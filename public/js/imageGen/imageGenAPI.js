// SiliconFlow AI 图片生成 API 封装
// 专门处理与SiliconFlow API的图片生成通信

const ImageGenAPI = {
  // 当前请求的AbortController
  currentController: null,

  // 图片生成 - 核心方法
  async generateImage(prompt, options = {}) {
    // 取消之前的请求
    if (this.currentController) {
      this.currentController.abort();
    }

    this.currentController = new AbortController();

    try {
      // 构建请求参数
      const requestBody = {
        model: CONFIG.IMAGE_GEN.MODEL,
        prompt: prompt,
        image_size: options.imageSize || "1024x1024",
        batch_size: 1,
        num_inference_steps: options.numInferenceSteps || 20,
        guidance_scale: options.guidanceScale || 7.5,
        ...options,
      };

      // 添加可选参数
      if (options.negativePrompt) {
        requestBody.negative_prompt = options.negativePrompt;
      }

      if (options.seed) {
        requestBody.seed = options.seed;
      }

      const response = await fetch("/api/ai/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("wxchat_auth_token")}`,
        },
        body: JSON.stringify(requestBody),
        signal: this.currentController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `API请求失败: ${response.status} ${response.statusText} - ${
            errorData.error || "未知错误"
          }`
        );
      }

      const result = await response.json();

      if (result.success && result.data) {
        return {
          success: true,
          data: {
            imageUrl: result.data.images[0].url,
            seed: result.data.seed,
            timings: result.data.timings,
            prompt: prompt,
            options: options,
          },
        };
      } else {
        throw new Error(result.message || "图片生成失败");
      }
    } catch (error) {
      if (error.name === "AbortError") {
        return {
          success: false,
          error: "请求被取消",
          cancelled: true,
        };
      }

      return {
        success: false,
        error: error.message || "图片生成失败",
      };
    }
  },

  // 下载图片数据
  async downloadImageData(imageUrl) {
    try {
      const response = await fetch(imageUrl);

      if (!response.ok) {
        throw new Error(
          `图片下载失败: ${response.status} ${response.statusText}`
        );
      }

      const blob = await response.blob();

      return blob;
    } catch (error) {
      throw new Error(`图片下载失败: ${error.message}`);
    }
  },

  // 取消当前请求
  cancelCurrentRequest() {
    if (this.currentController) {
      this.currentController.abort();
      this.currentController = null;
      console.log("ImageGenAPI: 已取消当前请求");
    }
  },

  // 验证提示词
  validatePrompt(prompt) {
    if (!prompt || typeof prompt !== "string") {
      return { valid: false, error: "提示词不能为空" };
    }

    if (prompt.trim().length === 0) {
      return { valid: false, error: "提示词不能为空" };
    }

    if (prompt.length > 1000) {
      return { valid: false, error: "提示词长度不能超过1000个字符" };
    }

    return { valid: true };
  },

  // 验证图片尺寸
  validateImageSize(size) {
    const validSizes = [
      "512x512",
      "768x768",
      "1024x1024",
      "1024x1536",
      "1536x1024",
    ];
    return validSizes.includes(size);
  },

  // 获取支持的图片尺寸列表
  getSupportedImageSizes() {
    return [
      { value: "512x512", label: "512×512 (正方形小图)" },
      { value: "768x768", label: "768×768 (正方形中图)" },
      { value: "1024x1024", label: "1024×1024 (正方形大图)" },
      { value: "1024x1536", label: "1024×1536 (竖版)" },
      { value: "1536x1024", label: "1536×1024 (横版)" },
    ];
  },

  // 获取API状态
  getStatus() {
    return {
      hasActiveRequest: this.currentController !== null,
    };
  },
};

// 导出到全局
window.ImageGenAPI = ImageGenAPI;
