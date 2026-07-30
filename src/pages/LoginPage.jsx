import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, Mail, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';
import './LoginPage.css';

export default function LoginPage() {
  const { apiActions } = useApp();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    if (isRegister) {
      await apiActions.register({ name, email, password });
    } else {
      await apiActions.login({ email, password });
    }
    setIsLoading(false);
  };

  const handleSocialLogin = async (provider) => {
    setIsLoading(true);
    await apiActions.login({ provider });
    setIsLoading(false);
  };

  return (
    <div className="login-page">
      {/* Ambient background */}
      <div className="login-ambient">
        <div className="ambient-orb orb-1" />
        <div className="ambient-orb orb-2" />
        <div className="ambient-orb orb-3" />
      </div>

      <div className="login-container animate-scaleIn">
        {/* Logo */}
        <div className="login-logo">
          <div className="logo-icon">
            <Sparkles size={28} />
          </div>
          <h1 className="logo-text gradient-text">CashApp</h1>
          <p className="logo-subtitle">
            {isRegister ? 'Tạo tài khoản mới cho cặp đôi' : 'Quản lý chi tiêu thông minh cho cặp đôi'}
          </p>
        </div>

        {/* Social Login */}
        <div className="social-login">
          <button
            className="social-btn google-btn"
            onClick={() => handleSocialLogin('google')}
            disabled={isLoading}
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>{isRegister ? 'Đăng ký với Google' : 'Đăng nhập với Google'}</span>
          </button>

          <button
            className="social-btn apple-btn"
            onClick={() => handleSocialLogin('apple')}
            disabled={isLoading}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            <span>{isRegister ? 'Đăng ký với Apple' : 'Đăng nhập với Apple'}</span>
          </button>
        </div>

        {/* Divider */}
        <div className="login-divider">
          <span>hoặc</span>
        </div>

        {/* Auth form */}
        <form className="login-form" onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label className="form-label" htmlFor="name">Họ và tên</label>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <input
                  id="name"
                  type="text"
                  className="form-input with-icon"
                  placeholder="Ví dụ: Minh Anh"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={isRegister}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <div className="input-wrapper">
              <Mail size={18} className="input-icon" />
              <input
                id="email"
                type="email"
                className="form-input with-icon"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Mật khẩu</label>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-input with-icon"
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={`btn-primary btn-lg login-submit ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="spinner" />
            ) : (
              <>
                <span>{isRegister ? 'Đăng ký tài khoản' : 'Đăng nhập'}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <p className="login-footer">
          {isRegister ? (
            <>
              Đã có tài khoản?{' '}
              <button className="link-btn" onClick={() => setIsRegister(false)}>
                Đăng nhập ngay
              </button>
            </>
          ) : (
            <>
              Chưa có tài khoản?{' '}
              <button className="link-btn" onClick={() => setIsRegister(true)}>
                Đăng ký miễn phí
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
