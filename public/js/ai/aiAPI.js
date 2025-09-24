// SiliconFlow AI API 封装
// 专门处理与SiliconFlow API的通信和DeepSeek-R1模型的流式响应

const AIAPI = {
  // 当前请求的AbortController
  currentController: null,

  // 流式聊天 - 核心方法
  async streamChat(message, callbacks = {}) {
    // 取消之前的请求
    if (this.currentController) {
      this.currentController.abort();
    }

    this.currentController = new AbortController();

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("wxchat_auth_token")}`,
        },
        body: JSON.stringify({
          message: message,
          model: CONFIG.AI.MODEL,
          max_tokens: CONFIG.AI.MAX_TOKENS,
          temperature: CONFIG.AI.TEMPERATURE,
          stream: CONFIG.AI.STREAM, // 使用配置中的流式设置
        }),
        signal: this.currentController.signal,
      });

      if (!response.ok) {
        throw new Error(
          `API请求失败: ${response.status} ${response.statusText}`
        );
      }

      // 处理流式响应
      return await this.processStreamResponse(response, callbacks);
    } catch (error) {
      if (error.name === "AbortError") {
        return { thinking: "", response: "", cancelled: true };
      }

      console.error("AIAPI: 请求失败", error);
      throw error;
    } finally {
      this.currentController = null;
    }
  },

  // 处理流式响应
  async processStreamResponse(response, callbacks) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let thinking = "";
    let finalResponse = "";
    let buffer = "";
    let isInThinking = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 解码数据块
        buffer += decoder.decode(value, { stream: true });

        // 按行处理
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // 保留不完整的行

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";

              if (content) {
                // 检测思考过程标签
                if (content.includes("<think>")) {
                  isInThinking = true;
                  thinking += content;
                  callbacks.onThinking?.(thinking);
                } else if (content.includes("</think>")) {
                  isInThinking = false;
                  thinking += content;
                  callbacks.onThinking?.(thinking);
                  callbacks.onThinkingComplete?.(thinking);
                } else if (isInThinking) {
                  // 在思考过程中
                  thinking += content;
                  callbacks.onThinking?.(thinking);
                } else {
                  // 最终回答
                  finalResponse += content;
                  callbacks.onResponse?.(content, finalResponse);
                }
              }
            } catch (parseError) {
              console.warn("AIAPI: 解析数据失败", parseError, data);
            }
          }
        }
      }

      return {
        thinking: this.cleanThinkingContent(thinking),
        response: finalResponse.trim(),
      };
    } catch (error) {
      console.error("AIAPI: 流式处理错误", error);
      throw error;
    } finally {
      reader.releaseLock();
    }
  },

  // 清理思考内容，移除标签
  cleanThinkingContent(thinking) {
    if (!thinking) return "";

    return thinking
      .replace(/<think>/g, "")
      .replace(/<\/think>/g, "")
      .trim();
  },

  // 取消当前请求
  cancelCurrentRequest() {
    if (this.currentController) {
      this.currentController.abort();
      this.currentController = null;
    }
  },

  // 检查API配置
  validateConfig() {
    if (!CONFIG.AI.ENABLED) {
      throw new Error("AI功能未启用");
    }

    return true;
  },

  // 测试API连接
  async testConnection() {
    try {
      this.validateConfig();

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("wxchat_auth_token")}`,
        },
        body: JSON.stringify({
          message: "test",
          model: CONFIG.AI.MODEL,
        }),
      });

      if (response.ok) {
        return true;
      } else {
        console.error("AIAPI: API连接测试失败", response.status);
        return false;
      }
    } catch (error) {
      console.error("AIAPI: API连接测试异常", error);
      return false;
    }
  },

  // 获取API状态
  getStatus() {
    return {
      enabled: CONFIG.AI.ENABLED,
      model: CONFIG.AI.MODEL,
      isRequesting: !!this.currentController,
    };
  },
};

// 导出到全局
window.AIAPI = AIAPI;
