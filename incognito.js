// incognito.js (v26.3 - 2.5 Flash Default & Presets A-G)
document.addEventListener('DOMContentLoaded', () => {
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
            this.attachedFiles = [];

            // DOM Elements
            this.chatWindow = document.getElementById(`chat-window-${modelId}`);
            this.promptInput = document.getElementById(`prompt-${modelId}`);
            this.sendBtn = document.getElementById(`send-btn-${modelId}`);
            
            // [New] Separate buttons and inputs
            this.uploadPdfBtn = document.getElementById(`upload-pdf-btn-${modelId}`);
            this.uploadImgBtn = document.getElementById(`upload-img-btn-${modelId}`);
            this.pdfFileInput = document.getElementById(`pdf-file-input-${modelId}`);
            this.imageFileInput = document.getElementById(`image-file-input-${modelId}`);

            this.previewContainer = document.getElementById(`image-preview-container-${modelId}`);
            this.presetButtons = document.querySelectorAll(`#preset-buttons-container-${modelId} .preset-btn`);

            this.attachEventListeners();
        }

        attachEventListeners() {
            this.sendBtn.addEventListener('click', () => this.sendMessage());
            this.promptInput.addEventListener('paste', (e) => this.handlePaste(e));
            
            // [New] Event listeners for separate buttons
            this.uploadPdfBtn.addEventListener('click', () => this.pdfFileInput.click());
            this.uploadImgBtn.addEventListener('click', () => this.imageFileInput.click());
            this.pdfFileInput.addEventListener('change', (e) => this.handleFileSelect(e, 'pdf'));
            this.imageFileInput.addEventListener('change', (e) => this.handleFileSelect(e, 'image'));

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
                    this.processImageFile(item.getAsFile());
                    return;
                }
            }
        }
        
        handleFileSelect(event, fileType) {
            const files = event.target.files;
            if (fileType === 'image') {
                for (const file of files) this.processImageFile(file);
            } else if (fileType === 'pdf') {
                if (files.length > 0) this.processPdfFile(files[0]);
            }
            event.target.value = ''; // Clear the input
        }
        
        processImageFile(file) {
            if (!file || !file.type.startsWith('image/')) return;
            if (this.attachedFiles.filter(f => f.type === 'image').length >= 4) {
                alert(chrome.i18n.getMessage("alertMaxImages"));
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                this.attachedFiles.push({
                    type: 'image',
                    base64: e.target.result.split(',')[1],
                    mimeType: file.type,
                    name: file.name
                });
                this.renderPreviews();
            };
            reader.readAsDataURL(file);
        }

        // [New] Base64 PDF processing method
        processPdfFile(file) {
            if (!file || file.type !== 'application/pdf') return;

            // Prevent multiple PDF uploads
            if (this.attachedFiles.some(f => f.type === 'pdf')) {
                alert("一次只能附加一個 PDF 檔案。"); // TODO: Add to i18n
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                this.attachedFiles.push({
                    type: 'pdf',
                    base64: e.target.result.split(',')[1],
                    mimeType: file.type,
                    name: file.name
                });
                this.renderPreviews();
            };
            reader.readAsDataURL(file);
        }

        renderPreviews() {
            this.previewContainer.innerHTML = '';
            this.attachedFiles.forEach((file, index) => {
                const item = document.createElement('div');
                let contentHTML = '';

                if (file.type === 'image') {
                    item.className = 'preview-item';
                    contentHTML = `<img src="data:${file.mimeType};base64,${file.base64}" />`;
                } else if (file.type === 'pdf') {
                    item.className = 'pdf-preview-item';
                    contentHTML = `<span>📄 ${file.name}</span>`;
                }

                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-btn';
                removeBtn.innerHTML = '&times;';
                removeBtn.onclick = () => {
                    this.attachedFiles.splice(index, 1);
                    this.renderPreviews();
                };
                
                item.innerHTML = contentHTML;
                item.appendChild(removeBtn);
                this.previewContainer.appendChild(item);
            });
            this.previewContainer.classList.toggle('active', this.attachedFiles.length > 0);
        }
        
        async sendMessage() {
            const promptText = this.promptInput.value.trim();
            if (!promptText && this.attachedFiles.length === 0) return;

            const imageFilesForDisplay = this.attachedFiles.filter(f => f.type === 'image');
            let displayText = promptText;
            const pdfFile = this.attachedFiles.find(f => f.type === 'pdf');
            if (pdfFile) {
                displayText += `\n(附加檔案: ${pdfFile.name})`;
            }
            this.displayMessage(displayText, 'user', imageFilesForDisplay);

            const userParts = [];
            if (promptText) {
                userParts.push({ text: promptText });
            }
            
            // [Modified] Create inlineData parts for all file types
            this.attachedFiles.forEach(file => {
                userParts.push({
                    inlineData: {
                        mimeType: file.mimeType,
                        data: file.base64
                    }
                });
            });
            
            this.history.push({ role: 'user', parts: userParts });
            
            this.promptInput.value = '';
            this.attachedFiles = [];
            this.renderPreviews();
            this.setLoading(true);
          
            try {
                const responseText = await this.callApi();
                this.history.push({ role: 'model', parts: [{ text: responseText }] });
                this.displayMessage(responseText, 'ai');
            } catch (error) {
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
            this.uploadPdfBtn.disabled = isLoading;
            this.uploadImgBtn.disabled = isLoading;
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
                // No translationModel needed here as tabs are hardcoded
                preset_a: '', preset_b: '', preset_c: '', preset_d: '', preset_e: '',
                preset_f: '', preset_g: '' // Added F, G
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
                preset_e: items.preset_e, preset_f: items.preset_f, preset_g: items.preset_g
            };

            // Initialize Flash (Default) and Pro instances
            // Removed 'default' instance
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