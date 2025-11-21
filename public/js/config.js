// 应用配置文件

const CONFIG = {
  // API 配置
  API: {
    BASE_URL: "", // 使用相对路径
    ENDPOINTS: {
      MESSAGES: "/api/messages",
      FILES_UPLOAD: "/api/files/upload",
      FILES_DOWNLOAD: "/api/files/download",
      SYNC: "/api/sync",
      CLEAR_ALL: "/api/clear-all",
      // 鉴权相关接口
      AUTH_LOGIN: "/api/auth/login",
      AUTH_VERIFY: "/api/auth/verify",
      AUTH_LOGOUT: "/api/auth/logout",
      // 搜索相关接口
      SEARCH: "/api/search",
      SEARCH_SUGGESTIONS: "/api/search/suggestions",
      // 配置接口
      CONFIG: "/api/config",
    },
  },

  // 文件上传配置（可动态更新）
  FILE: {
    MAX_SIZE: 100 * 1024 * 1024, // 默认100MB，启动时从服务器获取
    ALLOWED_TYPES: "*", // 允许所有类型
    CHUNK_SIZE: 1024 * 1024, // 1MB chunks (如果需要分片上传)
  },

  // UI 配置
  UI: {
    AUTO_REFRESH_INTERVAL: 5000, // 5秒自动刷新（SSE已处理新消息，减少频率）
    MESSAGE_LOAD_LIMIT: 5000, // 初始加载消息数量（Docker部署无限制）
    ANIMATION_DURATION: 100, // 动画持续时间(ms)（更快动画）
    TYPING_INDICATOR_DELAY: 1000, // 输入指示器延迟
    LOAD_MORE_BATCH_SIZE: 30, // 每次无限滚动加载的消息数量
    INFINITE_SCROLL_THRESHOLD: 80, // 距离顶部多少px时触发无限滚动
    SCROLL_DEBOUNCE_DELAY: 100, // 滚动事件防抖延迟(ms)
  },

  // 设备配置
  DEVICE: {
    ID_PREFIX: "web-",
    NAME_MOBILE: "移动设备",
    NAME_DESKTOP: "Web浏览器",
    STORAGE_KEY: "deviceId",
  },

  // 消息类型
  MESSAGE_TYPES: {
    TEXT: "text",
    FILE: "file",
    AI_THINKING: "ai_thinking",
    AI_RESPONSE: "ai_response",
  },

  // AI 配置
  AI: {
    ENABLED: true,
    API_BASE_URL: "", // 使用相对路径，调用自己的后端
    MODEL: "gpt-4o-mini", // 默认值，启动时会被服务器配置覆盖
    MAX_TOKENS: 4000,
    TEMPERATURE: 0.7,
    STREAM: true,
    THINKING_INDICATOR: "🤔 AI正在思考...",
    RESPONSE_INDICATOR: "🤖 AI助手",
    MODE_INDICATOR: "🤖 AI模式",
  },

  // AI图片生成配置
  IMAGE_GEN: {
    ENABLED: true,
    MODEL: "Kwai-Kolors/Kolors",
    DEFAULT_SIZE: "1024x1024",
    DEFAULT_STEPS: 20,
    DEFAULT_GUIDANCE: 7.5,
    MAX_PROMPT_LENGTH: 1000,
    GENERATING_INDICATOR: "🎨 AI正在生成图片...",
    UPLOADING_INDICATOR: "📤 正在保存图片...",
    SUCCESS_INDICATOR: "✅ 图片生成完成",
  },

  // 文件类型图标映射 - 完整版
  FILE_ICONS: {
    // 图片文件
    "image/": "🖼️",
    "image/jpeg": "🖼️",
    "image/jpg": "🖼️",
    "image/png": "🖼️",
    "image/gif": "🎞️",
    "image/bmp": "🖼️",
    "image/svg+xml": "🎨",
    "image/webp": "🖼️",
    "image/tiff": "🖼️",
    "image/ico": "🖼️",

    // 视频文件
    "video/": "🎥",
    "video/mp4": "🎥",
    "video/avi": "🎥",
    "video/mov": "🎥",
    "video/wmv": "🎥",
    "video/mkv": "🎥",
    "video/flv": "🎥",
    "video/webm": "🎥",
    "video/m4v": "🎥",

    // 音频文件
    "audio/": "🎵",
    "audio/mp3": "🎵",
    "audio/wav": "🎵",
    "audio/aac": "🎵",
    "audio/flac": "🎵",
    "audio/ogg": "🎵",
    "audio/m4a": "🎵",
    "audio/wma": "🎵",

    // 文档文件
    "application/pdf": "📕",
    "application/msword": "📘",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "📘",
    "application/vnd.ms-excel": "📗",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "📗",
    "application/vnd.ms-powerpoint": "📙",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      "📙",
    "application/rtf": "📄",

    // 压缩文件
    "application/zip": "📦",
    "application/x-rar-compressed": "📦",
    "application/x-7z-compressed": "📦",
    "application/x-tar": "📦",
    "application/gzip": "📦",
    "application/x-bzip2": "📦",

    // 文本文件
    "text/": "📄",
    "text/plain": "📄",
    "text/html": "🌐",
    "text/css": "🎨",
    "text/javascript": "⚡",
    "text/xml": "📋",
    "text/csv": "📊",
    "text/markdown": "📝",

    // 代码文件
    "application/javascript": "⚡",
    "application/json": "📋",
    "application/xml": "📋",

    // 其他常见格式
    "application/octet-stream": "📄",
    "application/x-executable": "⚙️",
    "application/x-msi": "💿",
    "application/x-deb": "📦",
    "application/x-rpm": "📦",

    // 默认图标
    default: "📄",
  },

  // 文件扩展名图标映射 - 用于无MIME类型时的备用检测
  FILE_EXTENSION_ICONS: {
    // 图片
    jpg: "🖼️",
    jpeg: "🖼️",
    png: "🖼️",
    gif: "🎞️",
    bmp: "🖼️",
    svg: "🎨",
    webp: "🖼️",
    tiff: "🖼️",
    tif: "🖼️",
    ico: "🖼️",

    // 视频
    mp4: "🎥",
    avi: "🎥",
    mov: "🎥",
    wmv: "🎥",
    mkv: "🎥",
    flv: "🎥",
    webm: "🎥",
    m4v: "🎥",
    mpg: "🎥",
    mpeg: "🎥",

    // 音频
    mp3: "🎵",
    wav: "🎵",
    aac: "🎵",
    flac: "🎵",
    ogg: "🎵",
    m4a: "🎵",
    wma: "🎵",
    opus: "🎵",

    // 文档
    pdf: "📕",
    doc: "📘",
    docx: "📘",
    xls: "📗",
    xlsx: "📗",
    ppt: "📙",
    pptx: "📙",
    rtf: "📄",
    odt: "📘",
    ods: "📗",
    odp: "📙",

    // 压缩
    zip: "📦",
    rar: "📦",
    "7z": "📦",
    tar: "📦",
    gz: "📦",
    bz2: "📦",
    xz: "📦",
    dmg: "💿",
    iso: "💿",

    // 文本和代码
    txt: "📄",
    md: "📝",
    html: "🌐",
    htm: "🌐",
    css: "🎨",
    js: "⚡",
    ts: "⚡",
    jsx: "⚡",
    tsx: "⚡",
    json: "📋",
    xml: "📋",
    csv: "📊",
    sql: "🗃️",

    // 编程语言
    py: "🐍",
    java: "☕",
    cpp: "⚙️",
    c: "⚙️",
    h: "⚙️",
    php: "🐘",
    rb: "💎",
    go: "🐹",
    rs: "🦀",
    swift: "🦉",
    kt: "🎯",
    scala: "📐",
    r: "📊",
    matlab: "📊",
    m: "📊",

    // 配置文件
    ini: "⚙️",
    cfg: "⚙️",
    conf: "⚙️",
    yaml: "⚙️",
    yml: "⚙️",
    toml: "⚙️",
    env: "⚙️",

    // 可执行文件
    exe: "⚙️",
    msi: "💿",
    deb: "📦",
    rpm: "📦",
    dmg: "💿",
    app: "📱",
    apk: "📱",

    // 字体文件
    ttf: "🔤",
    otf: "🔤",
    woff: "🔤",
    woff2: "🔤",
    eot: "🔤",

    // 其他
    log: "📜",
    bak: "💾",
    tmp: "🗂️",
    cache: "🗂️",
  },

  // 清理功能配置
  CLEAR: {
    TRIGGER_COMMANDS: ["/clear-all", "清空数据", "/清空", "clear all"],
    CONFIRM_CODE: "1234",
    CONFIRM_MESSAGE:
      "⚠️ 此操作将永久删除所有聊天记录和文件，无法恢复！\n\n请输入确认码：1234",
  },

  // PWA功能配置
  PWA: {
    TRIGGER_COMMANDS: ["/pwa", "/install", "/安装", "pwa", "install", "安装"],
    INSTALL_BENEFITS: [
      "像原生应用一样使用",
      "快速启动，无需浏览器",
      "离线访问缓存内容",
      "自动更新到最新版本",
    ],
  },

  // 错误消息
  ERRORS: {
    NETWORK: "网络连接失败，请检查网络",
    FILE_TOO_LARGE: () =>
      `文件大小不能超过${ConfigManager.getMaxFileSizeText()}`,
    FILE_UPLOAD_FAILED: "文件上传失败",
    MESSAGE_SEND_FAILED: "消息发送失败",
    LOAD_MESSAGES_FAILED: "加载消息失败",
    DEVICE_SYNC_FAILED: "设备同步失败",
    CLEAR_FAILED: "数据清理失败",
    CLEAR_CANCELLED: "数据清理已取消",
    AI_REQUEST_FAILED: "AI请求失败，请稍后重试",
    AI_STREAM_ERROR: "AI流式响应中断",
    AI_PARSE_ERROR: "AI响应解析失败",
    IMAGE_GEN_FAILED: "AI图片生成失败",
    IMAGE_GEN_PROMPT_EMPTY: "请输入图片描述",
    IMAGE_GEN_PROMPT_TOO_LONG: "图片描述过长，请简化",
    IMAGE_GEN_DOWNLOAD_FAILED: "图片下载失败",
    IMAGE_GEN_UPLOAD_FAILED: "图片保存失败",
    IMAGE_GEN_API_ERROR: "AI图片生成服务暂时不可用",
    IMAGE_GEN_QUOTA_EXCEEDED: "图片生成次数已达上限",
    SEARCH_FAILED: "搜索失败，请稍后重试",
    SEARCH_QUERY_TOO_SHORT: "搜索关键词太短",
    SEARCH_NO_RESULTS: "没有找到匹配的结果",
    SEARCH_SERVER_ERROR: "搜索服务暂时不可用",
  },

  // 成功消息
  SUCCESS: {
    FILE_UPLOADED: "文件上传成功",
    MESSAGE_SENT: "消息发送成功",
    DEVICE_SYNCED: "设备同步成功",
    DATA_CLEARED: "数据清理成功",
    AI_MODE_ENABLED: "AI模式已启用",
    AI_MODE_DISABLED: "AI模式已关闭",
    IMAGE_GEN_SUCCESS: "图片生成成功",
    IMAGE_GEN_SAVED: "图片已保存到聊天记录",
    SEARCH_COMPLETED: "搜索完成",
    SEARCH_HISTORY_CLEARED: "搜索历史已清除",
  },

  // 搜索功能配置
  SEARCH: {
    ENABLED: true,
    MAX_RESULTS: 100,
    RESULTS_PER_PAGE: 20,
    DEBOUNCE_DELAY: 300,
    MIN_QUERY_LENGTH: 1,
    HIGHLIGHT_CLASS: "search-highlight",
    HISTORY_LIMIT: 20,
    DEFAULT_FILTERS: {
      type: "all",
      timeRange: "all",
      deviceId: "all",
    },
    FILE_TYPE_CATEGORIES: {
      image: [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/bmp",
        "image/svg+xml",
        "image/webp",
      ],
      video: [
        "video/mp4",
        "video/avi",
        "video/mov",
        "video/wmv",
        "video/mkv",
        "video/flv",
        "video/webm",
      ],
      audio: [
        "audio/mp3",
        "audio/wav",
        "audio/aac",
        "audio/flac",
        "audio/ogg",
        "audio/m4a",
      ],
      document: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
      archive: [
        "application/zip",
        "application/x-rar-compressed",
        "application/x-7z-compressed",
        "application/x-tar",
      ],
      text: [
        "text/plain",
        "text/html",
        "text/css",
        "text/javascript",
        "text/markdown",
      ],
      code: ["application/javascript", "application/json", "application/xml"],
    },
  },
};

