// 实时通信管理器
class RealtimeManager {
  constructor() {
    this.eventSource = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3; // 减少SSE重试次数
    this.reconnectDelay = 1000; // 1秒
    this.deviceId = null;
    this.listeners = new Map();
    this.longPollingActive = false;
    this.longPollingTimeout = null;
  }

  // 初始化实时连接
  init(deviceId) {
    this.deviceId = deviceId;
    this.connect();
  }

  // 建立SSE连接
  connect() {
    if (this.eventSource) {
      this.disconnect();
    }

    try {
      // 获取认证token
      const token = Auth && Auth.getToken() ? Auth.getToken() : "";
      const url = `/api/events?deviceId=${encodeURIComponent(
        this.deviceId
      )}&token=${encodeURIComponent(token)}`;
      this.eventSource = new EventSource(url);

      // 连接成功
      this.eventSource.addEventListener("connection", (event) => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit("connected");
        UI.setConnectionStatus("connected");
      });

      // 接收消息
      this.eventSource.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.newMessages > 0) {
            // 有新消息，触发刷新
            this.emit("newMessages", data);
            // 立即加载消息，强制滚动到底部
            MessageHandler.loadMessages(true);
          }
        } catch (error) {
          // 静默处理解析错误
        }
      });

      // 接收清空所有消息的通知
      this.eventSource.addEventListener("clearAll", (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.action === "clearAll") {
            // 清空所有消息，实时更新UI
            this.emit("clearAll", data);
            MessageHandler.clearAllMessages();
          }
        } catch (error) {
          console.error("解析清空消息失败:", error);
        }
      });

      // 接收删除单条消息的通知
      this.eventSource.addEventListener("messageDeleted", (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.messageId) {
            // 删除单条消息，实时更新UI
            this.emit("messageDeleted", data);
          }
        } catch (error) {
          console.error("解析删除消息失败:", error);
        }
      });

      // 心跳检测
      this.eventSource.addEventListener("heartbeat", (event) => {
        this.emit("heartbeat");
      });

      // 连接错误
      this.eventSource.onerror = (event) => {
        this.isConnected = false;
        this.emit("disconnected");
        UI.setConnectionStatus("disconnected");

        // 自动重连
        this.handleReconnect();
      };
    } catch (error) {
      this.handleReconnect();
    }
  }

  // 断开连接
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.stopLongPolling();
    this.isConnected = false;
    this.emit("disconnected");
  }

  // 处理重连逻辑
  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.fallbackToLongPolling();
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 指数退避

    UI.setConnectionStatus("reconnecting");

    // PWA环境下的特殊处理
    const isPWA =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    // PWA环境下使用更短的重连延迟
    const pwaDelay = isPWA ? Math.min(delay, 2000) : delay;

    setTimeout(() => {
      if (!this.isConnected) {
        this.connect();
      }
    }, pwaDelay);
  }

  // 降级到长轮询
  fallbackToLongPolling() {
    this.disconnect();
    this.startLongPolling();
  }

  // 开始长轮询
  startLongPolling() {
    if (this.longPollingActive) {
      return;
    }

    this.longPollingActive = true;
    this.longPoll();
  }

  // 停止长轮询
  stopLongPolling() {
    this.longPollingActive = false;
    if (this.longPollingTimeout) {
      clearTimeout(this.longPollingTimeout);
      this.longPollingTimeout = null;
    }
  }

  // 长轮询实现
  async longPoll() {
    if (!this.longPollingActive) {
      return;
    }

    try {
      const lastMessageId = this.getLastMessageId();
      const url = `/api/poll?deviceId=${encodeURIComponent(
        this.deviceId
      )}&lastMessageId=${lastMessageId}&timeout=30`;

      // 添加认证头
      const headers = Auth ? Auth.addAuthHeader({}) : {};
      const response = await fetch(url, { headers });
      const data = await response.json();

      if (data.success && data.hasNewMessages) {
        this.emit("newMessages", { newMessages: data.newMessageCount });
        // 立即加载消息，强制滚动到底部
        MessageHandler.loadMessages(true);
      }

      // 设置连接状态
      if (!this.isConnected) {
        this.isConnected = true;
        this.emit("connected");
        UI.setConnectionStatus("connected");
      }
    } catch (error) {
      this.isConnected = false;
      this.emit("disconnected");
      UI.setConnectionStatus("disconnected");
    }

    // 继续下一次轮询
    if (this.longPollingActive) {
      this.longPollingTimeout = setTimeout(() => {
        this.longPoll();
      }, 1000); // 1秒后继续
    }
  }

  // 获取最后一条消息ID
  getLastMessageId() {
    const messages = MessageHandler.lastMessages || [];
    if (messages.length > 0) {
      return messages[messages.length - 1].id || "0";
    }
    return "0";
  }

  // 检查连接状态
  isConnectionAlive() {
    // SSE连接活跃
    if (this.eventSource && this.eventSource.readyState === EventSource.OPEN) {
      return true;
    }
    // 长轮询活跃
    if (this.longPollingActive && this.isConnected) {
      return true;
    }
    return false;
  }

  // 事件监听器
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  // 移除事件监听器
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // 触发事件
  emit(event, data = null) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`事件回调执行失败 [${event}]:`, error);
        }
      });
    }
  }

  // 手动触发消息检查
  checkMessages() {
    if (this.isConnectionAlive()) {
      // SSE连接正常，等待服务器推送
      return;
    }

    // SSE连接异常，降级到轮询
    MessageHandler.loadMessages();
  }

  // 获取连接状态
  getStatus() {
    if (!this.eventSource) return "disconnected";

    switch (this.eventSource.readyState) {
      case EventSource.CONNECTING:
        return "connecting";
      case EventSource.OPEN:
        return "connected";
      case EventSource.CLOSED:
        return "disconnected";
      default:
        return "unknown";
    }
  }

  // 销毁管理器
  destroy() {
    this.disconnect();
    this.stopLongPolling();
    this.listeners.clear();
    this.deviceId = null;
    this.reconnectAttempts = 0;
    this.longPollingActive = false;
  }
}

// 创建全局实例
const Realtime = new RealtimeManager();

// 网络状态监听
window.addEventListener("online", () => {
  // PWA环境下的特殊处理
  const isPWA =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (isPWA) {
    // PWA环境：延迟重连，确保网络完全恢复
    setTimeout(() => {
      if (!Realtime.isConnectionAlive()) {
        Realtime.connect();
      }
    }, 1000);
  } else {
    // 普通浏览器环境：立即重连
    if (!Realtime.isConnectionAlive()) {
      Realtime.connect();
    }
  }
});

window.addEventListener("offline", () => {
  UI.setConnectionStatus("offline");
});

// 页面可见性变化监听
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    // 页面变为可见时，检查连接状态
    if (!Realtime.isConnectionAlive()) {
      Realtime.connect();
    }
  }
});

// 监听删除消息事件
Realtime.on("messageDeleted", (data) => {
  if (data.messageId) {
    // 删除单条消息，实时更新UI
    UI.removeMessageFromUI(data.messageId);
  }
});

// 导出到全局
window.Realtime = Realtime;
