// 搜索处理器模块 - 整合搜索API和UI的交互逻辑

const SearchHandler = {
  // 初始化搜索功能
  init() {
    // 初始化API和UI模块
    if (typeof SearchAPI !== "undefined") {
      // SearchAPI已自动初始化
    }

    if (typeof SearchUI !== "undefined") {
      SearchUI.init();
    }

    // console.log('🔍 搜索功能已初始化');
  },

  // 显示搜索模态框（供外部调用）
  showSearchModal() {
    if (typeof SearchUI !== "undefined" && SearchUI.showSearchModal) {
      SearchUI.showSearchModal();
    } else {
      console.error("SearchUI未正确加载");
    }
  },

  // 执行搜索（供外部调用）
  async executeSearch(query, filters = {}) {
    if (typeof SearchAPI !== "undefined" && SearchAPI.search) {
      return await SearchAPI.search(query, filters);
    } else {
      throw new Error("SearchAPI未正确加载");
    }
  },

  // 清除搜索缓存
  clearCache() {
    if (typeof SearchAPI !== "undefined" && SearchAPI.clearCache) {
      SearchAPI.clearCache();
    }
  },
};

// 导出到全局
if (typeof window !== "undefined") {
  window.SearchHandler = SearchHandler;
}

// 模块导出
if (typeof module !== "undefined" && module.exports) {
  module.exports = SearchHandler;
}
