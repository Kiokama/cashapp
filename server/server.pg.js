import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { query } from './db.pg.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, message: { error: 'Thao tác quá nhanh.' } });
app.use('/api/v1/', apiLimiter);

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const spaceRooms = new Map();

wss.on('connection', (ws, req) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'SUBSCRIBE_SPACE' && data.spaceId) {
        ws.spaceId = data.spaceId;
        if (!spaceRooms.has(data.spaceId)) spaceRooms.set(data.spaceId, new Set());
        spaceRooms.get(data.spaceId).add(ws);
        ws.send(JSON.stringify({ type: 'SUBSCRIBED', spaceId: data.spaceId }));
      }
    } catch (e) {}
  });
  ws.on('close', () => {
    if (ws.spaceId && spaceRooms.has(ws.spaceId)) spaceRooms.get(ws.spaceId).delete(ws);
  });
});

function broadcastToSpace(spaceId, eventType, payload) {
  const room = spaceRooms.get(spaceId);
  if (room) {
    const msg = JSON.stringify({ type: eventType, data: payload, timestamp: new Date().toISOString() });
    room.forEach((client) => { if (client.readyState === WebSocket.OPEN) client.send(msg); });
  }
}

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  // Format: jwt_access_token_userId_timestamp
  const raw = token.replace('jwt_access_token_', '');
  const lastUnderscore = raw.lastIndexOf('_');
  const userId = lastUnderscore !== -1 ? raw.substring(0, lastUnderscore) : raw;

  try {
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) return res.status(401).json({ error: 'User not found' });
    req.user = { id: rows[0].id, name: rows[0].full_name, email: rows[0].email, avatar: rows[0].avatar_url };
    next();
  } catch (err) {
    console.error('requireAuth error:', err);
    res.status(500).json({ error: 'Auth error' });
  }
};

// Middleware to validate spaceId param
const validateSpaceId = (req, res, next) => {
  const { spaceId } = req.params;
  if (!spaceId || spaceId === 'undefined' || spaceId === 'null' || spaceId.trim() === '') {
    return res.status(400).json({ error: 'Mã không gian chung (spaceId) không hợp lệ.' });
  }
  next();
};

app.get('/', (req, res) => res.json({ status: 'online (PostgreSQL)' }));

