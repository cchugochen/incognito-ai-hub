/**
 * background.js (v26.3 - 2.5 Flash Default & Cleanup)
 */

const protocolVersion = "1.3";
let attachedTabs = {};

// --- Language Logic (for Service Worker context) ---
// Removed Arabic (ar) and Hindi (hi)
const supportedLanguagesForBg = [
    { code: 'en', name: 'English' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' }, { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' }, { code: 'tr', name: 'Turkish' },
    { code: 'uk', name: 'Ukrainian' }, { code: 'vi', name: 'Vietnamese' },
    { code: 'zh-TW', name: 'Traditional Chinese' }
];

async function getEffectiveUILanguageNameForBg() {
    try {
        const { displayLanguage } = await chrome.storage.sync.get({ displayLanguage: 'default' });
        if (displayLanguage && displayLanguage !== 'default') {
            const lang = supportedLanguagesForBg.find(l => l.code === displayLanguage);
            return lang ? lang.name : 'English';
        }
        const uiLang = chrome.i18n.getUILanguage();
        if (uiLang.toLowerCase().startsWith('zh')) {
            return 'Traditional Chinese';
        }
        const langCode = uiLang.split('-')[0];
        const found = supportedLanguagesForBg.find(l => l.code === langCode);
        return found ? found.name : 'English';
    } catch (error) {
        console.error("Error getting effective UI language name:", error);
        return 'English';
    }
}


// --- Main Message Router ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const handler = {
        'PROCESS_WEBPAGE': async () => {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs && tabs.length > 0 && tabs[0].id) {
                await captureAndRecognize(tabs[0].id);
            } else {
                throw new Error(chrome.i18n.getMessage("errorNoActiveTab"));
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
                console.error(`[Incognito AI Hub] Error processing '${request.type}':`, error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true; // Indicates that the response is sent asynchronously.
    }
});

// --- Core Processing Functions ---
async function processPastedText(payload) {
    let { text, targetLang } = payload;
    if (!text || typeof text !== 'string' || text.trim() === '') {
        throw new Error(chrome.i18n.getMessage("errorInvalidText"));
    }
    if (targetLang === 'system-default') {
        targetLang = await getEffectiveUILanguageNameForBg();
    }
    await logActivity({ type: 'paste', sourceUrl: 'pasted_text', originalText: text });
    await openReader({ text: text, targetLang: targetLang, sourceType: 'text' });
}

async function processUploadedFile(payload) {
    let { imageData, sourceLang, targetLang } = payload;
    if (!imageData) throw new Error(chrome.i18n.getMessage("errorNoImageData"));
    if (targetLang === 'system-default') {
        targetLang = await getEffectiveUILanguageNameForBg();
    }
    
    const recognizedText = await callGeminiVision(imageData, sourceLang);
    if (!recognizedText || recognizedText.trim().length < 10) {
        throw new Error(chrome.i18n.getMessage("errorOcrFailed"));
    }
    await logActivity({ type: 'upload_ocr', sourceUrl: 'uploaded_file', originalText: recognizedText });
    await openReader({ text: recognizedText, targetLang: targetLang, sourceType: 'image' });
}

async function processVoiceNote(payload) {
    let { audioData, spokenLang } = payload;
    if (!audioData || !audioData.data) throw new Error(chrome.i18n.getMessage("errorNoAudioData"));

    if (spokenLang === 'system-default') {
        spokenLang = await getEffectiveUILanguageNameForBg();
    }

    const transcribedText = await callGeminiSpeechToText(audioData, spokenLang);
    if (!transcribedText || transcribedText.trim().length === 0) {
        throw new Error(chrome.i18n.getMessage("errorSttFailed"));
    }
    await logActivity({ type: 'voice_note', sourceUrl: 'voice_input', originalText: transcribedText });
    
    const defaultTargetLang = await getEffectiveUILanguageNameForBg();
    await openReader({ text: transcribedText, targetLang: defaultTargetLang, sourceType: 'voice' });
}

