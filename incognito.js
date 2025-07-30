document.addEventListener('DOMContentLoaded', () => {
    // --- Global State ---
    let geminiApiKey = null;
    let presetPrompts = {}; // (2) 用於儲存預設提示語
    const MAX_ROUNDS = 6; // 3 user turns + 3 AI turns

    // --- Chat Instance Manager ---
    // Manages the state and DOM elements for a single chat tab
    class ChatInstance {
        constructor(modelId, modelName) {
            this.modelId = modelId;
            this.modelName = modelName;
            this.history = [];
            this.imageFiles = [];

            // DOM Elements
            this.chatWindow = document.getElementById(`chat-window-${modelId}`);
            this.promptInput = document.getElementById(`prompt-${modelId}`);
            this.sendBtn = document.getElementById(`send-btn-${modelId}`);
            this.uploadBtn = document.getElementById(`upload-btn-${modelId}`);
            this.fileInput = document.getElementById(`file-input-${modelId}`);
            this.previewContainer = document.getElementById(`image-preview-container-${modelId}`);
            this.presetButtons = document.querySelectorAll(`#preset-buttons-container-${modelId} .preset-btn`);

            this.attachEventListeners();
        }

        attachEventListeners() {
            this.sendBtn.addEventListener('click', () => this.sendMessage());
            this.uploadBtn.addEventListener('click', () => this.fileInput.click());
            this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
            
            // (3) 新增：貼上事件監聽
            this.promptInput.addEventListener('paste', (e) => this.handlePaste(e));

            // (2) 新增：預設提示按鈕事件監聽
            this.presetButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const presetKey = `preset_${button.dataset.preset.toLowerCase()}`;
                    const textToInsert = presetPrompts[presetKey];
                    if (textToInsert) {
                        // 將文字插入到當前游標位置，或附加到結尾
                        const start = this.promptInput.selectionStart;
                        const end = this.promptInput.selectionEnd;
                        const originalText = this.promptInput.value;
                        this.promptInput.value = originalText.substring(0, start) + textToInsert + originalText.substring(end);
                        this.promptInput.focus();
                        // 將游標移到插入文字的後面
                        this.promptInput.selectionStart = this.promptInput.selectionEnd = start + textToInsert.length;
                    }
                });
            });
        }
        
        // (3) 新增：處理貼上事件的函式
        handlePaste(event) {
            const items = (event.clipboardData || event.originalEvent.clipboardData).items;
            for (const item of items) {
                if (item.kind === 'file' && item.type.startsWith('image/')) {
                    event.preventDefault(); // 防止瀏覽器預設行為 (如貼上檔案路徑)
                    const file = item.getAsFile();
                    this.processImageFile(file);
                    return; // 只處理第一張圖片
                }
            }
        }

        handleFileSelect(event) {
            const files = event.target.files;
            for (const file of files) {
                this.processImageFile(file);
            }
            this.fileInput.value = ''; // 清空 input 以便下次選擇同個檔案
        }
        
        // (3) 新增：將圖片處理邏輯提取為共用函式
        processImageFile(file) {
            if (!file || !file.type.startsWith('image/')) return;
            if (this.imageFiles.length >= 4) {
                alert('錯誤：最多只能上傳 4 張圖片。');
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                this.imageFiles.push({ base64: e.target.result.split(',')[1], mimeType: file.type });
                this.renderImagePreviews();
            };
            reader.readAsDataURL(file);
        }

        renderImagePreviews() {
            this.previewContainer.innerHTML = '';
            this.imageFiles.forEach((file, index) => {
                const item = document.createElement('div');
                item.className = 'preview-item';
                const img = document.createElement('img');
                img.src = `data:${file.mimeType};base64,${file.base64}`;
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-btn';
                removeBtn.innerHTML = '&times;';
                removeBtn.onclick = () => {
                    this.imageFiles.splice(index, 1);
                    this.renderImagePreviews();
                };
                item.appendChild(img);
                item.appendChild(removeBtn);
                this.previewContainer.appendChild(item);
            });
            this.previewContainer.classList.toggle('active', this.imageFiles.length > 0);
        }

        async sendMessage() {
            const promptText = this.promptInput.value.trim();
            if (!promptText && this.imageFiles.length === 0) return;

            this.displayMessage(promptText, 'user', this.imageFiles);

            const userParts = [];
            if (promptText) userParts.push({ text: promptText });
            this.imageFiles.forEach(file => {
                userParts.push({ inlineData: { mimeType: file.mimeType, data: file.base64 } });
            });
            
            this.history.push({ role: 'user', parts: userParts });
            
            this.promptInput.value = '';
            this.imageFiles = [];
            this.renderImagePreviews();
            this.setLoading(true);

            try {
                const responseText = await this.callApi();
                this.history.push({ role: 'model', parts: [{ text: responseText }] });
                this.displayMessage(responseText, 'ai');
            } catch (error) {
                this.displayMessage(`API 請求失敗: ${error.message}`, 'ai', [], true);
                this.history.pop(); // 如果API失敗，移除剛剛加入的使用者歷史紀錄
            } finally {
                this.setLoading(false);
                this.checkTurnLimit();
            }
        }

        async callApi() {
            if (!geminiApiKey) throw new Error("尚未設定 API 金鑰。");
            
            const apiUrl = this.modelName.startsWith('models/')
                ? `https://generativelanguage.googleapis.com/v1beta/${this.modelName}:generateContent?key=${geminiApiKey}`
                : `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${geminiApiKey}`;

            const payload = { contents: this.history };
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error?.message || `HTTP Error ${response.status}`);
            if (result.candidates?.[0]?.content?.parts?.[0]?.text) return result.candidates[0].content.parts[0].text;
            
            const blockReason = result.promptFeedback?.blockReason;
            if (blockReason) throw new Error(`請求被 AI 拒絕，原因: ${blockReason}`);
            
            const finishReason = result.candidates?.[0]?.finishReason;
            if(finishReason && finishReason !== 'STOP') throw new Error(`API 未返回有效內容，終止原因: ${finishReason}`);

            throw new Error('API 未返回有效內容，請檢查主控台以獲取詳細資訊。');
        }

        displayMessage(text, role, images = [], isError = false) {
            const msgDiv = document.createElement('div');
            msgDiv.className = `msg ${role}`;
            if (isError) msgDiv.style.color = '#c0392b';
            if (images.length > 0) {
                const container = document.createElement('div');
                container.className = 'image-container';
                images.forEach(imgInfo => {
                    const img = document.createElement('img');
                    img.src = `data:${imgInfo.mimeType};base64,${imgInfo.base64}`;
                    container.appendChild(img);
                });
                msgDiv.appendChild(container);
            }
            const textPre = document.createElement('pre');
            textPre.textContent = text;
            msgDiv.appendChild(textPre);
            this.chatWindow.appendChild(msgDiv);
            this.chatWindow.scrollTop = this.chatWindow.scrollHeight;
        }

        setLoading(isLoading) {
            this.sendBtn.disabled = isLoading;
            this.promptInput.disabled = isLoading;
            this.uploadBtn.disabled = isLoading;
            this.presetButtons.forEach(btn => btn.disabled = isLoading);
            this.sendBtn.textContent = isLoading ? '思考中...' : 'Send ▶️';
        }

        checkTurnLimit() {
            const isLimitReached = this.history.length >= MAX_ROUNDS;
            if (isLimitReached) {
                this.setLoading(true); // Disable all inputs
                alert(`提示：已達 ${MAX_ROUNDS} 回合對話上限。請重新整理頁面以開始新的對話。`);
            }
        }
    }

    // --- Main Initialization ---
    const init = async () => {
        try {
            const items = await chrome.storage.sync.get({ 
                geminiApiKey: '',
                translationModel: 'gemini-2.0-flash',
                preset_a: '', preset_b: '', preset_c: '', preset_d: '', preset_e: ''
            });
            
            if (!items.geminiApiKey) {
                alert('錯誤：尚未設定 Gemini API 金鑰。請在擴充功能選項中設定。');
                document.querySelectorAll('.submit-btn, .upload-btn, .preset-btn').forEach(btn => btn.disabled = true);
                return;
            }
            geminiApiKey = items.geminiApiKey;
            // (2) 將讀取到的提示語存到全域變數
            presetPrompts = {
                preset_a: items.preset_a, preset_b: items.preset_b,
                preset_c: items.preset_c, preset_d: items.preset_d,
                preset_e: items.preset_e
            };

            // Create chat instances for each tab
            new ChatInstance('default', items.translationModel);
            new ChatInstance('flash', 'gemini-2.5-flash');
            new ChatInstance('pro', 'gemini-2.5-pro');
            
            // Tab switching logic
            const tabs = document.querySelectorAll('.tab-link');
            const contents = document.querySelectorAll('.tab-content');
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.forEach(item => item.classList.remove('active'));
                    contents.forEach(item => item.classList.remove('active'));
                    tab.classList.add('active');
                    document.getElementById(tab.dataset.tab).classList.add('active');
                });
            });

        } catch (error) {
            console.error('Initialization failed:', error);
            alert('頁面初始化失敗。');
        }
    };

    init();
});
