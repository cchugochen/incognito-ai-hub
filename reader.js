// reader.js (v27.2.3 - 3-mode AI service, renamed callTranslation)
import { populateLanguageSelector, getEffectiveUILanguageCode, supportedLanguages } from './scripts/language_manager.js';
import { buildGeminiUrl, geminiApiCall, getStoredApiConfig } from './scripts/gemini-api.js';
import { localModelTranslate, getLocalModelConfig } from './scripts/local-api.js';

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

    const clickTranslateHint = document.getElementById('click-translate-hint');
    const voiceTranslateTool = document.getElementById('voice-translate-tool');
    const voiceTargetLangSelect = document.getElementById('voice-target-lang');
    const translateVoiceBtn = document.getElementById('translate-voice-btn');
    const voiceTranslationOutput = document.getElementById('voice-translation-output');
    const ttsSpeakBtn = document.getElementById('tts-speak-btn');
    const translateLocalWarn = document.getElementById('translate-local-warn');

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

            // Show translate-all + TTS tool and click-translate hint for all source types
            clickTranslateHint.classList.remove('hidden');
            voiceTranslateTool.classList.remove('hidden');

            // Show long-text warning when local model is active
            const localConfig = await getLocalModelConfig();
            if (translateLocalWarn && localConfig.localModelEnabled) {
                translateLocalWarn.classList.remove('hidden');
            }
        } else {
            contentArea.innerHTML = `<p>${chrome.i18n.getMessage("readerErrorNotFound")}</p>`;
        }
        // Clean up local storage after use
        chrome.storage.local.remove(['articleText', 'targetLang', 'sourceType']);
    });

    function renderArticle(text) {
        contentArea.innerHTML = '';
        const lines = text.split('\n');
        let i = 0;
        while (i < lines.length) {
            const line = lines[i].trim();
            if (!line) { i++; continue; }

            // Table block: collect consecutive | rows into one <table>
            if (line.startsWith('|')) {
                const rows = [];
                while (i < lines.length && lines[i].trim().startsWith('|')) {
                    rows.push(lines[i].trim());
                    i++;
                }
                contentArea.appendChild(buildContentTable(rows));
                continue;
            }

            let el;
            if (line.startsWith('# ') || line.startsWith('## ')) {
                el = document.createElement('h2');
                el.textContent = line.replace(/^#{1,2} /, '');
            } else if (line.startsWith('### ')) {
                el = document.createElement('h3');
                el.textContent = line.slice(4);
            } else if (line.startsWith('#### ')) {
                el = document.createElement('h4');
                el.textContent = line.slice(5);
            } else if (line.startsWith('> ')) {
                el = document.createElement('blockquote');
                el.textContent = line.slice(2);
            } else {
                el = document.createElement('p');
                el.textContent = line;
                el.addEventListener('click', handleParagraphClick);
            }
            contentArea.appendChild(el);
            i++;
        }
    }

    function buildContentTable(rows) {
        const table = document.createElement('table');
        table.className = 'content-table';
        rows.forEach((row, idx) => {
            const cells = row.split('|').map(c => c.trim()).filter(c => c);
            if (!cells.length) return;
            const tr = document.createElement('tr');
            cells.forEach(text => {
                const td = document.createElement(idx === 0 ? 'th' : 'td');
                td.textContent = text;
                tr.appendChild(td);
            });
            table.appendChild(tr);
        });
        return table;
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
            const translatedText = await callTranslation(p.textContent, globalTargetLang);
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

    async function callTranslation(textToTranslate, targetLanguage) {
        const localConfig = await getLocalModelConfig();
        if (localConfig.localModelEnabled && localConfig.localModelEndpoint && localConfig.localModelName) {
            try {
                return await localModelTranslate(textToTranslate, targetLanguage,
                                                 localConfig.localModelEndpoint, localConfig.localModelName);
            } catch (e) {
                if (e.message === chrome.i18n.getMessage('errorLocalModelConnect')) {
                    throw new Error(chrome.i18n.getMessage('errorLocalModelOffline'));
                }
                throw e;
            }
        }

        const { geminiApiKey, translationModel } = await getStoredApiConfig();
        if (!geminiApiKey) throw new Error(chrome.i18n.getMessage("errorNoApiKey"));

        const apiUrl = buildGeminiUrl(translationModel, geminiApiKey);
        const payload = {
            "contents": [{
                "parts": [{
                    "text": `You are an expert translator. Detect the source language of the following text and translate it into fluent, natural ${targetLanguage}. Output only the translated text itself, without any additional comments or explanations.\n\nSource text:\n"${textToTranslate}"`
                }]
            }]
        };

        return geminiApiCall(apiUrl, payload);
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
        ttsSpeakBtn.disabled = true;
        window.speechSynthesis.cancel();

        try {
            const translatedText = await callTranslation(fullText, targetLang);
            voiceTranslationOutput.innerHTML = '';
            translatedText.split('\n').filter(l => l.trim()).forEach(line => {
                const p = document.createElement('p');
                p.textContent = line.trim();
                voiceTranslationOutput.appendChild(p);
            });
            ttsSpeakBtn.disabled = false;
        } catch (error) {
            voiceTranslationOutput.textContent = chrome.i18n.getMessage("readerTranslateFailed", error.message);
        } finally {
            translateVoiceBtn.disabled = false;
        }
    });

    // --- TTS: Pick the best available voice for a given BCP-47 language code ---
    function pickVoice(langCode) {
        const voices = window.speechSynthesis.getVoices();
        if (!voices.length) return null;
        // For English, prefer Google US English for clearer pronunciation
        if (langCode === 'en' || langCode.startsWith('en-')) {
            return (
                voices.find(v => v.name === 'Google US English') ||
                voices.find(v => v.lang === 'en-US' && v.name.toLowerCase().includes('google')) ||
                voices.find(v => v.name.toLowerCase().includes('google') && v.lang.startsWith('en')) ||
                voices.find(v => v.lang === 'en-US') ||
                voices.find(v => v.lang.startsWith('en')) ||
                null
            );
        }
        // For other languages, match by exact lang then by prefix
        return (
            voices.find(v => v.lang === langCode) ||
            voices.find(v => v.lang.startsWith(langCode.split('-')[0])) ||
            null
        );
    }

    // --- TTS: Speak translated text using Web Speech API ---
    ttsSpeakBtn.addEventListener('click', async () => {
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            ttsSpeakBtn.textContent = chrome.i18n.getMessage('readerTtsSpeakBtn');
            return;
        }
        // Collect text from rendered <p> elements, or fall back to textContent
        const pEls = voiceTranslationOutput.querySelectorAll('p');
        const text = pEls.length
            ? Array.from(pEls).map(p => p.textContent.trim()).filter(t => t).join(' ')
            : voiceTranslationOutput.textContent.trim();
        if (!text) return;

        // Map selected language name to BCP-47 code — use shared helper for system-default
        const selectedValue = voiceTargetLangSelect.value;
        let langCode;
        if (selectedValue === 'system-default') {
            langCode = await getEffectiveUILanguageCode();
        } else {
            const langEntry = supportedLanguages.find(l => l.name === selectedValue);
            langCode = langEntry?.code || 'en';
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = langCode;
        utterance.rate = 0.9;
        const selectedVoice = pickVoice(langCode);
        if (selectedVoice) utterance.voice = selectedVoice;
        utterance.onstart = () => { ttsSpeakBtn.textContent = chrome.i18n.getMessage('readerTtsStopBtn'); };
        utterance.onend = () => { ttsSpeakBtn.textContent = chrome.i18n.getMessage('readerTtsSpeakBtn'); };
        utterance.onerror = () => { ttsSpeakBtn.textContent = chrome.i18n.getMessage('readerTtsSpeakBtn'); };
        window.speechSynthesis.speak(utterance);
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
        voiceTranslationOutput.style.fontSize = `${size}px`;
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
        const elements = contentArea.querySelectorAll('h2, h3, h4, blockquote, p');
        let fullText = "";
        const title = document.title || 'reading_session';
        let pIndex = 0;
        elements.forEach(el => {
            const tag = el.tagName.toLowerCase();
            if (tag === 'h2') {
                fullText += `\n== ${el.textContent} ==\n\n`;
            } else if (tag === 'h3') {
                fullText += `\n-- ${el.textContent} --\n\n`;
            } else if (tag === 'h4') {
                fullText += `\n  ${el.textContent}\n\n`;
            } else if (tag === 'blockquote') {
                fullText += `> ${el.textContent}\n\n`;
            } else {
                pIndex++;
                fullText += `${chrome.i18n.getMessage("readerSaveOriginal", String(pIndex))}\n${el.textContent}\n\n`;
                const translationDiv = el.nextElementSibling;
                if (translationDiv && translationDiv.classList.contains('translation')) {
                    fullText += `${chrome.i18n.getMessage("readerSaveTranslated", String(pIndex))}\n${translationDiv.textContent}\n\n`;
                }
                fullText += "----------------------------------------\n\n";
            }
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