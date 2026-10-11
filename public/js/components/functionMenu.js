// 功能菜单组件 - 微信风格功能选项弹出层
// 提供Web端适用的功能选项界面框架

const FunctionMenu = {
  // 菜单配置 - 微信风格
  menuItems: [
    {
      id: "photo",
      icon: "📷",
      title: "拍摄",
      action: "photo",
    },
    {
      id: "album",
      icon: "🖼️",
      title: "相册",
      action: "album",
    },

    {
      id: "emoji",
      icon: "😊",
      title: "表情",
      action: "emoji",
    },
    {
      id: "file",
      icon: "📁",
      title: "文件",
      action: "file",
    },
    {
      id: "search",
      icon: "🔍",
      title: "搜索",
      action: "search",
    },

    {
      id: "ai-chat",
      icon: "🤖",
      title: "AI助手",
      action: "aiChat",
    },
    {
      id: "ai-image-gen",
      icon: "🎨",
      title: "AI绘画",
      action: "aiImageGen",
    },
    {
      id: "clear-chat",
      icon: "🧹",
      title: "清理记录",
      action: "clearChat",
    },
    {
      id: "pwa-manage",
      icon: "📱",
      title: "PWA管理",
      action: "pwaManage",
    },
    {
      id: "logout",
      icon: "🚪",
      title: "登出",
      action: "logout",
    },
  ],

  // 组件状态
  isInitialized: false,
  inputSelection: null,

  // 初始化菜单
  init() {
    if (this.isInitialized) {
      return;
    }
    this.bindEvents(); // 只做事件绑定，不插入菜单DOM
    this.isInitialized = true;
  },

  // 创建菜单DOM元素
  createMenuElement() {
    // 先移除旧菜单
    const oldMenu = document.getElementById("functionMenu");
    if (oldMenu) oldMenu.remove();
    // 统一渲染纵向滚动网格
    const menuHTML = `
      <div class="function-menu" id="functionMenu">
        <div class="function-menu-overlay"></div>
        <div class="function-menu-content">
          <div class="function-menu-header">
            <h3>更多功能</h3>
            <button class="function-menu-close" id="functionMenuClose">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
              </svg>
            </button>
          </div>
          <div class="function-menu-grid">
            ${this.menuItems
              .map(
                (item) => `
              <div class="function-menu-item" data-action="${item.action}" data-id="${item.id}">
                <div class="function-menu-item-icon">${item.icon}</div>
                <div class="function-menu-item-content">
                  <div class="function-menu-item-title">${item.title}</div>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", menuHTML);
  },

  // 生成菜单项HTML - 微信风格
  generateMenuItems() {
    return this.menuItems
      .map(
        (item) => `
            <div class="function-menu-item" data-action="${item.action}" data-id="${item.id}">
                <div class="function-menu-item-icon">${item.icon}</div>
                <div class="function-menu-item-content">
                    <div class="function-menu-item-title">${item.title}</div>
                </div>
            </div>
        `
      )
      .join("");
  },

  // 绑定事件
  bindEvents() {
    // 菜单项点击事件
    document.addEventListener("click", (e) => {
      const menuItem = e.target.closest(".function-menu-item");
      if (menuItem) {
        const action = menuItem.dataset.action;
        const itemId = menuItem.dataset.id;
        this.handleMenuItemClick(action, itemId);
      }
    });

    // 关闭按钮事件
    document.addEventListener("click", (e) => {
      if (e.target.closest("#functionMenuClose")) {
        this.hide();
      }
    });

    // 遮罩层点击关闭
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("function-menu-overlay")) {
        this.hide();
      }
    });
  },

  // 处理菜单项点击
  handleMenuItemClick(action, itemId) {
    // 分发自定义事件
    const event = new CustomEvent("functionMenu:itemClick", {
      detail: { action, itemId },
    });
    document.dispatchEvent(event);

    // 执行对应的动作
    this.executeAction(action, itemId);

    // 关闭菜单
    this.hide();
  },

  // 执行功能动作 - 微信风格功能
  executeAction(action, itemId) {
    switch (action) {
      case "photo":
        this.handlePhoto();
        break;
      case "album":
        this.handleAlbum();
        break;

      case "emoji":
        this.handleEmoji();
        break;
      case "file":
        this.handleFile();
        break;
      case "search":
        this.handleSearch();
        break;

      case "aiChat":
        this.handleAiChat();
        break;
      case "aiImageGen":
        this.handleAiImageGen();
        break;
      case "clearChat":
        this.handleClearChat();
        break;
      case "pwaManage":
        this.handlePwaManage();
        break;
      case "logout":
        this.handleLogout();
        break;
      default:
        this.showComingSoon(action);
    }
  },

  // 拍摄功能 - 调用系统原生相机
  handlePhoto() {
    // 创建隐藏的文件输入元素，设置为调用相机
    const cameraInput = document.createElement("input");
    cameraInput.type = "file";
    cameraInput.accept = "image/*";
    cameraInput.capture = "environment"; // 调用后置摄像头
    cameraInput.style.display = "none";

    // 监听文件选择
    cameraInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          // 显示上传状态
          UI.showSuccess("📸 正在处理照片...");

          // 上传文件
          const deviceId = Utils.getDeviceId();
          await API.uploadFile(file, deviceId);

          // 刷新消息列表（不重置已加载消息）
          setTimeout(async () => {
            await MessageHandler.loadMessages(true, false);
          }, 500);

          UI.showSuccess("📸 照片发送成功！");
        } catch (error) {
          console.error("拍照上传失败:", error);
          UI.showError("照片上传失败，请重试");
        }
      }

      // 清理临时元素
      if (cameraInput.parentNode) {
        cameraInput.parentNode.removeChild(cameraInput);
      }
    });

    // 添加到DOM并触发点击
    document.body.appendChild(cameraInput);
    cameraInput.click();
  },

  // 相册功能
  handleAlbum() {
    // 触发文件选择
    const fileInput = document.getElementById("fileInput");
    if (fileInput) {
      fileInput.accept = "image/*";
      fileInput.click();
    } else {
      this.showComingSoon("相册");
    }
  },

  // 表情功能
  handleEmoji() {
    this.showEmojiPicker();
  },

  // 显示表情选择器
  showEmojiPicker() {
    const existingPicker = document.querySelector(".emoji-picker-overlay");
    if (existingPicker) {
      this.closeEmojiPicker(existingPicker);
      return;
    }

    this.hide();

    const messageText = document.getElementById("messageText");
    if (messageText) {
      this.inputSelection = {
        start: messageText.selectionStart ?? messageText.value.length,
        end: messageText.selectionEnd ?? messageText.value.length,
      };
      messageText.blur();
    }

    // 创建表情选择器弹窗
    const overlay = document.createElement("div");
    overlay.className = "emoji-picker-overlay";
    overlay.innerHTML = `
      <div class="emoji-picker-modal">
        <div class="emoji-picker-header">
          <span class="emoji-picker-title">选择表情</span>
          <button class="emoji-picker-close">×</button>
        </div>
        <div class="emoji-picker-content">
          <div class="emoji-category">
            <div class="emoji-category-title">常用表情</div>
            <div class="emoji-grid">
              ${this.getEmojiGrid()}
            </div>
          </div>
        </div>
      </div>
    `;

    const inputContainer = document.querySelector(".input-container");
    if (!inputContainer) {
      return;
    }

    // 面板和输入行保持同一层级，移动端可以自然占据键盘区域。
    inputContainer.appendChild(overlay);
    document.body.classList.add("aux-panel-open");

    // 绑定事件
    this.bindEmojiPickerEvents(overlay);
  },

  // 获取表情网格HTML
  getEmojiGrid() {
    const emojis = [
      "😊",
      "👍",
      "❤️",
      "😂",
      "🎉",
      "👏",
      "🔥",
      "💯",
      "🥰",
      "😍",
      "🤔",
      "😅",
      "😎",
      "🤗",
      "😘",
      "😋",
      "😜",
      "🤪",
      "😇",
      "🥳",
      "🤩",
      "😌",
      "😏",
      "🙄",
      "😢",
      "😭",
      "😤",
      "😡",
      "🤬",
      "😱",
      "😨",
      "😰",
      "😳",
      "🤯",
      "🤢",
      "🤮",
      "👍",
      "👎",
      "👌",
      "✌️",
      "🤞",
      "🤟",
      "🤘",
      "👈",
      "👉",
      "👆",
      "👇",
      "☝️",
      "🎂",
      "🍰",
      "🍕",
      "🍔",
      "🍟",
      "🌭",
      "🥪",
      "🌮",
      "🌯",
      "🥙",
      "🥗",
      "🍝",
    ];

    return emojis
      .map(
        (emoji) =>
          `<button class="emoji-item" data-emoji="${emoji}">${emoji}</button>`
      )
      .join("");
  },

  // 绑定表情选择器事件
  bindEmojiPickerEvents(overlay) {
    // 关闭按钮
    const closeBtn = overlay.querySelector(".emoji-picker-close");
    closeBtn.addEventListener("click", () => {
      this.closeEmojiPicker(overlay);
    });

    // 点击遮罩关闭
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        this.closeEmojiPicker(overlay);
      }
    });

    // 表情选择
    const emojiItems = overlay.querySelectorAll(".emoji-item");
    emojiItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        const emoji = e.target.dataset.emoji;
        this.insertTextToInput(emoji, { focus: false });
        // 不关闭选择器，允许连续选择表情
      });
    });
  },

  // 关闭表情选择器
  closeEmojiPicker(overlay = document.querySelector(".emoji-picker-overlay")) {
    if (!overlay) {
      return;
    }

    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    document.body.classList.remove("aux-panel-open");
    this.inputSelection = null;
  },

  // 文件功能
  handleFile() {
    // 触发文件选择
    const fileInput = document.getElementById("fileInput");
    if (fileInput) {
      fileInput.accept = "*/*";
      fileInput.click();
    } else {
      this.showComingSoon("文件");
    }
  },

  // 搜索功能
  handleSearch() {
    // 检查搜索功能是否可用
    if (!CONFIG.SEARCH.ENABLED) {
      this.insertTextToInput("🔍 搜索功能暂未启用");
      return;
    }

    // 检查SearchUI是否已加载
    if (window.SearchUI && typeof SearchUI.showSearchModal === "function") {
      // 显示搜索模态框
      SearchUI.showSearchModal();
    } else {
      // 如果搜索模块未加载，显示提示
      this.insertTextToInput("🔍 搜索模块正在加载中...");

      // 尝试初始化搜索模块
      setTimeout(() => {
        if (window.SearchUI && typeof SearchUI.init === "function") {
          SearchUI.init();
          SearchUI.showSearchModal();
        }
      }, 100);
    }
  },

  // AI助手功能
  handleAiChat() {
    // 检查AI功能是否可用
    if (!CONFIG.AI.ENABLED) {
      this.insertTextToInput("🤖 AI功能暂未启用");
      return;
    }

    // 切换AI模式
    if (window.AIHandler && typeof AIHandler.toggleAIMode === "function") {
      const isAIMode = AIHandler.toggleAIMode();

      // 如果启用了AI模式，在输入框中添加AI标识
      if (isAIMode) {
        this.insertTextToInput("🤖 ");
      }
    } else {
      // 如果AI模块未加载，显示提示
      this.insertTextToInput("🤖 AI模块正在加载中...");

      // 尝试初始化AI模块
      setTimeout(() => {
        if (window.AIHandler && typeof AIHandler.init === "function") {
          AIHandler.init();
        }
      }, 100);
    }
  },

  // AI图片生成功能
  handleAiImageGen() {
    // 检查图片生成功能是否可用
    if (!CONFIG.IMAGE_GEN.ENABLED) {
      this.insertTextToInput("🎨 AI图片生成功能暂未启用");
      return;
    }

    // 检查ImageGenUI是否已加载
    if (
      window.ImageGenUI &&
      typeof ImageGenUI.showImageGenModal === "function"
    ) {
      // 显示图片生成模态框
      ImageGenUI.showImageGenModal();
    } else {
      // 如果UI模块未加载，显示提示
      this.insertTextToInput("🎨 AI图片生成模块正在加载中...");

      // 尝试初始化图片生成模块
      setTimeout(() => {
        if (window.ImageGenUI && typeof ImageGenUI.init === "function") {
          ImageGenUI.init();
          ImageGenUI.showImageGenModal();
        }
      }, 100);
    }
  },

  // 聊天记录清理功能
  handleClearChat() {
    document.dispatchEvent(new CustomEvent("functionMenu:clearChat"));
  },

  // PWA管理功能
  handlePwaManage() {
    // 复用现有的PWA逻辑
    if (
      window.MessageHandler &&
      typeof MessageHandler.handlePWACommand === "function"
    ) {
      MessageHandler.handlePWACommand();
    } else {
      // 如果MessageHandler未加载，显示提示
      this.insertTextToInput("📱 正在初始化PWA管理功能...");

      // 尝试通过输入PWA命令来触发
      setTimeout(() => {
        const messageText = document.getElementById("messageText");
        if (messageText) {
          messageText.value = "/pwa";
          // 触发发送消息
          const sendButton = document.getElementById("sendButton");
          if (sendButton) {
            sendButton.click();
          }
        }
      }, 100);
    }
  },

  // 登出功能
  handleLogout() {
    // 复用现有的登出逻辑
    if (
      window.MessageHandler &&
      typeof MessageHandler.handleLogoutCommand === "function"
    ) {
      MessageHandler.handleLogoutCommand();
    } else {
      // 如果MessageHandler未加载，显示提示
      this.insertTextToInput("🚪 正在初始化登出功能...");

      // 尝试通过输入登出命令来触发
      setTimeout(() => {
        const messageText = document.getElementById("messageText");
        if (messageText) {
          messageText.value = "/logout";
          // 触发发送消息
          const sendButton = document.getElementById("sendButton");
          if (sendButton) {
            sendButton.click();
          }
        }
      }, 100);
    }
  },

  // 显示即将推出提示
  showComingSoon(feature) {
    this.insertTextToInput(`🚧 ${feature}功能即将推出，敬请期待！`);
  },

  // 向输入框插入文本
  insertTextToInput(text, options = {}) {
    const messageText = document.getElementById("messageText");
    if (!messageText) return;

    const currentValue = messageText.value;
    const savedSelection = this.inputSelection || {};
    const cursorStart = messageText.selectionStart ?? currentValue.length;
    const cursorEnd = messageText.selectionEnd ?? cursorStart;
    const selectionStart = Number.isInteger(savedSelection.start)
      ? savedSelection.start
      : cursorStart;
    const selectionEnd = Number.isInteger(savedSelection.end)
      ? savedSelection.end
      : cursorEnd;

    const newValue =
      currentValue.slice(0, selectionStart) +
      text +
      currentValue.slice(selectionEnd);
    messageText.value = newValue;

    // 设置光标位置
    const newCursorPos = selectionStart + text.length;
    messageText.setSelectionRange(newCursorPos, newCursorPos);
    this.inputSelection = { start: newCursorPos, end: newCursorPos };

    // 触发input事件以更新UI状态
    messageText.dispatchEvent(new Event("input", { bubbles: true }));

    if (options.focus !== false) {
      messageText.focus();
    }
  },

  // 显示菜单
  show() {
    this.closeEmojiPicker();

    const existingMenu = document.getElementById("functionMenu");
    if (existingMenu) {
      this.hide();
      return;
    }

    const messageText = document.getElementById("messageText");
    if (window.matchMedia("(max-width: 720px)").matches && messageText) {
      messageText.blur();
    }
    this.createMenuElement();
    const menu = document.getElementById("functionMenu");
    if (menu) {
      const inputContainer = document.querySelector(".input-container");
      if (!inputContainer) {
        menu.remove();
        return;
      }
      inputContainer.appendChild(menu);
      document.body.classList.add("aux-panel-open");
      menu.classList.add("show");
    }
  },

  // 隐藏菜单
  hide() {
    const menu = document.getElementById("functionMenu");
    if (menu) {
      menu.remove(); // 彻底移除菜单DOM
    }
    document.body.classList.remove("aux-panel-open");
  },

  // 添加自定义菜单项
  addMenuItem(item) {
    this.menuItems.push(item);
    if (this.isInitialized) {
      this.refreshMenu();
    }
  },

  // 刷新菜单
  refreshMenu() {
    const menuGrid = document.querySelector(".function-menu-grid");
    if (menuGrid) {
      menuGrid.innerHTML = this.generateMenuItems();
    }
  },
};

// 导出组件
if (typeof module !== "undefined" && module.exports) {
  module.exports = FunctionMenu;
}
