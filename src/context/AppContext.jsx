import { createContext, useContext, useReducer, useEffect } from 'react';
import { api } from '../services/api';
import { wsService } from '../services/websocket';
import { generateId } from '../utils/helpers';

const AppContext = createContext(null);

const STORAGE_KEY = 'cashapp_state';

function loadSavedState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Failed to load local state', e);
  }
  return null;
}

function saveState(state) {
  try {
    const { isAuthenticated, loading, ...rest } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch (e) {
    console.warn('Failed to save state', e);
  }
}

function getInitialState() {
  const saved = loadSavedState();
  if (saved && saved.currentUser) {
    const firstSpaceId = saved.spaces ? Object.keys(saved.spaces)[0] : null;
    const activeSpaceId = (saved.activeSpaceId && saved.activeSpaceId !== 'undefined') ? saved.activeSpaceId : firstSpaceId;
    return { ...saved, activeSpaceId, isAuthenticated: true, loading: false, toasts: [] };
  }
  return {
    isAuthenticated: false,
    loading: false,
    currentUser: null,
    users: {},
    spaces: {},
    activeSpaceId: null,
    transactions: [],
    auditLog: [],
    notifications: [],
    toasts: [],
  };
}

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'LOGIN_SUCCESS': {
      const { user, spaces, activeSpaceId, transactions, auditLog, notifications, users } = action.payload;
      const firstSpaceId = Object.keys(spaces || {})[0] || null;
      const validActiveSpaceId = (activeSpaceId && activeSpaceId !== 'undefined') ? activeSpaceId : firstSpaceId;
      return {
        ...state,
        isAuthenticated: true,
        loading: false,
        currentUser: user,
        users: users || { [user.id]: user },
        spaces: spaces || {},
        activeSpaceId: validActiveSpaceId,
        transactions: transactions || [],
        auditLog: auditLog || [],
        notifications: notifications || [],
      };
    }

    case 'LOGOUT':
      localStorage.removeItem(STORAGE_KEY);
      api.logout();
      wsService.disconnect();
      return {
        ...getInitialState(),
        isAuthenticated: false,
      };

    case 'SET_ACTIVE_SPACE':
      return { ...state, activeSpaceId: action.payload };

    case 'UPDATE_PROFILE_SUCCESS': {
      const updatedUser = action.payload;
      return {
        ...state,
        currentUser: updatedUser,
        users: {
          ...state.users,
          [updatedUser.id]: updatedUser,
        },
      };
    }

    case 'ADD_TRANSACTION_SUCCESS': {
      const { tx, auditLogEntry, notification } = action.payload;
      if (state.transactions.some(t => t.id === tx.id)) return state;
      return {
        ...state,
        transactions: [tx, ...state.transactions],
        auditLog: auditLogEntry ? [auditLogEntry, ...state.auditLog] : state.auditLog,
        notifications: notification ? [notification, ...state.notifications] : state.notifications,
      };
    }

    case 'UPDATE_TRANSACTION_SUCCESS': {
      const { tx, auditLogEntry } = action.payload;
      return {
        ...state,
        transactions: state.transactions.map(t => t.id === tx.id ? tx : t),
        auditLog: auditLogEntry ? [auditLogEntry, ...state.auditLog] : state.auditLog,
      };
    }

    case 'DELETE_TRANSACTION_SUCCESS': {
      const { transactionId } = action.payload;
      return {
        ...state,
        transactions: state.transactions.filter(t => t.id !== transactionId),
      };
    }

    case 'UPDATE_BUDGET_SUCCESS': {
      const { spaceId, categoryId, amount } = action.payload;
      const space = state.spaces[spaceId] || { id: spaceId, budgets: {} };
      return {
        ...state,
        spaces: {
          ...state.spaces,
          [spaceId]: {
            ...space,
            budgets: {
              ...(space.budgets || {}),
              [categoryId]: amount,
            },
          },
        },
      };
    }

    case 'CREATE_SPACE_SUCCESS': {
      const newSpace = action.payload;
      return {
        ...state,
        spaces: { ...state.spaces, [newSpace.id]: newSpace },
        activeSpaceId: newSpace.id,
      };
    }

    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map(n => n.id === action.payload ? { ...n, read: true } : n),
      };

    case 'MARK_ALL_NOTIFICATIONS_READ':
      return {
        ...state,
        notifications: state.notifications.map(n => ({ ...n, read: true })),
      };

    case 'ADD_TOAST': {
      const toast = { id: generateId(), ...action.payload };
      return {
        ...state,
        toasts: [...state.toasts, toast],
      };
    }

    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter(t => t.id !== action.payload),
      };

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, undefined, getInitialState);

  // Connect WebSocket on authentication & active space change
  useEffect(() => {
    if (state.isAuthenticated && state.activeSpaceId) {
      wsService.connect(state.activeSpaceId);

      const unsubscribe = wsService.addListener((event) => {
        if (!event || !event.type) return;

        // Handle real-time broadcast events from server
        if (event.type === 'TRANSACTION_CREATED' && event.data?.transaction) {
          const tx = event.data.transaction;
          dispatch({
            type: 'ADD_TRANSACTION_SUCCESS',
            payload: { tx },
          });
          dispatch({
            type: 'ADD_TOAST',
            payload: { message: event.data.message || 'Giao dịch mới từ người thương!', type: 'info' },
          });
        } else if (event.type === 'TRANSACTION_UPDATED' && event.data?.transaction) {
          dispatch({
            type: 'UPDATE_TRANSACTION_SUCCESS',
            payload: { tx: event.data.transaction },
          });
          dispatch({
            type: 'ADD_TOAST',
            payload: { message: event.data.message, type: 'info' },
          });
        } else if (event.type === 'TRANSACTION_DELETED' && event.data?.transactionId) {
          dispatch({
            type: 'DELETE_TRANSACTION_SUCCESS',
            payload: { transactionId: event.data.transactionId },
          });
          dispatch({
            type: 'ADD_TOAST',
            payload: { message: event.data.message || 'Một giao dịch đã bị xóa', type: 'warning' },
          });
        } else if (event.type === 'SETTLEMENT_CREATED') {
          dispatch({
            type: 'ADD_TRANSACTION_SUCCESS',
            payload: { tx: event.data.transaction },
          });
          dispatch({
            type: 'ADD_TOAST',
            payload: { message: event.data.message, type: 'success' },
          });
        }
      });

      return () => unsubscribe();
    }
  }, [state.isAuthenticated, state.activeSpaceId]);

  // Auto save state locally
  useEffect(() => {
    if (state.isAuthenticated) {
      saveState(state);
    }
  }, [state]);

  // Auto remove toasts
  useEffect(() => {
    if (state.toasts.length > 0) {
      const timer = setTimeout(() => {
        dispatch({ type: 'REMOVE_TOAST', payload: state.toasts[0].id });
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [state.toasts]);

  // Helper to ensure valid space ID
  const getOrEnsureActiveSpaceId = async (providedSpaceId) => {
    let spaceId = providedSpaceId || state.activeSpaceId;
    if (!spaceId || spaceId === 'undefined' || spaceId === 'null') {
      try {
        const spacesList = await api.getSpaces();
        if (spacesList && spacesList.length > 0) {
          spaceId = spacesList[0].id;
          dispatch({ type: 'SET_ACTIVE_SPACE', payload: spaceId });
        } else {
          const newSpaceRes = await api.createSpace({ name: 'Không gian chung', emoji: '💕' });
          spaceId = newSpaceRes.spaceId || newSpaceRes.space?.id;
          if (newSpaceRes.space) {
            dispatch({ type: 'CREATE_SPACE_SUCCESS', payload: newSpaceRes.space });
          }
        }
      } catch (err) {
        console.error('Failed to resolve active space ID', err);
      }
    }
    return spaceId;
  };

  // API Dispatchers
  const apiActions = {
    async register(userData) {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        await api.register(userData);
        const profile = await api.getProfile();
        const spacesList = await api.getSpaces();
        const activeSpaceId = spacesList[0]?.id;
        const transactionsList = activeSpaceId ? await api.getTransactions(activeSpaceId) : [];
        const auditLogList = activeSpaceId ? await api.getAuditLogs(activeSpaceId) : [];
        const notifList = await api.getNotifications();
        const budgets = activeSpaceId ? await api.getBudgets(activeSpaceId).catch(() => ({})) : {};

        const spacesMap = {};
        spacesList.forEach(s => { 
          spacesMap[s.id] = s.id === activeSpaceId ? { ...s, budgets } : s; 
        });

        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            user: profile,
            users: { [profile.id]: profile },
            spaces: spacesMap,
            activeSpaceId,
            transactions: transactionsList,
            auditLog: auditLogList,
            notifications: notifList,
          },
        });
        dispatch({ type: 'ADD_TOAST', payload: { message: 'Đăng ký tài khoản thành công!', type: 'success' } });
      } catch (e) {
        dispatch({ type: 'SET_LOADING', payload: false });
        dispatch({ type: 'ADD_TOAST', payload: { message: e.message || 'Đăng ký thất bại', type: 'danger' } });
      }
    },

    async login(credentials) {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        await api.login(credentials);
        const profile = await api.getProfile();
        const spacesList = await api.getSpaces();
        const activeSpaceId = spacesList[0]?.id;
        const transactionsList = activeSpaceId ? await api.getTransactions(activeSpaceId) : [];
        const auditLogList = activeSpaceId ? await api.getAuditLogs(activeSpaceId) : [];
        const notifList = await api.getNotifications();
        const budgets = activeSpaceId ? await api.getBudgets(activeSpaceId).catch(() => ({})) : {};

        const spacesMap = {};
        spacesList.forEach(s => { 
          spacesMap[s.id] = s.id === activeSpaceId ? { ...s, budgets } : s; 
        });

        const usersMap = { [profile.id]: profile };
        
        // Fetch members of the active space to get real partner data
        if (activeSpaceId) {
          try {
            const spaceDetails = await api.getSpace(activeSpaceId);
            if (spaceDetails && spaceDetails.memberDetails) {
              spaceDetails.memberDetails.forEach(u => {
                usersMap[u.id] = u;
              });
            }
          } catch (e) {
            console.error('Failed to fetch space details for members', e);
          }
        }

        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            user: profile,
            users: usersMap,
            spaces: spacesMap,
            activeSpaceId,
            transactions: transactionsList,
            auditLog: auditLogList,
            notifications: notifList,
          },
        });
      } catch (e) {
        dispatch({ type: 'SET_LOADING', payload: false });
        dispatch({ type: 'ADD_TOAST', payload: { message: e.message || 'Đăng nhập thất bại', type: 'danger' } });
      }
    },

    async quickLogin(accountType) {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        await api.quickLogin(accountType);
        const profile = await api.getProfile();
        const spacesList = await api.getSpaces();
        const activeSpaceId = spacesList[0]?.id;
        const transactionsList = activeSpaceId ? await api.getTransactions(activeSpaceId) : [];
        const auditLogList = activeSpaceId ? await api.getAuditLogs(activeSpaceId) : [];
        const notifList = await api.getNotifications();
        const budgets = activeSpaceId ? await api.getBudgets(activeSpaceId).catch(() => ({})) : {};

        const spacesMap = {};
        spacesList.forEach(s => { 
          spacesMap[s.id] = s.id === activeSpaceId ? { ...s, budgets } : s; 
        });

        const usersMap = { [profile.id]: profile };
        if (activeSpaceId) {
          try {
            const spaceDetails = await api.getSpace(activeSpaceId);
            if (spaceDetails && spaceDetails.memberDetails) {
              spaceDetails.memberDetails.forEach(u => {
                usersMap[u.id] = u;
              });
            }
          } catch (e) {
            console.error('Failed to fetch space details for members', e);
          }
        }

        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            user: profile,
            users: usersMap,
            spaces: spacesMap,
            activeSpaceId,
            transactions: transactionsList,
            auditLog: auditLogList,
            notifications: notifList,
          },
        });
        dispatch({ type: 'ADD_TOAST', payload: { message: `⚡ Đã đăng nhập nhanh với tài khoản ${profile.name}!`, type: 'success' } });
      } catch (e) {
        dispatch({ type: 'SET_LOADING', payload: false });
        dispatch({ type: 'ADD_TOAST', payload: { message: e.message || 'Đăng nhập nhanh thất bại', type: 'danger' } });
      }
    },

    async updateProfile(updates) {
      try {
        const updatedUser = await api.updateProfile(updates);
        dispatch({ type: 'UPDATE_PROFILE_SUCCESS', payload: updatedUser });
        dispatch({ type: 'ADD_TOAST', payload: { message: 'Đã cập nhật thông tin cá nhân!', type: 'success' } });
        return updatedUser;
      } catch (e) {
        dispatch({ type: 'ADD_TOAST', payload: { message: e.message || 'Lỗi cập nhật hồ sơ', type: 'danger' } });
      }
    },

    async addTransaction(payload) {
      try {
        const spaceId = await getOrEnsureActiveSpaceId(payload?.spaceId);
        if (!spaceId || spaceId === 'undefined') {
          throw new Error('Không tìm thấy Không gian chung hợp lệ. Vui lòng thử lại.');
        }
        const newTx = await api.createTransaction(spaceId, payload);
        const auditLogs = await api.getAuditLogs(spaceId).catch(() => []);
        const notifications = await api.getNotifications().catch(() => []);

        dispatch({
          type: 'ADD_TRANSACTION_SUCCESS',
          payload: {
            tx: newTx,
            auditLogEntry: auditLogs[0],
            notification: notifications[0],
          },
        });
        dispatch({ type: 'ADD_TOAST', payload: { message: 'Đã thêm giao dịch thành công!', type: 'success' } });
        return newTx;
      } catch (e) {
        dispatch({ type: 'ADD_TOAST', payload: { message: e.message || 'Lỗi thêm giao dịch', type: 'danger' } });
      }
    },

    async updateTransaction(id, updates) {
      try {
        const spaceId = await getOrEnsureActiveSpaceId();
        if (!spaceId || spaceId === 'undefined') {
          throw new Error('Không tìm thấy Không gian chung hợp lệ.');
        }
        const updatedTx = await api.updateTransaction(spaceId, id, updates);
        const auditLogs = await api.getAuditLogs(spaceId).catch(() => []);

        dispatch({
          type: 'UPDATE_TRANSACTION_SUCCESS',
          payload: {
            tx: updatedTx,
            auditLogEntry: auditLogs[0],
          },
        });
        dispatch({ type: 'ADD_TOAST', payload: { message: 'Đã cập nhật giao dịch!', type: 'success' } });
        return updatedTx;
      } catch (e) {
        dispatch({ type: 'ADD_TOAST', payload: { message: e.message || 'Lỗi cập nhật giao dịch', type: 'danger' } });
      }
    },

    async deleteTransaction(id) {
      try {
        const spaceId = await getOrEnsureActiveSpaceId();
        if (!spaceId || spaceId === 'undefined') {
          throw new Error('Không tìm thấy Không gian chung hợp lệ.');
        }
        await api.deleteTransaction(spaceId, id);
        dispatch({ type: 'DELETE_TRANSACTION_SUCCESS', payload: { transactionId: id } });
        dispatch({ type: 'ADD_TOAST', payload: { message: 'Đã xóa giao dịch', type: 'warning' } });
      } catch (e) {
        dispatch({ type: 'ADD_TOAST', payload: { message: e.message || 'Lỗi xóa giao dịch', type: 'danger' } });
      }
    },

    async createSettlement(payload) {
      try {
        const spaceId = await getOrEnsureActiveSpaceId();
        if (!spaceId || spaceId === 'undefined') {
          throw new Error('Không tìm thấy Không gian chung hợp lệ.');
        }
        const settlementTx = await api.createSettlement(spaceId, payload);
        const auditLogs = await api.getAuditLogs(spaceId).catch(() => []);

        dispatch({
          type: 'ADD_TRANSACTION_SUCCESS',
          payload: {
            tx: settlementTx,
            auditLogEntry: auditLogs[0],
          },
        });
        dispatch({ type: 'ADD_TOAST', payload: { message: 'Đã ghi nhận thanh toán cấn trừ!', type: 'success' } });
        return settlementTx;
      } catch (e) {
        dispatch({ type: 'ADD_TOAST', payload: { message: e.message || 'Lỗi ghi nhận cấn trừ', type: 'danger' } });
      }
    },

    async updateBudget(categoryId, amount) {
      try {
        const spaceId = await getOrEnsureActiveSpaceId();
        if (!spaceId || spaceId === 'undefined') {
          throw new Error('Không tìm thấy Không gian chung hợp lệ.');
        }
        await api.updateBudget(spaceId, categoryId, amount);
        dispatch({
          type: 'UPDATE_BUDGET_SUCCESS',
          payload: { spaceId, categoryId, amount },
        });
        dispatch({ type: 'ADD_TOAST', payload: { message: 'Đã cập nhật ngân sách!', type: 'success' } });
      } catch (e) {
        dispatch({ type: 'ADD_TOAST', payload: { message: e.message || 'Lỗi cập nhật ngân sách', type: 'danger' } });
      }
    },

    async createSpace(data) {
      try {
        const res = await api.createSpace(data);
        if (res.space) {
          dispatch({ type: 'CREATE_SPACE_SUCCESS', payload: res.space });
          dispatch({ type: 'ADD_TOAST', payload: { message: 'Đã tạo không gian mới!', type: 'success' } });
        }
        return res;
      } catch (e) {
        dispatch({ type: 'ADD_TOAST', payload: { message: e.message || 'Lỗi tạo không gian', type: 'danger' } });
      }
    },

    async joinSpace(inviteCode) {
      try {
        await api.joinSpace({ inviteCode });
        dispatch({ type: 'ADD_TOAST', payload: { message: 'Tham gia thành công! Đang tải lại...', type: 'success' } });
        setTimeout(() => window.location.reload(), 1500);
        return true;
      } catch (e) {
        dispatch({ type: 'ADD_TOAST', payload: { message: e.message || 'Mã mời không hợp lệ', type: 'danger' } });
        return false;
      }
    },
  };

  return (
    <AppContext.Provider value={{ state, dispatch, apiActions }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
