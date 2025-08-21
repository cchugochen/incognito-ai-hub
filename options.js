// options.js (v25.3 - Bug Fix)
// - Fixed model radio buttons being unselectable by removing preventDefault().
import { populateLanguageSelector } from './scripts/language_manager.js';

/**
 * Saves options to chrome.storage.sync.
 */
function save_options() {
    // [v25.3 Fix] Ensure a model is selected before saving
    const selectedModelEl = document.querySelector('input[name="model-select"]:checked');
    if (!selectedModelEl) {
        // This case should ideally not happen with the fix, but as a safeguard:
        alert("Please select a translation model.");
        return;
    }
    const selectedModel = selectedModelEl.value;
    const lang = document.getElementById('display-language').value;

    chrome.storage.sync.set({
        displayLanguage: lang,
        geminiApiKey: document.getElementById('api-key').value,
        translationModel: selectedModel,
        logEndpoint: document.getElementById('log-endpoint').value,
        logKey: document.getElementById('log-key').value,
        prefLangA: document.getElementById('pref-lang-a').value.trim(),
        prefLangB: document.getElementById('pref-lang-b').value.trim(),
        preset_a: document.getElementById('preset-prompt-a').value,
        preset_b: document.getElementById('preset-prompt-b').value,
        preset_c: document.getElementById('preset-prompt-c').value,
        preset_d: document.getElementById('preset-prompt-d').value,
        preset_e: document.getElementById('preset-prompt-e').value
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
        translationModel: 'gemini-2.0-flash',
        logEndpoint: '',
        logKey: '',
        prefLangA: '',
        prefLangB: '',
        preset_a: '',
        preset_b: '',
        preset_c: '',
        preset_d: '',
        preset_e: ''
    }, (items) => {
        document.getElementById('display-language').value = items.displayLanguage;
        document.getElementById('api-key').value = items.geminiApiKey;
        document.getElementById('log-endpoint').value = items.logEndpoint;
        document.getElementById('log-key').value = items.logKey;
        
        document.getElementById('pref-lang-a').value = items.prefLangA;
        document.getElementById('pref-lang-b').value = items.prefLangB;

        document.getElementById('preset-prompt-a').value = items.preset_a;
        document.getElementById('preset-prompt-b').value = items.preset_b;
        document.getElementById('preset-prompt-c').value = items.preset_c;
        document.getElementById('preset-prompt-d').value = items.preset_d;
        document.getElementById('preset-prompt-e').value = items.preset_e;

        const savedModelRadio = document.querySelector(`input[name="model-select"][value="${items.translationModel}"]`);
        if (savedModelRadio) {
            savedModelRadio.checked = true;
        } else {
            document.querySelector('input[name="model-select"]').checked = true;
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

    // [v25.3 Fix] Removed e.preventDefault() to allow native label behavior.
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
