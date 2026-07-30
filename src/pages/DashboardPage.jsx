import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Wallet, Receipt, PieChart, Users, Clock
} from 'lucide-react';
import {
  formatCurrency, calculateBalance, calculateMonthlyTotal,
  calculateCategoryBreakdown, formatRelativeTime, getInitials, getUserColor
} from '../utils/helpers';
import { CATEGORIES } from '../utils/constants';
import './DashboardPage.css';

export default function DashboardPage() {
  const { state } = useApp();
  const { currentUser, users, transactions, spaces, activeSpaceId } = state;
  const space = spaces[activeSpaceId];
  const partner = Object.values(users).find(u => u.id !== currentUser?.id);

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

  const stats = useMemo(() => {
    const monthlyTotal = calculateMonthlyTotal(transactions, thisYear, thisMonth);
    const lastMonthTotal = calculateMonthlyTotal(transactions, lastMonthYear, lastMonth);
    const balance = partner ? calculateBalance(transactions, currentUser.id, partner.id) : 0;
    const categoryBreakdown = calculateCategoryBreakdown(
      transactions.filter(tx => {
        const d = new Date(tx.date);
        return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
      })
    );
    const totalTransactions = transactions.filter(tx => {
      if (tx.isSettlement) return false;
      const d = new Date(tx.date);
      return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
    }).length;

    const changePercent = lastMonthTotal > 0
      ? ((monthlyTotal - lastMonthTotal) / lastMonthTotal * 100).toFixed(1)
      : 0;

    return {
      monthlyTotal, lastMonthTotal, balance, categoryBreakdown,
      totalTransactions, changePercent,
    };
  }, [transactions, currentUser, partner, thisYear, thisMonth]);

  const recentTransactions = transactions
    .filter(tx => !tx.isSettlement)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  const topCategories = useMemo(() => {
    const entries = Object.entries(stats.categoryBreakdown);
    entries.sort((a, b) => b[1] - a[1]);
    return entries.slice(0, 5).map(([catId, amount]) => {
      const cat = CATEGORIES.find(c => c.id === catId);
      return { ...cat, amount };
    });
  }, [stats.categoryBreakdown]);

  return (
    <div className="dashboard">
      {/* Summary Cards */}
      <div className="stats-grid animate-fadeInUp">
        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon" style={{ background: 'rgba(108, 99, 255, 0.15)', color: 'var(--accent-primary)' }}>
              <Wallet size={20} />
            </div>
            <span className={`stat-change ${stats.changePercent >= 0 ? 'negative' : 'positive'}`}>
              {stats.changePercent >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {Math.abs(stats.changePercent)}%
            </span>
          </div>
          <div className="stat-value">{formatCurrency(stats.monthlyTotal, true)}</div>
          <div className="stat-label">Tổng chi tháng này</div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon" style={{
              background: stats.balance > 0 ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 82, 82, 0.15)',
              color: stats.balance > 0 ? 'var(--color-success)' : 'var(--color-danger)'
            }}>
              <Users size={20} />
            </div>
            <span className={`badge ${stats.balance > 0 ? 'badge-success' : stats.balance < 0 ? 'badge-danger' : 'badge-info'}`}>
              {stats.balance > 0 ? 'Được nợ' : stats.balance < 0 ? 'Đang nợ' : 'Đã cân'}
            </span>
          </div>
          <div className="stat-value" style={{ color: stats.balance > 0 ? 'var(--color-success)' : stats.balance < 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>
            {formatCurrency(Math.abs(stats.balance), true)}
          </div>
          <div className="stat-label">
            {stats.balance > 0 && partner ? `${partner.name} nợ bạn` :
             stats.balance < 0 && partner ? `Bạn nợ ${partner.name}` :
             'Số dư cấn trừ'}
          </div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon" style={{ background: 'rgba(0, 210, 255, 0.15)', color: 'var(--accent-secondary)' }}>
              <Receipt size={20} />
            </div>
          </div>
          <div className="stat-value">{stats.totalTransactions}</div>
          <div className="stat-label">Giao dịch tháng này</div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon" style={{ background: 'rgba(255, 167, 38, 0.15)', color: 'var(--color-warning)' }}>
              <PieChart size={20} />
            </div>
          </div>
          <div className="stat-value">{formatCurrency(stats.lastMonthTotal, true)}</div>
          <div className="stat-label">Tổng chi tháng trước</div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Recent Transactions */}
        <div className="dash-section glass-card animate-fadeInUp stagger-2">
          <div className="section-header">
            <h2 className="section-title">
              <Clock size={18} />
              Hoạt động gần đây
            </h2>
          </div>
          <div className="recent-list">
            {recentTransactions.map(tx => {
              const cat = CATEGORIES.find(c => c.id === tx.category);
              const paidByUser = users[tx.paidBy];
              const isMyExpense = tx.paidBy === currentUser?.id;

              return (
                <div key={tx.id} className="recent-item">
                  <div className="recent-cat-dot" style={{ background: cat?.color }} />
                  <div className="recent-info">
                    <span className="recent-desc">{tx.description}</span>
                    <span className="recent-meta">
                      {cat?.label} • {paidByUser?.name} thanh toán • {formatRelativeTime(tx.date)}
                    </span>
                  </div>
                  <div className="recent-amount">
                    <span className="amount-total">{formatCurrency(tx.amount)}</span>
                    <span className="amount-split" style={{ color: isMyExpense ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                      -{formatCurrency(tx.splits[currentUser?.id] || 0)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Categories */}
        <div className="dash-section glass-card animate-fadeInUp stagger-3">
          <div className="section-header">
            <h2 className="section-title">
              <PieChart size={18} />
              Danh mục chi tiêu cao
            </h2>
          </div>
          <div className="categories-list">
            {topCategories.map(cat => {
              const maxAmount = topCategories[0]?.amount || 1;
              const percentage = (cat.amount / maxAmount * 100);
              return (
                <div key={cat.id} className="category-item">
                  <div className="category-header">
                    <div className="category-label">
                      <div className="category-dot" style={{ background: cat.color }} />
                      <span>{cat.label}</span>
                    </div>
                    <span className="category-amount">{formatCurrency(cat.amount)}</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${percentage}%`,
                        background: cat.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {topCategories.length === 0 && (
              <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
                <p className="empty-state-desc">Chưa có giao dịch nào tháng này</p>
              </div>
            )}
          </div>
        </div>

        {/* Space Info */}
        {space && partner && (
          <div className="dash-section glass-card animate-fadeInUp stagger-4">
            <div className="section-header">
              <h2 className="section-title">
                <Users size={18} />
                Không gian chung
              </h2>
            </div>
            <div className="space-card-content">
              <div className="space-card-top">
                <span className="space-card-emoji">{space.emoji}</span>
                <div>
                  <h3 className="space-card-name">{space.name}</h3>
                  <p className="space-card-code">Mã mời: <strong>{space.inviteCode}</strong></p>
                </div>
              </div>
              <div className="space-members-list">
                {space.members.map(mId => {
                  const user = users[mId];
                  if (!user) return null;
                  return (
                    <div key={mId} className="space-member">
                      <div className="avatar avatar-sm" style={{ background: getUserColor(mId) }}>
                        {getInitials(user.name)}
                      </div>
                      <span>{user.name}</span>
                      {mId === currentUser?.id && <span className="badge badge-accent">Bạn</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
