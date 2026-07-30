import { CURRENCY_SYMBOL } from './constants';

/**
 * Format a number as Vietnamese currency
 */
export function formatCurrency(amount, compact = false) {
  if (compact && Math.abs(amount) >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M ${CURRENCY_SYMBOL}`;
  }
  if (compact && Math.abs(amount) >= 1000) {
    return `${(amount / 1000).toFixed(0)}K ${CURRENCY_SYMBOL}`;
  }
  return `${amount.toLocaleString('vi-VN')} ${CURRENCY_SYMBOL}`;
}

/**
 * Format a date string to Vietnamese locale
 */
export function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Format relative time
 */
export function formatRelativeTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return formatDate(dateStr);
}

/**
 * Generate a random invite code
 */
export function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generate a UUID
 */
export function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get the exact share/owed amount for a user in a transaction, safely handling both splitDetails and splits schema.
 */
export function getUserShare(tx, userId) {
  if (tx.splitDetails && Array.isArray(tx.splitDetails) && tx.splitDetails.length > 0) {
    const detail = tx.splitDetails.find(d => d.userId === userId);
    return detail ? (parseFloat(detail.owedAmount) || 0) : 0;
  }
  if (tx.splits && tx.splits[userId] !== undefined) {
    return parseFloat(tx.splits[userId]) || 0;
  }
  // Fallback to 50/50 if not specified
  return tx.amount / 2;
}

/**
 * Calculate the net balance between two users in a space
 * Returns positive if user1 is owed money (user2 owes user1),
 * Returns negative if user1 owes money (user1 owes user2)
 */
export function calculateBalance(transactions, userId1, userId2) {
  let balance = 0;

  for (const tx of transactions) {
    if (tx.isSettlement) continue; // skip settlements

    const paidBy = tx.paidBy;
    const shareUser1 = getUserShare(tx, userId1);
    const shareUser2 = getUserShare(tx, userId2);
    
    if (paidBy === userId1) {
      // user1 paid, user2 owes their share
      balance += shareUser2;
    } else if (paidBy === userId2) {
      // user2 paid, user1 owes their share
      balance -= shareUser1;
    }
  }

  // Apply settlements
  for (const tx of transactions) {
    if (!tx.isSettlement) continue;
    if (tx.paidBy === userId1) {
      // user1 paid a settlement to user2
      balance += tx.amount;
    } else if (tx.paidBy === userId2) {
      balance -= tx.amount;
    }
  }

  return balance;
}

/**
 * Calculate total spending for a given month/year
 */
export function calculateMonthlyTotal(transactions, year, month) {
  return transactions
    .filter(tx => {
      if (tx.isSettlement) return false;
      const d = new Date(tx.date);
      return d.getFullYear() === year && d.getMonth() === month;
    })
    .reduce((sum, tx) => sum + tx.amount, 0);
}

/**
 * Calculate spending by category
 */
export function calculateCategoryBreakdown(transactions) {
  const breakdown = {};
  for (const tx of transactions) {
    if (tx.isSettlement) continue;
    if (!breakdown[tx.category]) {
      breakdown[tx.category] = 0;
    }
    breakdown[tx.category] += tx.amount;
  }
  return breakdown;
}

/**
 * Calculate monthly spending over multiple months
 */
export function calculateMonthlyTrend(transactions, numMonths = 6) {
  const now = new Date();
  const months = [];
  
  for (let i = numMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const total = calculateMonthlyTotal(transactions, year, month);
    months.push({
      year,
      month,
      label: `T${month + 1}/${year}`,
      total,
    });
  }
  
  return months;
}

/**
 * Get initials from a name
 */
export function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Get a deterministic color for a user
 */
export function getUserColor(userId) {
  const colors = [
    'var(--accent-primary)',
    'var(--cat-dating)',
    'var(--cat-food)',
    'var(--cat-transport)',
    'var(--cat-entertainment)',
    'var(--color-success)',
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
