import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard, Receipt, PieChart, Wallet, History, Bell,
  Settings, LogOut, Menu, X, ChevronLeft, ChevronRight,
  Sparkles, Users, FileText
} from 'lucide-react';
import { getInitials, getUserColor } from '../utils/helpers';
import NotificationPanel from './NotificationPanel';
import './Layout.css';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Tổng quan' },
  { to: '/transactions', icon: Receipt, label: 'Giao dịch' },
  { to: '/analytics', icon: PieChart, label: 'Thống kê' },
  { to: '/budgets', icon: Wallet, label: 'Ngân sách' },
  { to: '/settle', icon: Users, label: 'Cấn trừ' },
  { to: '/history', icon: History, label: 'Lịch sử' },
  { to: '/export', icon: FileText, label: 'Xuất dữ liệu' },
];

export default function Layout() {
  const { state, dispatch } = useApp();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const location = useLocation();

  const activeSpace = state.spaces[state.activeSpaceId];
  const unreadCount = state.notifications.filter(n => !n.read).length;

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          {!sidebarCollapsed && (
            <div className="sidebar-brand animate-fadeIn">
              <div className="brand-icon">
                <Sparkles size={20} />
              </div>
              <div className="brand-text">
                <span className="brand-name gradient-text">CashApp</span>
                <span className="brand-tagline">Quản lý chi tiêu đôi</span>
              </div>
            </div>
          )}
          {sidebarCollapsed && (
            <div className="brand-icon collapsed-brand">
              <Sparkles size={20} />
            </div>
          )}
          <button
            className="sidebar-toggle btn-icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Mở rộng' : 'Thu gọn'}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Space indicator */}
        {activeSpace && !sidebarCollapsed && (
          <div className="sidebar-space animate-fadeIn">
            <span className="space-emoji">{activeSpace.emoji}</span>
            <div className="space-info">
              <span className="space-name">{activeSpace.name}</span>
              <span className="space-members">{activeSpace.members.length} thành viên</span>
            </div>
          </div>
        )}

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
              onClick={() => setMobileMenuOpen(false)}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon size={20} />
              {!sidebarCollapsed && <span>{item.label}</span>}
              {item.to === '/' && !sidebarCollapsed && unreadCount > 0 && (
                <span className="nav-badge">{unreadCount}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {!sidebarCollapsed && state.currentUser && (
            <div className="sidebar-user">
              <div
                className="avatar"
                style={{ background: getUserColor(state.currentUser.id) }}
              >
                {getInitials(state.currentUser.name)}
              </div>
              <div className="user-info">
                <span className="user-name">{state.currentUser.name}</span>
                <span className="user-email">{state.currentUser.email}</span>
              </div>
            </div>
          )}
          <button
            className={`nav-item logout-btn ${sidebarCollapsed ? 'collapsed' : ''}`}
            onClick={handleLogout}
            title="Đăng xuất"
          >
            <LogOut size={20} />
            {!sidebarCollapsed && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={`main-content ${sidebarCollapsed ? 'expanded' : ''}`}>
        {/* Top bar */}
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="btn-icon mobile-menu-btn"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={22} />
            </button>
            <h1 className="page-title">
              {navItems.find(i => {
                if (i.to === '/') return location.pathname === '/';
                return location.pathname.startsWith(i.to);
              })?.label || 'CashApp'}
            </h1>
          </div>
          <div className="topbar-right">
            <button
              className="btn-icon notification-btn"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="notification-dot">{unreadCount}</span>
              )}
            </button>
            {state.currentUser && (
              <div
                className="avatar topbar-avatar"
                style={{ background: getUserColor(state.currentUser.id) }}
              >
                {getInitials(state.currentUser.name)}
              </div>
            )}
          </div>

          {showNotifications && (
            <NotificationPanel onClose={() => setShowNotifications(false)} />
          )}
        </header>

        {/* Page content */}
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
