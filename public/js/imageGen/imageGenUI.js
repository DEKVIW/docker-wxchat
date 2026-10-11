// AI图片生成UI组件
// 负责图片生成的用户界面交互和显示

const ImageGenUI = {
    // UI状态
    isModalOpen: false,
    currentModal: null,
    
    // 初始化
    init() {
        this.bindEvents();
    },
    
    // 绑定事件
    bindEvents() {
        // 监听模态框关闭事件
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('image-gen-modal-overlay')) {
                this.closeModal();
            }
        });
        
        // 监听ESC键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isModalOpen) {
                this.closeModal();
            }
        });
    },
    
    // 显示图片生成模态框
    showImageGenModal() {
        if (this.isModalOpen) {
            return;
        }
        
        const modal = this.createImageGenModal();
        document.body.appendChild(modal);
        
        this.currentModal = modal;
        this.isModalOpen = true;
        
        // 聚焦到提示词输入框
        setTimeout(() => {
            const promptInput = modal.querySelector('#imageGenPrompt');
            if (promptInput) {
                promptInput.focus();
            }
        }, 100);
    },
    
    // 创建图片生成模态框
    createImageGenModal() {
        const modal = document.createElement('div');
        modal.className = 'image-gen-modal-overlay show';
        modal.innerHTML = `
            <div class="image-gen-modal">
                <div class="image-gen-header">
                    <h3>🎨 AI图片生成</h3>
                    <button class="close-btn" onclick="ImageGenUI.closeModal()">×</button>
                </div>
                
                <div class="image-gen-content">
                    <div class="form-group">
                        <label for="imageGenPrompt">图片描述 *</label>
                        <textarea 
                            id="imageGenPrompt" 
                            placeholder="请描述你想要生成的图片，例如：一只可爱的小猫坐在花园里，阳光明媚，卡通风格"
                            maxlength="${CONFIG.IMAGE_GEN.MAX_PROMPT_LENGTH}"
                            rows="3"
                        ></textarea>
                        <div class="char-count">
                            <span id="promptCharCount">0</span>/${CONFIG.IMAGE_GEN.MAX_PROMPT_LENGTH}
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="imageGenNegativePrompt">负面提示词（可选）</label>
                        <input 
                            type="text" 
                            id="imageGenNegativePrompt" 
                            placeholder="不想要的元素，例如：模糊、低质量、变形"
                        />
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="imageGenSize">图片尺寸</label>
                            <select id="imageGenSize">
                                <option value="1024x1024" selected>1024×1024 (正方形)</option>
                                <option value="1024x1536">1024×1536 (竖版)</option>
                                <option value="1536x1024">1536×1024 (横版)</option>
                                <option value="768x768">768×768 (中等)</option>
                                <option value="512x512">512×512 (小图)</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="imageGenSteps">生成步数</label>
                            <select id="imageGenSteps">
                                <option value="15">15 (快速)</option>
                                <option value="20" selected>20 (推荐)</option>
                                <option value="30">30 (精细)</option>
                                <option value="50">50 (最佳)</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="imageGenGuidance">引导强度: <span id="guidanceValue">7.5</span></label>
                        <input 
                            type="range" 
                            id="imageGenGuidance" 
                            min="1" 
                            max="20" 
                            step="0.5" 
                            value="7.5"
                        />
                        <div class="range-labels">
                            <span>创意</span>
                            <span>精确</span>
                        </div>
                    </div>
                </div>
                
                <div class="image-gen-footer">
                    <button class="btn-cancel" onclick="ImageGenUI.closeModal()">取消</button>
                    <button class="btn-generate" onclick="ImageGenUI.startGeneration()">
                        🎨 生成图片
                    </button>
                </div>
            </div>
        `;
        
        // 绑定事件
        this.bindModalEvents(modal);
        
        return modal;
    },
    
    // 绑定模态框事件
    bindModalEvents(modal) {
        // 提示词字符计数
        const promptInput = modal.querySelector('#imageGenPrompt');
        const charCount = modal.querySelector('#promptCharCount');
        
        promptInput.addEventListener('input', () => {
            charCount.textContent = promptInput.value.length;
            
            // 字符数超限时的样式
            if (promptInput.value.length > CONFIG.IMAGE_GEN.MAX_PROMPT_LENGTH * 0.9) {
                charCount.style.color = '#ff4444';
            } else {
                charCount.style.color = '#666';
            }
        });
        
        // 引导强度滑块
        const guidanceSlider = modal.querySelector('#imageGenGuidance');
        const guidanceValue = modal.querySelector('#guidanceValue');
        
        guidanceSlider.addEventListener('input', () => {
            guidanceValue.textContent = guidanceSlider.value;
        });
        
        // 回车键提交
        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                this.startGeneration();
            }
        });
    },
    
    // 开始生成图片
    async startGeneration() {
        const modal = this.currentModal;
        if (!modal) return;
        
        // 获取表单数据
        const prompt = modal.querySelector('#imageGenPrompt').value.trim();
        const negativePrompt = modal.querySelector('#imageGenNegativePrompt').value.trim();
        const imageSize = modal.querySelector('#imageGenSize').value;
        const numInferenceSteps = parseInt(modal.querySelector('#imageGenSteps').value);
        const guidanceScale = parseFloat(modal.querySelector('#imageGenGuidance').value);
        
        // 验证提示词
        if (!prompt) {
            UI.showError('请输入图片描述');
            return;
        }
        
        // 禁用生成按钮
        const generateBtn = modal.querySelector('.btn-generate');
        const originalText = generateBtn.textContent;
        generateBtn.disabled = true;
        generateBtn.textContent = '🎨 生成中...';
        
        try {
            // 关闭模态框
            this.closeModal();
            
            // 触发图片生成事件
            const event = new CustomEvent('imageGenRequest', {
                detail: {
                    prompt,
                    negativePrompt: negativePrompt || undefined,
                    imageSize,
                    numInferenceSteps,
                    guidanceScale
                }
            });
            
            document.dispatchEvent(event);
            
        } catch (error) {
            UI.showError(`生成失败: ${error.message}`);
            
            // 恢复按钮状态
            generateBtn.disabled = false;
            generateBtn.textContent = originalText;
        }
    },
    
    // 关闭模态框
    closeModal() {
        if (!this.isModalOpen || !this.currentModal) {
            return;
        }
        
        // 移除模态框
        if (this.currentModal.parentNode) {
            this.currentModal.parentNode.removeChild(this.currentModal);
        }
        
        this.currentModal = null;
        this.isModalOpen = false;
    },
    
    // 显示快速生成输入框（简化版）
    showQuickGenInput() {
        const prompt = window.prompt('请输入图片描述:', '');
        if (prompt && prompt.trim()) {
            // 使用默认参数快速生成
            const event = new CustomEvent('imageGenRequest', {
                detail: {
                    prompt: prompt.trim(),
                    imageSize: CONFIG.IMAGE_GEN.DEFAULT_SIZE,
                    numInferenceSteps: CONFIG.IMAGE_GEN.DEFAULT_STEPS,
                    guidanceScale: CONFIG.IMAGE_GEN.DEFAULT_GUIDANCE
                }
            });
            
            document.dispatchEvent(event);
        }
    },
    
    // 获取UI状态
    getStatus() {
        return {
            isModalOpen: this.isModalOpen,
            hasModal: this.currentModal !== null
        };
    }
};

// 导出到全局
window.ImageGenUI = ImageGenUI;
