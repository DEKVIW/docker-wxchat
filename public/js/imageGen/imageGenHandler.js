// AI图片生成处理器
// 负责协调图片生成的完整流程：API调用 → 图片下载 → R2上传 → 数据库存储 → UI更新

const ImageGenHandler = {
    // 当前生成状态
    isGenerating: false,
    currentGenerationId: null,
    
    // 初始化
    init() {
        this.bindEvents();
    },
    
    // 绑定事件
    bindEvents() {
        // 监听图片生成请求
        document.addEventListener('imageGenRequest', (event) => {
            this.handleImageGeneration(event.detail);
        });
    },
    
    // 处理图片生成请求 - 主要流程
    async handleImageGeneration(options) {
        if (this.isGenerating) {
            UI.showError('正在生成图片中，请稍候...');
            return;
        }
        
        try {
            this.isGenerating = true;
            const { prompt, negativePrompt, imageSize, guidanceScale, numInferenceSteps } = options;
            
            // 1. 验证提示词
            const validation = ImageGenAPI.validatePrompt(prompt);
            if (!validation.valid) {
                throw new Error(validation.error);
            }
            
            // 2. 显示生成状态
            const statusElement = this.showGeneratingStatus(prompt);
            
            // 3. 调用SiliconFlow API生成图片
            const generateResult = await ImageGenAPI.generateImage(prompt, {
                negativePrompt,
                imageSize: imageSize || CONFIG.IMAGE_GEN.DEFAULT_SIZE,
                guidanceScale: guidanceScale || CONFIG.IMAGE_GEN.DEFAULT_GUIDANCE,
                numInferenceSteps: numInferenceSteps || CONFIG.IMAGE_GEN.DEFAULT_STEPS
            });
            
            if (!generateResult.success) {
                throw new Error(generateResult.error);
            }
            
            // 4. 更新状态为下载中
            this.updateGeneratingStatus(statusElement, '📥 正在下载图片...');
            
            // 5. 下载图片数据
            const imageBlob = await ImageGenAPI.downloadImageData(generateResult.data.imageUrl);
            
            // 6. 更新状态为上传中
            this.updateGeneratingStatus(statusElement, CONFIG.IMAGE_GEN.UPLOADING_INDICATOR);
            
            // 7. 创建文件对象并上传到R2（使用现有的文件上传API）
            const timestamp = Date.now();
            const fileName = `ai-generated-${timestamp}.png`;

            // 确保文件类型正确
            const file = new File([imageBlob], fileName, {
                type: 'image/png',
                lastModified: timestamp
            });

            const deviceId = Utils.getDeviceId();
            const uploadResult = await API.uploadFile(file, deviceId);
            
            // 8. 移除生成状态显示
            this.hideGeneratingStatus(statusElement);
            
            // 9. 显示成功消息
            UI.showSuccess(CONFIG.IMAGE_GEN.SUCCESS_INDICATOR);
            
            // 10. 刷新消息列表显示新图片
            setTimeout(async () => {
                await MessageHandler.loadMessages(true); // 强制滚动到底部
            }, 500);
            
            return {
                success: true,
                data: {
                    fileId: uploadResult.fileId,
                    fileName: uploadResult.fileName,
                    prompt: prompt,
                    generationData: generateResult.data
                }
            };
            
        } catch (error) {
            // 根据错误类型显示不同的错误信息
            let errorMessage = CONFIG.ERRORS.IMAGE_GEN_FAILED;

            if (error.message.includes('网络')) {
                errorMessage = CONFIG.ERRORS.NETWORK;
            } else if (error.message.includes('API请求失败')) {
                errorMessage = CONFIG.ERRORS.IMAGE_GEN_API_ERROR;
            } else if (error.message.includes('下载失败')) {
                errorMessage = CONFIG.ERRORS.IMAGE_GEN_DOWNLOAD_FAILED;
            } else if (error.message.includes('上传失败')) {
                errorMessage = CONFIG.ERRORS.IMAGE_GEN_UPLOAD_FAILED;
            } else if (error.message.includes('提示词')) {
                errorMessage = error.message; // 使用原始提示词错误信息
            } else if (error.message.includes('quota') || error.message.includes('limit')) {
                errorMessage = CONFIG.ERRORS.IMAGE_GEN_QUOTA_EXCEEDED;
            }

            // 显示用户友好的错误信息
            UI.showError(errorMessage);

            return {
                success: false,
                error: error.message,
                userMessage: errorMessage
            };

        } finally {
            this.isGenerating = false;
            this.currentGenerationId = null;
        }
    },
    
    // 显示生成状态
    showGeneratingStatus(prompt) {
        const messageList = document.getElementById('messageList');
        if (!messageList) return null;
        
        const statusId = `gen-status-${Date.now()}`;
        const statusElement = document.createElement('div');
        statusElement.id = statusId;
        statusElement.className = 'message-item generating-status';
        statusElement.innerHTML = `
            <div class="message-content generating-message">
                <div class="generating-header">
                    <span class="generating-indicator">${CONFIG.IMAGE_GEN.GENERATING_INDICATOR}</span>
                </div>
                <div class="generating-prompt">
                    <strong>提示词:</strong> ${this.escapeHtml(prompt)}
                </div>
                <div class="generating-progress">
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                </div>
            </div>
            <div class="message-meta">
                <span>AI图片生成</span>
                <span class="message-time">${Utils.formatTime(new Date())}</span>
            </div>
        `;
        
        messageList.appendChild(statusElement);
        messageList.scrollTop = messageList.scrollHeight;
        
        return statusElement;
    },
    
    // 更新生成状态
    updateGeneratingStatus(statusElement, newStatus) {
        if (!statusElement) return;
        
        const indicator = statusElement.querySelector('.generating-indicator');
        if (indicator) {
            indicator.textContent = newStatus;
        }
    },
    
    // 隐藏生成状态
    hideGeneratingStatus(statusElement) {
        if (statusElement && statusElement.parentNode) {
            statusElement.parentNode.removeChild(statusElement);
        }
    },
    
    // 取消当前生成
    cancelGeneration() {
        if (this.isGenerating) {
            ImageGenAPI.cancelCurrentRequest();
            this.isGenerating = false;
            this.currentGenerationId = null;
            
            UI.showInfo('图片生成已取消');
        }
    },
    
    // 获取生成状态
    getStatus() {
        return {
            isGenerating: this.isGenerating,
            currentGenerationId: this.currentGenerationId
        };
    },
    
    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// 导出到全局
window.ImageGenHandler = ImageGenHandler;