// 1. AUTH
app.post('/api/v1/auth/register', authLimiter, async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Email đã tồn tại' });
    
    const userId = `user-${uuidv4().substring(0, 8)}`;
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || email)}`;
    await query('INSERT INTO users(id, email, password_hash, full_name, avatar_url) VALUES($1, $2, $3, $4, $5)', 
      [userId, email, password, name || email, avatar]);
    
    // Auto-create a default space for newly registered user
    const spaceId = `space-${uuidv4().substring(0, 8)}`;
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    await query('INSERT INTO spaces(id, name, emoji, invite_code, created_by) VALUES($1, $2, $3, $4, $5)',
      [spaceId, 'Không gian chung', '💕', inviteCode, userId]);
    await query('INSERT INTO space_members(space_id, user_id, role) VALUES($1, $2, $3)', [spaceId, userId, 'ADMIN']);

    const token = `jwt_access_token_${userId}_${Date.now()}`;
    res.status(201).json({ status: 'success', token, user: { id: userId, name, email, avatar } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: err.message || 'DB Error' });
  }
});

app.post('/api/v1/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await query('SELECT * FROM users WHERE email = $1 AND password_hash = $2', [email, password]);
    if (rows.length === 0) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    const user = rows[0];
    const token = `jwt_access_token_${user.id}_${Date.now()}`;
    res.json({ status: 'success', token, user: { id: user.id, name: user.full_name, email: user.email, avatar: user.avatar_url } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message || 'DB Error' });
  }
});

app.get('/api/v1/users/me', requireAuth, (req, res) => {
  res.json(req.user);
});

// 2. SPACES
app.get('/api/v1/spaces', requireAuth, async (req, res) => {
  try {
    let { rows } = await query(`
      SELECT s.* FROM spaces s 
      JOIN space_members sm ON s.id = sm.space_id 
      WHERE sm.user_id = $1
    `, [req.user.id]);
    
    if (rows.length === 0) {
      const spaceId = `space-${uuidv4().substring(0, 8)}`;
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      await query('INSERT INTO spaces(id, name, emoji, invite_code, created_by) VALUES($1, $2, $3, $4, $5)',
        [spaceId, 'Không gian chung', '💕', inviteCode, req.user.id]);
      await query('INSERT INTO space_members(space_id, user_id, role) VALUES($1, $2, $3)', [spaceId, req.user.id, 'ADMIN']);
      
      const newSpaceRes = await query('SELECT * FROM spaces WHERE id = $1', [spaceId]);
      rows = newSpaceRes.rows;
    }

    // Get members for each space
    for (let space of rows) {
      const membersRes = await query('SELECT user_id FROM space_members WHERE space_id = $1', [space.id]);
      space.members = membersRes.rows.map(r => r.user_id);
    }
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'DB Error' }); }
});

app.post('/api/v1/spaces', requireAuth, async (req, res) => {
  const { name, emoji } = req.body;
  const spaceId = `space-${uuidv4().substring(0, 8)}`;
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  try {
    await query('INSERT INTO spaces(id, name, emoji, invite_code, created_by) VALUES($1, $2, $3, $4, $5)',
      [spaceId, name || 'Không gian chung', emoji || '💕', inviteCode, req.user.id]);
    await query('INSERT INTO space_members(space_id, user_id, role) VALUES($1, $2, $3)', [spaceId, req.user.id, 'ADMIN']);
    res.status(201).json({ spaceId, inviteCode, space: { id: spaceId, members: [req.user.id], inviteCode, name, emoji } });
  } catch (err) { res.status(500).json({ error: 'DB Error' }); }
});

app.post('/api/v1/spaces/join', requireAuth, async (req, res) => {
  const { inviteCode } = req.body;
  try {
    const spaceRes = await query('SELECT id FROM spaces WHERE invite_code = $1', [inviteCode]);
    if (spaceRes.rows.length === 0) return res.status(404).json({ error: 'Mã không tồn tại' });
    const spaceId = spaceRes.rows[0].id;
    
    const checkRes = await query('SELECT * FROM space_members WHERE space_id = $1 AND user_id = $2', [spaceId, req.user.id]);
    if (checkRes.rows.length === 0) {
      await query('INSERT INTO space_members(space_id, user_id) VALUES($1, $2)', [spaceId, req.user.id]);
    }
    res.json({ success: true, spaceId });
  } catch (err) { res.status(500).json({ error: 'DB Error' }); }
});

app.get('/api/v1/spaces/:spaceId', requireAuth, validateSpaceId, async (req, res) => {
  try {
    const spaceRes = await query('SELECT * FROM spaces WHERE id = $1', [req.params.spaceId]);
    if (spaceRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const space = spaceRes.rows[0];
    const memRes = await query('SELECT u.id, u.full_name as name, u.email, u.avatar_url as avatar FROM users u JOIN space_members sm ON u.id = sm.user_id WHERE sm.space_id = $1', [space.id]);
    space.memberDetails = memRes.rows;
    space.members = memRes.rows.map(m => m.id);
    res.json(space);
  } catch (err) { res.status(500).json({ error: 'DB Error' }); }
});

// 3. TRANSACTIONS
app.get('/api/v1/spaces/:spaceId/transactions', requireAuth, validateSpaceId, async (req, res) => {
  const { spaceId } = req.params;
  try {
    const { rows } = await query('SELECT * FROM transactions WHERE space_id = $1 AND is_deleted = false ORDER BY transaction_date DESC LIMIT 50', [spaceId]);
    
    // Map snake_case back to camelCase for frontend
    const mapped = rows.map(r => ({
      id: r.id,
      spaceId: r.space_id,
      amount: parseFloat(r.amount),
      description: r.description,
      category: r.category_id,
      date: r.transaction_date,
      paidBy: r.paid_by,
      isSettlement: r.is_settlement
    }));
    res.json({ content: mapped });
  } catch (err) { res.status(500).json({ error: 'DB Error' }); }
});

app.post('/api/v1/spaces/:spaceId/transactions', requireAuth, validateSpaceId, async (req, res) => {
  const { spaceId } = req.params;
  const { amount, description, categoryId, category, date, paidBy, splitType, isSettlement } = req.body;
  const txId = uuidv4();
  try {
    await query(`
      INSERT INTO transactions(id, space_id, amount, description, category_id, transaction_date, paid_by, split_type, is_settlement) 
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [txId, spaceId, amount, description || 'Giao dịch', categoryId || category || 'other', date || new Date().toISOString(), paidBy || req.user.id, splitType || 'SPLIT_EQUAL', !!isSettlement]);
    
    const newTx = { id: txId, spaceId, amount: parseFloat(amount), description, category: categoryId || category, date, paidBy, isSettlement };
    broadcastToSpace(spaceId, 'TRANSACTION_CREATED', { transaction: newTx, actor: req.user });
    res.status(201).json(newTx);
  } catch (err) { 
    console.error('Create transaction error:', err);
    res.status(500).json({ error: 'DB Error' }); 
  }
});

// ... Analytics and other endpoints can be added gradually. Returning placeholders for now.
app.get('/api/v1/spaces/:spaceId/analytics/trend', (req, res) => res.json([]));
app.get('/api/v1/spaces/:spaceId/budgets', (req, res) => res.json({}));
app.get('/api/v1/spaces/:spaceId/balances', (req, res) => res.json({}));
app.get('/api/v1/spaces/:spaceId/audit-logs', requireAuth, validateSpaceId, (req, res) => res.json([]));
app.get('/api/v1/notifications', (req, res) => res.json([]));

server.listen(PORT, () => {
  console.log(`🚀 CashApp PostgreSQL REST Server running at http://localhost:${PORT}`);
});
