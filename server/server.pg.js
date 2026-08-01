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

app.use(cors({ origin: true, credentials: true, optionsSuccessStatus: 200 }));
app.options('*', cors({ origin: true, credentials: true, optionsSuccessStatus: 200 }));
app.use(express.json());
app.use(cookieParser());

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: 'Thao tác quá nhanh. Vui lòng thử lại sau.' } });
app.use('/api/v1/', apiLimiter);

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const spaceRooms = new Map();

wss.on('connection', (ws, req) => {
  console.log('⚡ [WebSocket] Client connected');
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
    console.log('⚡ [WebSocket] Client disconnected');
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
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const ensureUserExists = async (userId, spaceId = null) => {
  if (!userId || userId === 'undefined' || userId === 'null') return 'user-minhanh';
  try {
    const userCheck = await query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      const cleanName = userId.startsWith('user-') ? userId.replace('user-', '') : 'Thành viên';
      const cleanEmail = `${userId.toLowerCase()}@cashapp.com`;
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`;
      await query(`
        INSERT INTO users (id, email, password_hash, full_name, avatar_url)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING
      `, [userId, cleanEmail, 'dev123456', cleanName, avatar]);
    }

    if (spaceId && spaceId !== 'undefined') {
      await query(`
        INSERT INTO space_members (space_id, user_id, role)
        VALUES ($1, $2, 'MEMBER')
        ON CONFLICT (space_id, user_id) DO NOTHING
      `, [spaceId, userId]);
    }
    return userId;
  } catch (err) {
    console.error('ensureUserExists error:', err);
    return userId;
  }
};

const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const raw = token.replace('jwt_access_token_', '');
  const lastUnderscore = raw.lastIndexOf('_');
  const userId = lastUnderscore !== -1 ? raw.substring(0, lastUnderscore) : raw;

  try {
    await ensureUserExists(userId);
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) return res.status(401).json({ error: 'User not found' });
    req.user = { id: rows[0].id, name: rows[0].full_name, email: rows[0].email, avatar: rows[0].avatar_url };
    next();
  } catch (err) {
    console.error('requireAuth error:', err);
    res.status(500).json({ error: 'Auth error' });
  }
};


const validateSpaceId = (req, res, next) => {
  const { spaceId } = req.params;
  if (!spaceId || spaceId === 'undefined' || spaceId === 'null' || spaceId.trim() === '') {
    return res.status(400).json({ error: 'Mã không gian chung (spaceId) không hợp lệ.' });
  }
  next();
};

const mapSplitType = (type) => {
  if (type === 'PERCENTAGE' || type === 'SPLIT_PERCENTAGE') return 'SPLIT_PERCENTAGE';
  if (type === 'EXACT' || type === 'SPLIT_EXACT') return 'SPLIT_EXACT';
  return 'SPLIT_EQUAL';
};

app.get('/', (req, res) => res.json({ status: 'online', engine: 'PostgreSQL', version: 'v1' }));

/* ==========================================================================
   1. AUTH & USERS (WITH DEV QUICK LOGIN)
   ========================================================================== */

app.post('/api/v1/auth/register', authLimiter, async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ email và mật khẩu' });
  }
  try {
    const existing = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Email đã được đăng ký tài khoản' });

    const userId = `user-${uuidv4().substring(0, 8)}`;
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || email)}`;
    await query('INSERT INTO users(id, email, password_hash, full_name, avatar_url) VALUES($1, $2, $3, $4, $5)', 
      [userId, email.toLowerCase(), password, name || email.split('@')[0], avatar]);

    const spaceId = `space-${uuidv4().substring(0, 8)}`;
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    await query('INSERT INTO spaces(id, name, emoji, invite_code, created_by) VALUES($1, $2, $3, $4, $5)',
      [spaceId, 'Không gian thương & yêu 💕', '💕', inviteCode, userId]);
    await query('INSERT INTO space_members(space_id, user_id, role) VALUES($1, $2, $3)', [spaceId, userId, 'ADMIN']);

    const token = `jwt_access_token_${userId}_${Date.now()}`;
    return res.status(201).json({ status: 'success', token, user: { id: userId, name: name || email.split('@')[0], email, avatar } });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: err.message || 'Lỗi cơ sở dữ liệu' });
  }
});

