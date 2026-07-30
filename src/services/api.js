import { mockBackend } from './mockBackend';

const API_BASE_URL = window.__ENV__?.VITE_API_URL || 'http://localhost:5000/api/v1';

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
      console.warn(`[API] Server request to ${endpoint} failed or offline, using Mock fallback.`, err.message);
      return null;
    }
  }

  // 1. Auth & Users
  async register(userData) {
    const remote = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    if (remote) {
      if (remote.token) this.setToken(remote.token);
      return remote;
    }
    const res = await mockBackend.login({ email: userData.email, name: userData.name });
    if (res.data?.token) this.setToken(res.data.token);
    return res.data;
  }

  async login(credentials) {
    const remote = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (remote) {
      if (remote.token) this.setToken(remote.token);
      return remote;
    }
    const res = await mockBackend.login(credentials);
    if (res.data?.token) this.setToken(res.data.token);
    return res.data;
  }

  async logout() {
    this.setToken(null);
    return { success: true };
  }

  async getProfile() {
    const remote = await this.request('/users/me');
    if (remote) return remote;
    const res = await mockBackend.getProfile();
    return res.data;
  }

  async updateProfile(updates) {
    const remote = await this.request('/users/me', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (remote) return remote;
    const res = await mockBackend.updateProfile(updates);
    return res.data;
  }

  // 2. Shared Spaces
  async getSpaces() {
    const remote = await this.request('/spaces');
    if (remote) return remote;
    const res = await mockBackend.getSpaces();
    return res.data;
  }

  async getSpace(spaceId) {
    const remote = await this.request(`/spaces/${spaceId}`);
    if (remote) return remote;
    const res = await mockBackend.getSpace(spaceId);
    return res.data;
  }

  async createSpace(data) {
    const remote = await this.request('/spaces', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (remote) return remote;
    const res = await mockBackend.createSpace(data);
    return res.data;
  }

  async joinSpace(data) {
    const remote = await this.request('/spaces/join', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (remote) return remote;
    const res = await mockBackend.joinSpace(data);
    if (res.status >= 400) throw new Error(res.error);
    return res.data;
  }

  // 3. Transactions
  async getTransactions(spaceId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const endpoint = `/spaces/${spaceId}/transactions${query ? `?${query}` : ''}`;
    const remote = await this.request(endpoint);
    if (remote && remote.content) return remote.content;
    const res = await mockBackend.getTransactions(spaceId, params);
    return res.data;
  }

  async createTransaction(spaceId, payload) {
    const remote = await this.request(`/spaces/${spaceId}/transactions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (remote) return remote;
    const res = await mockBackend.createTransaction(spaceId, payload);
    if (res.status >= 400) throw new Error(res.error);
    return res.data;
  }

  async updateTransaction(spaceId, transactionId, payload) {
    const remote = await this.request(`/spaces/${spaceId}/transactions/${transactionId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (remote) return remote;
    const res = await mockBackend.updateTransaction(spaceId, transactionId, payload);
    if (res.status >= 400) throw new Error(res.error);
    return res.data;
  }

  async deleteTransaction(spaceId, transactionId) {
    const remote = await this.request(`/spaces/${spaceId}/transactions/${transactionId}`, {
      method: 'DELETE',
    });
    if (remote) return remote;
    const res = await mockBackend.deleteTransaction(spaceId, transactionId);
    if (res.status >= 400) throw new Error(res.error);
    return res.data;
  }

  // 4. Balances & Settlements
  async getBalances(spaceId) {
    const remote = await this.request(`/spaces/${spaceId}/balances`);
    if (remote) return remote;
    const res = await mockBackend.getBalances(spaceId);
    return res.data;
  }

  async createSettlement(spaceId, payload) {
    const remote = await this.request(`/spaces/${spaceId}/settlements`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (remote) return remote;
    const res = await mockBackend.createSettlement(spaceId, payload);
    if (res.status >= 400) throw new Error(res.error);
    return res.data;
  }

  // 5. Analytics & Budgets
  async getCategorySummary(spaceId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const remote = await this.request(`/spaces/${spaceId}/analytics/category-summary${query ? `?${query}` : ''}`);
    if (remote) return remote;
    const res = await mockBackend.getCategorySummary(spaceId, params);
    return res.data;
  }

  async getTrend(spaceId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const remote = await this.request(`/spaces/${spaceId}/analytics/trend${query ? `?${query}` : ''}`);
    if (remote) return remote;
    const res = await mockBackend.getTrend(spaceId, params);
    return res.data;
  }

  async getBudgets(spaceId) {
    const remote = await this.request(`/spaces/${spaceId}/budgets`);
    if (remote) return remote;
    const res = await mockBackend.getBudgets(spaceId);
    return res.data;
  }

  async updateBudget(spaceId, categoryId, amount) {
    const remote = await this.request(`/spaces/${spaceId}/budgets/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify({ amount }),
    });
    if (remote) return remote;
    const res = await mockBackend.updateBudget(spaceId, categoryId, amount);
    if (res.status >= 400) throw new Error(res.error);
    return res.data;
  }

  // 6. Advanced
  async getAuditLogs(spaceId) {
    const remote = await this.request(`/spaces/${spaceId}/audit-logs`);
    if (remote) return remote;
    const res = await mockBackend.getAuditLogs(spaceId);
    return res.data;
  }

  async getNotifications() {
    const remote = await this.request('/notifications');
    if (remote) return remote;
    const res = await mockBackend.getNotifications();
    return res.data;
  }

  async markNotificationRead(notifId) {
    const remote = await this.request(`/notifications/${notifId}/read`, { method: 'PUT' });
    if (remote) return remote;
    const res = await mockBackend.markNotificationRead(notifId);
    return res.data;
  }

  async markAllNotificationsRead() {
    const remote = await this.request('/notifications/read-all', { method: 'PUT' });
    if (remote) return remote;
    return { success: true };
  }

  async leaveSpace(spaceId) {
    const remote = await this.request(`/spaces/${spaceId}/leave`, { method: 'POST' });
    if (remote) return remote;
    return { success: true };
  }
}

export const api = new ApiService();
