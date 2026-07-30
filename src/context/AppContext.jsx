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
    return { ...saved, isAuthenticated: true, loading: false, toasts: [] };
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
      return {
        ...state,
        isAuthenticated: true,
        loading: false,
        currentUser: user,
        users: users || { [user.id]: user },
        spaces: spaces || {},
        activeSpaceId: activeSpaceId || Object.keys(spaces || {})[0],
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
      const space = state.spaces[spaceId];
      if (!space) return state;
      return {
        ...state,
        spaces: {
          ...state.spaces,
          [spaceId]: {
            ...space,
            budgets: {
              ...space.budgets,
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

  // API Dispatchers
  const apiActions = {
    async login(credentials) {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const data = await api.login(credentials);
        const profile = await api.getProfile();
        const spacesList = await api.getSpaces();
        const activeSpaceId = spacesList[0]?.id;
        const transactionsList = activeSpaceId ? await api.getTransactions(activeSpaceId) : [];
        const auditLogList = activeSpaceId ? await api.getAuditLogs(activeSpaceId) : [];
        const notifList = await api.getNotifications();

        const spacesMap = {};
        spacesList.forEach(s => { spacesMap[s.id] = s; });

        const mockUsers = {
          'user-a': { id: 'user-a', name: 'Minh Anh', email: 'minhanh@email.com' },
          'user-b': { id: 'user-b', name: 'Thuỳ Linh', email: 'thuylinh@email.com' },
        };

        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            user: profile,
            users: mockUsers,
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

    async addTransaction(payload) {
      try {
        const newTx = await api.createTransaction(state.activeSpaceId, payload);
        const auditLogs = await api.getAuditLogs(state.activeSpaceId);
        const notifications = await api.getNotifications();

        dispatch({
          type: 'ADD_TRANSACTION_SUCCESS',
          payload: {
            tx: newTx,
            auditLogEntry: auditLogs[0],
            notification: notifications[0],
          },
        });
        dispatch({ type: 'ADD_TOAST', payload: { message: 'Đã thêm giao dịch thành công!', type: 'success' } });
      } catch (e) {
        dispatch({ type: 'ADD_TOAST', payload: { message: e.message, type: 'danger' } });
      }
    },

    async updateTransaction(id, updates) {
      try {
        const updatedTx = await api.updateTransaction(state.activeSpaceId, id, updates);
        const auditLogs = await api.getAuditLogs(state.activeSpaceId);

        dispatch({
          type: 'UPDATE_TRANSACTION_SUCCESS',
          payload: {
            tx: updatedTx,
            auditLogEntry: auditLogs[0],
          },
        });
        dispatch({ type: 'ADD_TOAST', payload: { message: 'Đã cập nhật giao dịch!', type: 'success' } });
      } catch (e) {
        dispatch({ type: 'ADD_TOAST', payload: { message: e.message, type: 'danger' } });
      }
    },

    async deleteTransaction(id) {
      try {
        await api.deleteTransaction(state.activeSpaceId, id);
        dispatch({ type: 'DELETE_TRANSACTION_SUCCESS', payload: { transactionId: id } });
        dispatch({ type: 'ADD_TOAST', payload: { message: 'Đã xóa giao dịch', type: 'warning' } });
      } catch (e) {
        dispatch({ type: 'ADD_TOAST', payload: { message: e.message, type: 'danger' } });
      }
    },

    async updateBudget(categoryId, amount) {
      try {
        await api.updateBudget(state.activeSpaceId, categoryId, amount);
        dispatch({
          type: 'UPDATE_BUDGET_SUCCESS',
          payload: { spaceId: state.activeSpaceId, categoryId, amount },
        });
        dispatch({ type: 'ADD_TOAST', payload: { message: 'Đã cập nhật ngân sách!', type: 'success' } });
      } catch (e) {
        dispatch({ type: 'ADD_TOAST', payload: { message: e.message, type: 'danger' } });
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
