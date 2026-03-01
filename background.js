/**
 * background.js (v27.2.3 - 3-mode AI service, local-mode guards for multimodal)
 * Service worker for Incognito AI Hub.
 */

import { buildGeminiUrl, geminiApiCall } from './scripts/gemini-api.js';
import { supportedLanguages } from './scripts/language_manager.js';
import { getLocalModelConfig } from './scripts/local-api.js';

/**
 * Standalone DOM extraction function injected into the active tab.
 * Must be self-contained (no closures / external references).
 * Returns structured text with Markdown section markers (##, ###, ####).
 */
function extractDomContent() {
    const SKIP_TAGS = new Set([
        'script','style','noscript','svg','iframe',
        'nav','header','footer','aside','button','form','input','select','textarea'
    ]);
    const SKIP_ROLES = new Set([
        'navigation','banner','contentinfo','complementary','search','dialog'
    ]);
    const SKIP_PATTERNS = [
        'nav','menu','sidebar','advertisement','cookie','popup',
        'modal','share','social','comments','related','recommended','widget'
    ];

    function shouldSkip(el) {
        if (SKIP_TAGS.has(el.tagName.toLowerCase())) return true;
        const role = el.getAttribute?.('role') || '';
        if (SKIP_ROLES.has(role)) return true;
        const cls = (el.className || '').toString().toLowerCase();
        const id  = (el.id || '').toLowerCase();
        return SKIP_PATTERNS.some(p => cls.includes(p) || id.includes(p));
    }

    function getNodes(el, lines) {
        for (const child of el.childNodes) {
            if (child.nodeType !== 1) continue;
            if (shouldSkip(child)) continue;
            const tag  = child.tagName.toLowerCase();
            const text = child.textContent.trim();
            if (!text) continue;
            if      (tag === 'h1') { lines.push('', `# ${text}`, ''); }
            else if (tag === 'h2') { lines.push('', `## ${text}`, ''); }
            else if (tag === 'h3') { lines.push('', `### ${text}`, ''); }
            else if (/^h[4-6]$/.test(tag)) { lines.push('', `#### ${text}`, ''); }
            else if (tag === 'p')  { if (text.length > 1) lines.push(text); }
            else if (tag === 'li') { lines.push(`• ${text}`); }
            else if (tag === 'blockquote') { lines.push(`> ${text}`); }
            else if (tag === 'table') {
                child.querySelectorAll('tr').forEach(row => {
                    const cells = Array.from(row.querySelectorAll('th,td')).map(c => c.textContent.trim());
                    if (cells.some(c => c)) lines.push('| ' + cells.join(' | ') + ' |');
                });
            } else {
                getNodes(child, lines);
            }
        }
    }

    const SELECTORS = [
        'article','main','[role="main"]',
        '.ltx_page_content','#bodyContent',
        '.article-body','.paper-body',
        '#content','#main-content'
    ];
    let root = null;
    for (const sel of SELECTORS) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim().length > 200) { root = el; break; }
    }
    if (!root) root = document.body;

    const lines = [];
    getNodes(root, lines);
    return lines
        .map(l => l.trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

const protocolVersion = "1.3";
let attachedTabs = {};

// --- Language Logic (for Service Worker context) ---
async function getEffectiveUILanguageNameForBg() {
    try {
        const { displayLanguage } = await chrome.storage.sync.get({ displayLanguage: 'default' });
        if (displayLanguage && displayLanguage !== 'default') {
            const lang = supportedLanguages.find(l => l.code === displayLanguage);
            return lang ? lang.name : 'English';
        }
        const uiLang = chrome.i18n.getUILanguage();
        if (uiLang.toLowerCase().startsWith('zh')) {
            return 'Traditional Chinese';
        }
        const langCode = uiLang.split('-')[0];
        const found = supportedLanguages.find(l => l.code === langCode);
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

    const defaultTargetLang = await getEffectiveUILanguageNameForBg();
    await openReader({ text: transcribedText, targetLang: defaultTargetLang, sourceType: 'voice' });
}

async function captureAndRecognize(tabId) {
    if (!tabId) throw new Error("Invalid tab ID.");
    await setActionBadge(tabId, '...', '#007BFF');

    // --- Phase 1-A: Try DOM extraction first (fast, no screenshot needed) ---
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: extractDomContent,
        });
        const domText = results?.[0]?.result?.trim() || '';
        if (domText.length > 200) {
            const defaultTargetLang = await getEffectiveUILanguageNameForBg();
            await openReader({ text: domText, targetLang: defaultTargetLang, sourceType: 'webpage' });
            await setActionBadge(tabId, 'OK', '#28A745');
            return;
        }
    } catch (e) {
        console.warn('[captureAndRecognize] DOM extraction failed, falling back to screenshot:', e.message);
    }

    // --- Fallback: Screenshot OCR via Gemini Vision ---
    if (!attachedTabs[tabId]) {
        try {
            await new Promise((resolve, reject) => {
                chrome.debugger.attach({ tabId }, protocolVersion, () => {
                    if (chrome.runtime.lastError) {
                        return reject(new Error(chrome.runtime.lastError.message));
                    }
                    attachedTabs[tabId] = true;
                    chrome.debugger.onDetach.addListener((source) => {
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
        const screenshot = await sendDebuggerCommand(tabId, "Page.captureScreenshot", {
            format: "jpeg", quality: 90, captureBeyondViewport: true
        });
        if (!screenshot || !screenshot.data) {
            throw new Error(chrome.i18n.getMessage("errorScreenshotFailed"));
        }
        await setActionBadge(tabId, 'AI', '#17A2B8');
        const defaultTargetLang = await getEffectiveUILanguageNameForBg();

        let recognizedText;
        try {
            recognizedText = await callGeminiVision(screenshot.data);
        } catch (ocrErr) {
            if (ocrErr.code === 'RECITATION') {
                // Copyrighted content blocks verbatim OCR — retry with direct translation prompt
                console.warn('[captureAndRecognize] OCR blocked (RECITATION), retrying with translate mode.');
                const translated = await callGeminiVisionTranslate(screenshot.data, defaultTargetLang);
                const hint = chrome.i18n.getMessage('hintScreenshotMode');
                recognizedText = `> ${hint}\n\n${translated}`;
            } else {
                throw ocrErr;
            }
        }

        if (recognizedText && recognizedText.trim().length > 50) {
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
    const localCfg = await getLocalModelConfig();
    if (localCfg.aiMode === 'local') throw new Error(chrome.i18n.getMessage("errorLocalModeNoMultimodal"));

    const { geminiApiKey, translationModel } = await chrome.storage.sync.get({
        geminiApiKey: '',
        translationModel: 'gemini-2.5-flash'
    });
    if (!geminiApiKey) throw new Error(chrome.i18n.getMessage("errorNoApiKey"));

    const apiUrl = buildGeminiUrl(translationModel, geminiApiKey);

    const langHint = (sourceLang !== 'auto' && sourceLang) ? `The text is primarily in ${sourceLang}.` : "";

    const prompt = `You are a highly specialized AI assistant for document OCR and reconstruction. Accurately extract all text from the provided image and structure it with Markdown section markers. ${langHint}

Follow these guidelines:
1. **Section Headings:** Mark major headings (e.g., Abstract, Introduction, Methods, Results, Discussion, Conclusion, References, Appendix) with "## " prefix. Mark sub-section headings with "### " prefix. Place each heading on its own line with a blank line before it.
2. **Semantic Paragraphs:** Combine lines that form a single paragraph into one continuous paragraph. Start a new paragraph only at clear semantic breaks (indentation, significant vertical spacing).
3. **Multi-Column Layout:** Process the first column completely top-to-bottom before moving to the next column.
4. **Hyphenation:** Join words broken across lines (e.g., "experi-" + "ment" → "experiment").
5. **Exclude UI Chrome Only:** Ignore browser navigation bars, cookie banners, and advertisements. Do NOT exclude the document's own References section, footnotes, figure captions, author affiliations, or abstract.
6. **Output:** Return ONLY the reconstructed text with Markdown markers. No summaries, explanations, or added commentary.`;

    const payload = { "contents": [{ "parts": [ { "text": prompt }, { "inline_data": { "mime_type": "image/jpeg", "data": base64ImageData } } ] }] };

    return geminiApiCall(apiUrl, payload);
}

async function callGeminiVisionTranslate(base64ImageData, targetLang) {
    const localCfg = await getLocalModelConfig();
    if (localCfg.aiMode === 'local') throw new Error(chrome.i18n.getMessage("errorLocalModeNoMultimodal"));

    const { geminiApiKey, translationModel } = await chrome.storage.sync.get({
        geminiApiKey: '',
        translationModel: 'gemini-2.5-flash'
    });
    if (!geminiApiKey) throw new Error(chrome.i18n.getMessage("errorNoApiKey"));

    const apiUrl = buildGeminiUrl(translationModel, geminiApiKey);

    const prompt = `You are a translation assistant. Examine this screenshot and translate all main text content directly into fluent, natural ${targetLang}.

Follow these guidelines:
1. Focus on the main reading content. Ignore navigation bars, headers, footers, and UI chrome elements.
2. Translate paragraph by paragraph, preserving the reading flow and structure.
3. Use "## " prefix for chapter/section headings and "### " for subsections.
4. Output only the translated text in structured Markdown. Do not include the original text or any commentary.`;

    const payload = { "contents": [{ "parts": [ { "text": prompt }, { "inline_data": { "mime_type": "image/jpeg", "data": base64ImageData } } ] }] };

    return geminiApiCall(apiUrl, payload);
}

async function callGeminiSpeechToText(audioData, spokenLang) {
    const localCfg = await getLocalModelConfig();
    if (localCfg.aiMode === 'local') throw new Error(chrome.i18n.getMessage("errorLocalModeNoMultimodal"));

    const { geminiApiKey, translationModel } = await chrome.storage.sync.get({
        geminiApiKey: '',
        translationModel: 'gemini-2.5-flash'
    });
    if (!geminiApiKey) throw new Error(chrome.i18n.getMessage("errorNoApiKey"));

    const apiUrl = buildGeminiUrl(translationModel, geminiApiKey);

    let langHint = `The user's primary spoken language is ${spokenLang}.`;
    if (spokenLang === 'auto' || !spokenLang) {
        langHint = "Please transcribe the audio, automatically detecting the language spoken.";
    }

    const prompt = `You are a highly accurate transcription service. Transcribe the following audio. ${langHint} Provide a clean and accurate transcript. If you are unsure about a specific word or phrase, transcribe it as best you can and put it inside parentheses. Do not add any other comments.`;
    const payload = { "contents": [{ "parts": [ { "text": prompt }, { "inline_data": { "mime_type": audioData.mimeType, "data": audioData.data } } ] }] };

    return geminiApiCall(apiUrl, payload);
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
    } catch (e) {
        console.warn('[setActionBadge] Could not update badge:', e.message);
    }
}
