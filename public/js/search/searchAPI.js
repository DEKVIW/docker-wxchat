// 搜索API模块 - 封装搜索相关的API调用

const SearchAPI = {
  // 搜索缓存
  cache: new Map(),
  cacheTimeout: 5 * 60 * 1000, // 5分钟缓存

  // 执行搜索（本地优先，后端兜底）
  async search(query, filters = {}) {
    try {
      // 1. 本地优先搜索
      if (
        window.MessageHandler &&
        typeof MessageHandler.getLocalCache === "function"
      ) {
        const localMessages = MessageHandler.getLocalCache();
        const localResults = localMessages.filter((msg) => {
          // 支持文本和文件名模糊匹配
          if (msg.type === "text" && msg.content && msg.content.includes(query))
            return true;
          if (
            msg.type === "file" &&
            msg.original_name &&
            msg.original_name.includes(query)
          )
            return true;
          return false;
        });
        if (localResults.length > 0) {
          return { success: true, data: localResults, local: true };
        }
      }
      // 2. 后端兜底
      // 构建缓存键
      const cacheKey = this.buildCacheKey(query, filters);

      // 检查缓存
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached.data;
        }
      }

      // 构建搜索参数
      const params = new URLSearchParams();
      params.append("q", query);

      if (filters.type && filters.type !== "all") {
        params.append("type", filters.type);
      }

      if (filters.timeRange && filters.timeRange !== "all") {
        params.append("timeRange", filters.timeRange);
      }

      if (filters.deviceId && filters.deviceId !== "all") {
        params.append("deviceId", filters.deviceId);
      }

      if (filters.fileType && filters.fileType !== "all") {
        params.append("fileType", filters.fileType);
      }

      params.append("limit", filters.limit || CONFIG.SEARCH.MAX_RESULTS);
      params.append("offset", filters.offset || 0);

      // 发送搜索请求
      const headers = {
        "Content-Type": "application/json",
      };

      // 添加认证头
      const authHeaders = Auth ? Auth.addAuthHeader(headers) : headers;

      const response = await fetch(
        `${CONFIG.API.BASE_URL}${CONFIG.API.ENDPOINTS.SEARCH}?${params}`,
        {
          method: "GET",
          headers: authHeaders,
        }
      );

      if (!response.ok) {
        throw new Error(`搜索请求失败: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "搜索失败");
      }

      // 缓存结果
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      console.error("搜索API错误:", error);
      throw error;
    }
  },

  // 获取搜索建议
  async getSuggestions(query) {
    try {
      if (!query || query.trim().length < CONFIG.SEARCH.MIN_QUERY_LENGTH) {
        return { success: true, data: [] };
      }

      const headers = {
        "Content-Type": "application/json",
      };

      // 添加认证头
      const authHeaders = Auth ? Auth.addAuthHeader(headers) : headers;

      const response = await fetch(
        `${CONFIG.API.BASE_URL}${
          CONFIG.API.ENDPOINTS.SEARCH_SUGGESTIONS
        }?q=${encodeURIComponent(query)}`,
        {
          method: "GET",
          headers: authHeaders,
        }
      );

      if (!response.ok) {
        throw new Error(`建议请求失败: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("搜索建议API错误:", error);
      return { success: true, data: [] }; // 静默失败，不影响主要搜索功能
    }
  },

  // 构建缓存键
  buildCacheKey(query, filters) {
    const parts = [query];

    if (filters.type) parts.push(`type:${filters.type}`);
    if (filters.timeRange) parts.push(`time:${filters.timeRange}`);
    if (filters.deviceId) parts.push(`device:${filters.deviceId}`);
    if (filters.fileType) parts.push(`file:${filters.fileType}`);
    if (filters.limit) parts.push(`limit:${filters.limit}`);
    if (filters.offset) parts.push(`offset:${filters.offset}`);

    return parts.join("|");
  },

  // 清除缓存
  clearCache() {
    this.cache.clear();
  },

  // 清除过期缓存
  cleanExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  },

  // 获取文件类型分类
  getFileTypeCategories() {
    return CONFIG.SEARCH.FILE_TYPE_CATEGORIES;
  },

  // 格式化搜索结果
  formatSearchResults(results) {
    if (!results || !results.data || !Array.isArray(results.data)) {
      return [];
    }

    return results.data.map((item) => {
      // 格式化时间戳
      const timestamp = new Date(item.timestamp);
      const formattedTime = this.formatTimestamp(timestamp);

      // 获取文件图标
      let icon = "💬";
      if (item.type === "file" && item.mime_type) {
        icon = Utils.getFileIcon(item.mime_type, item.original_name);
      }

      // 处理内容显示
      let displayContent = item.content || "";
      let fileName = "";

      if (item.type === "file") {
        fileName = item.original_name || "未知文件";
        displayContent = fileName;
      }

      // 检测AI消息类型
      let messageType = item.type;
      let isAIMessage = false;

      if (item.content) {
        if (item.content.startsWith("[AI]")) {
          messageType = "ai_response";
          isAIMessage = true;
          displayContent = item.content.replace("[AI]", "").trim();
        } else if (item.content.startsWith("[AI-THINKING]")) {
          messageType = "ai_thinking";
          isAIMessage = true;
          displayContent = item.content.replace("[AI-THINKING]", "").trim();
        }
      }

      return {
        ...item,
        formattedTime,
        icon,
        displayContent,
        fileName,
        messageType,
        isAIMessage,
        fileSize: item.file_size ? Utils.formatFileSize(item.file_size) : null,
      };
    });
  },

  // 格式化时间戳
  formatTimestamp(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // 今天，显示时间
      return date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffDays === 1) {
      // 昨天
      return (
        "昨天 " +
        date.toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } else if (diffDays < 7) {
      // 一周内
      const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
      return (
        weekdays[date.getDay()] +
        " " +
        date.toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } else {
      // 超过一周，显示日期
      return (
        date.toLocaleDateString("zh-CN") +
        " " +
        date.toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }
  },
};

// 定期清理过期缓存
setInterval(() => {
  SearchAPI.cleanExpiredCache();
}, 10 * 60 * 1000); // 每10分钟清理一次

// 导出到全局
if (typeof window !== "undefined") {
  window.SearchAPI = SearchAPI;
}

// 模块导出
if (typeof module !== "undefined" && module.exports) {
  module.exports = SearchAPI;
}