app.post('/api/v1/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email) return res.status(400).json({ error: 'Vui lòng nhập email' });
  try {
    const { rows } = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    
    const user = rows[0];
    if (password && user.password_hash && user.password_hash !== password) {
      return res.status(401).json({ error: 'Mật khẩu không chính xác' });
    }

    const token = `jwt_access_token_${user.id}_${Date.now()}`;
    return res.json({
      status: 'success',
      token,
      user: { id: user.id, name: user.full_name, email: user.email, avatar: user.avatar_url }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: err.message || 'Lỗi cơ sở dữ liệu' });
  }
});

/**
 * DEV QUICK LOGIN ENDPOINT
 * Allows 1-click dev authentication for testing both partners (Minh Anh & Thùy Linh) or Demo account
 */
app.post('/api/v1/auth/quick-login', authLimiter, async (req, res) => {
  const { account } = req.body; // 'minhanh', 'thuylinh', or 'demo'
  
  const devAccounts = {
    minhanh: {
      id: 'user-minhanh',
      email: 'minhanh@cashapp.com',
      name: 'Minh Anh',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MinhAnh'
    },
    thuylinh: {
      id: 'user-thuylinh',
      email: 'thuylinh@cashapp.com',
      name: 'Thùy Linh',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ThuyLinh'
    },
    demo: {
      id: 'user-demo',
      email: 'demo@cashapp.com',
      name: 'Khách Trải Nghiệm',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DemoUser'
    }
  };

  const target = devAccounts[account] || devAccounts.minhanh;

  try {
    for (const key of ['minhanh', 'thuylinh']) {
      const acc = devAccounts[key];
      await query(`
        INSERT INTO users (id, email, password_hash, full_name, avatar_url)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, avatar_url = EXCLUDED.avatar_url
      `, [acc.id, acc.email, 'dev123456', acc.name, acc.avatar]);
    }

    if (account === 'demo') {
      await query(`
        INSERT INTO users (id, email, password_hash, full_name, avatar_url)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, avatar_url = EXCLUDED.avatar_url
      `, [devAccounts.demo.id, devAccounts.demo.email, 'dev123456', devAccounts.demo.name, devAccounts.demo.avatar]);
    }

    const sharedSpaceId = 'space-demo-couple';
    await query(`
      INSERT INTO spaces (id, name, emoji, invite_code, created_by)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO NOTHING
    `, [sharedSpaceId, 'Không gian thương & yêu 💕', '💕', 'LOVE2026', 'user-minhanh']);

    await query(`
      INSERT INTO space_members (space_id, user_id, role)
      VALUES ($1, $2, $3), ($1, $4, $5)
      ON CONFLICT (space_id, user_id) DO NOTHING
    `, [sharedSpaceId, 'user-minhanh', 'ADMIN', 'user-thuylinh', 'MEMBER']);

    if (account === 'demo') {
      await query(`
        INSERT INTO space_members (space_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (space_id, user_id) DO NOTHING
      `, [sharedSpaceId, 'user-demo', 'MEMBER']);
    }

    const token = `jwt_access_token_${target.id}_${Date.now()}`;
    return res.json({
      status: 'success',
      token,
      user: { id: target.id, name: target.name, email: target.email, avatar: target.avatar }
    });
  } catch (err) {
    console.error('Quick login error:', err);
    return res.status(500).json({ error: err.message || 'DB Error' });
  }
});

app.get('/api/v1/users/me', requireAuth, (req, res) => {
  return res.json(req.user);
});

app.put('/api/v1/users/me', requireAuth, async (req, res) => {
  const { name, avatar, email } = req.body;
  try {
    const newName = name || req.user.name;
    const newAvatar = avatar || req.user.avatar;
    const newEmail = email || req.user.email;

    await query(`
      UPDATE users 
      SET full_name = $1, avatar_url = $2, email = $3, updated_at = NOW() 
      WHERE id = $4
    `, [newName, newAvatar, newEmail, req.user.id]);

    req.user.name = newName;
    req.user.avatar = newAvatar;
    req.user.email = newEmail;

    return res.json(req.user);
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'DB Error' });
  }
});

