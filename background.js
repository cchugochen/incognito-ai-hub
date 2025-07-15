/**
 * Copyright (c) 2025 Dr. Cheng-Che Chen (陳正哲). All Rights Reserved.
 *
 * 無痕風颱工作台 (Hong-Thai Incognito Reader) v23.3 (Stable)
 * Developed in collaboration with Gemini.
 * - Corrected the Content Security Policy in manifest.json to allow tutorial styles.
 * - OCR prompt remains tuned for complex academic layouts.
 */

const protocolVersion = "1.3";
let attachedTabs = {};

// --- 主訊息路由器 ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const handler = {
        'PROCESS_WEBPAGE': async () => {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs && tabs.length > 0 && tabs[0].id) {
                await captureAndRecognize(tabs[0].id);
            } else {
                throw new Error("無法找到當前活動的分頁。");
            }
        },
        'PROCESS_UPLOADED_FILE': () => processUploadedFile(request.payload),
        'PROCESS_PASTED_TEXT': () => processPastedText(request.payload),
        'PROCESS_VOICE_NOTE': () => processVoiceNote(request.payload),
    }[request.type];

    if (handler) {
        (async () => {
            try {
                await handler();
                sendResponse({ success: true });
            } catch (error) {
                console.error(`[HongThai Reader] Error processing '${request.type}':`, error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
});

// --- 核心處理函數 ---
async function processPastedText(payload) {
    const { text, targetLang } = payload;
    if (!text || typeof text !== 'string' || text.trim() === '') throw new Error("無效或空白的文字內容。");
    await logActivity({ type: 'paste', sourceUrl: 'pasted_text', originalText: text });
    await openReader({ text: text, targetLang: targetLang, sourceType: 'text' });
}

async function processUploadedFile(payload) {
    const { imageData, sourceLang, targetLang } = payload;
    if (!imageData) throw new Error("未提供圖片資料。");
    const recognizedText = await callGeminiVision(imageData, sourceLang);
    if (!recognizedText || recognizedText.trim().length < 10) {
        throw new Error("AI 未能辨識出足夠的文字。");
    }
    await logActivity({ type: 'upload_ocr', sourceUrl: 'uploaded_file', originalText: recognizedText });
    await openReader({ text: recognizedText, targetLang: targetLang, sourceType: 'image' });
}

async function processVoiceNote(payload) {
    const { audioData, spokenLang } = payload;
    if (!audioData || !audioData.data) throw new Error("未提供音訊資料。");
    const transcribedText = await callGeminiSpeechToText(audioData, spokenLang);
    if (!transcribedText || transcribedText.trim().length === 0) {
        throw new Error("AI 未能辨識出任何語音。");
    }
    await logActivity({ type: 'voice_note', sourceUrl: 'voice_input', originalText: transcribedText });
    await openReader({ text: transcribedText, targetLang: 'English', sourceType: 'voice' });
}

async function captureAndRecognize(tabId) {
    if (!tabId) {
        throw new Error("無效的分頁 ID。");
    }
    
    await setActionBadge(tabId, '...', '#007BFF');

    if (!attachedTabs[tabId]) {
        try {
            await new Promise((resolve, reject) => {
                chrome.debugger.attach({ tabId }, protocolVersion, () => {
                    if (chrome.runtime.lastError) {
                        return reject(new Error(chrome.runtime.lastError.message));
                    }
                    attachedTabs[tabId] = true;
                    chrome.debugger.onDetach.addListener((source, detachedTabId) => {
                        if (source.tabId === tabId) delete attachedTabs[tabId];
                    });
                    resolve();
                });
            });
        } catch (e) {
            await setActionBadge(tabId, 'ERR', '#DC3545');
            throw new Error(`無法附加偵錯器。請重新載入頁面或檢查是否有其他擴充功能衝突。`);
        }
    }

    try {
        await setActionBadge(tabId, 'OCR', '#FFA500');
        const screenshot = await sendDebuggerCommand(tabId, "Page.captureScreenshot", { format: "jpeg", quality: 90, captureBeyondViewport: true });
        
        if (!screenshot || !screenshot.data) {
            throw new Error("擷取螢幕畫面失敗。");
        }

        await setActionBadge(tabId, 'AI', '#17A2B8');
        const recognizedText = await callGeminiVision(screenshot.data);

        if (recognizedText && recognizedText.trim().length > 50) {
            const tab = await chrome.tabs.get(tabId);
            await logActivity({ type: 'webpage_ocr', sourceUrl: tab.url, originalText: recognizedText });
            await openReader({ text: recognizedText, targetLang: 'Traditional Chinese', sourceType: 'webpage' });
            await setActionBadge(tabId, 'OK', '#28A745');
        } else {
            throw new Error("AI 未能辨識出足夠的文字內容。");
        }
    } catch (e) {
        await setActionBadge(tabId, 'ERR', '#DC3545');
        throw e;
    }
}

// --- 輔助與 API 呼叫函數 ---

async function openReader(payload) {
    const { text, targetLang, sourceType } = payload;
    await chrome.storage.local.set({ 
        articleText: text.trim(),
        targetLang: targetLang || 'Traditional Chinese',
        sourceType: sourceType || 'webpage'
    });
    const readerUrl = chrome.runtime.getURL('reader.html');
    await chrome.tabs.create({ url: readerUrl });
}

async function callGeminiVision(base64ImageData, sourceLang = 'auto') {
    const items = await chrome.storage.sync.get({ geminiApiKey: '', translationModel: 'gemini-2.0-flash' });
    if (!items.geminiApiKey) throw new Error("尚未設定 API 金鑰。");

    const model = items.translationModel;
    const apiUrl = model.startsWith('models/') ?
        `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${items.geminiApiKey}` :
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${items.geminiApiKey}`;
    
    let langHint = (sourceLang !== 'auto') ? `The text in the image is primarily in ${sourceLang}.` : "";
    
    const prompt = `You are a highly specialized AI assistant for document analysis. Your primary task is to perform OCR on the provided image and reconstruct the text into a clean, readable format. Please analyze the layout carefully. ${langHint}

Here are the key guidelines for your output:
1.  **Reconstruct Semantic Paragraphs:** Your main priority is to create paragraphs that are grammatically and semantically coherent. Combine lines that belong together into a single paragraph. Start a new paragraph only when there's a clear semantic break, such as an indentation or significant vertical space.
2.  **Analyze Layout:** For multi-column layouts, it is crucial to process the text of the first column completely from top to bottom before moving to the next column.
3.  **Join Hyphenated Words:** Please correctly join words that are hyphenated across lines (e.g., 'experi-' and 'ment' should become 'experiment').
4.  **Exclude Extraneous Elements:** Please ignore page headers, footers, and page numbers.
5.  **Final Output Format:** The final output should consist of ONLY the reconstructed text, formatted into clean paragraphs. Do not add any of your own comments, summaries, or explanations.`;

    const payload = { "contents": [{ "parts": [ { "text": prompt }, { "inline_data": { "mime_type": "image/jpeg", "data": base64ImageData } } ] }] };
    
    return geminiApiCall(apiUrl, payload);
}

async function callGeminiSpeechToText(audioData, spokenLang) {
    const items = await chrome.storage.sync.get({ geminiApiKey: '', translationModel: 'gemini-2.0-flash' });
    if (!items.geminiApiKey) throw new Error("尚未設定 API 金鑰。");

    const model = items.translationModel;
    const apiUrl = model.startsWith('models/') ?
        `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${items.geminiApiKey}` :
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${items.geminiApiKey}`;
    
    const prompt = `You are a highly accurate transcription service. Transcribe the following audio. The user's primary spoken language is ${spokenLang}. Provide a clean and accurate transcript. If you are unsure about a specific word or phrase, transcribe it as best you can and put it inside parentheses. Do not add any other comments.`;
    const payload = { "contents": [{ "parts": [ { "text": prompt }, { "inline_data": { "mime_type": audioData.mimeType, "data": audioData.data } } ] }] };

    return geminiApiCall(apiUrl, payload);
}

async function geminiApiCall(apiUrl, payload) {
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (!response.ok) {
            const errorDetails = result.error?.message || JSON.stringify(result);
            throw new Error(`API 請求失敗: ${errorDetails}`);
        }

        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content?.parts?.[0]?.text) {
            return result.candidates[0].content.parts[0].text;
        } else {
            if (result.promptFeedback?.blockReason) {
                throw new Error(`請求被 AI 拒絕，原因: ${result.promptFeedback.blockReason}`);
            }
            const finishReason = result.candidates?.[0]?.finishReason;
            if (finishReason && finishReason !== 'STOP') {
                 throw new Error(`AI 處理提前終止，原因: ${finishReason}`);
            }
            console.error("Invalid API response structure:", result);
            throw new Error("API 回應格式不正確或為空。");
        }
    } catch (error) {
        if (error instanceof TypeError) {
             throw new Error("網路錯誤，無法連接至 Gemini API。");
        }
        throw error;
    }
}

async function sendDebuggerCommand(tabId, method, params = {}) {
    return new Promise((resolve, reject) => {
        chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
            if (chrome.runtime.lastError) {
                return reject(new Error(chrome.runtime.lastError.message));
            }
            resolve(result);
        });
    });
}

async function setActionBadge(tabId, text, color) {
    try {
        await chrome.action.setBadgeText({ tabId, text });
        await chrome.action.setBadgeBackgroundColor({ tabId, color });
        if (text) {
            setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }), 5000);
        }
    } catch (e) { /* ignore */ }
}

async function logActivity(data) {
    const items = await chrome.storage.sync.get({ logEndpoint: '', logKey: '' });
    if (!items.logEndpoint) return;
    try {
        await fetch(items.logEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': items.logKey || '' },
            body: JSON.stringify({ timestamp: new Date().toISOString(), ...data })
        });
    } catch (error) {
        console.error('發送日誌失敗:', error);
    }
}
