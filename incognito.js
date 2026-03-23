// incognito.js (v28.0.2 - rebrand to PrivoAI)
import { buildGeminiUrl } from './scripts/gemini-api.js';
import { localModelCall, getLocalModelConfig } from './scripts/local-api.js';
import { getEffectiveUILanguageCode, supportedLanguages } from './scripts/language_manager.js';

document.addEventListener('DOMContentLoaded', () => {
    document.title = chrome.i18n.getMessage('incognitoTitle');

    // --- Global State ---
    let geminiApiKey = null;
    let presetPrompts = {};
    const MAX_ROUNDS = 12;

    // --- Notification Banner ---
    const notificationBanner = document.getElementById('notification-banner');

    function showNotification(msg, isError = false) {
        if (!notificationBanner) return;
        notificationBanner.textContent = msg;
        notificationBanner.className = `notification-banner ${isError ? 'error' : 'info'}`;
        notificationBanner.classList.remove('hidden');
        if (!isError) {
            setTimeout(() => notificationBanner.classList.add('hidden'), 4000);
        }
    }

    // --- Chat Instance Manager (Gemini) ---
    class ChatInstance {
        constructor(modelId, modelName, responseLang) {
            this.modelId = modelId;
            this.modelName = modelName;
            this.responseLang = responseLang;
            this.history = [];
            this.attachedFiles = [];

            // DOM Elements
            this.chatWindow = document.getElementById(`chat-window-${modelId}`);
            this.promptInput = document.getElementById(`prompt-${modelId}`);
            this.sendBtn = document.getElementById(`send-btn-${modelId}`);

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
                showNotification(chrome.i18n.getMessage("alertMaxImages"), true);
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

        processPdfFile(file) {
            if (!file || file.type !== 'application/pdf') return;

            if (this.attachedFiles.some(f => f.type === 'pdf')) {
                showNotification(chrome.i18n.getMessage("alertOnePdfOnly"), true);
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
                displayText += `\n(${chrome.i18n.getMessage("incognitoAttachedFile", pdfFile.name)})`;
            }
            this.displayMessage(displayText, 'user', imageFilesForDisplay);

            const userParts = [];
            if (promptText) {
                userParts.push({ text: promptText });
            }

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

            const apiUrl = buildGeminiUrl(this.modelName, geminiApiKey);
            const payload = { contents: this.history.slice(-MAX_ROUNDS * 2) };
            if (this.responseLang) {
                payload.system_instruction = {
                    parts: [{ text: `Please respond in ${this.responseLang} unless the user explicitly asks you to use a different language.` }]
                };
            }

            // Thinking mode: add thinkingConfig if checkbox is checked for this tab
            const thinkingCheckbox = document.getElementById(`thinking-${this.modelId}`);
            if (thinkingCheckbox?.checked) {
                payload.generationConfig = {
                    thinkingConfig: { thinkingBudget: -1 }  // dynamic budget (model decides)
                };
            }

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error?.message || `HTTP Error ${response.status}`);

            // Extract text from response (thinking models may have multiple parts; find the text part)
            const parts = result.candidates?.[0]?.content?.parts;
            if (parts) {
                const textPart = parts.find(p => p.text !== undefined && !p.thought);
                if (textPart) return textPart.text;
            }

            const blockReason = result.promptFeedback?.blockReason;
            if (blockReason) throw new Error(chrome.i18n.getMessage("errorApiRejected", blockReason));

            const finishReason = result.candidates?.[0]?.finishReason;
            if (finishReason && finishReason !== 'STOP') throw new Error(chrome.i18n.getMessage("errorApiStopped", finishReason));

            throw new Error(chrome.i18n.getMessage("errorApiInvalidResponse"));
        }

        displayMessage(text, role, images = [], isError = false) {
            const msgDiv = document.createElement('div');
            msgDiv.className = `msg ${role}${isError ? ' error' : ''}`;
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

    // --- Local Model Chat Instance (OpenAI-compatible format) ---
    class LocalChatInstance {
        constructor(modelName, endpoint, responseLang) {
            this.modelName = modelName;
            this.endpoint = endpoint;
            this.responseLang = responseLang;
            this.history = []; // OpenAI format: [{role: 'user'/'assistant', content: '...'}]

            this.chatWindow = document.getElementById('chat-window-local');
            this.promptInput = document.getElementById('prompt-local');
            this.sendBtn = document.getElementById('send-btn-local');
            this.presetButtons = document.querySelectorAll('#preset-buttons-container-local .preset-btn');

            this.attachEventListeners();
        }

        attachEventListeners() {
            this.sendBtn.addEventListener('click', () => this.sendMessage());
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

        async sendMessage() {
            const promptText = this.promptInput.value.trim();
            if (!promptText) return;

            this.displayMessage(promptText, 'user');
            this.history.push({ role: 'user', content: promptText });

            this.promptInput.value = '';
            this.setLoading(true);

            try {
                const messages = this.history.slice(-MAX_ROUNDS * 2);
                if (this.responseLang) {
                    messages.unshift({ role: 'system', content: `Please respond in ${this.responseLang} unless the user explicitly asks you to use a different language.` });
                }
                const responseText = await localModelCall(
                    this.endpoint, this.modelName,
                    messages
                );
                this.history.push({ role: 'assistant', content: responseText });
                this.displayMessage(responseText, 'ai');
            } catch (error) {
                this.displayMessage(error.message, 'ai', true);
                this.history.pop();
            } finally {
                this.setLoading(false);
            }
        }

        displayMessage(text, role, isError = false) {
            const msgDiv = document.createElement('div');
            msgDiv.className = `msg ${role}${isError ? ' error' : ''}`;
            const textPre = document.createElement('pre');
            textPre.textContent = text;
            msgDiv.appendChild(textPre);
            this.chatWindow.appendChild(msgDiv);
            this.chatWindow.scrollTop = this.chatWindow.scrollHeight;
        }

        setLoading(isLoading) {
            this.sendBtn.disabled = isLoading;
            this.promptInput.disabled = isLoading;
            this.presetButtons.forEach(btn => btn.disabled = isLoading);
            this.sendBtn.textContent = isLoading ? chrome.i18n.getMessage("stateThinking") : chrome.i18n.getMessage("incognitoSendButton");
        }
    }

    // --- Tab Logic ---
    function initTabs() {
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
    }

    // --- Main Initialization ---
    const init = async () => {
        try {
            const items = await chrome.storage.sync.get({
                geminiApiKey: '',
                preset_a: '', preset_b: '', preset_c: '', preset_d: '', preset_e: '',
                preset_f: '', preset_g: ''
            });

            // Preset prompts are shared across all tabs (Gemini and local)
            presetPrompts = {
                preset_a: items.preset_a, preset_b: items.preset_b,
                preset_c: items.preset_c, preset_d: items.preset_d,
                preset_e: items.preset_e, preset_f: items.preset_f, preset_g: items.preset_g
            };

            // Update preset button tooltips with actual preset content (if set)
            document.querySelectorAll('.preset-btn').forEach(button => {
                const content = presetPrompts[`preset_${button.dataset.preset.toLowerCase()}`];
                if (content) {
                    const tip = content.length > 100 ? content.substring(0, 100) + '…' : content;
                    button.setAttribute('data-tooltip', tip);
                }
            });

            // Resolve the user's preferred response language (settings → browser UI lang → English)
            const langCode = await getEffectiveUILanguageCode();
            const responseLang = supportedLanguages.find(l => l.code === langCode)?.name || 'English';

            if (!items.geminiApiKey) {
                showNotification(chrome.i18n.getMessage("alertNoApiKeyOptions"), true);
                // Disable Gemini tabs only (upload + submit buttons in lite/flash/pro tabs)
                document.querySelectorAll('#lite .submit-btn, #lite .upload-btn, #flash .submit-btn, #flash .upload-btn, #pro .submit-btn, #pro .upload-btn').forEach(btn => btn.disabled = true);
            } else {
                geminiApiKey = items.geminiApiKey;
                new ChatInstance('lite',  'gemini-3.1-flash-lite-preview', responseLang);
                new ChatInstance('flash', 'gemini-2.5-flash',               responseLang);
                new ChatInstance('pro',   'gemini-3.1-pro-preview',          responseLang);
            }

            // Initialize local model tab (independent of Gemini API key)
            const localConfig = await getLocalModelConfig();

            // Show info banner in Lite/Flash/Pro tabs when Local Only mode is active
            if (localConfig.aiMode === 'local') {
                const bannerMsg = chrome.i18n.getMessage('incognitoLocalModeBanner');
                ['lite', 'flash', 'pro'].forEach(tabId => {
                    const banner = document.getElementById(`local-mode-banner-${tabId}`);
                    if (banner) { banner.textContent = bannerMsg; banner.classList.remove('hidden'); }
                });
            }

            if (localConfig.localModelEnabled && localConfig.localModelEndpoint && localConfig.localModelName) {
                new LocalChatInstance(localConfig.localModelName, localConfig.localModelEndpoint, responseLang);
            } else {
                const banner = document.getElementById('local-disabled-banner');
                if (banner) {
                    banner.textContent = chrome.i18n.getMessage('localModelNotEnabledMsg');
                    banner.classList.remove('hidden');
                }
                document.getElementById('send-btn-local').disabled = true;
                document.getElementById('prompt-local').disabled = true;
                document.querySelectorAll('#preset-buttons-container-local .preset-btn').forEach(b => b.disabled = true);
            }

            initTabs();

        } catch (error) {
            console.error('Initialization failed:', error);
            showNotification(chrome.i18n.getMessage("alertInitFailed"), true);
        }
    };

    init();
});
