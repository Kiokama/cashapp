import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ArrowRight, Check, Users, Wallet, TrendingUp, TrendingDown
} from 'lucide-react';
import { formatCurrency, calculateBalance, getInitials, getUserColor } from '../utils/helpers';
import './SettlePage.css';

export default function SettlePage() {
  const { state, apiActions } = useApp();
  const { currentUser, users, transactions, activeSpaceId } = state;
  const partner = Object.values(users).find(u => u.id !== currentUser?.id);

  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');

  const balance = useMemo(() => {
    if (!partner) return 0;
    return calculateBalance(transactions, currentUser.id, partner.id);
  }, [transactions, currentUser, partner]);

  // Settlement history
  const settlements = useMemo(() => {
    return transactions
      .filter(tx => tx.isSettlement)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions]);

  const handleSettle = async () => {
    const amount = parseFloat(settleAmount);
    if (!amount || amount <= 0) return;

    const payerId = balance < 0 ? currentUser.id : partner.id;
    const receiverId = balance < 0 ? partner.id : currentUser.id;

    if (apiActions.createSettlement) {
      await apiActions.createSettlement({ payerId, receiverId, amount });
    } else {
      await apiActions.addTransaction({
        spaceId: activeSpaceId,
        amount,
        description: `Thanh toán cấn trừ`,
        category: 'other',
        date: new Date().toISOString(),
        paidBy: payerId,
        splitType: 'exact',
        splits: { [receiverId]: amount },
        isSettlement: true,
      });
    }
    setShowSettleModal(false);
    setSettleAmount('');
  };

  return (
    <div className="settle-page">
      {/* Balance Card */}
      <div className="settle-balance glass-card animate-fadeInUp">
        <div className="balance-visual">
          <div className="balance-person">
            <div className="avatar avatar-xl" style={{ background: getUserColor(currentUser?.id || '') }}>
              {getInitials(currentUser?.name)}
            </div>
            <span className="balance-person-name">{currentUser?.name}</span>
          </div>

          <div className="balance-arrow-container">
            <div className={`balance-arrow ${balance > 0 ? 'owed' : balance < 0 ? 'owes' : 'settled'}`}>
              {balance > 0 ? (
                <>
                  <TrendingDown size={20} />
                  <ArrowRight size={20} style={{ transform: 'rotate(180deg)' }} />
                </>
              ) : balance < 0 ? (
                <>
                  <ArrowRight size={20} />
                  <TrendingUp size={20} />
                </>
              ) : (
                <Check size={24} />
              )}
            </div>
            <div className={`balance-amount ${balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'neutral'}`}>
              {formatCurrency(Math.abs(balance))}
            </div>
            <div className="balance-status">
              {balance > 0 ? `${partner?.name} nợ bạn` :
               balance < 0 ? `Bạn nợ ${partner?.name}` :
               'Đã cân bằng! 🎉'}
            </div>
          </div>

          <div className="balance-person">
            <div className="avatar avatar-xl" style={{ background: getUserColor(partner?.id || '') }}>
              {getInitials(partner?.name)}
            </div>
            <span className="balance-person-name">{partner?.name}</span>
          </div>
        </div>

        {balance !== 0 && (
          <button
            className="btn-primary btn-lg settle-btn"
            onClick={() => {
              setSettleAmount(Math.abs(balance).toString());
              setShowSettleModal(true);
            }}
          >
            <Wallet size={20} />
            Trả nợ / Ghi nhận thanh toán
          </button>
        )}
      </div>

      {/* How it works */}
      <div className="settle-how glass-card animate-fadeInUp stagger-2">
        <h3 className="settle-how-title">Cách hoạt động</h3>
        <div className="settle-steps">
          <div className="settle-step">
            <div className="step-number">1</div>
            <div>
              <strong>Ghi chép giao dịch</strong>
              <p>Mỗi khi có khoản chi chung, ghi lại và chia tiền</p>
            </div>
          </div>
          <div className="settle-step">
            <div className="step-number">2</div>
            <div>
              <strong>Tự động tính toán</strong>
              <p>Hệ thống tự tính ai nợ ai bao nhiêu</p>
            </div>
          </div>
          <div className="settle-step">
            <div className="step-number">3</div>
            <div>
              <strong>Thanh toán & Cân bằng</strong>
              <p>Chuyển khoản và ghi nhận để đưa số dư về 0</p>
            </div>
          </div>
        </div>
      </div>

      {/* Settlement History */}
      {settlements.length > 0 && (
        <div className="settle-history glass-card animate-fadeInUp stagger-3">
          <h3 className="section-title">
            <Wallet size={18} />
            Lịch sử thanh toán
          </h3>
          <div className="settle-list">
            {settlements.map(tx => {
              const payer = users[tx.paidBy];
              return (
                <div key={tx.id} className="settle-item">
                  <div className="settle-item-icon">
                    <Check size={16} />
                  </div>
                  <div className="settle-item-info">
                    <span className="settle-item-desc">
                      {payer?.name} đã thanh toán
                    </span>
                    <span className="settle-item-date">
                      {new Date(tx.date).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <span className="settle-item-amount">{formatCurrency(tx.amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settle Modal */}
      {showSettleModal && (
        <div className="modal-overlay" onClick={() => setShowSettleModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Ghi nhận thanh toán</h2>
              <button className="modal-close" onClick={() => setShowSettleModal(false)}>✕</button>
            </div>

            <div className="settle-modal-body">
              <p className="settle-modal-desc">
                {balance < 0
                  ? `Bạn đang nợ ${partner?.name} ${formatCurrency(Math.abs(balance))}. Ghi nhận số tiền đã chuyển khoản:`
                  : `${partner?.name} đang nợ bạn ${formatCurrency(Math.abs(balance))}. Ghi nhận số tiền đã nhận:`}
              </p>

              <div className="form-group">
                <label className="form-label">Số tiền thanh toán (₫)</label>
                <input
                  type="number"
                  className="form-input"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  autoFocus
                  min="0"
                />
              </div>

              <div className="form-actions">
                <button className="btn-secondary" onClick={() => setShowSettleModal(false)}>
                  Hủy
                </button>
                <button className="btn-primary" onClick={handleSettle}>
                  <Check size={18} />
                  Xác nhận thanh toán
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
