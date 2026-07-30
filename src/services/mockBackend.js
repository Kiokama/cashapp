import { createSampleData } from '../utils/sampleData';
import { generateId, generateInviteCode, calculateBalance, calculateMonthlyTotal, calculateCategoryBreakdown, calculateMonthlyTrend } from '../utils/helpers';

const MOCK_STORAGE_KEY = 'cashapp_backend_db';

// Initialize in-memory / localStorage DB
function getDB() {
  try {
    const saved = localStorage.getItem(MOCK_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Failed to load DB from storage', e);
  }
  const initialData = createSampleData();
  saveDB(initialData);
  return initialData;
}

function saveDB(db) {
  try {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    console.warn('Failed to save DB to storage', e);
  }
}

// Helper to simulate network latency
const delay = (ms = 250) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mock Backend REST Controller
 * Simulates server-side REST API execution & validation
 */
export const mockBackend = {
  // 1. Auth & Users
  async login(credentials) {
    await delay(300);
    const db = getDB();
    const user = db.currentUser;
    return {
      status: 200,
      data: {
        token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.user_${user.id}`,
        user,
      },
    };
  },

  async getProfile() {
    await delay(150);
    const db = getDB();
    return { status: 200, data: db.currentUser };
  },

  async updateProfile(updates) {
    await delay(200);
    const db = getDB();
    db.currentUser = { ...db.currentUser, ...updates };
    db.users[db.currentUser.id] = db.currentUser;
    saveDB(db);
    return { status: 200, data: db.currentUser };
  },

  // 2. Shared Spaces
  async getSpaces() {
    await delay(150);
    const db = getDB();
    return { status: 200, data: Object.values(db.spaces) };
  },

  async getSpace(spaceId) {
    await delay(150);
    const db = getDB();
    const space = db.spaces[spaceId];
    if (!space) return { status: 404, error: 'Space not found' };
    const members = space.members.map(id => db.users[id]).filter(Boolean);
    return { status: 200, data: { ...space, memberDetails: members } };
  },

  async createSpace({ name, emoji }) {
    await delay(300);
    const db = getDB();
    const newSpace = {
      id: generateId(),
      name,
      emoji: emoji || '💰',
      inviteCode: generateInviteCode(),
      members: [db.currentUser.id],
      createdAt: new Date().toISOString(),
      budgets: {},
    };
    db.spaces[newSpace.id] = newSpace;
    db.activeSpaceId = newSpace.id;
    saveDB(db);
    return { status: 201, data: newSpace };
  },

  async joinSpace({ inviteCode }) {
    await delay(300);
    const db = getDB();
    const space = Object.values(db.spaces).find(s => s.inviteCode === inviteCode.toUpperCase());
    if (!space) return { status: 404, error: 'Mã mời không hợp lệ hoặc đã hết hạn' };

    if (!space.members.includes(db.currentUser.id)) {
      space.members.push(db.currentUser.id);
      saveDB(db);
    }
    return { status: 200, data: space };
  },

  // 3. Transactions & Logic Validation
  async getTransactions(spaceId, params = {}) {
    await delay(200);
    const db = getDB();
    let result = db.transactions.filter(tx => tx.spaceId === spaceId && !tx.isDeleted);

    if (params.categoryId && params.categoryId !== 'all') {
      result = result.filter(tx => tx.category === params.categoryId);
    }
    if (params.startDate) {
      result = result.filter(tx => new Date(tx.date) >= new Date(params.startDate));
    }
    if (params.endDate) {
      result = result.filter(tx => new Date(tx.date) <= new Date(params.endDate));
    }

    result.sort((a, b) => new Date(b.date) - new Date(a.date));
    return { status: 200, data: result };
  },

  async createTransaction(spaceId, payload) {
    await delay(300);
    const db = getDB();

    // BACKEND VALIDATION: Ensure sum(owedAmount) == amount
    const totalOwed = Object.values(payload.splits || {}).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
    if (!payload.isSettlement && Math.abs(totalOwed - payload.amount) > 1) {
      return {
        status: 400,
        error: `Validation Error: Tổng số tiền chia (${totalOwed.toLocaleString()}₫) không khớp với số tiền giao dịch (${payload.amount.toLocaleString()}₫)`,
      };
    }

    const newTx = {
      id: generateId(),
      spaceId,
      amount: payload.amount,
      description: payload.description,
      category: payload.category || 'other',
      date: payload.date || new Date().toISOString(),
      paidBy: payload.paidBy,
      splitType: payload.splitType || 'equal',
      splits: payload.splits || {},
      isSettlement: !!payload.isSettlement,
      createdAt: new Date().toISOString(),
    };

    db.transactions.unshift(newTx);

    // Audit Log Entry
    db.auditLog.unshift({
      id: generateId(),
      transactionId: newTx.id,
      action: 'created',
      userId: db.currentUser.id,
      timestamp: newTx.createdAt,
      changes: null,
      description: newTx.description,
    });

    // In-App Notification
    db.notifications.unshift({
      id: generateId(),
      type: newTx.isSettlement ? 'settlement' : 'expense_added',
      read: false,
      message: newTx.isSettlement
        ? `${db.currentUser.name} đã thanh toán ${newTx.amount.toLocaleString('vi-VN')}₫`
        : `${db.currentUser.name} đã thêm "${newTx.description}" — ${newTx.amount.toLocaleString('vi-VN')}₫`,
      timestamp: newTx.createdAt,
      userId: db.currentUser.id,
    });

    saveDB(db);
    return { status: 201, data: newTx };
  },

  async updateTransaction(spaceId, transactionId, updates) {
    await delay(300);
    const db = getDB();
    const index = db.transactions.findIndex(t => t.id === transactionId);
    if (index === -1) return { status: 404, error: 'Transaction not found' };

    const oldTx = db.transactions[index];
    const updatedTx = { ...oldTx, ...updates };

    // Validation
    const totalOwed = Object.values(updatedTx.splits || {}).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
    if (!updatedTx.isSettlement && Math.abs(totalOwed - updatedTx.amount) > 1) {
      return {
        status: 400,
        error: `Validation Error: Tổng số tiền chia không khớp với số tiền giao dịch`,
      };
    }

    db.transactions[index] = updatedTx;

    // Audit Log Entry
    db.auditLog.unshift({
      id: generateId(),
      transactionId,
      action: 'edited',
      userId: db.currentUser.id,
      timestamp: new Date().toISOString(),
      changes: {
        amount: oldTx.amount !== updatedTx.amount ? { from: oldTx.amount, to: updatedTx.amount } : null,
      },
      description: updatedTx.description,
    });

    saveDB(db);
    return { status: 200, data: updatedTx };
  },

  async deleteTransaction(spaceId, transactionId) {
    await delay(200);
    const db = getDB();
    const tx = db.transactions.find(t => t.id === transactionId);
    if (!tx) return { status: 404, error: 'Transaction not found' };

    // Soft delete
    tx.isDeleted = true;

    // Audit Log Entry
    db.auditLog.unshift({
      id: generateId(),
      transactionId,
      action: 'deleted',
      userId: db.currentUser.id,
      timestamp: new Date().toISOString(),
      changes: null,
      description: tx.description,
    });

    saveDB(db);
    return { status: 200, data: { message: 'Soft deleted successfully' } };
  },

  // 4. Balances & Settlements
  async getBalances(spaceId) {
    await delay(150);
    const db = getDB();
    const space = db.spaces[spaceId];
    if (!space) return { status: 404, error: 'Space not found' };

    const [userA, userB] = space.members;
    const balance = calculateBalance(db.transactions.filter(t => t.spaceId === spaceId && !t.isDeleted), userA, userB);

    return {
      status: 200,
      data: {
        currency: 'VND',
        spaceId,
        balances: {
          [userA]: balance,
          [userB]: -balance,
        },
        debts: balance !== 0 ? [{
          fromUserId: balance < 0 ? userA : userB,
          toUserId: balance < 0 ? userB : userA,
          amount: Math.abs(balance),
        }] : [],
      },
    };
  },

  async createSettlement(spaceId, { payerId, receiverId, amount }) {
    return this.createTransaction(spaceId, {
      amount,
      description: 'Thanh toán cấn trừ',
      category: 'other',
      date: new Date().toISOString(),
      paidBy: payerId,
      splitType: 'exact',
      splits: {},
      isSettlement: true,
    });
  },

  // 5. Analytics & Budgets
  async getCategorySummary(spaceId, { month, year }) {
    await delay(150);
    const db = getDB();
    const spaceTxs = db.transactions.filter(tx => {
      if (tx.spaceId !== spaceId || tx.isSettlement || tx.isDeleted) return false;
      const d = new Date(tx.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    const summary = calculateCategoryBreakdown(spaceTxs);
    const total = Object.values(summary).reduce((a, b) => a + b, 0);

    return {
      status: 200,
      data: {
        month,
        year,
        totalAmount: total,
        categories: Object.entries(summary).map(([categoryId, amount]) => ({
          categoryId,
          amount,
          percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
        })),
      },
    };
  },

  async getTrend(spaceId, { months = 6 }) {
    await delay(200);
    const db = getDB();
    const spaceTxs = db.transactions.filter(tx => tx.spaceId === spaceId && !tx.isDeleted);
    const trend = calculateMonthlyTrend(spaceTxs, months);
    return { status: 200, data: trend };
  },

  async getBudgets(spaceId) {
    await delay(150);
    const db = getDB();
    const space = db.spaces[spaceId];
    return { status: 200, data: space?.budgets || {} };
  },

  async updateBudget(spaceId, categoryId, amount) {
    await delay(200);
    const db = getDB();
    const space = db.spaces[spaceId];
    if (!space) return { status: 404, error: 'Space not found' };

    space.budgets = space.budgets || {};
    space.budgets[categoryId] = amount;
    saveDB(db);
    return { status: 200, data: { categoryId, amount } };
  },

  // 6. Advanced
  async getAuditLogs(spaceId) {
    await delay(150);
    const db = getDB();
    return { status: 200, data: db.auditLog };
  },

  async getNotifications() {
    await delay(100);
    const db = getDB();
    return { status: 200, data: db.notifications };
  },

  async markNotificationRead(notifId) {
    await delay(100);
    const db = getDB();
    db.notifications = db.notifications.map(n => n.id === notifId ? { ...n, read: true } : n);
    saveDB(db);
    return { status: 200, data: { success: true } };
  },
};
