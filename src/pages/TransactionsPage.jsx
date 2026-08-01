import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Plus, Search, Trash2, Edit3, X, Check, Receipt
} from 'lucide-react';
import { formatCurrency, formatDate, getInitials, getUserColor, getUserShare } from '../utils/helpers';
import { CATEGORIES, SPLIT_TYPES } from '../utils/constants';
import './TransactionsPage.css';

export default function TransactionsPage() {
  const { state, apiActions } = useApp();
  const { currentUser, users, transactions, activeSpaceId } = state;
  const partner = Object.values(users).find(u => u.id !== currentUser?.id);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  // Form state
  const [form, setForm] = useState({
    amount: '',
    description: '',
    category: 'food',
    date: new Date().toISOString().split('T')[0],
    paidBy: currentUser?.id || '',
    splitType: SPLIT_TYPES.EQUAL,
    splitPercentA: 50,
    splitPercentB: 50,
    splitAmountA: '',
    splitAmountB: '',
  });

  const resetForm = () => {
    setForm({
      amount: '',
      description: '',
      category: 'food',
      date: new Date().toISOString().split('T')[0],
      paidBy: currentUser?.id || '',
      splitType: SPLIT_TYPES.EQUAL,
      splitPercentA: 50,
      splitPercentB: 50,
      splitAmountA: '',
      splitAmountB: '',
    });
  };

  const openEdit = (tx) => {
    const userAShare = getUserShare(tx, currentUser?.id);
    const userBShare = getUserShare(tx, partner?.id);
    setForm({
      amount: tx.amount.toString(),
      description: tx.description,
      category: tx.category,
      date: tx.date.split('T')[0],
      paidBy: tx.paidBy,
      splitType: tx.splitType || SPLIT_TYPES.EQUAL,
      splitPercentA: tx.amount > 0 ? Math.round((userAShare / tx.amount) * 100) : 50,
      splitPercentB: tx.amount > 0 ? Math.round((userBShare / tx.amount) * 100) : 50,
      splitAmountA: userAShare.toString(),
      splitAmountB: userBShare.toString(),
    });
    setEditingTx(tx);
    setShowAddModal(true);
  };

  const calculateSplits = () => {
    const amount = parseFloat(form.amount) || 0;
    const userAId = currentUser?.id;
    const userBId = partner?.id;

    let splits = {};

    switch (form.splitType) {
      case SPLIT_TYPES.EQUAL: {
        const half = Math.floor(amount / 2);
        splits = {
          [userAId]: half,
          [userBId]: amount - half,
        };
        break;
      }
      case SPLIT_TYPES.PERCENTAGE: {
        const shareA = Math.round(amount * (form.splitPercentA / 100));
        splits = {
          [userAId]: shareA,
          [userBId]: amount - shareA,
        };
        break;
      }
      case SPLIT_TYPES.EXACT:
        splits = {
          [userAId]: parseFloat(form.splitAmountA) || 0,
          [userBId]: parseFloat(form.splitAmountB) || 0,
        };
        break;
      default:
        splits = {
          [userAId]: Math.floor(amount / 2),
          [userBId]: amount - Math.floor(amount / 2),
        };
    }

    return splits;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!amount || !form.description.trim()) return;

    const splits = calculateSplits();

    if (editingTx) {
      await apiActions.updateTransaction(editingTx.id, {
        amount,
        description: form.description,
        category: form.category,
        date: new Date(form.date).toISOString(),
        paidBy: form.paidBy,
        splitType: form.splitType,
        splits,
      });
    } else {
      await apiActions.addTransaction({
        spaceId: activeSpaceId,
        amount,
        description: form.description,
        category: form.category,
        date: new Date(form.date).toISOString(),
        paidBy: form.paidBy,
        splitType: form.splitType,
        splits,
        isSettlement: false,
      });
    }

    setShowAddModal(false);
    setEditingTx(null);
    resetForm();
  };

  const handleDelete = async (id) => {
    await apiActions.deleteTransaction(id);
  };

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(tx => !tx.isSettlement)
      .filter(tx => {
        if (filterCategory !== 'all' && tx.category !== filterCategory) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return tx.description.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, filterCategory, searchQuery]);

  return (
    <div className="transactions-page">
      {/* Header */}
      <div className="tx-header glass-card animate-fadeInUp" style={{ padding: 'var(--space-md)' }}>
        <div className="tx-search-bar">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Tìm kiếm giao dịch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="tx-filters">
          <select
            className="form-select filter-select"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="all">Tất cả danh mục</option>
            {CATEGORIES.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>
          <button
            className="btn-primary"
            onClick={() => { resetForm(); setEditingTx(null); setShowAddModal(true); }}
          >
            <Plus size={18} />
            Thêm chi tiêu
          </button>
        </div>
      </div>

      {/* Transaction List */}
      <div className="tx-list animate-fadeInUp stagger-2">
        {filteredTransactions.length === 0 ? (
          <div className="empty-state glass-card">
            <div className="empty-state-icon"><Receipt size={28} /></div>
            <h3 className="empty-state-title">Chưa có giao dịch</h3>
            <p className="empty-state-desc">Nhấn "Thêm chi tiêu" để bắt đầu ghi chép giao dịch chung</p>
          </div>
        ) : (
          filteredTransactions.map(tx => {
            const cat = CATEGORIES.find(c => c.id === tx.category);
            const paidByUser = users[tx.paidBy];
            const myShare = getUserShare(tx, currentUser?.id);

            return (
              <div key={tx.id} className="tx-card glass-card-sm">
                <div className="tx-cat-indicator" style={{ background: cat?.color }} />
                <div className="tx-main">
                  <div className="tx-info">
                    <span className="tx-desc">{tx.description}</span>
                    <span className="tx-meta">
                      <span className="tx-cat-label" style={{ color: cat?.color }}>{cat?.label}</span>
                      <span>•</span>
                      <span>{formatDate(tx.date)}</span>
                      <span>•</span>
                      <span className="tx-paid-by">
                        <div className="avatar avatar-sm" style={{ background: getUserColor(tx.paidBy) }}>
                          {getInitials(paidByUser?.name)}
                        </div>
                        {paidByUser?.name} trả
                      </span>
                    </span>
                  </div>
                  <div className="tx-amounts">
                    <span className="tx-total">{formatCurrency(tx.amount)}</span>
                    <span className="tx-share">Phần bạn: {formatCurrency(myShare)}</span>
                  </div>
                  <div className="tx-actions">
                    <button className="btn-icon" onClick={() => openEdit(tx)} title="Sửa">
                      <Edit3 size={16} />
                    </button>
                    <button className="btn-icon" onClick={() => handleDelete(tx.id)} title="Xóa">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => { setShowAddModal(false); setEditingTx(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingTx ? 'Sửa giao dịch' : 'Thêm khoản chi mới'}
              </h2>
              <button className="modal-close" onClick={() => { setShowAddModal(false); setEditingTx(null); }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="tx-form">
              <div className="form-group">
                <label className="form-label">Mô tả</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Ăn tối nhà hàng"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Số tiền (₫)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="0"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Ngày</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Danh mục</label>
                  <select
                    className="form-select"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Ai thanh toán?</label>
                  <select
                    className="form-select"
                    value={form.paidBy}
                    onChange={(e) => setForm({ ...form, paidBy: e.target.value })}
                  >
                    {Object.values(users).map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.id === currentUser?.id ? '(Bạn)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Split Options */}
              <div className="form-group">
                <label className="form-label">Cách chia tiền</label>
                <div className="split-options">
                  <button
                    type="button"
                    className={`split-option ${form.splitType === SPLIT_TYPES.EQUAL ? 'active' : ''}`}
                    onClick={() => setForm({ ...form, splitType: SPLIT_TYPES.EQUAL })}
                  >
                    Chia đều
                  </button>
                  <button
                    type="button"
                    className={`split-option ${form.splitType === SPLIT_TYPES.PERCENTAGE ? 'active' : ''}`}
                    onClick={() => setForm({ ...form, splitType: SPLIT_TYPES.PERCENTAGE })}
                  >
                    Theo %
                  </button>
                  <button
                    type="button"
                    className={`split-option ${form.splitType === SPLIT_TYPES.EXACT ? 'active' : ''}`}
                    onClick={() => setForm({ ...form, splitType: SPLIT_TYPES.EXACT })}
                  >
                    Số tiền cụ thể
                  </button>
                </div>
              </div>

              {/* Split Details */}
              {form.splitType === SPLIT_TYPES.EQUAL && (
                <div className="split-preview glass-card-sm">
                  <div className="split-row">
                    <span>{currentUser?.name}</span>
                    <span className="split-value">{formatCurrency(Math.round((parseFloat(form.amount) || 0) / 2))}</span>
                  </div>
                  <div className="split-row">
                    <span>{partner?.name}</span>
                    <span className="split-value">{formatCurrency(Math.round((parseFloat(form.amount) || 0) / 2))}</span>
                  </div>
                </div>
              )}

              {form.splitType === SPLIT_TYPES.PERCENTAGE && (
                <div className="split-details">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">{currentUser?.name} (%)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={form.splitPercentA}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setForm({ ...form, splitPercentA: val, splitPercentB: 100 - val });
                        }}
                        min="0"
                        max="100"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{partner?.name} (%)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={form.splitPercentB}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setForm({ ...form, splitPercentB: val, splitPercentA: 100 - val });
                        }}
                        min="0"
                        max="100"
                      />
                    </div>
                  </div>
                  <div className="split-preview glass-card-sm">
                    <div className="split-row">
                      <span>{currentUser?.name} ({form.splitPercentA}%)</span>
                      <span className="split-value">{formatCurrency(Math.round((parseFloat(form.amount) || 0) * form.splitPercentA / 100))}</span>
                    </div>
                    <div className="split-row">
                      <span>{partner?.name} ({form.splitPercentB}%)</span>
                      <span className="split-value">{formatCurrency(Math.round((parseFloat(form.amount) || 0) * form.splitPercentB / 100))}</span>
                    </div>
                  </div>
                </div>
              )}

              {form.splitType === SPLIT_TYPES.EXACT && (
                <div className="split-details">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">{currentUser?.name} (₫)</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="0"
                        value={form.splitAmountA}
                        onChange={(e) => setForm({ ...form, splitAmountA: e.target.value })}
                        min="0"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{partner?.name} (₫)</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="0"
                        value={form.splitAmountB}
                        onChange={(e) => setForm({ ...form, splitAmountB: e.target.value })}
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => { setShowAddModal(false); setEditingTx(null); }}>
                  Hủy
                </button>
                <button type="submit" className="btn-primary">
                  <Check size={18} />
                  {editingTx ? 'Cập nhật' : 'Thêm giao dịch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
