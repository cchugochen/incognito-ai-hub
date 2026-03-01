// options.js (v27.2.3 - 3-mode AI service selector)
import { populateLanguageSelector, supportedLanguages } from './scripts/language_manager.js';

// --- Preferred Language List Helpers ---

/** Populate the two <select> dropdowns with supported languages. */
function populatePrefLangSelects() {
    const notSetLabel = chrome.i18n.getMessage('optionsPrefLangNotSet');
    document.querySelectorAll('.pref-lang-row[data-type="select"] .pref-lang-value').forEach(select => {
        select.innerHTML = '';
        const notSetOpt = new Option(notSetLabel, '');
        select.add(notSetOpt);
        supportedLanguages.forEach(lang => {
            select.add(new Option(`${lang.nativeName} / ${lang.name}`, lang.name));
        });
    });
}

/** Read current pref lang values from the DOM rows in display order. */
function getPrefLangValues() {
    return Array.from(document.querySelectorAll('#pref-lang-list .pref-lang-row'))
        .map(row => row.querySelector('.pref-lang-value').value.trim());
}

/** Apply saved values to DOM rows (index 0→row0, 1→row1, 2→row2 in current DOM order). */
function setPrefLangValues(values) {
    const rows = document.querySelectorAll('#pref-lang-list .pref-lang-row');
    rows.forEach((row, i) => {
        const input = row.querySelector('.pref-lang-value');
        if (input) input.value = values[i] ?? '';
    });
}

/** Update the 1./2./3. position labels after any reorder. */
function updatePrefLangNumbers() {
    document.querySelectorAll('#pref-lang-list .pref-lang-row').forEach((row, i) => {
        const numEl = row.querySelector('.pref-slot-num');
        if (numEl) numEl.textContent = `${i + 1}.`;
    });
}

/** Enable/disable ↑↓ buttons based on current row position. */
function updatePrefLangArrows() {
    const rows = document.querySelectorAll('#pref-lang-list .pref-lang-row');
    rows.forEach((row, i) => {
        row.querySelector('[data-dir="up"]').disabled = (i === 0);
        row.querySelector('[data-dir="down"]').disabled = (i === rows.length - 1);
    });
}

// --- AI Mode Panel Show/Hide ---

/** Update visibility of gemini-config and local-mode-warning based on selected mode.
 * local-config (endpoint + model name) is always visible so users can always configure it. */
function updateAiModePanels(mode) {
    const geminiConfig = document.getElementById('gemini-config');
    const localWarning = document.getElementById('local-mode-warning');

    // Hide Gemini API key + model selector in local-only mode (not needed)
    geminiConfig.classList.toggle('hidden', mode === 'local');
    // Show amber warning only in local-only mode
    localWarning.classList.toggle('hidden', mode !== 'local');
}

// --- Core Options Logic ---

function save_options() {
    const selectedModelEl = document.querySelector('input[name="model-select"]:checked');
    const selectedModel = selectedModelEl ? selectedModelEl.value : 'gemini-2.5-flash';
    const lang = document.getElementById('display-language').value;
    const prefLangs = getPrefLangValues();
    const aiModeEl = document.querySelector('input[name="ai-mode"]:checked');
    const aiMode = aiModeEl ? aiModeEl.value : 'gemini';

    chrome.storage.sync.set({
        displayLanguage: lang,
        geminiApiKey: document.getElementById('api-key').value,
        translationModel: selectedModel,
        prefLangs: prefLangs,
        // Clear old individual keys so migration path is clean
        prefLangA: '',
        prefLangB: '',
        preset_a: document.getElementById('preset-prompt-a').value,
        preset_b: document.getElementById('preset-prompt-b').value,
        preset_c: document.getElementById('preset-prompt-c').value,
        preset_d: document.getElementById('preset-prompt-d').value,
        preset_e: document.getElementById('preset-prompt-e').value,
        preset_f: document.getElementById('preset-prompt-f').value,
        preset_g: document.getElementById('preset-prompt-g').value,
        aiMode: aiMode,
        localModelEndpoint: document.getElementById('local-model-endpoint').value.trim(),
        localModelName: document.getElementById('local-model-name').value.trim()
    }, () => {
        const status = document.getElementById('status');
        status.textContent = chrome.i18n.getMessage('optionsStatusSaved');
        status.className = 'status-success';
        setTimeout(() => { status.textContent = ''; status.className = ''; }, 2000);
    });
}

