// options.js (v22.7)
// Handles saving and restoring options with the new radio button interface for model selection.

function save_options() {
  const selectedModel = document.querySelector('input[name="model-select"]:checked').value;

  chrome.storage.sync.set({
    geminiApiKey: document.getElementById('api-key').value,
    translationModel: selectedModel,
    logEndpoint: document.getElementById('log-endpoint').value,
    logKey: document.getElementById('log-key').value
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
    logKey: ''
  }, function(items) {
    document.getElementById('api-key').value = items.geminiApiKey;
    document.getElementById('log-endpoint').value = items.logEndpoint;
    document.getElementById('log-key').value = items.logKey;
    
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
