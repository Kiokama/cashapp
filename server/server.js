import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { createInitialDB } from './db.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Support reverse proxy (Render, Vercel, Nginx) for rate-limiting & IP tracking
app.set('trust proxy', 1);

// Security & Middlewares
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// SECURITY: Rate Limiting to prevent API brute-force & spam attacks
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Quá nhiều yêu cầu từ IP này. Vui lòng thử lại sau 15 phút.' },
});

// Strict rate limiter for Auth login attempts
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit to 10 login attempts per minute
  message: { error: 'Thao tác quá nhanh. Vui lòng đợi 1 phút.' },
});

app.use('/api/v1/', apiLimiter);

// Create HTTP server & attach WebSocket Server
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Active WebSocket connections map: spaceId -> Set of sockets
const spaceRooms = new Map();

wss.on('connection', (ws, req) => {
  console.log('⚡ [WebSocket] Client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'SUBSCRIBE_SPACE' && data.spaceId) {
        ws.spaceId = data.spaceId;
        if (!spaceRooms.has(data.spaceId)) {
          spaceRooms.set(data.spaceId, new Set());
        }
        spaceRooms.get(data.spaceId).add(ws);
        console.log(`⚡ [WebSocket] Client subscribed to room space: ${data.spaceId}`);
        ws.send(JSON.stringify({ type: 'SUBSCRIBED', spaceId: data.spaceId }));
      }
    } catch (e) {
      console.error('WebSocket message parse error:', e);
    }
  });

  ws.on('close', () => {
    if (ws.spaceId && spaceRooms.has(ws.spaceId)) {
      spaceRooms.get(ws.spaceId).delete(ws);
    }
    console.log('⚡ [WebSocket] Client disconnected');
  });
});

// Broadcast event helper
function broadcastToSpace(spaceId, eventType, payload) {
  const room = spaceRooms.get(spaceId);
  if (room) {
    const msg = JSON.stringify({ type: eventType, data: payload, timestamp: new Date().toISOString() });
    room.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }
}

// Initialize Database
const db = createInitialDB();

// Middleware: Logger & Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Middleware: Auth check
const requireAuth = (req, res, next) => {
  req.user = db.currentUser;
  next();
};

// Root Health Check Route
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: '🚀 CashApp API Server is running!',
    docs: '/api/v1',
  });
});

/* ==========================================================================
   1. Nhóm API Xác thực & Người dùng (Auth & Users) + Advanced Security Tokens
   ========================================================================== */

/**
 * POST /api/v1/auth/register
 * Body: { name, email, password }
 */