function restore_options() {
    chrome.storage.sync.get({
        displayLanguage: 'default',
        geminiApiKey: '',
        translationModel: 'gemini-2.5-flash',
        prefLangs: null,
        prefLangA: '',
        prefLangB: '',
        preset_a: '',
        preset_b: '',
        preset_c: '',
        preset_d: '',
        preset_e: '',
        preset_f: '',
        preset_g: '',
        aiMode: null,
        localModelEnabled: false,
        localModelEndpoint: 'http://localhost:11434/v1',
        localModelName: 'llama3.2'
    }, (items) => {
        document.getElementById('display-language').value = items.displayLanguage;
        document.getElementById('api-key').value = items.geminiApiKey;

        // Migration: if prefLangs not saved yet, seed from old A/B keys
        const prefLangs = items.prefLangs ?? [items.prefLangA, items.prefLangB, ''];
        setPrefLangValues(prefLangs);

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
            if (firstRadio) firstRadio.checked = true;
        }

        // Migrate from old localModelEnabled boolean → aiMode
        let aiMode = items.aiMode;
        if (aiMode === null) {
            aiMode = items.localModelEnabled ? 'hybrid' : 'gemini';
        }
        const aiModeRadio = document.querySelector(`input[name="ai-mode"][value="${aiMode}"]`);
        if (aiModeRadio) aiModeRadio.checked = true;

        document.getElementById('local-model-endpoint').value = items.localModelEndpoint;
        document.getElementById('local-model-name').value = items.localModelName;
        updateAiModePanels(aiMode);
    });
}

function reset_options() {
    const presetIds = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    presetIds.forEach(id => {
        document.getElementById(`preset-prompt-${id}`).value = '';
    });
    document.getElementById('api-key').value = '';
    setPrefLangValues(['', '', '']);

    const firstRadio = document.querySelector('input[name="model-select"]');
    if (firstRadio) firstRadio.checked = true;

    const geminiModeRadio = document.getElementById('ai-mode-gemini');
    if (geminiModeRadio) geminiModeRadio.checked = true;
    document.getElementById('local-model-endpoint').value = 'http://localhost:11434/v1';
    document.getElementById('local-model-name').value = 'llama3.2';
    updateAiModePanels('gemini');

    chrome.storage.sync.set({
        geminiApiKey: '',
        translationModel: 'gemini-2.5-flash',
        prefLangs: ['', '', ''],
        prefLangA: '', prefLangB: '',
        preset_a: '', preset_b: '', preset_c: '', preset_d: '',
        preset_e: '', preset_f: '', preset_g: '',
        aiMode: 'gemini',
        localModelEndpoint: 'http://localhost:11434/v1',
        localModelName: 'llama3.2'
    }, () => {
        const status = document.getElementById('status');
        status.textContent = chrome.i18n.getMessage('optionsStatusReset');
        status.className = 'status-success';
        setTimeout(() => { status.textContent = ''; status.className = ''; }, 2500);
    });
}

// --- Main Execution ---
document.addEventListener('DOMContentLoaded', async () => {
    document.title = chrome.i18n.getMessage('optionsTitle');

    // Populate display language selector
    const displayLangSelect = document.getElementById('display-language');
    const defaultOption = new Option(chrome.i18n.getMessage('optionsDisplayLangDefault'), 'default');
    displayLangSelect.add(defaultOption);
    await populateLanguageSelector(displayLangSelect, { isDisplayLangSelector: true });

    // Populate the two supported-language selects in the pref-lang list
    populatePrefLangSelects();

    // Restore saved values
    restore_options();

    // Reorder buttons: swap the clicked row with its neighbor
    document.getElementById('pref-lang-list').addEventListener('click', (e) => {
        const btn = e.target.closest('.pref-arrow');
        if (!btn) return;
        const row = btn.closest('.pref-lang-row');
        const list = document.getElementById('pref-lang-list');
        const rows = Array.from(list.querySelectorAll('.pref-lang-row'));
        const idx = rows.indexOf(row);

        if (btn.dataset.dir === 'up' && idx > 0) {
            list.insertBefore(row, rows[idx - 1]);
        } else if (btn.dataset.dir === 'down' && idx < rows.length - 1) {
            list.insertBefore(rows[idx + 1], row);
        }
        updatePrefLangNumbers();
        updatePrefLangArrows();
    });

    document.getElementById('save').addEventListener('click', save_options);
    document.getElementById('reset').addEventListener('click', reset_options);

    // AI mode radio change → update panel visibility
    document.querySelectorAll('input[name="ai-mode"]').forEach(radio => {
        radio.addEventListener('change', () => updateAiModePanels(radio.value));
    });

    document.querySelectorAll('.model-card').forEach(card => {
        card.addEventListener('click', () => {
            const radioId = card.getAttribute('for');
            const radio = document.getElementById(radioId);
            if (radio) radio.checked = true;
        });
    });
});
