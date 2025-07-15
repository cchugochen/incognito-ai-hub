document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const chatWindow = document.getElementById('chat-window');
    const promptInput = document.getElementById('prompt');
    const sendBtn = document.getElementById('send-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('file-input');
    const imagePreviewContainer = document.getElementById('image-preview-container');

    // --- State Management (In-Memory) ---
    let geminiApiKey = null;
    let conversationHistory = [];
    let imageFiles = []; // Stores { base64: '...', mimeType: '...' }
    const MAX_ROUNDS = 6; // 3 user turns + 3 AI turns

    // --- Core Functions (Declared before use) ---

    const handleFileSelect = (event) => {
        const files = event.target.files || event.dataTransfer.files;
        if (!files) return;

        if (imageFiles.length + files.length > 4) {
            alert('錯誤：最多只能上傳 4 張圖片。');
            return;
        }

        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;
            const reader = new FileReader();
            reader.onload = (e) => {
                imageFiles.push({
                    base64: e.target.result.split(',')[1],
                    mimeType: file.type,
                });
                renderImagePreviews();
            };
            reader.readAsDataURL(file);
        }
        fileInput.value = ''; // Reset to allow re-selecting same file
    };

    const renderImagePreviews = () => {
        imagePreviewContainer.innerHTML = '';
        imageFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'preview-item';
            const img = document.createElement('img');
            img.src = `data:${file.mimeType};base64,${file.base64}`;
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = () => {
                imageFiles.splice(index, 1);
                renderImagePreviews();
            };
            item.appendChild(img);
            item.appendChild(removeBtn);
            imagePreviewContainer.appendChild(item);
        });

        // Toggle .active class based on whether there are images
        if (imageFiles.length > 0) {
            imagePreviewContainer.classList.add('active');
        } else {
            imagePreviewContainer.classList.remove('active');
        }
    };

    const handleSendMessage = async () => {
        const promptText = promptInput.value.trim();
        if (!promptText && imageFiles.length === 0) return;

        displayMessage(promptText, 'user', imageFiles);

        const userParts = [];
        if (promptText) {
            userParts.push({ text: promptText });
        }
        imageFiles.forEach(file => {
            userParts.push({ inlineData: { mimeType: file.mimeType, data: file.base64 } });
        });
        
        conversationHistory.push({ role: 'user', parts: userParts });
        
        promptInput.value = '';
        imageFiles = [];
        renderImagePreviews();
        setLoading(true);

        try {
            const responseText = await callGeminiApi();
            displayMessage(responseText, 'ai');
            conversationHistory.push({ role: 'model', parts: [{ text: responseText }] });
        } catch (error) {
            displayMessage(`API 請求失敗: ${error.message}`, 'ai', [], true);
            conversationHistory.pop();
        } finally {
            setLoading(false);
            checkTurnLimit();
        }
    };

    const callGeminiApi = async () => {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`;
        const payload = { contents: conversationHistory };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error?.message || `HTTP Error ${response.status}`);
        }
        if (result.candidates && result.candidates[0].content?.parts?.[0]?.text) {
            return result.candidates[0].content.parts[0].text;
        }
        throw new Error(`API 未返回有效內容，原因: ${result.promptFeedback?.blockReason || '未知'}`);
    };

    // --- UI Helpers ---
    const displayMessage = (text, role, images = [], isError = false) => {
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

        chatWindow.appendChild(msgDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    };

    const setLoading = (isLoading) => {
        sendBtn.disabled = isLoading;
        promptInput.disabled = isLoading;
        uploadBtn.disabled = isLoading;
        if (isLoading) {
            sendBtn.textContent = '思考中...';
        } else {
            sendBtn.textContent = 'Send▶️';
        }
    };
    
    const checkTurnLimit = () => {
        if (conversationHistory.length >= MAX_ROUNDS) {
            sendBtn.disabled = true;
            promptInput.disabled = true;
            uploadBtn.disabled = true;
            alert('提示：已達 6 回合對話上限。請重新整理頁面以開始新的對話。');
        } else {
            sendBtn.disabled = false;
            promptInput.disabled = false;
            uploadBtn.disabled = false;
        }
    };

    // --- Initialization ---
    const init = async () => {
        try {
            const items = await chrome.storage.sync.get({ geminiApiKey: '' });
            if (items.geminiApiKey) {
                geminiApiKey = items.geminiApiKey;
            } else {
                alert('錯誤：尚未設定 Gemini API 金鑰。請在擴充功能選項中設定。');
                sendBtn.disabled = true;
                uploadBtn.disabled = true;
            }
        } catch (error) {
            console.error('Failed to get API key:', error);
            alert('讀取 API 金鑰時發生錯誤。');
        }
    };

    // --- Event Listeners ---
    sendBtn.addEventListener('click', handleSendMessage);
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);

    const dropArea = document.body;
    dropArea.addEventListener('dragover', (e) => e.preventDefault());
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        handleFileSelect(e);
    });

    // --- Start the app ---
    init();
});