/* ==========================================================================
   2. SPACES API
   ========================================================================== */

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
        [spaceId, 'Không gian thương & yêu 💕', '💕', inviteCode, req.user.id]);
      await query('INSERT INTO space_members(space_id, user_id, role) VALUES($1, $2, $3)', [spaceId, req.user.id, 'ADMIN']);
      
      const newSpaceRes = await query('SELECT * FROM spaces WHERE id = $1', [spaceId]);
      rows = newSpaceRes.rows;
    }

    for (let space of rows) {
      const membersRes = await query('SELECT user_id FROM space_members WHERE space_id = $1', [space.id]);
      space.members = membersRes.rows.map(r => r.user_id);
    }
    return res.json(rows);
  } catch (err) {
    console.error('Get spaces error:', err);
    return res.status(500).json({ error: 'DB Error' });
  }
});

app.post('/api/v1/spaces', requireAuth, async (req, res) => {
  const { name, emoji } = req.body;
  const spaceId = `space-${uuidv4().substring(0, 8)}`;
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  try {
    await query('INSERT INTO spaces(id, name, emoji, invite_code, created_by) VALUES($1, $2, $3, $4, $5)',
      [spaceId, name || 'Không gian chung', emoji || '💕', inviteCode, req.user.id]);
    await query('INSERT INTO space_members(space_id, user_id, role) VALUES($1, $2, $3)', [spaceId, req.user.id, 'ADMIN']);
    return res.status(201).json({ spaceId, inviteCode, space: { id: spaceId, members: [req.user.id], inviteCode, name, emoji } });
  } catch (err) {
    console.error('Create space error:', err);
    return res.status(500).json({ error: 'DB Error' });
  }
});

app.post('/api/v1/spaces/join', requireAuth, async (req, res) => {
  const { inviteCode } = req.body;
  try {
    const spaceRes = await query('SELECT id FROM spaces WHERE UPPER(invite_code) = UPPER($1)', [inviteCode]);
    if (spaceRes.rows.length === 0) return res.status(404).json({ error: 'Mã mời không tồn tại hoặc đã hết hạn' });
    const spaceId = spaceRes.rows[0].id;
    
    await query(`
      INSERT INTO space_members(space_id, user_id, role) 
      VALUES($1, $2, 'MEMBER') 
      ON CONFLICT (space_id, user_id) DO NOTHING
    `, [spaceId, req.user.id]);

    return res.json({ success: true, spaceId });
  } catch (err) {
    console.error('Join space error:', err);
    return res.status(500).json({ error: 'DB Error' });
  }
});

app.get('/api/v1/spaces/:spaceId', requireAuth, validateSpaceId, async (req, res) => {
  try {
    const spaceRes = await query('SELECT * FROM spaces WHERE id = $1', [req.params.spaceId]);
    if (spaceRes.rows.length === 0) return res.status(404).json({ error: 'Space không tồn tại' });
    const space = spaceRes.rows[0];
    const memRes = await query(`
      SELECT u.id, u.full_name as name, u.email, u.avatar_url as avatar 
      FROM users u 
      JOIN space_members sm ON u.id = sm.user_id 
      WHERE sm.space_id = $1
    `, [space.id]);
    space.memberDetails = memRes.rows;
    space.members = memRes.rows.map(m => m.id);
    return res.json(space);
  } catch (err) {
    console.error('Get space error:', err);
    return res.status(500).json({ error: 'DB Error' });
  }
});

app.post('/api/v1/spaces/:spaceId/leave', requireAuth, validateSpaceId, async (req, res) => {
  try {
    await query('DELETE FROM space_members WHERE space_id = $1 AND user_id = $2', [req.params.spaceId, req.user.id]);
    return res.json({ success: true, message: 'Đã rời khỏi không gian chung' });
  } catch (err) {
    console.error('Leave space error:', err);
    return res.status(500).json({ error: 'DB Error' });
  }
});

/* ==========================================================================
   3. TRANSACTIONS CRUD API
   ========================================================================== */

