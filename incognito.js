document.addEventListener('DOMContentLoaded', () => {
    // --- Global State ---
    let geminiApiKey = null;
    const MAX_ROUNDS = 6; // 3 user turns + 3 AI turns

    // --- Chat Instance Manager ---
    // Manages the state and DOM elements for a single chat tab
    class ChatInstance {
        constructor(modelId, modelName) {
            this.modelId = modelId; // e.g., 'default', 'flash', 'pro'
            this.modelName = modelName; // e.g., 'gemini-2.0-flash', 'gemini-2.5-pro'
            this.history = [];
            this.imageFiles = [];

            // DOM Elements
            this.chatWindow = document.getElementById(`chat-window-${modelId}`);
            this.promptInput = document.getElementById(`prompt-${modelId}`);
            this.sendBtn = document.getElementById(`send-btn-${modelId}`);
            this.uploadBtn = document.getElementById(`upload-btn-${modelId}`);
            this.fileInput = document.getElementById(`file-input-${modelId}`);
            this.previewContainer = document.getElementById(`image-preview-container-${modelId}`);

            this.attachEventListeners();
        }

        attachEventListeners() {
            this.sendBtn.addEventListener('click', () => this.sendMessage());
            this.uploadBtn.addEventListener('click', () => this.fileInput.click());
            this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        handleFileSelect(event) {
            const files = event.target.files;
            if (this.imageFiles.length + files.length > 4) {
                alert('錯誤：最多只能上傳 4 張圖片。');
                return;
            }
            for (const file of files) {
                if (!file.type.startsWith('image/')) continue;
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.imageFiles.push({ base64: e.target.result.split(',')[1], mimeType: file.type });
                    this.renderImagePreviews();
                };
                reader.readAsDataURL(file);
            }
            this.fileInput.value = '';
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
                this.displayMessage(responseText, 'ai');
                this.history.push({ role: 'model', parts: [{ text: responseText }] });
            } catch (error) {
                this.displayMessage(`API 請求失敗: ${error.message}`, 'ai', [], true);
                this.history.pop();
            } finally {
                this.setLoading(false);
                this.checkTurnLimit();
            }
        }

        async callApi() {
            if (!geminiApiKey) throw new Error("尚未設定 API 金鑰。");
            
            // FIX: Handle model names that might already contain the "models/" prefix.
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
            throw new Error(`API 未返回有效內容，原因: ${result.promptFeedback?.blockReason || '未知'}`);
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
            this.sendBtn.textContent = isLoading ? '思考中...' : 'Send ▶️';
        }

        checkTurnLimit() {
            const isLimitReached = this.history.length >= MAX_ROUNDS;
            this.sendBtn.disabled = isLimitReached;
            this.promptInput.disabled = isLimitReached;
            this.uploadBtn.disabled = isLimitReached;
            if (isLimitReached) {
                alert(`提示：已達 ${MAX_ROUNDS} 回合對話上限。請重新整理頁面以開始新的對話。`);
            }
        }
    }

    // --- Main Initialization ---
    const init = async () => {
        try {
            const items = await chrome.storage.sync.get({ 
                geminiApiKey: '',
                translationModel: 'gemini-2.0-flash' // Default model for translation
            });
            
            if (!items.geminiApiKey) {
                alert('錯誤：尚未設定 Gemini API 金鑰。請在擴充功能選項中設定。');
                document.querySelectorAll('.submit-btn, .upload-btn').forEach(btn => btn.disabled = true);
                return;
            }
            geminiApiKey = items.geminiApiKey;

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
