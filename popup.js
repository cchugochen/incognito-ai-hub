// popup.js

// RTL support for Arabic locale
if (chrome.i18n.getUILanguage().startsWith('ar')) {
    document.body.setAttribute('dir', 'rtl');
}

// Show Local Only mode notice below the translate-page button
chrome.storage.sync.get({ aiMode: null, localModelEnabled: false }, (items) => {
    const aiMode = items.aiMode ?? (items.localModelEnabled ? 'hybrid' : 'gemini');
    if (aiMode === 'local') {
        document.getElementById('local-mode-webpage-note').classList.remove('hidden');
    }
});

document.getElementById('open-voice-notes').addEventListener('click', () => {
  chrome.tabs.create({ url: 'voice_notes.html' });
  window.close();
});

document.getElementById('open-incognito').addEventListener('click', () => {
  chrome.tabs.create({ url: 'incognito.html' });
  window.close();
});

document.getElementById('open-workbench').addEventListener('click', () => {
  chrome.tabs.create({ url: 'workbench.html' });
  window.close();
});

document.getElementById('process-webpage').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'PROCESS_WEBPAGE' });
  window.close();
});

document.getElementById('open-voice-summary').addEventListener('click', () => {
  chrome.tabs.create({ url: 'voice_summary.html' });
  window.close();
});

document.getElementById('open-dharma').addEventListener('click', () => {
  chrome.tabs.create({ url: 'dharma.html' });
  window.close();
});

document.getElementById('open-tutorial').addEventListener('click', () => {
  chrome.tabs.create({ url: 'tutorial.html' });
  window.close();
});