async function captureAndRecognize(tabId) {
    if (!tabId) {
        throw new Error("Invalid tab ID.");
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
            throw new Error(chrome.i18n.getMessage("errorDebuggerAttach"));
        }
    }

    try {
        await setActionBadge(tabId, 'OCR', '#FFA500');
        const screenshot = await sendDebuggerCommand(tabId, "Page.captureScreenshot", { format: "jpeg", quality: 90, captureBeyondViewport: true });
        
        if (!screenshot || !screenshot.data) {
            throw new Error(chrome.i18n.getMessage("errorScreenshotFailed"));
        }

        await setActionBadge(tabId, 'AI', '#17A2B8');
        const recognizedText = await callGeminiVision(screenshot.data);

        if (recognizedText && recognizedText.trim().length > 50) {
            const tab = await chrome.tabs.get(tabId);
            await logActivity({ type: 'webpage_ocr', sourceUrl: tab.url, originalText: recognizedText });
            const defaultTargetLang = await getEffectiveUILanguageNameForBg();
            await openReader({ text: recognizedText, targetLang: defaultTargetLang, sourceType: 'webpage' });
            await setActionBadge(tabId, 'OK', '#28A745');
        } else {
            throw new Error(chrome.i18n.getMessage("errorOcrFailedLong"));
        }
    } catch (e) {
        await setActionBadge(tabId, 'ERR', '#DC3545');
        throw e;
    }
}

// --- Helper and API Call Functions ---

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
    const { geminiApiKey, translationModel } = await chrome.storage.sync.get({ 
        geminiApiKey: '', 
        translationModel: 'gemini-2.5-flash' // UPDATED DEFAULT to 2.5 Flash
    });
    if (!geminiApiKey) throw new Error(chrome.i18n.getMessage("errorNoApiKey"));

    const model = translationModel;
    const apiUrl = model.startsWith('models/') ?
        `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${geminiApiKey}` :
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
    
    let langHint = (sourceLang !== 'auto' && sourceLang) ? `The text in the image is primarily in ${sourceLang}.` : "";
    
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
    const { geminiApiKey, translationModel } = await chrome.storage.sync.get({ 
        geminiApiKey: '', 
        translationModel: 'gemini-2.5-flash' // UPDATED DEFAULT to 2.5 Flash
    });
    if (!geminiApiKey) throw new Error(chrome.i18n.getMessage("errorNoApiKey"));

    const model = translationModel;
    const apiUrl = model.startsWith('models/') ?
        `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${geminiApiKey}` :
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
    
    let langHint = `The user's primary spoken language is ${spokenLang}.`;
    if (spokenLang === 'auto' || !spokenLang) {
        langHint = "Please transcribe the audio, automatically detecting the language spoken.";
    }
    
    const prompt = `You are a highly accurate transcription service. Transcribe the following audio. ${langHint} Provide a clean and accurate transcript. If you are unsure about a specific word or phrase, transcribe it as best you can and put it inside parentheses. Do not add any other comments.`;
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
            throw new Error(chrome.i18n.getMessage("errorApiRequestFailed", errorDetails));
        }

        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content?.parts?.[0]?.text) {
            return result.candidates[0].content.parts[0].text;
        } else {
            if (result.promptFeedback?.blockReason) {
                throw new Error(chrome.i18n.getMessage("errorApiRejected", result.promptFeedback.blockReason));
            }
            const finishReason = result.candidates?.[0]?.finishReason;
            if (finishReason && finishReason !== 'STOP') {
                 throw new Error(chrome.i18n.getMessage("errorApiStopped", finishReason));
            }
            console.error("Invalid API response structure:", result);
            throw new Error(chrome.i18n.getMessage("errorApiInvalidResponse"));
        }
    } catch (error) {
        if (error instanceof TypeError) {
             throw new Error(chrome.i18n.getMessage("errorNetwork"));
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
    const { logEndpoint, logKey } = await chrome.storage.sync.get({ logEndpoint: '', logKey: '' });
    if (!logEndpoint) return;
    try {
        await fetch(logEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': logKey || '' },
            body: JSON.stringify({ timestamp: new Date().toISOString(), ...data })
        });
    } catch (error) {
        console.error('Failed to send log:', error);
    }
}