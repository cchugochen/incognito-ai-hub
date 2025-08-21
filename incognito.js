// incognito.js (v25.2 - Bug Fix)
// - Fixed a syntax error that made control buttons unresponsive.
// - Increased MAX_ROUNDS to 12.
document.addEventListener('DOMContentLoaded', () => {
    // Set document title dynamically
    document.title = chrome.i18n.getMessage('incognitoTitle');

    // --- Global State ---
    let geminiApiKey = null;
    let presetPrompts = {};
    const MAX_ROUNDS = 12; 

    // --- Chat Instance Manager ---
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
            // [v25.2 Fix] Corrected syntax error by adding a semicolon.
            this.sendBtn.addEventListener('click', () => this.sendMessage());
            this.uploadBtn.addEventListener('click', () => this.fileInput.click());
            this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
            this.promptInput.addEventListener('paste', (e) => this.handlePaste(e));

            this.presetButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const presetKey = `preset_${button.dataset.preset.toLowerCase()}`;
                    const textToInsert = presetPrompts[presetKey];
                    if (textToInsert) {
                        const start = this.promptInput.selectionStart;
                        const end = this.promptInput.selectionEnd;
                        const originalText = this.promptInput.value;
                        this.promptInput.value = originalText.substring(0, start) + textToInsert + originalText.substring(end);
                        this.promptInput.focus();
                        this.promptInput.selectionStart = this.promptInput.selectionEnd = start + textToInsert.length;
                    }
                });
            });
        }
        
        handlePaste(event) {
            const items = (event.clipboardData || event.originalEvent.clipboardData).items;
            for (const item of items) {
                if (item.kind === 'file' && item.type.startsWith('image/')) {
                    event.preventDefault();
                    const file = item.getAsFile();
                    this.processImageFile(file);
                    return;
                }
            }
        }

        handleFileSelect(event) {
            const files = event.target.files;
            for (const file of files) {
                this.processImageFile(file);
            }
            this.fileInput.value = '';
        }
        
        processImageFile(file) {
            if (!file || !file.type.startsWith('image/')) return;
            if (this.imageFiles.length >= 4) {
                alert(chrome.i18n.getMessage("alertMaxImages"));
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
                // 修正：直接顯示從 callApi() 傳來的、已經過 i18n 處理的錯誤訊息
                this.displayMessage(error.message, 'ai', [], true);
                this.history.pop();
            } finally {
                this.setLoading(false);
                this.checkTurnLimit();
            }
        }

        async callApi() {
            if (!geminiApiKey) throw new Error(chrome.i18n.getMessage("errorNoApiKey"));
            
            const apiUrl = this.modelName.startsWith('models/')
                ? `https://generativelanguage.googleapis.com/v1beta/${this.modelName}:generateContent?key=${geminiApiKey}`
                : `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${geminiApiKey}`;

            const payload = { contents: this.history.slice(-MAX_ROUNDS * 2) };
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error?.message || `HTTP Error ${response.status}`);
            if (result.candidates?.[0]?.content?.parts?.[0]?.text) return result.candidates[0].content.parts[0].text;
            
            const blockReason = result.promptFeedback?.blockReason;
            if (blockReason) throw new Error(chrome.i18n.getMessage("errorApiRejected", blockReason));
            
            const finishReason = result.candidates?.[0]?.finishReason;
            if(finishReason && finishReason !== 'STOP') throw new Error(chrome.i18n.getMessage("errorApiStopped", finishReason));

            throw new Error(chrome.i18n.getMessage("errorApiInvalidResponse"));
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
            this.sendBtn.textContent = isLoading ? chrome.i18n.getMessage("stateThinking") : chrome.i18n.getMessage("incognitoSendButton");
        }

        checkTurnLimit() {
            const userMessages = this.history.filter(m => m.role === 'user').length;
            if (userMessages >= MAX_ROUNDS) {
                this.setLoading(true);
                this.displayMessage(chrome.i18n.getMessage("alertTurnLimit", String(MAX_ROUNDS)), 'ai');
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
                alert(chrome.i18n.getMessage("alertNoApiKeyOptions"));
                document.querySelectorAll('.submit-btn, .upload-btn, .preset-btn').forEach(btn => btn.disabled = true);
                return;
            }
            geminiApiKey = items.geminiApiKey;
            presetPrompts = {
                preset_a: items.preset_a, preset_b: items.preset_b,
                preset_c: items.preset_c, preset_d: items.preset_d,
                preset_e: items.preset_e
            };

            new ChatInstance('default', items.translationModel);
            new ChatInstance('flash', 'gemini-2.5-flash');
            new ChatInstance('pro', 'gemini-2.5-pro');
            
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
            alert(chrome.i18n.getMessage("alertInitFailed"));
        }
    };

    init();
});
