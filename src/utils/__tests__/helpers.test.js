import { describe, it, expect } from 'vitest';
import { calculateBalance, calculateCategoryBreakdown, calculateMonthlyTrend } from '../helpers';

describe('Financial Split & Balance Logic Unit Tests', () => {
  it('should accurately calculate equal 50/50 balance debt between two users', () => {
    const mockTransactions = [
      {
        id: 'tx-1',
        amount: 200000,
        paidBy: 'user-a',
        splits: { 'user-a': 100000, 'user-b': 100000 },
        isSettlement: false,
      },
      {
        id: 'tx-2',
        amount: 50000,
        paidBy: 'user-b',
        splits: { 'user-a': 25000, 'user-b': 25000 },
        isSettlement: false,
      },
    ];

    // User A paid 200k (B owes A 100k). User B paid 50k (A owes B 25k).
    // Net balance for User A = +75,000 (User B owes User A 75,000 VND).
    const netBalanceA = calculateBalance(mockTransactions, 'user-a', 'user-b');
    expect(netBalanceA).toBe(75000);
  });

  it('should correctly handle SPLIT_PERCENTAGE and exact custom split amounts', () => {
    const mockTransactions = [
      {
        id: 'tx-3',
        amount: 1000000,
        paidBy: 'user-a',
        splits: { 'user-a': 700000, 'user-b': 300000 }, // 70/30 split
        isSettlement: false,
      },
    ];

    const netBalanceA = calculateBalance(mockTransactions, 'user-a', 'user-b');
    expect(netBalanceA).toBe(300000);
  });

  it('should offset debts completely when SETTLEMENT transaction occurs', () => {
    const mockTransactions = [
      {
        id: 'tx-1',
        amount: 100000,
        paidBy: 'user-a',
        splits: { 'user-a': 50000, 'user-b': 50000 },
        isSettlement: false,
      },
      {
        id: 'tx-settle',
        amount: 50000,
        paidBy: 'user-b',
        splits: { 'user-a': 50000, 'user-b': 0 },
        isSettlement: true, // User B pays User A 50,000 VND
      },
    ];

    const netBalanceA = calculateBalance(mockTransactions, 'user-a', 'user-b');
    expect(netBalanceA).toBe(0);
  });

  it('should aggregate category expenditure totals accurately', () => {
    const mockTransactions = [
      { id: '1', category: 'food', amount: 150000, isSettlement: false },
      { id: '2', category: 'food', amount: 250000, isSettlement: false },
      { id: '3', category: 'dating', amount: 300000, isSettlement: false },
    ];

    const breakdown = calculateCategoryBreakdown(mockTransactions);
    expect(breakdown.food).toBe(400000);
    expect(breakdown.dating).toBe(300000);
  });
});
