import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Edit3, Check, X, AlertTriangle } from 'lucide-react';
import { formatCurrency, calculateCategoryBreakdown } from '../utils/helpers';
import { CATEGORIES } from '../utils/constants';
import './BudgetsPage.css';

export default function BudgetsPage() {
  const { state, apiActions } = useApp();
  const { transactions, spaces, activeSpaceId } = state;
  const space = spaces[activeSpaceId];

  const [editingCat, setEditingCat] = useState(null);
  const [editValue, setEditValue] = useState('');

  const now = new Date();
  const thisMonthTx = transactions.filter(tx => {
    if (tx.isSettlement) return false;
    const d = new Date(tx.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  const categorySpending = useMemo(() => calculateCategoryBreakdown(thisMonthTx), [thisMonthTx]);

  const budgets = space?.budgets || {};

  const budgetData = useMemo(() => {
    return CATEGORIES.map(cat => {
      const spent = categorySpending[cat.id] || 0;
      const budget = budgets[cat.id] || 0;
      const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
      const overBudget = budget > 0 && spent > budget;
      const nearBudget = budget > 0 && percentage >= 80 && !overBudget;

      return {
        ...cat,
        spent,
        budget,
        percentage,
        overBudget,
        nearBudget,
        remaining: budget > 0 ? budget - spent : 0,
      };
    });
  }, [categorySpending, budgets]);

  const totalBudget = budgetData.reduce((sum, b) => sum + b.budget, 0);
  const totalSpent = budgetData.reduce((sum, b) => sum + b.spent, 0);
  const overallPercentage = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;

  const handleEditBudget = (catId) => {
    setEditingCat(catId);
    setEditValue((budgets[catId] || '').toString());
  };

  const handleSaveBudget = async () => {
    if (editingCat && activeSpaceId) {
      await apiActions.updateBudget(editingCat, parseFloat(editValue) || 0);
      setEditingCat(null);
    }
  };

  return (
    <div className="budgets-page">
      {/* Overall budget */}
      <div className="budget-overview glass-card animate-fadeInUp">
        <div className="budget-overview-header">
          <div>
            <h2 className="budget-overview-title">Tổng ngân sách tháng này</h2>
            <p className="budget-overview-subtitle">
              Đã chi {formatCurrency(totalSpent)} / {formatCurrency(totalBudget)}
            </p>
          </div>
          <div className="budget-overview-percent">
            <span className={`percent-value ${overallPercentage >= 90 ? 'danger' : overallPercentage >= 70 ? 'warning' : ''}`}>
              {overallPercentage.toFixed(0)}%
            </span>
          </div>
        </div>
        <div className="progress-bar" style={{ height: 12 }}>
          <div
            className="progress-fill"
            style={{
              width: `${overallPercentage}%`,
              background: overallPercentage >= 90
                ? 'var(--accent-gradient-warm)'
                : overallPercentage >= 70
                ? 'linear-gradient(90deg, var(--color-warning), #ffcc02)'
                : 'var(--accent-gradient)',
            }}
          />
        </div>
      </div>

      {/* Budget cards */}
      <div className="budget-grid animate-fadeInUp stagger-2">
        {budgetData.map(item => (
          <div
            key={item.id}
            className={`budget-card glass-card-sm ${item.overBudget ? 'over-budget' : ''} ${item.nearBudget ? 'near-budget' : ''}`}
          >
            <div className="budget-card-header">
              <div className="budget-cat">
                <div className="budget-cat-dot" style={{ background: item.color }} />
                <span className="budget-cat-name">{item.label}</span>
              </div>
              {item.overBudget && (
                <span className="badge badge-danger">
                  <AlertTriangle size={10} />
                  Vượt ngân sách
                </span>
              )}
              {item.nearBudget && (
                <span className="badge badge-warning">
                  <AlertTriangle size={10} />
                  Sắp đạt giới hạn
                </span>
              )}
            </div>

            <div className="budget-amounts">
              <div className="budget-spent">
                <span className="budget-amount-label">Đã chi</span>
                <span className="budget-amount-value">{formatCurrency(item.spent)}</span>
              </div>
              <div className="budget-limit">
                <span className="budget-amount-label">Ngân sách</span>
                {editingCat === item.id ? (
                  <div className="budget-edit-row">
                    <input
                      type="number"
                      className="form-input budget-edit-input"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveBudget();
                        if (e.key === 'Escape') setEditingCat(null);
                      }}
                    />
                    <button className="btn-icon" onClick={handleSaveBudget}>
                      <Check size={16} style={{ color: 'var(--color-success)' }} />
                    </button>
                    <button className="btn-icon" onClick={() => setEditingCat(null)}>
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="budget-value-row">
                    <span className="budget-amount-value">
                      {item.budget > 0 ? formatCurrency(item.budget) : 'Chưa thiết lập'}
                    </span>
                    <button className="btn-icon" onClick={() => handleEditBudget(item.id)}>
                      <Edit3 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {item.budget > 0 && (
              <>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${item.percentage}%`,
                      background: item.overBudget
                        ? 'var(--color-danger)'
                        : item.nearBudget
                        ? 'var(--color-warning)'
                        : item.color,
                    }}
                  />
                </div>
                <div className="budget-remaining">
                  {item.overBudget ? (
                    <span style={{ color: 'var(--color-danger)' }}>
                      Vượt {formatCurrency(Math.abs(item.remaining))}
                    </span>
                  ) : (
                    <span>Còn lại: {formatCurrency(item.remaining)}</span>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