app.get('/api/v1/spaces/:spaceId/transactions', requireAuth, validateSpaceId, async (req, res) => {
  const { spaceId } = req.params;
  const { startDate, endDate, categoryId, page = 0, size = 50 } = req.query;

  try {
    let sql = 'SELECT * FROM transactions WHERE space_id = $1 AND is_deleted = false';
    const params = [spaceId];

    if (categoryId && categoryId !== 'all') {
      params.push(categoryId);
      sql += ` AND category_id = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      sql += ` AND transaction_date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      sql += ` AND transaction_date <= $${params.length}`;
    }

    sql += ' ORDER BY transaction_date DESC';

    const { rows } = await query(sql, params);

    const txIds = rows.map(r => r.id);
    let splitMap = {};
    if (txIds.length > 0) {
      const splitRes = await query('SELECT * FROM split_details WHERE transaction_id = ANY($1)', [txIds]);
      splitRes.rows.forEach(sd => {
        if (!splitMap[sd.transaction_id]) splitMap[sd.transaction_id] = [];
        splitMap[sd.transaction_id].push(sd);
      });
    }

    const mapped = rows.map(r => {
      const sDetails = splitMap[r.id] || [];
      const splitsObj = {};
      sDetails.forEach(sd => {
        splitsObj[sd.user_id] = parseFloat(sd.owed_amount);
      });

      return {
        id: r.id,
        spaceId: r.space_id,
        amount: parseFloat(r.amount),
        description: r.description,
        category: r.category_id,
        date: r.transaction_date,
        paidBy: r.paid_by,
        splitType: r.split_type,
        isSettlement: r.is_settlement,
        isDeleted: r.is_deleted,
        splitDetails: sDetails.map(sd => ({
          userId: sd.user_id,
          owedAmount: parseFloat(sd.owed_amount),
          percentage: parseFloat(sd.percentage || 0)
        })),
        splits: splitsObj,
      };
    });

    const startIdx = parseInt(page) * parseInt(size);
    const paginated = mapped.slice(startIdx, startIdx + parseInt(size));

    return res.json({
      content: paginated,
      page: parseInt(page),
      size: parseInt(size),
      totalElements: mapped.length,
      totalPages: Math.ceil(mapped.length / parseInt(size)),
    });
  } catch (err) { 
    console.error('GET transactions error:', err);
    return res.status(500).json({ error: 'DB Error: ' + err.message }); 
  }
});

