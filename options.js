// options.js (v24.0)
// - Added support for saving and restoring 5 preset prompts.

function save_options() {
  const selectedModel = document.querySelector('input[name="model-select"]:checked').value;

  chrome.storage.sync.set({
    geminiApiKey: document.getElementById('api-key').value,
    translationModel: selectedModel,
    logEndpoint: document.getElementById('log-endpoint').value,
    logKey: document.getElementById('log-key').value,
    // (2) 儲存預設提示語
    preset_a: document.getElementById('preset-prompt-a').value,
    preset_b: document.getElementById('preset-prompt-b').value,
    preset_c: document.getElementById('preset-prompt-c').value,
    preset_d: document.getElementById('preset-prompt-d').value,
    preset_e: document.getElementById('preset-prompt-e').value
  }, function() {
    const status = document.getElementById('status');
    status.textContent = '設定已儲存。';
    setTimeout(() => { status.textContent = ''; }, 1500);
  });
}

function restore_options() {
  chrome.storage.sync.get({
    geminiApiKey: '',
    translationModel: 'gemini-2.0-flash', // Default model
    logEndpoint: '',
    logKey: '',
    // (2) 讀取預設提示語的預設值
    preset_a: '',
    preset_b: '',
    preset_c: '',
    preset_d: '',
    preset_e: ''
  }, function(items) {
    document.getElementById('api-key').value = items.geminiApiKey;
    document.getElementById('log-endpoint').value = items.logEndpoint;
    document.getElementById('log-key').value = items.logKey;
    
    // (2) 還原預設提示語到輸入框
    document.getElementById('preset-prompt-a').value = items.preset_a;
    document.getElementById('preset-prompt-b').value = items.preset_b;
    document.getElementById('preset-prompt-c').value = items.preset_c;
    document.getElementById('preset-prompt-d').value = items.preset_d;
    document.getElementById('preset-prompt-e').value = items.preset_e;

    // Find the radio button that corresponds to the saved model and check it.
    const savedModelRadio = document.querySelector(`input[name="model-select"][value="${items.translationModel}"]`);
    if (savedModelRadio) {
      savedModelRadio.checked = true;
    } else {
      // If the saved model is not found (e.g., it was removed), default to the first one.
      document.querySelector('input[name="model-select"]').checked = true;
    }
  });
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
