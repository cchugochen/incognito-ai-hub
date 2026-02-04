// options.js (v26.3 - Model Update & Presets A-G)
import { populateLanguageSelector } from './scripts/language_manager.js';

/**
 * Saves options to chrome.storage.sync.
 */
function save_options() {
    const selectedModelEl = document.querySelector('input[name="model-select"]:checked');
    if (!selectedModelEl) {
        alert("Please select a translation model.");
        return;
    }
    const selectedModel = selectedModelEl.value;
    const lang = document.getElementById('display-language').value;

    chrome.storage.sync.set({
        displayLanguage: lang,
        geminiApiKey: document.getElementById('api-key').value,
        translationModel: selectedModel,
        prefLangA: document.getElementById('pref-lang-a').value.trim(),
        prefLangB: document.getElementById('pref-lang-b').value.trim(),
        preset_a: document.getElementById('preset-prompt-a').value,
        preset_b: document.getElementById('preset-prompt-b').value,
        preset_c: document.getElementById('preset-prompt-c').value,
        preset_d: document.getElementById('preset-prompt-d').value,
        preset_e: document.getElementById('preset-prompt-e').value,
        // Added presets F and G
        preset_f: document.getElementById('preset-prompt-f').value,
        preset_g: document.getElementById('preset-prompt-g').value
    }, () => {
        const status = document.getElementById('status');
        status.textContent = chrome.i18n.getMessage('optionsStatusSaved');
        status.style.color = 'green';
        setTimeout(() => { status.textContent = ''; }, 2000);
    });
}

/**
 * Restores options from chrome.storage.sync.
 */
function restore_options() {
    chrome.storage.sync.get({
        displayLanguage: 'default',
        geminiApiKey: '',
        translationModel: 'gemini-2.5-flash', // UPDATED DEFAULT to 2.5 Flash
        prefLangA: '',
        prefLangB: '',
        preset_a: '',
        preset_b: '',
        preset_c: '',
        preset_d: '',
        preset_e: '',
        preset_f: '',
        preset_g: ''
    }, (items) => {
        document.getElementById('display-language').value = items.displayLanguage;
        document.getElementById('api-key').value = items.geminiApiKey;
        
        document.getElementById('pref-lang-a').value = items.prefLangA;
        document.getElementById('pref-lang-b').value = items.prefLangB;

        document.getElementById('preset-prompt-a').value = items.preset_a;
        document.getElementById('preset-prompt-b').value = items.preset_b;
        document.getElementById('preset-prompt-c').value = items.preset_c;
        document.getElementById('preset-prompt-d').value = items.preset_d;
        document.getElementById('preset-prompt-e').value = items.preset_e;
        document.getElementById('preset-prompt-f').value = items.preset_f;
        document.getElementById('preset-prompt-g').value = items.preset_g;

        const savedModelRadio = document.querySelector(`input[name="model-select"][value="${items.translationModel}"]`);
        if (savedModelRadio) {
            savedModelRadio.checked = true;
        } else {
            // Fallback to the first radio button if saved model is not found
            const firstRadio = document.querySelector('input[name="model-select"]');
            if(firstRadio) firstRadio.checked = true;
        }
    });
}

// --- Main Execution ---
document.addEventListener('DOMContentLoaded', async () => {
    document.title = chrome.i18n.getMessage('optionsTitle');
    
    const displayLangSelect = document.getElementById('display-language');
    const defaultOption = new Option(chrome.i18n.getMessage('optionsDisplayLangDefault'), 'default');
    displayLangSelect.add(defaultOption);
    await populateLanguageSelector(displayLangSelect, { isDisplayLangSelector: true });

    restore_options();
    
    document.getElementById('save').addEventListener('click', save_options);

    document.querySelectorAll('.model-card').forEach(card => {
        card.addEventListener('click', () => {
            const radioId = card.getAttribute('for');
            const radio = document.getElementById(radioId);
            if (radio) {
                radio.checked = true;
            }
        });
    });
});