app.post('/api/v1/spaces/:spaceId/transactions', requireAuth, validateSpaceId, async (req, res) => {
  const { spaceId } = req.params;
  const { amount, description, categoryId, category, date, paidBy, splitType, splits, splitDetails, isSettlement } = req.body;

  const numAmount = parseFloat(amount);
  if (!numAmount || numAmount <= 0 || isNaN(numAmount)) {
    return res.status(400).json({ error: 'Số tiền giao dịch phải lớn hơn 0' });
  }

  let totalOwed = 0;
  if (splitDetails && Array.isArray(splitDetails) && splitDetails.length > 0) {
    totalOwed = splitDetails.reduce((sum, item) => sum + (parseFloat(item.owedAmount) || 0), 0);
  } else if (splits && Object.keys(splits).length > 0) {
    totalOwed = Object.values(splits).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  }

  if (!isSettlement && totalOwed > 0 && Math.abs(totalOwed - numAmount) > 1) {
    return res.status(400).json({
      error: `Lỗi Validate Backend: Tổng số tiền chia (${totalOwed.toLocaleString('vi-VN')}₫) không bằng tổng số tiền giao dịch (${numAmount.toLocaleString('vi-VN')}₫)`,
    });
  }

  const txId = uuidv4();
  const dbSplitType = mapSplitType(splitType);
  const txDate = date ? new Date(date).toISOString() : new Date().toISOString();
  let txPaidBy = paidBy || req.user.id;
  txPaidBy = await ensureUserExists(txPaidBy, spaceId);
  const txCat = categoryId || category || 'other';

  try {
    await query(`
      INSERT INTO transactions(id, space_id, amount, description, category_id, transaction_date, paid_by, split_type, is_settlement) 
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [txId, spaceId, numAmount, description || 'Giao dịch mới', txCat, txDate, txPaidBy, dbSplitType, !!isSettlement]);

    let finalSplitDetails = [];
    let splitsObj = splits || {};

    if (splitDetails && Array.isArray(splitDetails) && splitDetails.length > 0) {
      finalSplitDetails = splitDetails;
    } else if (splitsObj && Object.keys(splitsObj).length > 0) {
      finalSplitDetails = Object.entries(splitsObj).map(([uid, owed]) => ({
        userId: uid,
        owedAmount: parseFloat(owed) || 0,
        percentage: numAmount > 0 ? Math.round(((parseFloat(owed) || 0) / numAmount) * 100) : 0,
      }));
    } else {
      const memRes = await query('SELECT user_id FROM space_members WHERE space_id = $1', [spaceId]);
      const members = memRes.rows.map(r => r.user_id);
      const share = numAmount / (members.length || 1);
      finalSplitDetails = members.map(uid => ({
        userId: uid,
        owedAmount: share,
        percentage: members.length > 0 ? Math.round(100 / members.length) : 50,
      }));
    }

    for (const sd of finalSplitDetails) {
      const validUserId = await ensureUserExists(sd.userId, spaceId);
      await query(`
        INSERT INTO split_details(id, transaction_id, user_id, owed_amount, percentage)
        VALUES($1, $2, $3, $4, $5)
        ON CONFLICT (transaction_id, user_id) DO UPDATE SET owed_amount = EXCLUDED.owed_amount, percentage = EXCLUDED.percentage
      `, [uuidv4(), txId, validUserId, sd.owedAmount, sd.percentage || 0]);
      splitsObj[validUserId] = sd.owedAmount;
    }

    await query(`
      INSERT INTO audit_logs(id, transaction_id, user_id, action_type, description)
      VALUES($1, $2, $3, 'CREATED', $4)
    `, [uuidv4(), txId, req.user.id, description || 'Tạo giao dịch mới']);

    const newTx = {
      id: txId,
      spaceId,
      amount: numAmount,
      description: description || 'Giao dịch mới',
      category: txCat,
      date: txDate,
      paidBy: txPaidBy,
      splitType: dbSplitType,
      isSettlement: !!isSettlement,
      splitDetails: finalSplitDetails,
      splits: splitsObj,
    };

    broadcastToSpace(spaceId, 'TRANSACTION_CREATED', {
      transaction: newTx,
      actor: req.user,
      message: `${req.user.name} vừa thêm giao dịch: "${newTx.description}" (${newTx.amount.toLocaleString('vi-VN')}₫)`
    });

    return res.status(201).json(newTx);
  } catch (err) { 
    console.error('Create transaction error:', err);
    return res.status(500).json({ error: 'Lỗi cơ sở dữ liệu: ' + err.message }); 
  }
});

app.put('/api/v1/spaces/:spaceId/transactions/:transactionId', requireAuth, validateSpaceId, async (req, res) => {
  const { spaceId, transactionId } = req.params;
  const { amount, description, category, date, paidBy, splitType, splits, splitDetails } = req.body;

  try {
    const txRes = await query('SELECT * FROM transactions WHERE id = $1 AND space_id = $2 AND is_deleted = false', [transactionId, spaceId]);
    if (txRes.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy giao dịch' });

    const oldTx = txRes.rows[0];
    const newAmount = amount !== undefined ? parseFloat(amount) : parseFloat(oldTx.amount);

    if (amount !== undefined && (newAmount <= 0 || isNaN(newAmount))) {
      return res.status(400).json({ error: 'Số tiền giao dịch phải lớn hơn 0' });
    }

    let totalOwed = 0;
    if (splitDetails && Array.isArray(splitDetails) && splitDetails.length > 0) {
      totalOwed = splitDetails.reduce((sum, item) => sum + (parseFloat(item.owedAmount) || 0), 0);
    } else if (splits && Object.keys(splits).length > 0) {
      totalOwed = Object.values(splits).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    }

    if (!oldTx.is_settlement && totalOwed > 0 && Math.abs(totalOwed - newAmount) > 1) {
      return res.status(400).json({
        error: `Lỗi Validate Backend: Tổng số tiền chia (${totalOwed.toLocaleString('vi-VN')}₫) không bằng tổng số tiền giao dịch (${newAmount.toLocaleString('vi-VN')}₫)`,
      });
    }

    const newDesc = description !== undefined ? description : oldTx.description;
    const newCat = category !== undefined ? category : oldTx.category_id;
    const newDate = date ? new Date(date).toISOString() : oldTx.transaction_date;
    let newPaidBy = paidBy || oldTx.paid_by;
    newPaidBy = await ensureUserExists(newPaidBy, spaceId);
    const dbSplitType = splitType ? mapSplitType(splitType) : oldTx.split_type;

    await query(`
      UPDATE transactions 
      SET amount = $1, description = $2, category_id = $3, transaction_date = $4, paid_by = $5, split_type = $6, updated_at = NOW()
      WHERE id = $7 AND space_id = $8
    `, [newAmount, newDesc, newCat, newDate, newPaidBy, dbSplitType, transactionId, spaceId]);

    let finalSplitDetails = [];
    let splitsObj = splits || {};

    if (splitDetails && Array.isArray(splitDetails) && splitDetails.length > 0) {
      finalSplitDetails = splitDetails;
    } else if (splitsObj && Object.keys(splitsObj).length > 0) {
      finalSplitDetails = Object.entries(splitsObj).map(([uid, owed]) => ({
        userId: uid,
        owedAmount: parseFloat(owed) || 0,
        percentage: newAmount > 0 ? Math.round(((parseFloat(owed) || 0) / newAmount) * 100) : 0,
      }));
    }

    if (finalSplitDetails.length > 0) {
      await query('DELETE FROM split_details WHERE transaction_id = $1', [transactionId]);
      for (const sd of finalSplitDetails) {
        const validUserId = await ensureUserExists(sd.userId, spaceId);
        await query(`
          INSERT INTO split_details(id, transaction_id, user_id, owed_amount, percentage)
          VALUES($1, $2, $3, $4, $5)
        `, [uuidv4(), transactionId, validUserId, sd.owedAmount, sd.percentage || 0]);
        splitsObj[validUserId] = sd.owedAmount;
      }
    }

    await query(`
      INSERT INTO audit_logs(id, transaction_id, user_id, action_type, description)
      VALUES($1, $2, $3, 'EDITED', $4)
    `, [uuidv4(), transactionId, req.user.id, `Cập nhật giao dịch: ${newDesc}`]);

    const updatedTx = {
      id: transactionId,
      spaceId,
      amount: newAmount,
      description: newDesc,
      category: newCat,
      date: newDate,
      paidBy: newPaidBy,
      splitType: dbSplitType,
      isSettlement: oldTx.is_settlement,
      splitDetails: finalSplitDetails,
      splits: splitsObj,
    };

    broadcastToSpace(spaceId, 'TRANSACTION_UPDATED', {
      transaction: updatedTx,
      actor: req.user,
      message: `${req.user.name} vừa cập nhật giao dịch "${newDesc}"`
    });

    return res.json(updatedTx);
  } catch (err) {
    console.error('Update transaction error:', err);
    return res.status(500).json({ error: 'Lỗi cơ sở dữ liệu: ' + err.message });
  }
});

app.delete('/api/v1/spaces/:spaceId/transactions/:transactionId', requireAuth, validateSpaceId, async (req, res) => {
  const { spaceId, transactionId } = req.params;

  try {
    const txRes = await query('SELECT * FROM transactions WHERE id = $1 AND space_id = $2', [transactionId, spaceId]);
    if (txRes.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy giao dịch' });

    await query('UPDATE transactions SET is_deleted = true, updated_at = NOW() WHERE id = $1 AND space_id = $2', [transactionId, spaceId]);

    await query(`
      INSERT INTO audit_logs(id, transaction_id, user_id, action_type, description)
      VALUES($1, $2, $3, 'DELETED', $4)
    `, [uuidv4(), transactionId, req.user.id, 'Xóa giao dịch']);

    broadcastToSpace(spaceId, 'TRANSACTION_DELETED', {
      transactionId,
      actor: req.user,
      message: `${req.user.name} đã xóa 1 giao dịch`
    });

    return res.json({ message: 'Đã xóa giao dịch thành công' });
  } catch (err) {
    console.error('Delete transaction error:', err);
    return res.status(500).json({ error: 'Lỗi cơ sở dữ liệu: ' + err.message });
  }
});

/* ==========================================================================
   4. BALANCES & SETTLEMENTS API
   ========================================================================== */

app.get('/api/v1/spaces/:spaceId/balances', requireAuth, validateSpaceId, async (req, res) => {
  const { spaceId } = req.params;
  try {
    const memRes = await query('SELECT user_id FROM space_members WHERE space_id = $1', [spaceId]);
    const members = memRes.rows.map(r => r.user_id);
    const balanceMap = {};
    members.forEach(id => { balanceMap[id] = 0; });

    const txRes = await query('SELECT * FROM transactions WHERE space_id = $1 AND is_deleted = false', [spaceId]);
    const txIds = txRes.rows.map(r => r.id);

    let splitMap = {};
    if (txIds.length > 0) {
      const splitRes = await query('SELECT * FROM split_details WHERE transaction_id = ANY($1)', [txIds]);
      splitRes.rows.forEach(sd => {
        if (!splitMap[sd.transaction_id]) splitMap[sd.transaction_id] = [];
        splitMap[sd.transaction_id].push(sd);
      });
    }

    txRes.rows.forEach(t => {
      const paidBy = t.paid_by;
      const sDetails = splitMap[t.id] || [];

      if (sDetails.length > 0) {
        sDetails.forEach(sd => {
          const owed = parseFloat(sd.owed_amount) || 0;
          if (sd.user_id !== paidBy) {
            balanceMap[paidBy] = (balanceMap[paidBy] || 0) + owed;
            balanceMap[sd.user_id] = (balanceMap[sd.user_id] || 0) - owed;
          }
        });
      } else {
        const half = (parseFloat(t.amount) || 0) / (members.length || 1);
        members.forEach(mId => {
          if (mId !== paidBy) {
            balanceMap[paidBy] = (balanceMap[paidBy] || 0) + half;
            balanceMap[mId] = (balanceMap[mId] || 0) - half;
          }
        });
      }
    });

    return res.json(balanceMap);
  } catch (err) {
    console.error('Get balances error:', err);
    return res.status(500).json({ error: 'DB Error: ' + err.message });
  }
});

app.post('/api/v1/spaces/:spaceId/settlements', requireAuth, validateSpaceId, async (req, res) => {
  const { spaceId } = req.params;
  const { payerId, receiverId, amount } = req.body;

  if (!amount || amount <= 0) return res.status(400).json({ error: 'Số tiền cấn trừ phải lớn hơn 0' });

  const txId = uuidv4();
  const txDate = new Date().toISOString();

  try {
    await query(`
      INSERT INTO transactions(id, space_id, amount, description, category_id, transaction_date, paid_by, split_type, is_settlement) 
      VALUES($1, $2, $3, $4, 'other', $5, $6, 'SPLIT_EXACT', true)
    `, [txId, spaceId, amount, 'Thanh toán cấn trừ', txDate, payerId]);

    await query(`
      INSERT INTO split_details(id, transaction_id, user_id, owed_amount, percentage)
      VALUES($1, $2, $3, $4, 100)
    `, [uuidv4(), txId, receiverId, amount]);

    const settlementTx = {
      id: txId,
      spaceId,
      amount: parseFloat(amount),
      description: 'Thanh toán cấn trừ',
      category: 'other',
      date: txDate,
      paidBy: payerId,
      splitType: 'SPLIT_EXACT',
      isSettlement: true,
      splitDetails: [{ userId: receiverId, owedAmount: parseFloat(amount), percentage: 100 }],
      splits: { [receiverId]: parseFloat(amount) },
    };

    broadcastToSpace(spaceId, 'SETTLEMENT_CREATED', {
      transaction: settlementTx,
      actor: req.user,
      message: `${req.user.name} đã thực hiện cấn trừ thanh toán ${parseFloat(amount).toLocaleString('vi-VN')}₫`
    });

    return res.status(201).json(settlementTx);
  } catch (err) {
    console.error('Create settlement error:', err);
    return res.status(500).json({ error: 'DB Error: ' + err.message });
  }
});

/* ==========================================================================
   5. ANALYTICS & BUDGETS API
   ========================================================================== */

app.get('/api/v1/spaces/:spaceId/analytics/category-summary', requireAuth, validateSpaceId, async (req, res) => {
  const { spaceId } = req.params;
  const now = new Date();
  const month = req.query.month !== undefined ? parseInt(req.query.month) : now.getMonth();
  const year = req.query.year !== undefined ? parseInt(req.query.year) : now.getFullYear();

  try {
    const { rows } = await query(`
      SELECT category_id, SUM(amount) as total
      FROM transactions
      WHERE space_id = $1 AND is_settlement = false AND is_deleted = false
        AND EXTRACT(MONTH FROM transaction_date) = $2
        AND EXTRACT(YEAR FROM transaction_date) = $3
      GROUP BY category_id
    `, [spaceId, month + 1, year]);

    let totalAmount = 0;
    const categories = rows.map(r => {
      const amt = parseFloat(r.total);
      totalAmount += amt;
      return { categoryId: r.category_id, amount: amt };
    });

    categories.forEach(c => {
      c.percentage = totalAmount > 0 ? Math.round((c.amount / totalAmount) * 100) : 0;
    });

    return res.json({ month, year, totalAmount, categories });
  } catch (err) {
    console.error('Category summary error:', err);
    return res.status(500).json({ error: 'DB Error' });
  }
});

app.get('/api/v1/spaces/:spaceId/analytics/trend', requireAuth, validateSpaceId, async (req, res) => {
  const { spaceId } = req.params;
  const numMonths = parseInt(req.query.months) || 6;
  const now = new Date();

  try {
    const result = [];
    for (let i = numMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();

      const { rows } = await query(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE space_id = $1 AND is_settlement = false AND is_deleted = false
          AND EXTRACT(MONTH FROM transaction_date) = $2
          AND EXTRACT(YEAR FROM transaction_date) = $3
      `, [spaceId, m + 1, y]);

      result.push({
        monthLabel: `Thg ${m + 1}`,
        year: y,
        month: m,
        totalAmount: parseFloat(rows[0]?.total || 0),
      });
    }
    return res.json(result);
  } catch (err) {
    console.error('Trend analytics error:', err);
    return res.status(500).json({ error: 'DB Error' });
  }
});

