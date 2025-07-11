/**
 * reader.js (v19.4)
 * - Restored correct code to fix file mix-up issue.
 * - Handles display, paragraph translation, and voice note translation tool.
 */
document.addEventListener('DOMContentLoaded', () => {
    const contentArea = document.getElementById('content-area');
    const fontSizeSlider = document.getElementById('font-size');
    const fontSizeValue = document.getElementById('font-size-value');
    const lineHeightSlider = document.getElementById('line-height');
    const lineHeightValue = document.getElementById('line-height-value');
    const colorButtons = document.querySelectorAll('.color-btn');
    const saveButton = document.getElementById('save-text');

    const voiceTranslateTool = document.getElementById('voice-translate-tool');
    const voiceTargetLangSelect = document.getElementById('voice-target-lang');
    const translateVoiceBtn = document.getElementById('translate-voice-btn');
    const voiceTranslationOutput = document.getElementById('voice-translation-output');

    let globalTargetLang = 'Traditional Chinese'; // Default translation target

    initializeUI();

    chrome.storage.local.get(['articleText', 'targetLang', 'sourceType'], (data) => {
        if (data.articleText && data.articleText.trim().length > 0) {
            globalTargetLang = data.targetLang || 'Traditional Chinese';
            renderArticle(data.articleText);

            // If the source is from voice notes, show the translation tool
            if (data.sourceType === 'voice') {
                voiceTranslateTool.classList.remove('hidden');
            }
        } else {
            contentArea.innerHTML = '<p>找不到文章內容，或提取的內容為空。請返回原始頁面重試。</p>';
        }
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
            const translatedText = await callGeminiForTranslation(p.textContent, globalTargetLang);
            const translationDiv = document.createElement('div');
            translationDiv.className = 'translation';
            translationDiv.textContent = translatedText;
            p.after(translationDiv);
        } catch (error) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'translation';
            errorDiv.textContent = `翻譯失敗: ${error.message}`;
            p.after(errorDiv);
        } finally {
            p.classList.remove('translating');
        }
    }

    async function callGeminiForTranslation(textToTranslate, targetLanguage) {
        const items = await chrome.storage.sync.get({
            geminiApiKey: '',
            translationModel: 'gemini-2.0-flash'
        });
        if (!items.geminiApiKey) throw new Error("尚未設定 Gemini API 金鑰。");
        
        const model = items.translationModel;
        const apiUrl = model.startsWith('models/') ?
            `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${items.geminiApiKey}` :
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${items.geminiApiKey}`;
        
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
                  throw new Error("內容因違反安全政策被 AI 拒絕。");
             }
             throw new Error("API 未返回有效的翻譯結果。");
        }
    }
    
    translateVoiceBtn.addEventListener('click', async () => {
        const fullText = Array.from(contentArea.querySelectorAll('p')).map(p => p.textContent).join('\n');
        if (!fullText) return;
        
        const targetLang = voiceTargetLangSelect.value;
        voiceTranslationOutput.textContent = '翻譯中...';
        translateVoiceBtn.disabled = true;

        try {
            const translatedText = await callGeminiForTranslation(fullText, targetLang);
            voiceTranslationOutput.textContent = translatedText;
        } catch (error) {
            voiceTranslationOutput.textContent = `翻譯失敗: ${error.message}`;
        } finally {
            translateVoiceBtn.disabled = false;
        }
    });

    // --- UI and Save Functions ---
    function initializeUI() {
        const defaultFontSize = '20';
        fontSizeSlider.value = defaultFontSize;
        contentArea.style.fontSize = `${defaultFontSize}px`;
        fontSizeValue.textContent = `${defaultFontSize}px`;
        const defaultLineHeight = '1.6';
        lineHeightSlider.value = defaultLineHeight;
        contentArea.style.lineHeight = defaultLineHeight;
        lineHeightValue.textContent = defaultLineHeight;
        document.body.style.backgroundColor = '#FFFFFF';
    }

    function saveContentAsTxt() {
        const paragraphs = contentArea.querySelectorAll('p');
        let fullText = "";
        const title = document.title || 'reading_session';
        paragraphs.forEach((p, index) => {
            fullText += `[原文 ${index + 1}]\n${p.textContent}\n\n`;
            const translationDiv = p.nextElementSibling;
            if (translationDiv && translationDiv.classList.contains('translation')) {
                fullText += `[翻譯 ${index + 1}]\n${translationDiv.textContent}\n\n`;
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

    fontSizeSlider.addEventListener('input', (e) => {
        const size = e.target.value;
        contentArea.style.fontSize = `${size}px`;
        fontSizeValue.textContent = `${size}px`;
    });
    lineHeightSlider.addEventListener('input', (e) => {
        const height = e.target.value;
        contentArea.style.lineHeight = height;
        lineHeightValue.textContent = height;
    });
    colorButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const color = e.target.dataset.color;
            document.body.style.backgroundColor = color;
            document.body.classList.toggle('dark-mode', color === '#1E1E1E');
        });
    });
    saveButton.addEventListener('click', saveContentAsTxt);
});
