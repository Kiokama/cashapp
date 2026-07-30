import { v4 as uuidv4 } from 'uuid';

export function createInitialDB() {
  return {
    users: {},
    spaces: {},
    transactions: [],
    budgets: {},
    auditLog: [],
    notifications: [],
    currentUser: null,
  };
}