app.get('/api/v1/spaces/:spaceId/budgets', requireAuth, validateSpaceId, async (req, res) => {
  const { spaceId } = req.params;
  try {
    const { rows } = await query('SELECT category_id, monthly_limit FROM budgets WHERE space_id = $1', [spaceId]);
    const budgetMap = {};
    rows.forEach(r => { budgetMap[r.category_id] = parseFloat(r.monthly_limit); });
    return res.json(budgetMap);
  } catch (err) {
    console.error('Get budgets error:', err);
    return res.status(500).json({ error: 'DB Error' });
  }
});

app.put('/api/v1/spaces/:spaceId/budgets/:categoryId', requireAuth, validateSpaceId, async (req, res) => {
  const { spaceId, categoryId } = req.params;
  const { amount } = req.body;

  try {
    const limit = parseFloat(amount) || 0;
    await query(`
      INSERT INTO budgets(id, space_id, category_id, monthly_limit)
      VALUES($1, $2, $3, $4)
      ON CONFLICT (space_id, category_id) DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit, updated_at = NOW()
    `, [uuidv4(), spaceId, categoryId, limit]);

    return res.json({ categoryId, amount: limit });
  } catch (err) {
    console.error('Update budget error:', err);
    return res.status(500).json({ error: 'DB Error' });
  }
});

