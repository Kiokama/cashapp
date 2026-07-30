/**
 * CashApp Client WebSocket Service
 * Provides real-time synchronization between couple members
 */
class WebSocketService {
  constructor() {
    this.ws = null;
    this.listeners = new Set();
    this.currentSpaceId = null;
    this.reconnectTimer = null;
  }

  connect(spaceId) {
    if (!spaceId) return;
    this.currentSpaceId = spaceId;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.subscribe(spaceId);
      }
      return;
    }

    let wsUrl = window.__ENV__?.VITE_WS_URL || import.meta.env.VITE_WS_URL || 'wss://cashapp-up0q.onrender.com/ws';
    // Auto-correct if user accidentally set VITE_WS_URL to end with /api/v1
    if (wsUrl.endsWith('/api/v1')) {
      wsUrl = wsUrl.replace('/api/v1', '/ws');
    }
    // Auto-correct if user accidentally set VITE_WS_URL to localhost
    if (wsUrl.includes('localhost')) {
      wsUrl = 'wss://cashapp-up0q.onrender.com/ws';
    }

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('⚡ [Real-time WS] Connected to backend websocket');
        this.subscribe(spaceId);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('⚡ [Real-time WS] Event received:', data);
          this.notifyListeners(data);
        } catch (e) {
          console.error('Error parsing WS message', e);
        }
      };

      this.ws.onclose = () => {
        console.warn('⚡ [Real-time WS] Disconnected. Reconnecting in 3s...');
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          if (this.currentSpaceId) this.connect(this.currentSpaceId);
        }, 3000);
      };

      this.ws.onerror = (err) => {
        console.warn('⚡ [Real-time WS] Error connection fallback', err);
      };
    } catch (e) {
      console.warn('⚡ [Real-time WS] Initialization error:', e);
    }
  }

  subscribe(spaceId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'SUBSCRIBE_SPACE', spaceId }));
    }
  }

  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners(data) {
    this.listeners.forEach(callback => callback(data));
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const wsService = new WebSocketService();
