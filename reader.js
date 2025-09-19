// reader.js (v25.1 - Dynamic Target Language)
import { populateLanguageSelector, getEffectiveUILanguageCode, supportedLanguages } from './scripts/language_manager.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Set document title dynamically
    document.title = chrome.i18n.getMessage('readerTitle');

    // --- DOM Elements ---
    const contentArea = document.getElementById('content-area');
    const fontSizeSlider = document.getElementById('font-size');
    const fontSizeValue = document.getElementById('font-size-value');
    const lineHeightSlider = document.getElementById('line-height');
    const lineHeightValue = document.getElementById('line-height-value');
    const colorButtons = document.querySelectorAll('.color-btn');
    const saveButton = document.getElementById('save-text');
    
    // [v25.1] New main target language selector
    const mainTargetLangSelect = document.getElementById('target-lang');

    const voiceTranslateTool = document.getElementById('voice-translate-tool');
    const voiceTargetLangSelect = document.getElementById('voice-target-lang');
    const translateVoiceBtn = document.getElementById('translate-voice-btn');
    const voiceTranslationOutput = document.getElementById('voice-translation-output');

    // --- State ---
    let globalTargetLang = 'Traditional Chinese'; // Default fallback
    
    // --- Language & UI Initialization ---
    // Populate the new main target language selector
    await populateLanguageSelector(mainTargetLangSelect, { 
        includeSystemDefault: true, 
        includePrefLangs: true 
    });

    // Populate the voice tool's language selector (can be the same list)
    await populateLanguageSelector(voiceTargetLangSelect, { 
        includeSystemDefault: true, 
        includePrefLangs: true 
    });

    initializeUI();

    // --- Load Content and Set Initial Language ---
    chrome.storage.local.get(['articleText', 'targetLang', 'sourceType'], async (data) => {
        if (data.articleText && data.articleText.trim().length > 0) {
            // Determine initial target language based on what was passed
            if (data.targetLang === 'system-default' || !data.targetLang) {
                const code = await getEffectiveUILanguageCode();
                globalTargetLang = supportedLanguages.find(l => l.code === code)?.name || 'English';
                mainTargetLangSelect.value = 'system-default'; // Set dropdown to show 'System Default'
            } else {
                globalTargetLang = data.targetLang;
                mainTargetLangSelect.value = globalTargetLang; // Set dropdown to the specific language
            }
            
            renderArticle(data.articleText);

            if (data.sourceType === 'voice') {
                voiceTranslateTool.classList.remove('hidden');
            }
        } else {
            contentArea.innerHTML = `<p>${chrome.i18n.getMessage("readerErrorNotFound")}</p>`;
        }
        // Clean up local storage after use
        chrome.storage.local.remove(['articleText', 'targetLang', 'sourceType']);
    });

    function renderArticle(text) {
        contentArea.innerHTML = '';
        const paragraphs = text.split('\n').filter(p => p.trim().length > 0);
        paragraphs.forEach(pText => {
            const p = document.createElement('p');
            p.textContent = pText;
            p.addEventListener('click', handleParagraphClick);
            contentArea.appendChild(p);
        });
    }

    async function handleParagraphClick(event) {
        const p = event.currentTarget;
        if (p.classList.contains('translating')) return;

        const existingTranslation = p.nextElementSibling;
        if (existingTranslation && existingTranslation.classList.contains('translation')) {
            existingTranslation.remove();
            return;
        }

        p.classList.add('translating');
        try {
            // [v25.1] The globalTargetLang is now updated by the new dropdown
            const translatedText = await callGeminiForTranslation(p.textContent, globalTargetLang);
            const translationDiv = document.createElement('div');
            translationDiv.className = 'translation';
            translationDiv.textContent = translatedText;
            p.after(translationDiv);
        } catch (error) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'translation error';
            errorDiv.textContent = chrome.i18n.getMessage("readerTranslateFailed", error.message);
            p.after(errorDiv);
        } finally {
            p.classList.remove('translating');
        }
    }

    async function callGeminiForTranslation(textToTranslate, targetLanguage) {
        const { geminiApiKey, translationModel } = await chrome.storage.sync.get({
            geminiApiKey: '',
            translationModel: 'gemini-2.0-flash' // <-- 修改為指定的備用模型
        });
        if (!geminiApiKey) throw new Error(chrome.i18n.getMessage("errorNoApiKey"));
        
        const model = translationModel;
        const apiUrl = model.startsWith('models/') ?
            `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${geminiApiKey}` :
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
        
        const payload = {
            "contents": [{
                "parts": [{ 
                    "text": `You are an expert translator. Detect the source language of the following text and translate it into fluent, natural ${targetLanguage}. Output only the translated text itself, without any additional comments or explanations.\n\nSource text:\n"${textToTranslate}"`
                }]
            }]
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
             const errorResult = await response.json();
             const errorDetails = errorResult.error?.message || `HTTP error! status: ${response.status}`;
             throw new Error(errorDetails);
        }
        const result = await response.json();
        if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
            return result.candidates[0].content.parts[0].text;
        } else {
             const finishReason = result.candidates?.[0]?.finishReason;
             if (finishReason === 'SAFETY') {
                  throw new Error(chrome.i18n.getMessage("errorApiRejected", "SAFETY"));
             }
             throw new Error(chrome.i18n.getMessage("errorApiInvalidResponse"));
        }
    }
    
    // --- Event Listeners ---

    // [v25.1] Listener for the new main target language dropdown
    mainTargetLangSelect.addEventListener('change', async (e) => {
        const selectedValue = e.target.value;
        if (selectedValue === 'system-default') {
            const code = await getEffectiveUILanguageCode();
            globalTargetLang = supportedLanguages.find(l => l.code === code)?.name || 'English';
        } else {
            globalTargetLang = selectedValue;
        }
        // Remove existing translations as the target language has changed
        document.querySelectorAll('.translation').forEach(el => el.remove());
    });

    translateVoiceBtn.addEventListener('click', async () => {
        const fullText = Array.from(contentArea.querySelectorAll('p')).map(p => p.textContent).join('\n');
        if (!fullText) return;
        
        let targetLang = voiceTargetLangSelect.value;
        if (targetLang === 'system-default') {
            const code = await getEffectiveUILanguageCode();
            targetLang = supportedLanguages.find(l => l.code === code)?.name || 'English';
        }

        voiceTranslationOutput.textContent = chrome.i18n.getMessage("readerTranslating").trim();
        translateVoiceBtn.disabled = true;

        try {
            const translatedText = await callGeminiForTranslation(fullText, targetLang);
            voiceTranslationOutput.textContent = translatedText;
        } catch (error) {
            voiceTranslationOutput.textContent = chrome.i18n.getMessage("readerTranslateFailed", error.message);
        } finally {
            translateVoiceBtn.disabled = false;
        }
    });

    function initializeUI() {
        fontSizeSlider.value = '20';
        lineHeightSlider.value = '1.6';
        updateFontSize('20');
        updateLineHeight('1.6');
        updateBgColor('bg-white');
    }

    function updateFontSize(size) {
        contentArea.style.fontSize = `${size}px`;
        fontSizeValue.textContent = `${size}px`;
    }

    function updateLineHeight(height) {
        contentArea.style.lineHeight = height;
        lineHeightValue.textContent = height;
    }

    function updateBgColor(colorClass) {
        document.body.className = colorClass;
    }

    function saveContentAsTxt() {
        const paragraphs = contentArea.querySelectorAll('p');
        let fullText = "";
        const title = document.title || 'reading_session';
        paragraphs.forEach((p, index) => {
            fullText += `${chrome.i18n.getMessage("readerSaveOriginal", String(index + 1))}\n${p.textContent}\n\n`;
            const translationDiv = p.nextElementSibling;
            if (translationDiv && translationDiv.classList.contains('translation')) {
                fullText += `${chrome.i18n.getMessage("readerSaveTranslated", String(index + 1))}\n${translationDiv.textContent}\n\n`;
            }
            fullText += "----------------------------------------\n\n";
        });
        if (fullText.trim() === "") return;
        const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    fontSizeSlider.addEventListener('input', (e) => updateFontSize(e.target.value));
    lineHeightSlider.addEventListener('input', (e) => updateLineHeight(e.target.value));
    colorButtons.forEach(button => {
        button.addEventListener('click', (e) => updateBgColor(e.currentTarget.dataset.color));
    });
    saveButton.addEventListener('click', saveContentAsTxt);
});