/* ==========================================================================
   6. AUDIT LOGS & NOTIFICATIONS API
   ========================================================================== */

app.get('/api/v1/spaces/:spaceId/audit-logs', requireAuth, validateSpaceId, async (req, res) => {
  const { spaceId } = req.params;
  try {
    const { rows } = await query(`
      SELECT al.*, u.full_name as user_name, u.avatar_url 
      FROM audit_logs al
      JOIN transactions t ON al.transaction_id = t.id
      JOIN users u ON al.user_id = u.id
      WHERE t.space_id = $1
      ORDER BY al.created_at DESC
      LIMIT 50
    `, [spaceId]);

    const mapped = rows.map(r => ({
      id: r.id,
      transactionId: r.transaction_id,
      action: r.action_type ? r.action_type.toLowerCase() : 'created',
      userId: r.user_id,
      timestamp: r.created_at,
      description: r.description,
      user: { id: r.user_id, name: r.user_name, avatar: r.avatar_url }
    }));

    return res.json(mapped);
  } catch (err) {
    console.error('Audit logs error:', err);
    return res.status(500).json({ error: 'DB Error' });
  }
});

app.get('/api/v1/notifications', requireAuth, (req, res) => {
  return res.json([]);
});

server.listen(PORT, () => {
  console.log(`🚀 CashApp PostgreSQL REST & WebSocket Server running at http://localhost:${PORT}`);
});
