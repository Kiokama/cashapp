import { useApp } from '../context/AppContext';
import { CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export default function ToastContainer() {
  const { state } = useApp();

  const icons = {
    success: <CheckCircle size={18} style={{ color: 'var(--color-success)' }} />,
    danger: <AlertCircle size={18} style={{ color: 'var(--color-danger)' }} />,
    warning: <AlertTriangle size={18} style={{ color: 'var(--color-warning)' }} />,
    info: <Info size={18} style={{ color: 'var(--color-info)' }} />,
  };

  if (state.toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {state.toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type || 'info'}`}>
          {icons[toast.type || 'info']}
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