app.post('/api/v1/auth/register', authLimiter, (req, res) => {
  const { name, email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ Email và Mật khẩu' });
  }

  // Check existing
  const existing = Object.values(db.users).find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'Email này đã được đăng ký tài khoản' });
  }

  const userId = `user-${uuidv4().substring(0, 8)}`;
  const newUser = {
    id: userId,
    name: name || email.split('@')[0],
    email,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || email)}`,
  };

  db.users[userId] = newUser;
  db.currentUser = newUser;

  const accessToken = `jwt_access_token_${newUser.id}_${Date.now()}`;
  const refreshToken = `jwt_refresh_token_${newUser.id}_${Date.now()}`;

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.status(201).json({
    status: 'success',
    token: accessToken,
    user: newUser,
  });
});

/**
 * POST /api/v1/auth/login
 * Sets HttpOnly Secure Refresh Cookie + Returns Short-lived Access Token
 */
app.post('/api/v1/auth/login', authLimiter, (req, res) => {
  const { email } = req.body;
  let user = Object.values(db.users).find(u => u.email.toLowerCase() === (email || '').toLowerCase());
  
  if (!user) {
    return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
  }

  const accessToken = `jwt_access_token_${user.id}_${Date.now()}`;
  const refreshToken = `jwt_refresh_token_${user.id}_${Date.now()}`;

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return res.json({
    status: 'success',
    token: accessToken,
    user,
  });
});

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using HttpOnly cookie
 */
app.post('/api/v1/auth/refresh', (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token không hợp lệ hoặc đã hết hạn' });
  }

  // Extract userId from token (format: jwt_refresh_token_user-xxx_timestamp)
  const parts = refreshToken.split('_');
  const userId = parts[3];
  const user = db.users[userId];
  
  if (!user) {
    return res.status(401).json({ error: 'Người dùng không tồn tại' });
  }

  const newAccessToken = `jwt_access_token_${user.id}_${Date.now()}`;
  return res.json({ token: newAccessToken });
});

/**
 * POST /api/v1/auth/logout
 */
app.post('/api/v1/auth/logout', (req, res) => {
  res.clearCookie('refreshToken');
  return res.json({ success: true });
});

app.get('/api/v1/users/me', requireAuth, (req, res) => {
  return res.json(req.user);
});

app.put('/api/v1/users/me', requireAuth, (req, res) => {
  const { name, avatar, email } = req.body;
  if (name) req.user.name = name;
  if (avatar) req.user.avatar = avatar;
  if (email) req.user.email = email;

  db.users[req.user.id] = req.user;
  return res.json(req.user);
});

/* ==========================================================================
   2. Nhóm API Không gian chung (Shared Spaces)
   ========================================================================== */

app.get('/api/v1/spaces', requireAuth, (req, res) => {
  const userSpaces = Object.values(db.spaces).filter(s => s.members.includes(req.user.id));
  return res.json(userSpaces);
});

app.post('/api/v1/spaces', requireAuth, (req, res) => {
  const { name, emoji } = req.body;
  const newSpace = {
    id: `space-${uuidv4().substring(0, 8)}`,
    name: name || 'Không gian chung',
    emoji: emoji || '💕',
    inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
    members: [req.user.id],
    createdAt: new Date().toISOString(),
    budgets: {},
  };

  db.spaces[newSpace.id] = newSpace;
  return res.status(201).json({
    spaceId: newSpace.id,
    inviteCode: newSpace.inviteCode,
    space: newSpace,
  });
});

app.post('/api/v1/spaces/join', requireAuth, (req, res) => {
  const { inviteCode } = req.body;
  const space = Object.values(db.spaces).find(s => s.inviteCode === (inviteCode || '').toUpperCase());

  if (!space) {
    return res.status(404).json({ error: 'Mã mời không tồn tại hoặc đã hết hạn' });
  }

  if (!space.members.includes(req.user.id)) {
    space.members.push(req.user.id);
  }

  return res.json(space);
});

app.get('/api/v1/spaces/:spaceId', requireAuth, (req, res) => {
  const { spaceId } = req.params;
  const space = db.spaces[spaceId];

  if (!space) {
    return res.status(404).json({ error: 'Space không tồn tại' });
  }

  const memberDetails = space.members.map(id => db.users[id]).filter(Boolean);
  return res.json({
    ...space,
    memberDetails,
  });
});

/* ==========================================================================
   3. Nhóm API Giao dịch (Transactions) - Core Logic & Real-time Trigger
   ========================================================================== */

app.get('/api/v1/spaces/:spaceId/transactions', requireAuth, (req, res) => {
  const { spaceId } = req.params;
  const { startDate, endDate, categoryId, page = 0, size = 50 } = req.query;

  let list = db.transactions.filter(t => t.spaceId === spaceId && !t.isDeleted);

  if (categoryId && categoryId !== 'all') {
    list = list.filter(t => t.category === categoryId);
  }

  if (startDate) {
    list = list.filter(t => new Date(t.date) >= new Date(startDate));
  }

  if (endDate) {
    list = list.filter(t => new Date(t.date) <= new Date(endDate));
  }

  list.sort((a, b) => new Date(b.date) - new Date(a.date));

  const startIdx = parseInt(page) * parseInt(size);
  const paginated = list.slice(startIdx, startIdx + parseInt(size));

  return res.json({
    content: paginated,
    page: parseInt(page),
    size: parseInt(size),
    totalElements: list.length,
    totalPages: Math.ceil(list.length / parseInt(size)),
  });
});

app.post('/api/v1/spaces/:spaceId/transactions', requireAuth, (req, res) => {
  const { spaceId } = req.params;
  const { amount, description, categoryId, category, transactionDate, date, paidBy, splitType, splitDetails, splits, isSettlement } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Số tiền giao dịch phải lớn hơn 0' });
  }

  let finalDetails = splitDetails;
  let totalOwed = 0;

  if (splitDetails && Array.isArray(splitDetails)) {
    totalOwed = splitDetails.reduce((sum, item) => sum + (parseFloat(item.owedAmount) || 0), 0);
  } else if (splits) {
    totalOwed = Object.values(splits).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  }

  if (!isSettlement && Math.abs(totalOwed - amount) > 1) {
    return res.status(400).json({
      error: `Lỗi Validate Backend: Tổng số tiền chia (${totalOwed.toLocaleString()}₫) không bằng tổng số tiền giao dịch (${amount.toLocaleString()}₫)`,
    });
  }

  const newTx = {
    id: uuidv4(),
    spaceId,
    amount: parseFloat(amount),
    description: description || 'Giao dịch mới',
    category: categoryId || category || 'other',
    date: transactionDate || date || new Date().toISOString(),
    paidBy: paidBy || req.user.id,
    splitType: splitType || 'SPLIT_EQUAL',
    splitDetails: finalDetails || [],
    splits: splits || {},
    isSettlement: !!isSettlement,
    isDeleted: false,
    createdAt: new Date().toISOString(),
  };

  db.transactions.unshift(newTx);

  db.auditLog.unshift({
    id: uuidv4(),
    transactionId: newTx.id,
    action: 'created',
    userId: req.user.id,
    timestamp: newTx.createdAt,
    changes: null,
    description: newTx.description,
  });

  // REAL-TIME WEBSOCKET BROADCAST: Notify partner in real-time
  broadcastToSpace(spaceId, 'TRANSACTION_CREATED', {
    transaction: newTx,
    actor: req.user,
    message: `${req.user.name} vừa thêm giao dịch: "${newTx.description}" (${newTx.amount.toLocaleString('vi-VN')}₫)`,
  });

  return res.status(201).json(newTx);
});

app.put('/api/v1/spaces/:spaceId/transactions/:transactionId', requireAuth, (req, res) => {
  const { spaceId, transactionId } = req.params;
  const index = db.transactions.findIndex(t => t.id === transactionId && t.spaceId === spaceId);

  if (index === -1) {
    return res.status(404).json({ error: 'Không tìm thấy giao dịch' });
  }

  const oldTx = db.transactions[index];
  const updates = req.body;

  const updatedTx = {
    ...oldTx,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  db.transactions[index] = updatedTx;

  db.auditLog.unshift({
    id: uuidv4(),
    transactionId,
    action: 'edited',
    userId: req.user.id,
    timestamp: new Date().toISOString(),
    changes: {
      amount: oldTx.amount !== updatedTx.amount ? { from: oldTx.amount, to: updatedTx.amount } : null,
    },
    description: updatedTx.description,
  });

  // REAL-TIME WEBSOCKET BROADCAST
  broadcastToSpace(spaceId, 'TRANSACTION_UPDATED', {
    transaction: updatedTx,
    actor: req.user,
    message: `${req.user.name} đã cập nhật giao dịch: "${updatedTx.description}"`,
  });

  return res.json(updatedTx);
});

app.delete('/api/v1/spaces/:spaceId/transactions/:transactionId', requireAuth, (req, res) => {
  const { spaceId, transactionId } = req.params;
  const tx = db.transactions.find(t => t.id === transactionId && t.spaceId === spaceId);

  if (!tx) {
    return res.status(404).json({ error: 'Không tìm thấy giao dịch' });
  }

  tx.isDeleted = true;

  db.auditLog.unshift({
    id: uuidv4(),
    transactionId,
    action: 'deleted',
    userId: req.user.id,
    timestamp: new Date().toISOString(),
    changes: null,
    description: tx.description,
  });

  // REAL-TIME WEBSOCKET BROADCAST
  broadcastToSpace(spaceId, 'TRANSACTION_DELETED', {
    transactionId,
    actor: req.user,
    message: `${req.user.name} đã xóa 1 giao dịch`,
  });

  return res.json({ message: 'Đã xóa giao dịch thành công (Soft delete)' });
});

/* ==========================================================================
   4. Nhóm API Cấn trừ & Thanh toán (Settle Up & Balances)
   ========================================================================== */

app.get('/api/v1/spaces/:spaceId/balances', requireAuth, (req, res) => {
  const { spaceId } = req.params;
  const space = db.spaces[spaceId];

  if (!space) {
    return res.status(404).json({ error: 'Space không tồn tại' });
  }

  const [userA, userB] = space.members;
  let netBalanceUserA = 0;

  db.transactions
    .filter(t => t.spaceId === spaceId && !t.isDeleted)
    .forEach(t => {
      let shareA = 0;
      let shareB = 0;

      if (t.splitDetails && t.splitDetails.length > 0) {
        const itemA = t.splitDetails.find(d => d.userId === userA);
        const itemB = t.splitDetails.find(d => d.userId === userB);
        shareA = itemA ? itemA.owedAmount : 0;
        shareB = itemB ? itemB.owedAmount : 0;
      } else if (t.splits) {
        shareA = t.splits[userA] || 0;
        shareB = t.splits[userB] || 0;
      } else {
        shareA = t.amount / 2;
        shareB = t.amount / 2;
      }

      if (t.paidBy === userA) {
        netBalanceUserA += shareB;
      } else if (t.paidBy === userB) {
        netBalanceUserA -= shareA;
      }
    });

  return res.json({
    [userA]: netBalanceUserA,
    [userB]: -netBalanceUserA,
  });
});

app.post('/api/v1/spaces/:spaceId/settlements', requireAuth, (req, res) => {
  const { spaceId } = req.params;
  const { payerId, receiverId, amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Số tiền thanh toán phải lớn hơn 0' });
  }

  const settlementTx = {
    id: uuidv4(),
    spaceId,
    amount: parseFloat(amount),
    description: 'Thanh toán cấn trừ',
    category: 'other',
    date: new Date().toISOString(),
    paidBy: payerId,
    splitType: 'SPLIT_EXACT',
    splitDetails: [
      { userId: payerId, owedAmount: 0, percentage: 0 },
      { userId: receiverId, owedAmount: parseFloat(amount), percentage: 100 },
    ],
    splits: {
      [payerId]: 0,
      [receiverId]: parseFloat(amount),
    },
    isSettlement: true,
    isDeleted: false,
    createdAt: new Date().toISOString(),
  };

  db.transactions.unshift(settlementTx);

  // REAL-TIME WEBSOCKET BROADCAST
  broadcastToSpace(spaceId, 'SETTLEMENT_CREATED', {
    transaction: settlementTx,
    actor: req.user,
    message: `${req.user.name} đã thực hiện thanh toán cấn trừ ${parseFloat(amount).toLocaleString('vi-VN')}₫`,
  });

  return res.status(201).json(settlementTx);
});

/* ==========================================================================
   5. Nhóm API Thống kê & Ngân sách (Analytics & Budgets)
   ========================================================================== */

app.get('/api/v1/spaces/:spaceId/analytics/category-summary', requireAuth, (req, res) => {
  const { spaceId } = req.params;
  const now = new Date();
  const month = req.query.month !== undefined ? parseInt(req.query.month) : now.getMonth();
  const year = req.query.year !== undefined ? parseInt(req.query.year) : now.getFullYear();

  const monthTxs = db.transactions.filter(t => {
    if (t.spaceId !== spaceId || t.isSettlement || t.isDeleted) return false;
    const d = new Date(t.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const categoryTotals = {};
  let totalAmount = 0;

  monthTxs.forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    totalAmount += t.amount;
  });

  const categories = Object.entries(categoryTotals).map(([categoryId, amount]) => ({
    categoryId,
    amount,
    percentage: totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0,
  }));

  return res.json({
    month,
    year,
    totalAmount,
    categories,
  });
});

app.get('/api/v1/spaces/:spaceId/analytics/trend', requireAuth, (req, res) => {
  const { spaceId } = req.params;
  const numMonths = parseInt(req.query.months) || 6;
  const now = new Date();

  const result = [];
  for (let i = numMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();

    const monthTxs = db.transactions.filter(t => {
      if (t.spaceId !== spaceId || t.isSettlement || t.isDeleted) return false;
      const tDate = new Date(t.date);
      return tDate.getMonth() === m && tDate.getFullYear() === y;
    });

    const total = monthTxs.reduce((sum, t) => sum + t.amount, 0);
    result.push({
      monthLabel: `Thg ${m + 1}`,
      year: y,
      month: m,
      totalAmount: total,
    });
  }

  return res.json(result);
});

app.get('/api/v1/spaces/:spaceId/budgets', requireAuth, (req, res) => {
  const { spaceId } = req.params;
  const space = db.spaces[spaceId];

  if (!space) {
    return res.status(404).json({ error: 'Space không tồn tại' });
  }

  return res.json(space.budgets || {});
});

app.put('/api/v1/spaces/:spaceId/budgets/:categoryId', requireAuth, (req, res) => {
  const { spaceId, categoryId } = req.params;
  const { amount } = req.body;
  const space = db.spaces[spaceId];

  if (!space) {
    return res.status(404).json({ error: 'Space không tồn tại' });
  }

  space.budgets = space.budgets || {};
  space.budgets[categoryId] = parseFloat(amount) || 0;

  return res.json({
    categoryId,
    amount: space.budgets[categoryId],
  });
});

/* ==========================================================================
   6. Nhóm API Lịch sử Biến động & Thông báo (Audit Logs & Notifications)
   ========================================================================== */

/**
 * GET /api/v1/spaces/:spaceId/audit-logs
 */
app.get('/api/v1/spaces/:spaceId/audit-logs', requireAuth, (req, res) => {
  const { spaceId } = req.params;
  const logs = (db.auditLog || []).map(log => ({
    ...log,
    user: db.users[log.userId] || { id: log.userId, name: 'Người dùng' },
  }));
  return res.json(logs);
});

/**
 * GET /api/v1/notifications
 */
app.get('/api/v1/notifications', requireAuth, (req, res) => {
  const notifs = (db.notifications || []).map(n => ({
    ...n,
    actor: db.users[n.actorId] || { id: n.actorId, name: 'Đối phương' },
  }));
  return res.json(notifs);
});

/**
 * PUT /api/v1/notifications/:notifId/read
 */
app.put('/api/v1/notifications/:notifId/read', requireAuth, (req, res) => {
  const { notifId } = req.params;
  const item = (db.notifications || []).find(n => n.id === notifId);
  if (item) item.read = true;
  return res.json({ success: true, notifId });
});

/**
 * PUT /api/v1/notifications/read-all
 */
app.put('/api/v1/notifications/read-all', requireAuth, (req, res) => {
  (db.notifications || []).forEach(n => { n.read = true; });
  return res.json({ success: true });
});

/**
 * POST /api/v1/spaces/:spaceId/leave
 */
app.post('/api/v1/spaces/:spaceId/leave', requireAuth, (req, res) => {
  const { spaceId } = req.params;
  const space = db.spaces[spaceId];
  if (space) {
    space.members = space.members.filter(id => id !== req.user.id);
  }
  return res.json({ success: true, message: 'Đã rời không gian chung' });
});

/* ==========================================================================
   Start HTTP & WebSocket Server
   ========================================================================== */
server.listen(PORT, () => {
  console.log(`🚀 CashApp Secure REST & Real-time WebSocket Server running at http://localhost:${PORT}`);
  console.log(`📡 REST APIs: http://localhost:${PORT}/api/v1/...`);
  console.log(`⚡ WebSocket Stream: ws://localhost:${PORT}/ws`);
});
