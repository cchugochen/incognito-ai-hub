// options.js (v27.1 - Local Model Support)
import { populateLanguageSelector } from './scripts/language_manager.js';

/**
 * Saves options to chrome.storage.sync.
 */
function save_options() {
    const selectedModelEl = document.querySelector('input[name="model-select"]:checked');
    const selectedModel = selectedModelEl ? selectedModelEl.value : 'gemini-2.5-flash';
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
        preset_f: document.getElementById('preset-prompt-f').value,
        preset_g: document.getElementById('preset-prompt-g').value,
        localModelEnabled: document.getElementById('local-model-enabled').checked,
        localModelEndpoint: document.getElementById('local-model-endpoint').value.trim(),
        localModelName: document.getElementById('local-model-name').value.trim()
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
        translationModel: 'gemini-2.5-flash',
        prefLangA: '',
        prefLangB: '',
        preset_a: '',
        preset_b: '',
        preset_c: '',
        preset_d: '',
        preset_e: '',
        preset_f: '',
        preset_g: '',
        localModelEnabled: false,
        localModelEndpoint: 'http://localhost:11434/v1',
        localModelName: 'llama3.2'
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
            const firstRadio = document.querySelector('input[name="model-select"]');
            if(firstRadio) firstRadio.checked = true;
        }

        const localEnabledCheckbox = document.getElementById('local-model-enabled');
        localEnabledCheckbox.checked = items.localModelEnabled;
        document.getElementById('local-model-endpoint').value = items.localModelEndpoint;
        document.getElementById('local-model-name').value = items.localModelName;
        document.getElementById('local-model-settings').style.display = items.localModelEnabled ? '' : 'none';
    });
}

/**
 * Resets presets and API key to defaults. Preserves display language.
 */
function reset_options() {
    const presetIds = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    presetIds.forEach(id => {
        document.getElementById(`preset-prompt-${id}`).value = '';
    });
    document.getElementById('api-key').value = '';
    document.getElementById('pref-lang-a').value = '';
    document.getElementById('pref-lang-b').value = '';

    const firstRadio = document.querySelector('input[name="model-select"]');
    if (firstRadio) firstRadio.checked = true;

    document.getElementById('local-model-enabled').checked = false;
    document.getElementById('local-model-endpoint').value = 'http://localhost:11434/v1';
    document.getElementById('local-model-name').value = 'llama3.2';
    document.getElementById('local-model-settings').style.display = 'none';

    chrome.storage.sync.set({
        geminiApiKey: '',
        translationModel: 'gemini-2.5-flash',
        prefLangA: '', prefLangB: '',
        preset_a: '', preset_b: '', preset_c: '', preset_d: '',
        preset_e: '', preset_f: '', preset_g: '',
        localModelEnabled: false,
        localModelEndpoint: 'http://localhost:11434/v1',
        localModelName: 'llama3.2'
    }, () => {
        const status = document.getElementById('status');
        status.textContent = chrome.i18n.getMessage('optionsStatusReset');
        status.style.color = '#606C38';
        setTimeout(() => { status.textContent = ''; }, 2500);
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
    document.getElementById('reset').addEventListener('click', reset_options);

    document.getElementById('local-model-enabled').addEventListener('change', (e) => {
        document.getElementById('local-model-settings').style.display = e.target.checked ? '' : 'none';
    });

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