// 配置管理函数
const ConfigManager = {
  // 从服务器加载配置
  async loadConfig() {
    try {
      const response = await fetch(CONFIG.API.ENDPOINTS.CONFIG, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("wxchat_auth_token")}`,
        },
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // 更新文件大小限制
          CONFIG.FILE.MAX_SIZE = result.data.maxFileSize;
          // console.log(
          //   `📦 文件大小限制已更新为: ${result.data.maxFileSizeMB}MB`
          // );

          // 更新AI配置
          if (result.data.aiConfig) {
            CONFIG.AI.MODEL = result.data.aiConfig.model;
            CONFIG.AI.MAX_TOKENS = result.data.aiConfig.maxTokens;
            CONFIG.AI.TEMPERATURE = result.data.aiConfig.temperature;
            CONFIG.AI.STREAM = result.data.aiConfig.stream;
            // console.log(`🤖 AI配置已更新: ${result.data.aiConfig.model}`);
          }

          // 更新图片生成配置
          if (result.data.imageGenConfig) {
            CONFIG.IMAGE_GEN.MODEL = result.data.imageGenConfig.model;
            CONFIG.IMAGE_GEN.DEFAULT_SIZE =
              result.data.imageGenConfig.defaultSize;
            CONFIG.IMAGE_GEN.DEFAULT_STEPS =
              result.data.imageGenConfig.defaultSteps;
            CONFIG.IMAGE_GEN.DEFAULT_GUIDANCE =
              result.data.imageGenConfig.defaultGuidance;
            // console.log(
            //   `🎨 图片生成配置已更新: ${result.data.imageGenConfig.model}`
            // );
          }
        }
      }
    } catch (error) {
      console.warn("⚠️ 无法从服务器加载配置，使用默认值:", error);
    }
  },

  // 获取格式化的文件大小限制
  getMaxFileSizeMB() {
    return Math.round(CONFIG.FILE.MAX_SIZE / (1024 * 1024));
  },

  // 获取格式化的文件大小限制文本
  getMaxFileSizeText() {
    const mb = this.getMaxFileSizeMB();
    return mb >= 1024 ? `${Math.round(mb / 1024)}GB` : `${mb}MB`;
  },
};

// 冻结配置对象，防止意外修改（除了FILE配置，因为它需要动态更新）
Object.freeze(CONFIG);
Object.freeze(CONFIG.API);
Object.freeze(CONFIG.API.ENDPOINTS);
// CONFIG.FILE 不冻结，允许动态更新
Object.freeze(CONFIG.UI);
Object.freeze(CONFIG.DEVICE);
Object.freeze(CONFIG.MESSAGE_TYPES);
Object.freeze(CONFIG.AI);
Object.freeze(CONFIG.IMAGE_GEN);
Object.freeze(CONFIG.FILE_ICONS);
Object.freeze(CONFIG.FILE_EXTENSION_ICONS);
Object.freeze(CONFIG.CLEAR);
Object.freeze(CONFIG.PWA);
Object.freeze(CONFIG.ERRORS);
Object.freeze(CONFIG.SUCCESS);
Object.freeze(CONFIG.SEARCH);
