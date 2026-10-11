const ConversationManager = {
  activeId: Number(localStorage.getItem("wxchat_current_conversation_id")) || 1,
  conversations: [],
  isInitialized: false,
  menuElement: null,

  currentConversationId() {
    return this.activeId || 1;
  },

  async init() {
    if (!this.isInitialized) {
      this.bindEvents();
      this.isInitialized = true;
    }
    await this.refresh();
  },

  async refresh() {
    const result = await API.get("/api/conversations");
    if (!result || !result.success || !Array.isArray(result.data)) {
      throw new Error(
        (result && (result.error || result.message)) || "聊天列表加载失败"
      );
    }
    this.conversations = result.data;
    if (!this.conversations.some((item) => Number(item.id) === this.activeId)) {
      const defaultConversation = this.conversations.find((item) => item.is_default);
      const defaultId = defaultConversation && defaultConversation.id;
      const firstConversation = this.conversations[0];
      const firstId = firstConversation && firstConversation.id;
      this.activeId = Number(defaultId || firstId || 1);
      localStorage.setItem("wxchat_current_conversation_id", this.activeId);
    }
    this.render();
    this.updateHeader();
  },

  bindEvents() {
    const createConversationButton = document.getElementById("createConversation");
    const conversationToggle = document.getElementById("conversationToggle");
    const conversationOverlay = document.getElementById("conversationOverlay");
    const conversationList = document.getElementById("conversationList");

    if (createConversationButton) {
      createConversationButton.addEventListener("click", () => {
        this.createConversation();
      });
    }
    if (conversationToggle) {
      conversationToggle.addEventListener("click", () => {
        this.openDrawer();
      });
    }
    if (conversationOverlay) {
      conversationOverlay.addEventListener("click", () => {
        this.closeDrawer();
      });
    }
    if (conversationList) conversationList.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-conversation-action]");
      const item = event.target.closest("[data-conversation-id]");
      if (!item) return;
      const conversationId = Number(item.dataset.conversationId);
      if (actionButton && actionButton.dataset.conversationAction === "menu") {
        event.stopPropagation();
        this.openConversationMenu(conversationId, actionButton);
        return;
      }
      this.selectConversation(conversationId);
    });
    if (conversationList) conversationList.addEventListener("contextmenu", (event) => {
      const item = event.target.closest("[data-conversation-id]");
      if (!item) return;
      event.preventDefault();
      this.openConversationMenu(Number(item.dataset.conversationId), null, {
        x: event.clientX,
        y: event.clientY,
      });
    });
    if (conversationList) conversationList.addEventListener("keydown", (event) => {
      const item = event.target.closest("[data-conversation-id]");
      if (!item) return;
      if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
        event.preventDefault();
        this.openConversationMenu(Number(item.dataset.conversationId), item);
        return;
      }
      if ((event.key !== "Enter" && event.key !== " ") || event.target.closest("button")) return;
      event.preventDefault();
      this.selectConversation(Number(item.dataset.conversationId));
    });
    document.addEventListener("click", (event) => {
      if (
        this.menuElement &&
        !this.menuElement.contains(event.target) &&
        !event.target.closest("[data-conversation-action='menu']")
      ) {
        this.closeConversationMenu();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.closeConversationMenu();
    });
  },

  render() {
    const list = document.getElementById("conversationList");
    const count = document.getElementById("conversationCount");
    if (!list) return;
    if (count) count.textContent = String(this.conversations.length);
    list.innerHTML = this.conversations.map((conversation) => {
      const id = Number(conversation.id);
      const active = id === this.activeId;
      const preview = conversation.last_message || "暂无消息，开始聊天吧";
      return `
        <div class="conversation-item${active ? " is-active" : ""}${conversation.is_pinned ? " is-pinned" : ""}" role="button" tabindex="0"
          aria-current="${active ? "page" : "false"}" data-conversation-id="${id}">
          <div class="conversation-avatar" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
              <path d="M5 7.5h14v9H5z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
              <path d="m7 10 5 3.5 5-3.5M8 5h8M8 19h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <div class="conversation-copy">
            <div class="conversation-title-row">
              <strong>${Utils.escapeHtml(conversation.name)}</strong>
              ${active ? '<span class="conversation-presence" aria-label="当前会话"></span>' : ""}
            </div>
            <span class="conversation-preview">${Utils.escapeHtml(preview)}</span>
          </div>
          <button type="button" class="conversation-menu-trigger" data-conversation-action="menu"
            aria-label="${Utils.escapeHtml(conversation.name)}的聊天操作" aria-haspopup="menu" aria-expanded="false" title="聊天操作">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" />
            </svg>
          </button>
        </div>
      `;
    }).join("");
  },

  updateHeader() {
    const conversation = this.conversations.find(
      (item) => Number(item.id) === this.activeId
    );
    const title = document.querySelector(".chat-header-copy h1");
    if (title && conversation) title.textContent = conversation.name;
    document.title = conversation
      ? `${conversation.name} - 微信文件传输助手`
      : "微信文件传输助手";
  },

  updatePreview(conversationId, message) {
    const item = document.querySelector(
      `[data-conversation-id="${Number(conversationId)}"] .conversation-preview`
    );
    if (!item || !message) return;
    item.textContent = message.type === "file"
      ? message.original_name || "文件"
      : message.content || "暂无消息，开始聊天吧";
  },

  openConversationMenu(conversationId, anchor, point) {
    const conversation = this.conversations.find((item) => Number(item.id) === conversationId);
    if (!conversation) return;
    this.closeConversationMenu();

    const menu = document.createElement("div");
    menu.className = "conversation-action-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = `
      <button type="button" role="menuitem" data-menu-action="toggle-pin">
        <span class="conversation-menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M8 4h8l-1.2 5.2 3.2 3.1v1.2H6v-1.2l3.2-3.1L8 4Zm4 9.5V20" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
        <span>${conversation.is_pinned ? "取消置顶" : "置顶聊天"}</span>
      </button>
      <button type="button" role="menuitem" data-menu-action="rename">
        <span class="conversation-menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m14 5 5 5M4 20l4.2-.8L19 8.4 15.6 5 4.8 15.8 4 20Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg></span><span>重命名</span>
      </button>
      <div class="conversation-menu-divider" role="separator"></div>
      <button type="button" role="menuitem" class="is-destructive" data-menu-action="delete" ${conversation.is_default ? "disabled" : ""}>
        <span class="conversation-menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M10 11v6m4-6v6M7 7l.8 13h8.4L17 7M9 7V4h6v3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
        <span>${conversation.is_default ? "默认聊天不可删除" : "删除聊天"}</span>
      </button>
    `;
    menu.addEventListener("click", async (event) => {
      const actionButton = event.target.closest("[data-menu-action]");
      const action = actionButton && actionButton.dataset.menuAction;
      if (!action) return;
      event.stopPropagation();
      this.closeConversationMenu();
      if (action === "rename") return this.renameConversation(conversationId);
      if (action === "toggle-pin") return this.toggleConversationPin(conversationId);
      if (action === "delete") return this.deleteConversation(conversationId);
    });
    document.body.appendChild(menu);
    this.menuElement = menu;
    const trigger =
      anchor && anchor.matches && anchor.matches("[data-conversation-action='menu']")
        ? anchor
        : null;
    if (trigger) trigger.setAttribute("aria-expanded", "true");

    const rect = anchor && anchor.getBoundingClientRect
      ? anchor.getBoundingClientRect()
      : null;
    const menuRect = menu.getBoundingClientRect();
    const x = (point && point.x) || (rect && rect.right) || 0;
    let left = x - menuRect.width;
    left = Math.max(8, Math.min(left, window.innerWidth - menuRect.width - 8));
    let top = (point && point.y) || (rect && rect.bottom) || 0;
    if (top + menuRect.height > window.innerHeight - 8) {
      top = ((rect && rect.top) || top) - menuRect.height - 6;
    } else if (!point) {
      top += 6;
    }
    menu.style.left = `${left}px`;
    menu.style.top = `${Math.max(8, top)}px`;
    const firstButton = menu.querySelector("button:not(:disabled)");
    if (firstButton) firstButton.focus({ preventScroll: true });
  },

  closeConversationMenu() {
    if (!this.menuElement) return;
    const trigger = document.querySelector("[data-conversation-action='menu'][aria-expanded='true']");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    this.menuElement.remove();
    this.menuElement = null;
  },

  async toggleConversationPin(conversationId) {
    const conversation = this.conversations.find((item) => Number(item.id) === conversationId);
    if (!conversation) return;
    try {
      await API.request(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        body: JSON.stringify({ is_pinned: !conversation.is_pinned }),
      });
      await this.refresh();
    } catch (error) {
      UI.showError(error.message || "置顶状态更新失败");
    }
  },

  async deleteConversation(conversationId) {
    const conversation = this.conversations.find((item) => Number(item.id) === conversationId);
    if (!conversation || conversation.is_default) return;
    const confirmed = window.confirm(
      `删除“${conversation.name}”后，其中的消息会被永久删除；未被其他聊天引用的文件也会一并删除。此操作不可恢复，确定继续吗？`
    );
    if (!confirmed) return;
    const wasActive = conversationId === this.activeId;
    try {
      await API.request(`/api/conversations/${conversationId}`, { method: "DELETE" });
      await this.refresh();
      if (wasActive) {
        MessageHandler.switchConversation(this.activeId);
        if (window.Realtime && window.Realtime.refreshConversation) {
          window.Realtime.refreshConversation();
        }
      }
    } catch (error) {
      UI.showError(error.message || "删除聊天失败");
    }
  },

  async createConversation() {
    const usedNames = new Set(this.conversations.map((item) => item.name));
    let suffix = 2;
    while (usedNames.has(`微信传输助手 ${suffix}`)) suffix += 1;
    const name = await this.requestName(`微信传输助手 ${suffix}`, "新建聊天");
    if (!name) return;
    try {
      const result = await API.post("/api/conversations", { name });
      await this.refresh();
      await this.selectConversation(Number(result.data.id));
    } catch (error) {
      UI.showError(error.message || "新建聊天失败");
    }
  },

  async renameConversation(conversationId) {
    const conversation = this.conversations.find(
      (item) => Number(item.id) === conversationId
    );
    if (!conversation) return;
    const name = await this.requestName(conversation.name, "重命名聊天");
    if (!name || name === conversation.name) return;
    try {
      await API.request(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      await this.refresh();
    } catch (error) {
      UI.showError(error.message || "重命名失败");
    }
  },

  requestName(initialName, title) {
    const dialog = document.createElement("dialog");
    dialog.className = "conversation-name-dialog";
    dialog.innerHTML = `
      <form>
        <header><strong></strong><button type="button" class="dialog-close" aria-label="关闭">×</button></header>
        <label>聊天名称<input type="text" maxlength="40" required autocomplete="off"></label>
        <div class="dialog-actions">
          <button type="button" class="dialog-cancel">取消</button>
          <button type="submit" class="dialog-confirm">完成</button>
        </div>
      </form>
    `;
    dialog.querySelector("header strong").textContent = title;
    const input = dialog.querySelector("input");
    input.value = initialName;
    document.body.appendChild(dialog);
    return new Promise((resolve) => {
      let value = "";
      dialog.querySelector("form").addEventListener("submit", (event) => {
        event.preventDefault();
        if (!input.reportValidity()) return;
        value = input.value.trim();
        if (value) dialog.close("save");
      });
      dialog.querySelectorAll(".dialog-close, .dialog-cancel").forEach((button) => {
        button.addEventListener("click", () => dialog.close());
      });
      dialog.addEventListener("close", () => {
        dialog.remove();
        resolve(value);
      }, { once: true });
      dialog.showModal();
      input.focus();
      input.select();
    });
  },

  async selectConversation(conversationId) {
    const nextId = Number(conversationId);
    if (!this.conversations.some((item) => Number(item.id) === nextId)) return;
    if (nextId === this.activeId) {
      this.closeDrawer();
      return;
    }
    const input = document.getElementById("messageText");
    if (input) {
      localStorage.setItem(`wxchat_draft_${this.activeId}`, input.value);
    }
    this.activeId = nextId;
    localStorage.setItem("wxchat_current_conversation_id", nextId);
    this.render();
    this.updateHeader();
    if (input) {
      input.value = localStorage.getItem(`wxchat_draft_${nextId}`) || "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    this.closeDrawer();
    MessageHandler.switchConversation(nextId);
    if (window.Realtime && window.Realtime.refreshConversation) {
      Realtime.refreshConversation();
    }
  },

  openDrawer() {
    document.body.classList.add("conversation-drawer-open");
  },

  closeDrawer() {
    document.body.classList.remove("conversation-drawer-open");
  },
};
