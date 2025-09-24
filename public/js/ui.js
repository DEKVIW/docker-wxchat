// UI 操作和渲染

const UI = {
  // DOM 元素缓存
  elements: {},

  // 消息缓存（用于增量更新）
  messageCache: new Map(),

  // 记录上一次连接状态
  _lastConnectionStatus: null,

  // 初始化UI
  init() {
    this.cacheElements();
    this.bindEvents();
  },

  // 缓存DOM元素
  cacheElements() {
    this.elements = {
      messageList: document.getElementById("messageList"),
      messageForm: document.getElementById("messageForm"),
      messageText: document.getElementById("messageText"),
      sendButton: document.getElementById("sendButton"),
      functionButton: document.getElementById("functionButton"),
      fileInput: document.getElementById("fileInput"),
      uploadStatus: document.getElementById("uploadStatus"),
      progressBar: document.getElementById("progressBar"),
      fileButton: document.getElementById("fileButton"),
    };
  },

  // 绑定事件
  bindEvents() {
    // 自动调整文本框高度和切换发送按钮
    this.elements.messageText.addEventListener("input", () => {
      this.autoResizeTextarea();
      this.checkInputAndToggleSendButton();
    });

    // 监听其他可能改变输入框内容的事件
    this.elements.messageText.addEventListener("paste", () => {
      // 粘贴后稍微延迟检查，确保内容已更新
      setTimeout(() => {
        this.checkInputAndToggleSendButton();
      }, 10);
    });

    this.elements.messageText.addEventListener("cut", () => {
      // 剪切后稍微延迟检查
      setTimeout(() => {
        this.checkInputAndToggleSendButton();
      }, 10);
    });

    // 回车发送消息
    this.elements.messageText.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        MessageHandler.sendMessage();
      }
    });

    // 初始化时检查输入状态
    this.checkInputAndToggleSendButton();
  },

  // 自动调整文本框高度
  autoResizeTextarea() {
    const textarea = this.elements.messageText;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  },

  // 显示加载状态
  showLoading(message = "加载中...") {
    this.elements.messageList.innerHTML = `
            <div class="loading">
                <div class="loading-spinner">⏳</div>
                <span>${message}</span>
            </div>
        `;
  },

  // 显示空状态
  showEmpty(message = "还没有消息，开始聊天吧！") {
    this.elements.messageList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💬</div>
                <p>${message}</p>
            </div>
        `;
  },

  // 渲染消息列表（增量更新）
  renderMessages(messages, forceScroll = false) {
    if (!messages || messages.length === 0) {
      this.showEmpty();
      this.messageCache.clear();
      return;
    }

    // 检查用户是否在底部
    const wasAtBottom = this.isAtBottom();

    // 数据库已经按时间戳升序排序，直接使用
    const sortedMessages = messages;

    // 确保顶部加载指示器存在
    this.ensureTopLoadingIndicator();

    // 执行增量更新
    this.updateMessagesIncremental(sortedMessages);

    // 只有在用户原本在底部或强制滚动时才滚动到底部
    if (wasAtBottom || forceScroll) {
      this.scrollToBottom();
    }
  },

  // 增量更新消息列表
  updateMessagesIncremental(messages) {
    const currentDeviceId = Utils.getDeviceId();
    const messageContainer = this.elements.messageList;

    // 如果是空状态，清空并重新开始
    if (messageContainer.querySelector(".empty-state")) {
      messageContainer.innerHTML = "";
      this.messageCache.clear();
    }

    // 确保顶部加载指示器存在
    this.ensureTopLoadingIndicator();

    // 创建新的消息ID集合
    const newMessageIds = new Set(messages.map((msg) => msg.id));

    // 移除不存在的消息（静默移除）
    this.messageCache.forEach((element, messageId) => {
      if (!newMessageIds.has(messageId)) {
        element.remove();
        this.messageCache.delete(messageId);
      }
    });

    // 批量处理新消息，减少DOM操作
    const fragment = document.createDocumentFragment();
    const newElements = [];

    messages.forEach((message, index) => {
      if (!this.messageCache.has(message.id)) {
        const messageElement = this.createMessageElement(
          message,
          currentDeviceId
        );

        // 新消息直接添加到fragment，保持数据库排序
        fragment.appendChild(messageElement);

        this.messageCache.set(message.id, messageElement);
        newElements.push(messageElement);
      }
    });

    // 一次性添加所有新消息到末尾（保持时间顺序）
    if (fragment.children.length > 0) {
      messageContainer.appendChild(fragment);
    }

    // 处理需要加载图片的消息
    messages.forEach((message) => {
      if (message._needsImageLoad) {
        const { r2Key, safeId } = message._needsImageLoad;
        // 使用setTimeout确保DOM完全插入后再加载图片
        setTimeout(() => {
          this.loadImageAsync(r2Key, safeId);
        }, 10);
      }
    });

    // 批量添加淡入动画
    if (newElements.length > 0) {
      requestAnimationFrame(() => {
        newElements.forEach((element) => {
          element.classList.add("fade-in");
        });
      });
    }
  },

  // 创建消息DOM元素
  createMessageElement(message, currentDeviceId) {
    const isOwn = message.device_id === currentDeviceId;
    const time = Utils.formatTime(message.timestamp);
    const deviceName = isOwn ? "我的设备" : "其他设备";

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${isOwn ? "own" : "other"}`;
    messageDiv.dataset.messageId = message.id;
    messageDiv.dataset.timestamp = message.timestamp;

    if (message.type === CONFIG.MESSAGE_TYPES.TEXT) {
      messageDiv.innerHTML = this.renderTextMessageContent(
        message,
        deviceName,
        time
      );
    } else if (message.type === CONFIG.MESSAGE_TYPES.FILE) {
      messageDiv.innerHTML = this.renderFileMessageContent(
        message,
        deviceName,
        time
      );
    } else if (message.type === CONFIG.MESSAGE_TYPES.AI_RESPONSE) {
      // AI消息使用特殊处理
      messageDiv.className = `message ai fade-in`;
      if (window.AIUI && typeof AIUI.createAIMessageElement === "function") {
        const aiElement = AIUI.createAIMessageElement(message);
        if (aiElement) {
          messageDiv.innerHTML = aiElement.innerHTML;
        }
      } else {
        // 降级处理：使用文本消息格式
        messageDiv.innerHTML = this.renderTextMessageContent(
          message,
          "AI助手",
          time
        );
      }
    }

    return messageDiv;
  },

  // 找到消息的正确插入位置
  findInsertPosition(message, allMessages, currentIndex) {
    const messageContainer = this.elements.messageList;
    const existingMessages = Array.from(messageContainer.children);

    // 如果是第一条消息或容器为空
    if (currentIndex === 0 || existingMessages.length === 0) {
      return existingMessages[0] || null;
    }

    // 查找下一条已存在的消息
    for (let i = currentIndex + 1; i < allMessages.length; i++) {
      const nextMessage = allMessages[i];
      const existingElement = this.messageCache.get(nextMessage.id);
      if (existingElement && messageContainer.contains(existingElement)) {
        return existingElement;
      }
    }

    return null; // 插入到末尾
  },

  // 渲染单个消息（保留用于兼容性）
  renderMessage(message, currentDeviceId) {
    const isOwn = message.device_id === currentDeviceId;
    const time = Utils.formatTime(message.timestamp);
    const deviceName = isOwn ? "我的设备" : "其他设备";

    if (message.type === CONFIG.MESSAGE_TYPES.TEXT) {
      return this.renderTextMessage(message, isOwn, deviceName, time);
    } else if (message.type === CONFIG.MESSAGE_TYPES.FILE) {
      return this.renderFileMessage(message, isOwn, deviceName, time);
    }

    return "";
  },

  // 渲染文本消息内容
  renderTextMessageContent(message, deviceName, time) {
    const hasMarkdown = Utils.markdown.hasMarkdownSyntax(message.content);
    const messageId = `msg-${message.id}`;

    // 默认显示渲染后的内容（如果有markdown语法）
    const displayContent = hasMarkdown
      ? Utils.markdown.renderToHtml(message.content)
      : this.escapeHtml(message.content);

    const textMessageClass = hasMarkdown
      ? "text-message markdown-rendered"
      : "text-message";
    const toggleButton = hasMarkdown
      ? `<button class="markdown-toggle" onclick="UI.toggleMarkdownView('${messageId}')" title="切换源码/渲染视图">📝</button>`
      : "";
    // 复制按钮，和内容平级
    const copyButton = `<button class=\"copy-btn\" onclick=\"UI.copyMessageContent('${messageId}')\" title=\"复制内容\">📋</button>`;
    // 删除按钮，放在左下角
    const deleteButton = `<button class=\"delete-btn\" onclick=\"UI.deleteMessage('${message.id}')\" title=\"删除消息\">🗑️</button>`;

    // 结构优化：内容和按钮平级，按钮贴在气泡右上角和右下角
    return `<div class="message-content">
        <div class="${textMessageClass}" id="${messageId}" data-original="${this.escapeHtml(
      message.content
    )}" data-rendered="${displayContent.replace(
      /"/g,
      "&quot;"
    )}" data-is-rendered="${hasMarkdown ? "true" : "false"}">
            ${displayContent}${toggleButton}
        </div>
        ${copyButton}
        ${deleteButton}
    </div><div class="message-meta"><span>${deviceName}</span><span class="message-time">${time}</span></div>`;
  },

  // 新增复制逻辑
  copyMessageContent(messageId) {
    const el = document.getElementById(messageId);
    if (!el) return;
    // 克隆节点，移除 markdown 按钮，只复制内容
    const clone = el.cloneNode(true);
    const btn = clone.querySelector(".markdown-toggle");
    if (btn) btn.remove();
    const text = clone.textContent.trim();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => {
          UI.showSuccess("复制成功");
        },
        () => {
          UI.showError("复制失败");
        }
      );
    } else {
      // 兼容旧浏览器
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        UI.showSuccess("复制成功");
      } catch (err) {
        UI.showError("复制失败");
      }
      document.body.removeChild(textarea);
    }
  },

  // 渲染文本消息（保留用于兼容性）
  renderTextMessage(message, isOwn, deviceName, time) {
    const hasMarkdown = Utils.markdown.hasMarkdownSyntax(message.content);
    const messageId = `msg-${message.id}`;

    // 默认显示渲染后的内容（如果有markdown语法）
    const displayContent = hasMarkdown
      ? Utils.markdown.renderToHtml(message.content)
      : this.escapeHtml(message.content);

    const textMessageClass = hasMarkdown
      ? "text-message markdown-rendered"
      : "text-message";
    const toggleButton = hasMarkdown
      ? `<button class="markdown-toggle" onclick="UI.toggleMarkdownView('${messageId}')" title="切换源码/渲染视图">📝</button>`
      : "";

    return `<div class="message ${
      isOwn ? "own" : "other"
    } fade-in"><div class="message-content"><div class="${textMessageClass}" id="${messageId}" data-original="${this.escapeHtml(
      message.content
    )}" data-rendered="${displayContent.replace(
      /"/g,
      "&quot;"
    )}" data-is-rendered="${
      hasMarkdown ? "true" : "false"
    }">${displayContent}${toggleButton}</div></div><div class="message-meta"><span>${deviceName}</span><span class="message-time">${time}</span></div></div>`;
  },

  // 渲染文件消息内容
  renderFileMessageContent(message, deviceName, time) {
    const fileIcon = Utils.getFileIcon(
      message.mime_type,
      message.original_name
    );
    const fileSize = Utils.formatFileSize(message.file_size);
    const isImage = Utils.isImageFile(message.mime_type);

    let imagePreview = "";
    if (isImage && message.r2_key) {
      // 创建安全的ID（移除特殊字符）
      const safeId = this.createSafeId(message.r2_key);
      const imageId = `img-${safeId}`;

      imagePreview = `<div class="image-preview" id="preview-${safeId}">
                <div class="image-loading" id="loading-${safeId}">
                    <div class="loading-spinner">⏳</div>
                    <span>加载图片中...</span>
                </div>
                <img id="${imageId}" alt="${this.escapeHtml(
        message.original_name
      )}" style="display: none;" />
                <div class="image-error" id="error-${safeId}" style="display: none;">
                    <span>🖼️ 图片加载失败</span>
                    <button onclick="UI.retryLoadImage('${
                      message.r2_key
                    }', '${safeId}')" class="retry-btn">重试</button>
                </div>
            </div>`;

      // 标记需要异步加载图片（在DOM插入后执行）
      message._needsImageLoad = { r2Key: message.r2_key, safeId: safeId };
    }

    return `<div class="message-content"><div class="file-message"><div class="file-info"><div class="file-icon">${fileIcon}</div><div class="file-details"><div class="file-name">${this.escapeHtml(
      message.original_name
    )}</div><div class="file-size">${fileSize}</div></div></div><div class="file-actions"><button class="download-btn" onclick="API.downloadFile('${
      message.r2_key
    }', '${this.escapeHtml(
      message.original_name
    )}')">⬇️ 下载</button><button class="delete-btn" onclick="UI.deleteMessage('${
      message.id
    }')" title="删除消息">🗑️ 删除</button></div>${imagePreview}</div></div><div class="message-meta"><span>${deviceName}</span><span class="message-time">${time}</span></div>`;
  },

  // 渲染文件消息（保留用于兼容性）
  renderFileMessage(message, isOwn, deviceName, time) {
    const fileIcon = Utils.getFileIcon(
      message.mime_type,
      message.original_name
    );
    const fileSize = Utils.formatFileSize(message.file_size);
    const isImage = Utils.isImageFile(message.mime_type);

    let imagePreview = "";
    if (isImage) {
      // 创建安全的ID（移除特殊字符）
      const safeId = this.createSafeId(message.r2_key);
      const imageId = `img-${safeId}`;

      imagePreview = `<div class="image-preview" id="preview-${safeId}">
                <div class="image-loading" id="loading-${safeId}">
                    <div class="loading-spinner">⏳</div>
                    <span>加载图片中...</span>
                </div>
                <img id="${imageId}" alt="${this.escapeHtml(
        message.original_name
      )}" style="display: none;" />
                <div class="image-error" id="error-${safeId}" style="display: none;">
                    <span>🖼️ 图片加载失败</span>
                    <button onclick="UI.retryLoadImage('${
                      message.r2_key
                    }', '${safeId}')" class="retry-btn">重试</button>
                </div>
            </div>`;

      // 标记需要异步加载图片（在DOM插入后执行）
      message._needsImageLoad = { r2Key: message.r2_key, safeId: safeId };
    }

    return `<div class="message ${
      isOwn ? "own" : "other"
    } fade-in"><div class="message-content"><div class="file-message"><div class="file-info"><div class="file-icon">${fileIcon}</div><div class="file-details"><div class="file-name">${this.escapeHtml(
      message.original_name
    )}</div><div class="file-size">${fileSize}</div></div></div><div class="file-actions"><button class="download-btn" onclick="API.downloadFile('${
      message.r2_key
    }', '${this.escapeHtml(
      message.original_name
    )}')">⬇️ 下载</button><button class="delete-btn" onclick="UI.deleteMessage('${
      message.id
    }')" title="删除消息">🗑️ 删除</button></div>${imagePreview}</div></div><div class="message-meta"><span>${deviceName}</span><span class="message-time">${time}</span></div></div>`;
  },

  // 添加新消息到列表（增量方式）
  addMessage(message) {
    // 检查用户是否在底部
    const wasAtBottom = this.isAtBottom();

    // 如果当前是空状态，先清空
    if (this.elements.messageList.querySelector(".empty-state")) {
      this.elements.messageList.innerHTML = "";
      this.messageCache.clear();
    }

    // 如果消息已存在，不重复添加
    if (this.messageCache.has(message.id)) {
      return;
    }

    const currentDeviceId = Utils.getDeviceId();
    const messageElement = this.createMessageElement(message, currentDeviceId);

    // 添加到末尾
    this.elements.messageList.appendChild(messageElement);
    this.messageCache.set(message.id, messageElement);

    // 检查是否需要加载图片（DOM插入后）
    if (message._needsImageLoad) {
      const { r2Key, safeId } = message._needsImageLoad;
      // 使用setTimeout确保DOM完全插入后再加载图片
      setTimeout(() => {
        this.loadImageAsync(r2Key, safeId);
      }, 10);
    }

    // 添加淡入动画
    requestAnimationFrame(() => {
      messageElement.classList.add("fade-in");
    });

    // 只有在用户原本在底部时才自动滚动
    if (wasAtBottom) {
      this.scrollToBottom();
    }
  },

  // 添加AI消息到列表
  addAIMessage(message) {
    // console.log("UI: 添加AI消息", { message });

    // 检查必要的元素
    if (!this.elements.messageList) {
      console.error("UI: messageList 元素不存在");
      return;
    }

    // 检查用户是否在底部
    const wasAtBottom = this.isAtBottom();

    // 如果当前是空状态，先清空
    if (this.elements.messageList.querySelector(".empty-state")) {
      // console.log("UI: 清空空状态");
      this.elements.messageList.innerHTML = "";
      this.messageCache.clear();
    }

    // 如果消息已存在，不重复添加
    if (this.messageCache.has(message.id)) {
      // console.log("UI: 消息已存在，跳过添加", { messageId: message.id });
      return;
    }

    // 使用AIUI创建AI消息元素
    let messageElement;
    if (window.AIUI && typeof AIUI.createAIMessageElement === "function") {
      // console.log("UI: 使用AIUI创建AI消息元素");
      messageElement = AIUI.createAIMessageElement(message);
    } else {
      // console.log("UI: AIUI不可用，使用降级处理");
      // 降级处理：使用普通消息元素
      messageElement = this.createMessageElement(message, "ai-system");
      messageElement.classList.add("ai");
    }

    if (!messageElement) {
      console.error("UI: 消息元素创建失败");
      return;
    }

    // console.log("UI: 准备添加消息元素到DOM", { messageElement });

    // 添加到末尾
    this.elements.messageList.appendChild(messageElement);
    this.messageCache.set(message.id, messageElement);

    // console.log("UI: 消息元素已添加到DOM");

    // 添加淡入动画
    requestAnimationFrame(() => {
      messageElement.classList.add("fade-in");
    });

    // 强制滚动到底部
    this.scrollToBottom();

    // console.log("UI: AI消息添加完成");
  },

  // 更新AI思考过程
  updateAIThinking(thinkingId, thinking) {
    if (window.AIUI && typeof AIUI.updateThinkingContent === "function") {
      AIUI.updateThinkingContent(thinkingId, thinking);
    }
  },

  // 更新AI响应
  updateAIResponse(responseId, chunk, fullResponse) {
    if (window.AIUI && typeof AIUI.updateResponseContent === "function") {
      AIUI.updateResponseContent(responseId, chunk, fullResponse);
    }
  },

  // 完成AI响应
  completeAIResponse(responseId, finalContent) {
    if (window.AIUI && typeof AIUI.completeResponse === "function") {
      AIUI.completeResponse(responseId, finalContent);
    }
  },

  // 移除消息
  removeMessage(messageId) {
    const messageElement = document.querySelector(
      `[data-message-id="${messageId}"]`
    );
    if (messageElement) {
      messageElement.remove();
      this.messageCache.delete(messageId);
    }

    // 如果是AI消息，也从AI UI中移除
    if (window.AIUI && typeof AIUI.removeAIMessage === "function") {
      AIUI.removeAIMessage(messageId);
    }
  },

  // 更新AI模式状态
  updateAIMode(isAIMode) {
    // console.log("UI: 更新AI模式状态", { isAIMode });

    // 使用AIUI更新模式指示器
    if (window.AIUI && typeof AIUI.updateAIModeIndicator === "function") {
      AIUI.updateAIModeIndicator(isAIMode);
    }

    // 更新输入框样式
    const inputContainer = document.querySelector(".input-container");
    if (inputContainer) {
      if (isAIMode) {
        inputContainer.classList.add("ai-mode");
      } else {
        inputContainer.classList.remove("ai-mode");
      }
    }
  },

  // 检查是否在底部
  isAtBottom() {
    const container = this.elements.messageList;
    const threshold = 50; // 50px的容差
    return (
      container.scrollTop + container.clientHeight >=
      container.scrollHeight - threshold
    );
  },

  // 滚动到底部
  scrollToBottom() {
    // 使用requestAnimationFrame确保DOM更新完成后再滚动
    requestAnimationFrame(() => {
      const container = this.elements.messageList;

      // iOS Safari 特殊处理
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

      if (isIOS) {
        // iOS上使用smooth滚动可能有问题，使用多重方法确保滚动
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "auto", // iOS上auto比smooth更可靠
        });

        // 备用方法
        setTimeout(() => {
          container.scrollTop = container.scrollHeight;
        }, 50);
      } else {
        container.scrollTop = container.scrollHeight;
      }
    });
  },

  // 设置发送按钮状态 - 微信移动端风格
  setSendButtonState(disabled, loading = false) {
    this.elements.sendButton.disabled = disabled;

    if (loading) {
      this.elements.sendButton.classList.add("loading");
    } else {
      this.elements.sendButton.classList.remove("loading");
    }
  },

  // 显示/隐藏发送按钮 - 微信移动端风格
  toggleSendButton(show) {
    if (show) {
      this.elements.sendButton.classList.add("show");
    } else {
      this.elements.sendButton.classList.remove("show");
    }
  },

  // 显示/隐藏功能按钮 - 微信风格
  toggleFunctionButton(show) {
    if (this.elements.functionButton) {
      if (show) {
        this.elements.functionButton.classList.remove("hide");
        this.elements.functionButton.classList.add("show");
      } else {
        this.elements.functionButton.classList.remove("show");
        this.elements.functionButton.classList.add("hide");
      }
    }
  },

  // 检查输入内容并切换按钮显示 - 动态切换逻辑
  checkInputAndToggleSendButton() {
    const hasContent = this.getInputValue().length > 0;

    // 微信风格：有内容时显示发送按钮，隐藏功能按钮
    // 无内容时显示功能按钮，隐藏发送按钮
    this.toggleSendButton(hasContent);
    this.toggleFunctionButton(!hasContent);

    // 如果有功能按钮组件，也通知它更新状态
    if (
      window.FunctionButton &&
      typeof window.FunctionButton.updateVisibility === "function"
    ) {
      window.FunctionButton.updateVisibility();
    }
  },

  // 清空输入框
  clearInput() {
    this.elements.messageText.value = "";
    this.autoResizeTextarea();

    // 清空输入时重新检查按钮状态
    this.checkInputAndToggleSendButton();
  },

  // 获取输入内容
  getInputValue() {
    return this.elements.messageText.value.trim();
  },

  // 转义HTML
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  // 显示错误消息 - 弹窗已禁用，避免移动端遮挡输入框
  showError(message) {
    Utils.showNotification(message, "error");

    // 错误弹窗已禁用，避免遮挡输入框，只在控制台输出
    console.error("UI错误:", message);

    // const errorDiv = document.createElement('div');
    // errorDiv.className = 'error-message';
    // errorDiv.textContent = message;
    // errorDiv.style.cssText = `
    //     position: fixed;
    //     top: 20px;
    //     left: 50%;
    //     transform: translateX(-50%);
    //     background: #ff4757;
    //     color: white;
    //     padding: 10px 20px;
    //     border-radius: 5px;
    //     z-index: 1000;
    //     animation: fadeIn 0.3s ease-out;
    // `;
    //
    // document.body.appendChild(errorDiv);
    //
    // setTimeout(() => {
    //     errorDiv.remove();
    // }, 3000);
  },

  // 显示成功消息 - 弹窗已禁用，避免移动端遮挡输入框
  showSuccess(message) {
    Utils.showNotification(message, "success");

    // 成功弹窗已禁用，避免遮挡输入框，只在控制台输出
    // console.log("UI成功:", message);

    // if (message.includes('\n')) {
    //     const successDiv = document.createElement('div');
    //     successDiv.className = 'success-message';
    //     successDiv.innerHTML = message.replace(/\n/g, '<br>');
    //     successDiv.style.cssText = `
    //         position: fixed;
    //         top: 20px;
    //         left: 50%;
    //         transform: translateX(-50%);
    //         background: #07c160;
    //         color: white;
    //         padding: 15px 25px;
    //         border-radius: 8px;
    //         z-index: 1000;
    //         animation: fadeIn 0.3s ease-out;
    //         max-width: 400px;
    //         text-align: center;
    //         box-shadow: 0 4px 12px rgba(7, 193, 96, 0.3);
    //         font-size: 14px;
    //         line-height: 1.5;
    //     `;
    //
    //     document.body.appendChild(successDiv);
    //
    //     setTimeout(() => {
    //         successDiv.remove();
    //     }, 5000);
    // }
  },

  // 设置连接状态
  setConnectionStatus(status) {
    let statusElement = document.querySelector(".connection-status");
    if (!statusElement) {
      statusElement = document.createElement("div");
      statusElement.className = "connection-status";
      // 插入到消息列表的父容器中，位于消息列表之前
      this.elements.messageList.parentNode.insertBefore(
        statusElement,
        this.elements.messageList
      );
    }

    const isOnline = status === "connected";
    // 只在状态变化时显示"已连接"
    if (isOnline && UI._lastConnectionStatus !== "connected") {
      statusElement.textContent = "已连接";
      statusElement.className = "connection-status online";
      setTimeout(() => {
        // 3秒后，如果状态仍然是online，则清空文本和样式
        if (statusElement.classList.contains("online")) {
          statusElement.textContent = "";
          statusElement.classList.remove("online");
        }
      }, 3000);
    } else if (status === "disconnected" || status === "offline") {
      statusElement.textContent = "离线模式";
      statusElement.className = "connection-status offline";
      // Utils.showNotification("网络已断开，已进入离线模式", "warning"); // 已去除弹窗
    }
    // 记录本次状态
    UI._lastConnectionStatus = status;
  },

  // 显示上传状态
  showUploadStatus(show = true) {
    const uploadStatus = this.elements.uploadStatus;
    if (uploadStatus) {
      uploadStatus.style.display = show ? "flex" : "none";
    }
  },

  // 更新上传进度
  updateUploadProgress(percent) {
    const progressBar =
      document.getElementById("progressBar") || this.elements.progressBar;
    if (progressBar) {
      progressBar.style.width = `${percent}%`;
    }
  },

  // 重置上传状态
  resetUploadStatus() {
    this.showUploadStatus(false);
    this.updateUploadProgress(0);
  },

  // 显示键盘快捷键提示
  showKeyboardHint(message, duration = 3000) {
    // 移除现有提示
    const existingHint = document.querySelector(".keyboard-hint");
    if (existingHint) {
      existingHint.remove();
    }

    // 创建新提示
    const hint = document.createElement("div");
    hint.className = "keyboard-hint";
    hint.textContent = message;
    document.body.appendChild(hint);

    // 显示动画
    setTimeout(() => hint.classList.add("show"), 100);

    // 自动隐藏
    setTimeout(() => {
      hint.classList.remove("show");
      setTimeout(() => hint.remove(), 300);
    }, duration);
  },

  // 添加消息状态指示器
  addMessageStatus(messageElement, status) {
    const metaElement = messageElement.querySelector(".message-meta");
    if (metaElement) {
      const statusSpan = document.createElement("span");
      statusSpan.className = `message-status status-${status}`;

      switch (status) {
        case "sending":
          statusSpan.textContent = "⏳";
          break;
        case "sent":
          statusSpan.textContent = "✓";
          break;
        case "failed":
          statusSpan.textContent = "✗";
          break;
      }

      metaElement.appendChild(statusSpan);
    }
  },

  // 更新消息时间显示格式
  updateMessageTime(messageElement, timestamp) {
    const timeElement = messageElement.querySelector(
      ".message-meta span:last-child"
    );
    if (timeElement) {
      timeElement.innerHTML = `<span class="message-time">${Utils.formatTime(
        timestamp
      )}</span>`;
    }
  },

  // 切换Markdown视图
  toggleMarkdownView(messageId) {
    const messageElement = document.getElementById(messageId);
    if (!messageElement) return;

    const isCurrentlyRendered = messageElement.dataset.isRendered === "true";
    const originalContent = messageElement.dataset.original;
    const renderedContent = messageElement.dataset.rendered.replace(
      /&quot;/g,
      '"'
    );

    // 清除现有内容
    messageElement.innerHTML = "";

    if (isCurrentlyRendered) {
      // 切换到源码视图
      const textNode = document.createTextNode(originalContent);
      messageElement.appendChild(textNode);
      messageElement.className = "text-message";
      messageElement.dataset.isRendered = "false";
    } else {
      // 切换到渲染视图
      messageElement.innerHTML = renderedContent;
      messageElement.className = "text-message markdown-rendered";
      messageElement.dataset.isRendered = "true";
    }

    // 重新添加切换按钮
    const toggleButton = document.createElement("button");
    toggleButton.className = "markdown-toggle";
    toggleButton.onclick = () => this.toggleMarkdownView(messageId);
    toggleButton.title = "切换源码/渲染视图";
    toggleButton.textContent = "📝";
    messageElement.appendChild(toggleButton);
  },

  // 创建安全的ID（移除特殊字符）
  createSafeId(str) {
    if (!str || typeof str !== "string") {
      return "unknown";
    }
    return str.replace(/[^a-zA-Z0-9-_]/g, "");
  },

  // 异步加载图片
  async loadImageAsync(r2Key, safeId) {
    try {
      // 检查r2Key是否存在
      if (!r2Key) {
        console.warn("图片r2Key不存在，跳过加载");
        return;
      }

      // 如果没有提供safeId，则生成一个
      if (!safeId) {
        safeId = this.createSafeId(r2Key);
      }

      // 获取相关元素
      const loadingElement = document.getElementById(`loading-${safeId}`);
      const imageElement = document.getElementById(`img-${safeId}`);
      const errorElement = document.getElementById(`error-${safeId}`);

      if (!loadingElement || !imageElement || !errorElement) {
        console.warn("图片元素未找到:", r2Key);
        return;
      }

      // 显示加载状态
      loadingElement.style.display = "flex";
      imageElement.style.display = "none";
      errorElement.style.display = "none";

      // 获取图片blob URL
      const blobUrl = await API.getImageBlobUrl(r2Key);

      // 设置图片源并等待加载完成
      await new Promise((resolve, reject) => {
        imageElement.onload = resolve;
        imageElement.onerror = reject;
        imageElement.src = blobUrl;
      });

      // 显示图片，隐藏加载状态
      loadingElement.style.display = "none";
      imageElement.style.display = "block";
    } catch (error) {
      console.error("图片加载失败:", error);

      // 显示错误状态
      const safeIdToUse = safeId || this.createSafeId(r2Key);
      const loadingElement = document.getElementById(`loading-${safeIdToUse}`);
      const imageElement = document.getElementById(`img-${safeIdToUse}`);
      const errorElement = document.getElementById(`error-${safeIdToUse}`);

      if (loadingElement) loadingElement.style.display = "none";
      if (imageElement) imageElement.style.display = "none";
      if (errorElement) errorElement.style.display = "flex";
    }
  },

  // 重试加载图片
  async retryLoadImage(r2Key, safeId) {
    // 清除可能存在的缓存
    if (typeof API !== "undefined" && API.revokeImageBlobUrl) {
      API.revokeImageBlobUrl(r2Key);
    }

    // 重新加载
    await this.loadImageAsync(r2Key, safeId);
  },

  // 确保顶部加载指示器存在
  ensureTopLoadingIndicator() {
    const messageContainer = this.elements.messageList;
    let topIndicator = messageContainer.querySelector(".top-loading-indicator");

    if (!topIndicator) {
      topIndicator = document.createElement("div");
      topIndicator.className = "top-loading-indicator";
      topIndicator.innerHTML = `
                <div class="top-loading-content">
                    <div class="top-loading-spinner">⏳</div>
                    <span class="top-loading-text">加载历史消息中...</span>
                </div>
            `;

      // 插入到消息列表的最前面
      messageContainer.insertBefore(topIndicator, messageContainer.firstChild);

      // 默认隐藏
      topIndicator.style.display = "none";
    }
  },

  // 显示/隐藏顶部加载指示器
  showTopLoadingIndicator(show) {
    this.ensureTopLoadingIndicator();
    const topIndicator = this.elements.messageList.querySelector(
      ".top-loading-indicator"
    );
    if (topIndicator) {
      if (show) {
        topIndicator.style.display = "flex";
        // 添加淡入动画
        requestAnimationFrame(() => {
          topIndicator.classList.add("fade-in");
        });
      } else {
        topIndicator.style.display = "none";
        topIndicator.classList.remove("fade-in");
      }
    }
  },

  // 获取消息容器
  getMessageContainer() {
    return this.elements.messageList;
  },

  // 滑动确认弹窗
  showSlideToConfirmModal({ title = "", message = "", onConfirm }) {
    // 创建遮罩
    const overlay = document.createElement("div");
    overlay.className = "slide-confirm-overlay";
    overlay.innerHTML = `
      <div class="slide-confirm-modal">
        <div class="slide-confirm-title">${title}</div>
        <div class="slide-confirm-message">${message}</div>
        <div class="slide-confirm-slider">
          <div class="slide-confirm-track"></div>
          <div class="slide-confirm-thumb"></div>
          <span class="slide-confirm-label">滑动确认</span>
        </div>
        <button class="slide-confirm-cancel">取消</button>
      </div>
    `;
    document.body.appendChild(overlay);
    // 禁止页面滚动
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const slider = overlay.querySelector(".slide-confirm-slider");
    const thumb = overlay.querySelector(".slide-confirm-thumb");
    const label = overlay.querySelector(".slide-confirm-label");
    const cancelBtn = overlay.querySelector(".slide-confirm-cancel");
    let isDragging = false;
    let startX = 0;
    let currentX = 0;
    let maxMove = slider.offsetWidth - thumb.offsetWidth - 4;

    // 适配窗口变化
    function updateMaxMove() {
      maxMove = slider.offsetWidth - thumb.offsetWidth - 4;
    }
    window.addEventListener("resize", updateMaxMove);
    setTimeout(updateMaxMove, 100);

    function onDragStart(e) {
      isDragging = true;
      startX =
        (e.touches ? e.touches[0].clientX : e.clientX) - thumb.offsetLeft;
      thumb.classList.add("dragging");
      // 拖动滑块时禁止页面滚动
      document.body.style.overflow = "hidden";
    }
    function onDragMove(e) {
      if (!isDragging) return;
      currentX = (e.touches ? e.touches[0].clientX : e.clientX) - startX;
      currentX = Math.max(0, Math.min(currentX, maxMove));
      thumb.style.transform = `translateX(${currentX}px)`;
      if (currentX > maxMove * 0.95) {
        label.textContent = "松开确认";
      } else {
        label.textContent = "滑动确认";
      }
      // 拖动时阻止页面滚动
      if (e.cancelable) e.preventDefault();
    }
    function onDragEnd() {
      if (!isDragging) return;
      isDragging = false;
      thumb.classList.remove("dragging");
      if (currentX > maxMove * 0.95) {
        // 成功
        thumb.style.transform = `translateX(${maxMove}px)`;
        setTimeout(() => {
          document.body.removeChild(overlay);
          window.removeEventListener("resize", updateMaxMove);
          document.body.style.overflow = prevOverflow;
          onConfirm && onConfirm();
        }, 200);
      } else {
        // 复位
        thumb.style.transform = "translateX(0)";
        label.textContent = "滑动确认";
        // 拖动结束恢复页面滚动
        document.body.style.overflow = prevOverflow;
      }
    }
    // 事件绑定
    thumb.addEventListener("mousedown", onDragStart);
    thumb.addEventListener("touchstart", onDragStart);
    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("touchmove", onDragMove, { passive: false });
    document.addEventListener("mouseup", onDragEnd);
    document.addEventListener("touchend", onDragEnd);
    cancelBtn.onclick = () => {
      document.body.removeChild(overlay);
      window.removeEventListener("resize", updateMaxMove);
      document.body.style.overflow = prevOverflow;
    };
  },

  // 删除消息
  async deleteMessage(messageId) {
    try {
      // 显示确认对话框
      const confirmed = confirm("确定要删除这条消息吗？此操作不可撤销。");
      if (!confirmed) {
        return;
      }

      // 调用API删除消息
      await API.deleteMessage(messageId);

      // 从UI中移除消息
      this.removeMessageFromUI(messageId);

      // 显示成功提示
      this.showSuccess("消息已删除");
    } catch (error) {
      console.error("删除消息失败:", error);
      this.showError("删除消息失败: " + error.message);
    }
  },

  // 从UI中移除消息
  removeMessageFromUI(messageId) {
    // 查找包含该消息ID的消息元素
    const messageElement = document.querySelector(
      `[data-message-id="${messageId}"]`
    );
    if (messageElement) {
      // 添加删除动画
      messageElement.style.transition = "all 0.3s ease";
      messageElement.style.transform = "translateX(-100%)";
      messageElement.style.opacity = "0";

      // 动画完成后移除元素
      setTimeout(() => {
        messageElement.remove();

        // 检查是否还有消息，如果没有则显示空状态
        const messageList = this.elements.messageList;
        if (messageList && messageList.children.length === 0) {
          this.showEmpty("还没有消息，开始聊天吧！");
        }
      }, 300);
    }
  },
};
