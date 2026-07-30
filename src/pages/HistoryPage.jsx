import { useApp } from '../context/AppContext';
import { History, Edit3, Plus, Trash2, ArrowRight } from 'lucide-react';
import { formatCurrency, formatRelativeTime, getInitials, getUserColor } from '../utils/helpers';
import './HistoryPage.css';

export default function HistoryPage() {
  const { state } = useApp();
  const { auditLog, users } = state;

  const getActionIcon = (action) => {
    switch (action) {
      case 'created': return <Plus size={14} />;
      case 'edited': return <Edit3 size={14} />;
      case 'deleted': return <Trash2 size={14} />;
      default: return <History size={14} />;
    }
  };

  const getActionLabel = (action) => {
    switch (action) {
      case 'created': return 'Đã tạo';
      case 'edited': return 'Đã sửa';
      case 'deleted': return 'Đã xóa';
      default: return action;
    }
  };

  const getActionClass = (action) => {
    switch (action) {
      case 'created': return 'action-created';
      case 'edited': return 'action-edited';
      case 'deleted': return 'action-deleted';
      default: return '';
    }
  };

  return (
    <div className="history-page">
      <div className="history-intro animate-fadeInUp">
        <p className="history-desc">
          Lịch sử thay đổi của tất cả giao dịch. Đảm bảo tính minh bạch và tránh nhầm lẫn.
        </p>
      </div>

      <div className="audit-timeline animate-fadeInUp stagger-2">
        {auditLog.length === 0 ? (
          <div className="empty-state glass-card">
            <div className="empty-state-icon"><History size={28} /></div>
            <h3 className="empty-state-title">Chưa có lịch sử</h3>
            <p className="empty-state-desc">Lịch sử sẽ được ghi lại khi có giao dịch mới</p>
          </div>
        ) : (
          auditLog.map((entry, idx) => {
            const user = users[entry.userId];
            return (
              <div key={entry.id} className="timeline-item">
                <div className="timeline-line" />
                <div className={`timeline-dot ${getActionClass(entry.action)}`}>
                  {getActionIcon(entry.action)}
                </div>
                <div className="timeline-content glass-card-sm">
                  <div className="timeline-header">
                    <div className="timeline-user">
                      <div
                        className="avatar avatar-sm"
                        style={{ background: getUserColor(entry.userId) }}
                      >
                        {getInitials(user?.name)}
                      </div>
                      <strong>{user?.name || 'Unknown'}</strong>
                    </div>
                    <span className={`badge ${
                      entry.action === 'created' ? 'badge-success' :
                      entry.action === 'edited' ? 'badge-warning' :
                      'badge-danger'
                    }`}>
                      {getActionLabel(entry.action)}
                    </span>
                  </div>
                  <p className="timeline-desc">
                    {entry.description || 'Giao dịch'}
                  </p>
                  {entry.changes?.amount && (
                    <div className="timeline-changes">
                      <span className="change-from">{formatCurrency(entry.changes.amount.from)}</span>
                      <ArrowRight size={14} />
                      <span className="change-to">{formatCurrency(entry.changes.amount.to)}</span>
                    </div>
                  )}
                  <span className="timeline-time">{formatRelativeTime(entry.timestamp)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
