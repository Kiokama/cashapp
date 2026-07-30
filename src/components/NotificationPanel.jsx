import { useApp } from '../context/AppContext';
import { Bell, BellOff, CheckCheck, X, Receipt, Wallet, AlertTriangle } from 'lucide-react';
import { formatRelativeTime } from '../utils/helpers';
import './NotificationPanel.css';

export default function NotificationPanel({ onClose }) {
  const { state, dispatch } = useApp();
  const { notifications } = state;
  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotifIcon = (type) => {
    switch (type) {
      case 'expense_added': return <Receipt size={16} />;
      case 'settlement': return <Wallet size={16} />;
      case 'settle_request': return <Wallet size={16} />;
      case 'budget_warning': return <AlertTriangle size={16} />;
      default: return <Bell size={16} />;
    }
  };

  const getNotifClass = (type) => {
    switch (type) {
      case 'expense_added': return 'notif-icon-expense';
      case 'settlement': return 'notif-icon-settle';
      case 'settle_request': return 'notif-icon-settle';
      case 'budget_warning': return 'notif-icon-warning';
      default: return 'notif-icon-default';
    }
  };

  return (
    <div className="notification-panel animate-fadeInDown" onClick={(e) => e.stopPropagation()}>
      <div className="notif-header">
        <h3>Thông báo</h3>
        <div className="notif-actions">
          {unreadCount > 0 && (
            <button
              className="btn-ghost btn-sm"
              onClick={() => dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ' })}
            >
              <CheckCheck size={14} />
              Đánh dấu đã đọc
            </button>
          )}
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="notif-list">
        {notifications.length === 0 ? (
          <div className="notif-empty">
            <BellOff size={32} />
            <p>Chưa có thông báo nào</p>
          </div>
        ) : (
          notifications.slice(0, 20).map(notif => (
            <div
              key={notif.id}
              className={`notif-item ${!notif.read ? 'unread' : ''}`}
              onClick={() => dispatch({ type: 'MARK_NOTIFICATION_READ', payload: notif.id })}
            >
              <div className={`notif-icon ${getNotifClass(notif.type)}`}>
                {getNotifIcon(notif.type)}
              </div>
              <div className="notif-content">
                <p className="notif-message">{notif.message}</p>
                <span className="notif-time">{formatRelativeTime(notif.timestamp)}</span>
              </div>
              {!notif.read && <div className="notif-unread-dot" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
