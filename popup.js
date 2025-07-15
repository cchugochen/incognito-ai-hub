// popup.js
document.getElementById('process-webpage').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'PROCESS_WEBPAGE' });
  window.close();
});

document.getElementById('open-workbench').addEventListener('click', () => {
  chrome.tabs.create({ url: 'workbench.html' });
  window.close();
});

document.getElementById('open-voice-notes').addEventListener('click', () => {
  chrome.tabs.create({ url: 'voice_notes.html' });
  window.close();
});

// v23.0: Add listener for the incognito chat page
document.getElementById('open-incognito').addEventListener('click', () => {
  chrome.tabs.create({ url: 'incognito.html' });
  window.close();
});

document.getElementById('open-tutorial').addEventListener('click', () => {
  chrome.tabs.create({ url: 'tutorial.html' });
  window.close();
});

document.getElementById('show-license').addEventListener('click', () => {
  chrome.tabs.create({ url: 'LICENSE' });
  window.close();
});
