
const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE_URL = import.meta.env.VITE_API_URL || (isLocal ? 'http://localhost:5000/api/v1' : 'https://cashapp-up0q.onrender.com/api/v1');

class ApiService {
  constructor() {
    this.token = localStorage.getItem('cashapp_auth_token') || null;
  }

  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem('cashapp_auth_token', token);
    else localStorage.removeItem('cashapp_auth_token');
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...options.headers,
    };

    try {
      const response = await fetch(url, { ...options, headers });
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.indexOf('application/json') !== -1) {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || `HTTP Error ${response.status}`);
        }
        return data;
      } else {
        const text = await response.text();
        if (!response.ok) {
          throw new Error(`HTTP Error ${response.status}: ${text.substring(0, 50)}...`);
        }
        return { success: true, data: text };
      }
    } catch (err) {
      console.error(`[API] Server request to ${endpoint} failed.`, err.message);
      if (err.message.includes('NetworkError') || err.message.includes('Failed to fetch')) {
        throw new Error('Lỗi kết nối máy chủ (Backend có thể đang khởi động hoặc mất kết nối). Vui lòng thử lại sau 30 giây.');
      }
      throw err;
    }
  }

  // 1. Auth & Users
  async register(userData) {
    const remote = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    if (remote?.token) this.setToken(remote.token);
    return remote;
  }

  async login(credentials) {
    const remote = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (remote?.token) this.setToken(remote.token);
    return remote;
  }

  async quickLogin(account) {
    const remote = await this.request('/auth/quick-login', {
      method: 'POST',
      body: JSON.stringify({ account }),
    });
    if (remote?.token) this.setToken(remote.token);
    return remote;
  }


  async logout() {
    this.setToken(null);
    return { success: true };
  }

  async getProfile() {
    const remote = await this.request('/users/me');
    return remote;
  }

  async updateProfile(updates) {
    const remote = await this.request('/users/me', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return remote;
  }

  // 2. Shared Spaces
  async getSpaces() {
    const remote = await this.request('/spaces');
    return remote;
  }

  async getSpace(spaceId) {
    const remote = await this.request(`/spaces/${spaceId}`);
    return remote;
  }

  async createSpace(data) {
    const remote = await this.request('/spaces', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return remote;
  }

  async joinSpace(data) {
    const remote = await this.request('/spaces/join', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return remote;
  }

  // 3. Transactions
  async getTransactions(spaceId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const endpoint = `/spaces/${spaceId}/transactions${query ? `?${query}` : ''}`;
    const remote = await this.request(endpoint);
    if (remote && remote.content) return remote.content;
  }

  async createTransaction(spaceId, payload) {
    const remote = await this.request(`/spaces/${spaceId}/transactions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return remote;
  }

  async updateTransaction(spaceId, transactionId, payload) {
    const remote = await this.request(`/spaces/${spaceId}/transactions/${transactionId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return remote;
  }

  async deleteTransaction(spaceId, transactionId) {
    const remote = await this.request(`/spaces/${spaceId}/transactions/${transactionId}`, {
      method: 'DELETE',
    });
    return remote;
  }

  // 4. Balances & Settlements
  async getBalances(spaceId) {
    const remote = await this.request(`/spaces/${spaceId}/balances`);
    return remote;
  }

  async createSettlement(spaceId, payload) {
    const remote = await this.request(`/spaces/${spaceId}/settlements`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return remote;
  }

  // 5. Analytics & Budgets
  async getCategorySummary(spaceId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const remote = await this.request(`/spaces/${spaceId}/analytics/category-summary${query ? `?${query}` : ''}`);
    return remote;
  }

  async getTrend(spaceId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const remote = await this.request(`/spaces/${spaceId}/analytics/trend${query ? `?${query}` : ''}`);
    return remote;
  }

  async getBudgets(spaceId) {
    const remote = await this.request(`/spaces/${spaceId}/budgets`);
    return remote;
  }

  async updateBudget(spaceId, categoryId, amount) {
    const remote = await this.request(`/spaces/${spaceId}/budgets/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify({ amount }),
    });
    return remote;
  }

  // 6. Advanced
  async getAuditLogs(spaceId) {
    const remote = await this.request(`/spaces/${spaceId}/audit-logs`);
    return remote;
  }

  async getNotifications() {
    const remote = await this.request('/notifications');
    return remote;
  }

  async markNotificationRead(notifId) {
    const remote = await this.request(`/notifications/${notifId}/read`, { method: 'PUT' });
    return remote;
  }

  async markAllNotificationsRead() {
    const remote = await this.request('/notifications/read-all', { method: 'PUT' });
    return remote;
  }

  async leaveSpace(spaceId) {
    const remote = await this.request(`/spaces/${spaceId}/leave`, { method: 'POST' });
    return remote;
  }
}

export const api = new ApiService();
