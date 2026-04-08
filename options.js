// options.js (v27.2.3 - 3-mode AI service selector)
import { populateLanguageSelector, supportedLanguages } from './scripts/language_manager.js';
import { fetchLocalModelCatalog, normalizeLocalApiBaseUrl } from './scripts/local-api.js';

const t = (key, fallback = '', substitutions) => chrome.i18n.getMessage(key, substitutions) || fallback;
let localModelFetchSeq = 0;

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

function showOptionsStatus(message, kind = 'success') {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status-text ${kind ? `status-${kind}` : ''}`.trim();
}

function setLocalModelStatus(message, kind = '') {
    const status = document.getElementById('local-model-status');
    status.textContent = message;
    status.className = `field-status ${kind ? `status-${kind}` : ''}`.trim();
}

function setLocalModelButtonsBusy(isBusy) {
    document.getElementById('test-local-connection').disabled = isBusy;
    document.getElementById('refresh-local-models').disabled = isBusy;
}

function resetLocalModelSelect(message = t('localModelSelectEmpty', 'No models detected yet')) {
    const select = document.getElementById('local-model-select');
    select.innerHTML = '';
    select.add(new Option(message, ''));
    select.disabled = true;
}

function syncManualModelWithSelect() {
    const select = document.getElementById('local-model-select');
    const manualInput = document.getElementById('local-model-name');
    const selected = select.value.trim();
    if (selected) {
        manualInput.value = selected;
    }
}

function syncSelectWithManualModel() {
    const select = document.getElementById('local-model-select');
    if (select.disabled) return;
    const manualValue = document.getElementById('local-model-name').value.trim();
    const hasMatch = Array.from(select.options).some(opt => opt.value && opt.value === manualValue);
    select.value = hasMatch ? manualValue : '';
}

function getLocalModelSourceLabel(source) {
    return source === 'ollama'
        ? t('localModelSourceOllama', 'Ollama /api/tags')
        : t('localModelSourceOpenAI', '/v1/models');
}

function renderDetectedLocalModels(models, source) {
    const select = document.getElementById('local-model-select');
    const manualInput = document.getElementById('local-model-name');
    const hint = document.getElementById('local-model-hint');
    const manualValue = manualInput.value.trim();
    const sourceLabel = getLocalModelSourceLabel(source);

    select.innerHTML = '';

    if (!models.length) {
        resetLocalModelSelect();
        hint.textContent = t(
            'localModelManualHint',
            'If auto-detection fails, you can still enter the model name manually below.'
        );
        return;
    }

    select.add(new Option(t('localModelSelectPlaceholder', 'Choose a detected model...'), ''));
    models.forEach(modelName => select.add(new Option(modelName, modelName)));
    select.disabled = false;

    if (manualValue && models.includes(manualValue)) {
        select.value = manualValue;
    } else if (!manualValue && models.length === 1) {
        select.value = models[0];
        manualInput.value = models[0];
    }

    hint.textContent = t(
        'localModelDetectedHint',
        `Detected via ${sourceLabel}. Selecting a model will fill the field below.`,
        [sourceLabel]
    );
}

async function probeLocalModelCatalog({ interactive = true, reason = 'refresh' } = {}) {
    const endpointInput = document.getElementById('local-model-endpoint');
    const endpoint = normalizeLocalApiBaseUrl(endpointInput.value);
    const requestId = ++localModelFetchSeq;

    endpointInput.value = endpoint;

    if (!endpoint) {
        resetLocalModelSelect();
        document.getElementById('local-model-hint').textContent = t(
            'localModelManualHint',
            'If auto-detection fails, you can still enter the model name manually below.'
        );
        if (interactive) {
            setLocalModelStatus(
                t('localModelStatusNeedEndpoint', 'Enter an endpoint URL first.'),
                'error'
            );
        } else {
            setLocalModelStatus('');
        }
        return null;
    }

    setLocalModelButtonsBusy(true);
    if (interactive) {
        setLocalModelStatus(
            reason === 'test'
                ? t('localModelStatusTesting', 'Testing endpoint and fetching model list...')
                : t('localModelStatusLoading', 'Fetching model list...'),
            'info'
        );
    }

    try {
        const result = await fetchLocalModelCatalog(endpoint);
        if (requestId !== localModelFetchSeq) return null;

        renderDetectedLocalModels(result.models, result.source);
        const sourceLabel = getLocalModelSourceLabel(result.source);

        if (interactive) {
            if (result.models.length) {
                setLocalModelStatus(
                    t(
                        'localModelStatusSuccess',
                        `Connected. Found ${result.models.length} models via ${sourceLabel}.`,
                        [`${result.models.length}`, sourceLabel]
                    ),
                    'success'
                );
            } else {
                setLocalModelStatus(
                    t(
                        'localModelStatusNoModels',
                        `Connected, but no installed models were reported via ${sourceLabel}.`,
                        [sourceLabel]
                    ),
                    'info'
                );
            }
        }
        return result;
    } catch (error) {
        if (requestId !== localModelFetchSeq) return null;

        resetLocalModelSelect();
        document.getElementById('local-model-hint').textContent = t(
            'localModelManualHint',
            'If auto-detection fails, you can still enter the model name manually below.'
        );

        if (interactive) {
            setLocalModelStatus(
                error.message || t('localModelStatusError', 'Could not reach the server or retrieve a model list.'),
                'error'
            );
        } else {
            setLocalModelStatus('');
        }
        return null;
    } finally {
        if (requestId === localModelFetchSeq) {
            setLocalModelButtonsBusy(false);
        }
    }
}

function initLocalModelUiText() {
    document.getElementById('test-local-connection').textContent = t('localModelTestButton', 'Test Connection');
    document.getElementById('refresh-local-models').textContent = t('localModelRefreshButton', 'Refresh Models');
    document.getElementById('local-model-select-label').textContent = t('localModelSelectLabel', 'Detected Models');
    document.getElementById('local-model-manual-hint').textContent = t(
        'localModelManualHint',
        'If auto-detection fails, you can still enter the model name manually below.'
    );
    resetLocalModelSelect();
}

// --- Core Options Logic ---

function save_options() {
    const selectedModelEl = document.querySelector('input[name="model-select"]:checked');
    const selectedModel = selectedModelEl ? selectedModelEl.value : 'gemini-3.1-flash-lite-preview';
    const lang = document.getElementById('display-language').value;
    const prefLangs = getPrefLangValues();
    const aiModeEl = document.querySelector('input[name="ai-mode"]:checked');
    const aiMode = aiModeEl ? aiModeEl.value : 'gemini';
    const normalizedEndpoint = normalizeLocalApiBaseUrl(document.getElementById('local-model-endpoint').value);
    document.getElementById('local-model-endpoint').value = normalizedEndpoint;
    const resolvedLocalModelName = document.getElementById('local-model-name').value.trim() ||
        document.getElementById('local-model-select').value.trim();

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
        localModelEndpoint: normalizedEndpoint,
        localModelName: resolvedLocalModelName
    }, () => {
        showOptionsStatus(chrome.i18n.getMessage('optionsStatusSaved'), 'success');
        setTimeout(() => showOptionsStatus('', ''), 2000);
    });
}

async function restore_options() {
    const items = await chrome.storage.sync.get({
        displayLanguage: 'default',
        geminiApiKey: '',
        translationModel: 'gemini-3.1-flash-lite-preview',
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
    });
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
    resetLocalModelSelect();
    document.getElementById('local-model-hint').textContent = t(
        'localModelManualHint',
        'If auto-detection fails, you can still enter the model name manually below.'
    );
    setLocalModelStatus('');
    updateAiModePanels('gemini');

    chrome.storage.sync.set({
        geminiApiKey: '',
        translationModel: 'gemini-3.1-flash-lite-preview',
        prefLangs: ['', '', ''],
        prefLangA: '', prefLangB: '',
        preset_a: '', preset_b: '', preset_c: '', preset_d: '',
        preset_e: '', preset_f: '', preset_g: '',
        aiMode: 'gemini',
        localModelEndpoint: 'http://localhost:11434/v1',
        localModelName: 'llama3.2'
    }, () => {
        showOptionsStatus(chrome.i18n.getMessage('optionsStatusReset'), 'success');
        setTimeout(() => showOptionsStatus('', ''), 2500);
    });
}

// --- Main Execution ---
document.addEventListener('DOMContentLoaded', async () => {
    document.title = chrome.i18n.getMessage('optionsTitle');
    initLocalModelUiText();

    // Populate display language selector
    const displayLangSelect = document.getElementById('display-language');
    const defaultOption = new Option(chrome.i18n.getMessage('optionsDisplayLangDefault'), 'default');
    displayLangSelect.add(defaultOption);
    await populateLanguageSelector(displayLangSelect, { isDisplayLangSelector: true });

    // Populate the two supported-language selects in the pref-lang list
    populatePrefLangSelects();

    document.getElementById('test-local-connection').addEventListener('click', () => {
        probeLocalModelCatalog({ interactive: true, reason: 'test' });
    });
    document.getElementById('refresh-local-models').addEventListener('click', () => {
        probeLocalModelCatalog({ interactive: true, reason: 'refresh' });
    });
    document.getElementById('local-model-endpoint').addEventListener('change', () => {
        probeLocalModelCatalog({ interactive: true, reason: 'refresh' });
    });
    document.getElementById('local-model-select').addEventListener('change', syncManualModelWithSelect);
    document.getElementById('local-model-name').addEventListener('input', syncSelectWithManualModel);

    // Restore saved values
    await restore_options();
    await probeLocalModelCatalog({ interactive: false, reason: 'refresh' });

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
