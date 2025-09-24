// 功能按钮组件 - 微信风格动态输入功能
// 实现输入框为空时显示的圆形加号按钮

const FunctionButton = {
  // 组件状态
  isVisible: true,

  // DOM 元素引用
  elements: {
    functionButton: null,
  },

  // 初始化功能按钮
  init() {
    // 确保DOM已加载
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        this.doInit();
      });
    } else {
      this.doInit();
    }
  },

  // 执行实际初始化
  doInit() {
    this.cacheElements();
    this.bindEvents();
    this.updateVisibility();
  },

  // 缓存DOM元素
  cacheElements() {
    this.elements.functionButton = document.getElementById("functionButton");

    // 检查关键元素是否存在
    if (!this.elements.functionButton) {
      console.error("FunctionButton: 找不到功能按钮元素 #functionButton");
    }
  },

  // 绑定事件
  bindEvents() {
    if (this.elements.functionButton) {
      // 点击功能按钮直接弹出菜单
      this.elements.functionButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (
          window.FunctionMenu &&
          typeof window.FunctionMenu.show === "function"
        ) {
          window.FunctionMenu.show();
        }
      });
    } else {
      console.error("FunctionButton: 无法绑定事件，按钮元素不存在");
    }
  },

  // 显示功能按钮
  show() {
    if (!this.elements.functionButton) return;

    this.isVisible = true;
    this.elements.functionButton.classList.remove("hide");
    this.elements.functionButton.classList.add("show");
  },

  // 隐藏功能按钮
  hide() {
    if (!this.elements.functionButton) return;

    this.isVisible = false;
    this.elements.functionButton.classList.remove("show");
    this.elements.functionButton.classList.add("hide");
  },

  // 更新可见性（根据输入框状态）
  updateVisibility() {
    const messageText = document.getElementById("messageText");
    if (!messageText) {
      console.warn("FunctionButton: 找不到输入框元素");
      return;
    }

    const hasContent = messageText.value.trim().length > 0;

    if (hasContent) {
      this.hide();
    } else {
      this.show();
    }
  },

  // 获取当前状态
  getState() {
    return {
      isVisible: this.isVisible,
    };
  },
};

// 导出组件（如果使用模块系统）
if (typeof module !== "undefined" && module.exports) {
  module.exports = FunctionButton;
}
