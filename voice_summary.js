// voice_summary.js (v28.0.2 - rebrand to PrivoAI)
import { populateLanguageSelector, supportedLanguages } from './scripts/language_manager.js';
import { Readability } from './scripts/readability.js';

// --- Constants ---
const MAX_RECORDING_SECONDS = 900; // 15 minutes

// --- State ---
let activeTabId = 'vs-youtube';
let lastSummaryText = '';
let pendingAudioData = null;   // { mimeType, data } for mic recording
let pendingPdfData = null;     // { base64, mimeType } for PDF upload
let pendingAudioFile = null;   // { mimeType, data } for audio file upload
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let timerInterval = null;
let timerSeconds = 0;
let ttsUtterance = null;

document.addEventListener('DOMContentLoaded', async () => {
    document.title = chrome.i18n.getMessage('vsSummaryTitle') || 'AI朗讀podcast';

    // Apply i18n placeholders (i18n.js handles data-i18n attributes,
    // but placeholders need manual handling)
    applyPlaceholders();

    // Populate language selector
    await populateLanguageSelector(document.getElementById('summary-language'), {
        includeSystemDefault: true,
        includePrefLangs: true,
        defaultValue: 'system-default'
    });

    initTabs();
    initFileUploads();
    initMicTab();

    document.getElementById('use-current-tab-btn').addEventListener('click', fillCurrentTabUrl);
    document.getElementById('vs-process-btn').addEventListener('click', handleProcess);
    document.getElementById('vs-tts-btn').addEventListener('click', handleTts);
    document.getElementById('vs-download-btn').addEventListener('click', handleDownload);
});

// --- i18n placeholders ---
function applyPlaceholders() {
    const map = {
        'yt-url':        'vsYoutubeUrlPlaceholder',
        'webpage-url':   'vsWebpagePlaceholder',
        'vs-text-input': 'vsTextPlaceholder',
        'vs-tts-prompt': 'vsTtsPromptPlaceholder',
    };
    for (const [id, key] of Object.entries(map)) {
        const el = document.getElementById(id);
        if (el) el.placeholder = chrome.i18n.getMessage(key) || el.placeholder;
    }
}

// --- Tab Switching ---
function initTabs() {
    const tabs = document.querySelectorAll('.tab-link');
    const contents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            activeTabId = tab.dataset.tab;
            document.getElementById(activeTabId).classList.add('active');
        });
    });
}

// --- File Uploads ---
function initFileUploads() {
    // Audio file
    const audioBox = document.getElementById('audio-upload-box');
    const audioInput = document.getElementById('audio-file-input');
    const audioName = document.getElementById('audio-file-name');

    audioBox.addEventListener('click', () => audioInput.click());
    audioBox.addEventListener('dragover', e => { e.preventDefault(); audioBox.classList.add('drag-over'); });
    audioBox.addEventListener('dragleave', () => audioBox.classList.remove('drag-over'));
    audioBox.addEventListener('drop', e => {
        e.preventDefault();
        audioBox.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) processAudioFileSelection(file, audioName);
    });
    audioInput.addEventListener('change', () => {
        if (audioInput.files[0]) processAudioFileSelection(audioInput.files[0], audioName);
    });

    // PDF/TXT file
    const pdfBox = document.getElementById('pdf-upload-box');
    const pdfInput = document.getElementById('pdf-file-input');
    const pdfName = document.getElementById('pdf-file-name');

    pdfBox.addEventListener('click', () => pdfInput.click());
    pdfBox.addEventListener('dragover', e => { e.preventDefault(); pdfBox.classList.add('drag-over'); });
    pdfBox.addEventListener('dragleave', () => pdfBox.classList.remove('drag-over'));
    pdfBox.addEventListener('drop', e => {
        e.preventDefault();
        pdfBox.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) processPdfFileSelection(file, pdfName);
    });
    pdfInput.addEventListener('change', () => {
        if (pdfInput.files[0]) processPdfFileSelection(pdfInput.files[0], pdfName);
    });
}

function processAudioFileSelection(file, nameEl) {
    pendingAudioFile = null;
    const reader = new FileReader();
    reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        pendingAudioFile = { mimeType: file.type || 'audio/mpeg', data: base64 };
        nameEl.textContent = file.name;
        nameEl.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function processPdfFileSelection(file, nameEl) {
    pendingPdfData = null;
    if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onloadend = () => {
            pendingPdfData = { text: reader.result };
        };
        reader.readAsText(file);
    } else {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            pendingPdfData = { base64, mimeType: 'application/pdf' };
        };
        reader.readAsDataURL(file);
    }
    nameEl.textContent = file.name;
    nameEl.classList.remove('hidden');
}

// --- Microphone Tab ---
function initMicTab() {
    const recordBtn = document.getElementById('vs-record-btn');
    recordBtn.addEventListener('click', () => {
        if (!isRecording) startRecording();
        else stopRecording();
    });
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: { channelCount: 1, sampleRate: 16000 }
        });
        const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? { mimeType: 'audio/webm;codecs=opus' }
            : {};
        mediaRecorder = new MediaRecorder(stream, options);
        audioChunks = [];
        pendingAudioData = null;

        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = () => {
            const blob = new Blob(audioChunks, { type: 'audio/webm' });
            const fr = new FileReader();
            fr.onloadend = () => {
                pendingAudioData = { mimeType: blob.type, data: fr.result.split(',')[1] };
            };
            fr.readAsDataURL(blob);
            stream.getTracks().forEach(t => t.stop());
        };

        mediaRecorder.start();
        isRecording = true;
        const recordBtn = document.getElementById('vs-record-btn');
        recordBtn.textContent = chrome.i18n.getMessage('voiceButtonStop') || 'Stop';
        recordBtn.classList.add('recording');
        startTimer();
    } catch (err) {
        setStatus(chrome.i18n.getMessage('errorMicPermission') || err.message, true);
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    isRecording = false;
    const recordBtn = document.getElementById('vs-record-btn');
    recordBtn.textContent = chrome.i18n.getMessage('voiceButtonStart') || 'Record';
    recordBtn.classList.remove('recording');
    stopTimer();
}

function startTimer() {
    timerSeconds = 0;
    const timerEl = document.getElementById('vs-timer');
    timerEl.textContent = '00:00';
    timerInterval = setInterval(() => {
        timerSeconds++;
        const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
        const s = (timerSeconds % 60).toString().padStart(2, '0');
        timerEl.textContent = `${m}:${s}`;
        if (timerSeconds >= MAX_RECORDING_SECONDS) {
            stopRecording();
            setStatus(chrome.i18n.getMessage('voiceStatusLimitReached') || 'Recording limit reached.', true);
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// --- Webpage: Use Current Tab ---
async function fillCurrentTabUrl() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        document.getElementById('webpage-url').value = tab.url;
    } else {
        setStatus(chrome.i18n.getMessage('errorNoActiveTab') || 'No valid active tab.', true);
    }
}

// --- Resolve language name from selector ---
function resolveLanguage() {
    const sel = document.getElementById('summary-language');
    const val = sel.value;
    if (!val || val === 'system-default') {
        const uiLang = chrome.i18n.getUILanguage();
        if (uiLang.toLowerCase().startsWith('zh')) return 'Traditional Chinese';
        const found = supportedLanguages.find(l => l.code === uiLang.split('-')[0]);
        return found ? found.name : 'English';
    }
    const found = supportedLanguages.find(l => l.code === val);
    return found ? found.name : val;
}

// --- Main Process Orchestrator ---
async function handleProcess() {
    const processBtn = document.getElementById('vs-process-btn');
    processBtn.disabled = true;
    hideOutput();
    clearStatus();

    try {
        const ttsPrompt = document.getElementById('vs-tts-prompt').value.trim();
        const language = resolveLanguage();

        // Step 1: Gather source content
        setStatus(chrome.i18n.getMessage('vsStatusFetching') || 'Fetching content...');
        const content = await getSourceContent();

        // Step 2: Transcribe audio if needed
        let text = content.text || '';
        if (content.audioData) {
            setStatus(chrome.i18n.getMessage('vsStatusTranscribing') || 'Transcribing audio...');
            const r = await chrome.runtime.sendMessage({
                type: 'TRANSCRIBE_AUDIO_FOR_SUMMARY',
                payload: { audioData: content.audioData, spokenLang: 'auto' }
            });
            if (!r.success) throw new Error(r.error);
            text = r.transcript;
        }

        // Step 3: Summarize
        setStatus(chrome.i18n.getMessage('vsStatusSummarizing') || 'Generating summary...');
        const payload = content.fileData
            ? { fileData: content.fileData, ttsPrompt, language }
            : { text, ttsPrompt, language };

        const r = await chrome.runtime.sendMessage({ type: 'SUMMARIZE_TEXT', payload });
        if (!r.success) throw new Error(r.error);

        lastSummaryText = r.summary;
        clearStatus();
        renderSummary(r.summary);
        showOutput();

    } catch (err) {
        setStatus(err.message, true);
    } finally {
        processBtn.disabled = false;
    }
}

// --- Get source content depending on active tab ---
async function getSourceContent() {
    switch (activeTabId) {

        case 'vs-youtube': {
            const url = document.getElementById('yt-url').value.trim();
            if (!url) throw new Error('Please enter a YouTube URL.');
            const text = await extractYouTubeTranscript(url);
            return { text };
        }

        case 'vs-webpage': {
            const url = document.getElementById('webpage-url').value.trim();
            if (!url) throw new Error('Please enter a webpage URL or use the current tab.');
            const text = await extractWebpageText(url);
            return { text };
        }

        case 'vs-audio': {
            if (!pendingAudioFile) throw new Error('Please select an audio file first.');
            return { audioData: pendingAudioFile };
        }

        case 'vs-pdf': {
            if (!pendingPdfData) throw new Error('Please select a PDF or TXT file first.');
            if (pendingPdfData.text) {
                return { text: pendingPdfData.text };
            }
            return { fileData: { base64: pendingPdfData.base64, mimeType: pendingPdfData.mimeType } };
        }

        case 'vs-text': {
            const text = document.getElementById('vs-text-input').value.trim();
            if (!text) throw new Error('Please paste some text first.');
            return { text };
        }

        case 'vs-mic': {
            if (!pendingAudioData) {
                throw new Error('Please record audio first, then press Generate Voice.');
            }
            return { audioData: pendingAudioData };
        }

        default:
            throw new Error('Unknown source tab.');
    }
}

// --- YouTube Transcript Extraction ---
async function extractYouTubeTranscript(videoUrl) {
    const r = await chrome.runtime.sendMessage({
        type: 'FETCH_EXTERNAL_URL',
        payload: { url: videoUrl }
    });
    if (!r.success) throw new Error(r.error);

    // Extract ytInitialPlayerResponse JSON from the page
    const match = r.text.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var\s|const\s|let\s|window\.|<\/script>)/s);
    if (!match) {
        throw new Error(chrome.i18n.getMessage('errorYoutubeExtract') || 'Could not extract captions. The video may require sign-in or have no captions.');
    }

    let playerResponse;
    try {
        playerResponse = JSON.parse(match[1]);
    } catch {
        throw new Error('Failed to parse YouTube player response.');
    }

    const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks || tracks.length === 0) {
        throw new Error(chrome.i18n.getMessage('vsYoutubeNoCaption') || 'This video has no captions available.');
    }

    // Prefer any track in order: original language auto-captions → any track
    const track = tracks.find(t => t.kind === 'asr') || tracks[0];
    const captionUrl = track.baseUrl;

    const cr = await chrome.runtime.sendMessage({
        type: 'FETCH_EXTERNAL_URL',
        payload: { url: captionUrl }
    });
    if (!cr.success) throw new Error(cr.error);

    // Parse XML captions
    const xml = new DOMParser().parseFromString(cr.text, 'text/xml');
    const segments = Array.from(xml.querySelectorAll('text'))
        .map(n => n.textContent.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim())
        .filter(Boolean);

    if (segments.length === 0) throw new Error('Captions are empty for this video.');
    return segments.join(' ');
}

// --- Webpage Text Extraction via Readability ---
async function extractWebpageText(url) {
    const r = await chrome.runtime.sendMessage({
        type: 'FETCH_EXTERNAL_URL',
        payload: { url }
    });
    if (!r.success) throw new Error(r.error);

    const doc = new DOMParser().parseFromString(r.text, 'text/html');
    // Fix relative URLs
    const base = doc.createElement('base');
    base.href = url;
    doc.head.prepend(base);

    const article = new Readability(doc).parse();
    if (!article || !article.textContent || article.textContent.trim().length < 80) {
        throw new Error(chrome.i18n.getMessage('errorWebpageExtract') || 'Could not extract meaningful text from this page.');
    }
    return `# ${article.title || 'Article'}\n\n${article.textContent.trim()}`;
}

// --- Markdown Rendering (same logic as reader.js renderArticle) ---
function renderSummary(text) {
    const container = document.getElementById('vs-summary-output');
    container.innerHTML = '';
    const lines = text.split('\n');
    let i = 0;
    while (i < lines.length) {
        const line = lines[i].trim();
        if (!line) { i++; continue; }

        if (line.startsWith('|')) {
            const rows = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                rows.push(lines[i].trim());
                i++;
            }
            container.appendChild(buildTable(rows));
            continue;
        }

        let el;
        if (line.startsWith('# ') || line.startsWith('## ')) {
            el = document.createElement('h2');
            el.textContent = line.replace(/^#{1,2} /, '');
        } else if (line.startsWith('### ')) {
            el = document.createElement('h3');
            el.textContent = line.slice(4);
        } else if (line.startsWith('#### ')) {
            el = document.createElement('h4');
            el.textContent = line.slice(5);
        } else if (line.startsWith('> ')) {
            el = document.createElement('blockquote');
            el.textContent = line.slice(2);
        } else if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ')) {
            el = document.createElement('li');
            el.textContent = line.slice(2);
        } else {
            el = document.createElement('p');
            el.textContent = line;
        }
        container.appendChild(el);
        i++;
    }
}

function buildTable(rows) {
    const table = document.createElement('table');
    table.className = 'content-table';
    rows.forEach((row, idx) => {
        const cells = row.split('|').map(c => c.trim()).filter(c => c);
        if (!cells.length) return;
        const tr = document.createElement('tr');
        cells.forEach(cellText => {
            const td = document.createElement(idx === 0 ? 'th' : 'td');
            td.textContent = cellText;
            tr.appendChild(td);
        });
        table.appendChild(tr);
    });
    return table;
}

// --- TTS Playback ---
function handleTts() {
    const btn = document.getElementById('vs-tts-btn');
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        btn.textContent = chrome.i18n.getMessage('vsTtsPlayBtn') || 'Play TTS';
        return;
    }
    if (!lastSummaryText) return;

    const langCode = getSelectedLangCode();
    const utterance = new SpeechSynthesisUtterance(lastSummaryText);
    utterance.lang = langCode;
    utterance.rate = 0.9;

    const voice = pickVoice(langCode);
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
        btn.textContent = chrome.i18n.getMessage('vsTtsStopBtn') || 'Stop TTS';
    };
    utterance.onend = utterance.onerror = () => {
        btn.textContent = chrome.i18n.getMessage('vsTtsPlayBtn') || 'Play TTS';
    };

    ttsUtterance = utterance;
    window.speechSynthesis.speak(utterance);
}

function pickVoice(langCode) {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const lower = langCode.toLowerCase();
    return voices.find(v => v.lang.toLowerCase() === lower)
        || voices.find(v => v.lang.toLowerCase().startsWith(lower.split('-')[0]))
        || null;
}

function getSelectedLangCode() {
    const sel = document.getElementById('summary-language');
    const val = sel.value;
    if (!val || val === 'system-default') return chrome.i18n.getUILanguage();
    return val;
}

// --- Download Audio via Gemini TTS → WAV ---
async function handleDownload() {
    if (!lastSummaryText) return;
    const btn = document.getElementById('vs-download-btn');
    btn.disabled = true;

    setStatus(chrome.i18n.getMessage('vsStatusGeneratingAudio') || 'Generating audio...');
    try {
        const r = await chrome.runtime.sendMessage({
            type: 'GENERATE_TTS',
            payload: { text: lastSummaryText, voiceName: 'Aoede' }
        });
        if (!r.success) throw new Error(r.error);

        const wavBuffer = pcmToWav(r.audioBase64);
        const blob = new Blob([wavBuffer], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'summary.wav';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        clearStatus();
    } catch (err) {
        // Fallback: download as .md if TTS fails
        setStatus((err.message || 'TTS failed') + ' — saving as text instead.', true);
        downloadAsMarkdown();
    } finally {
        btn.disabled = false;
    }
}

function downloadAsMarkdown() {
    const blob = new Blob([lastSummaryText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'summary.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Convert base64 PCM (audio/L16, 16-bit signed, mono, 24000 Hz) to WAV ArrayBuffer.
 * Gemini TTS returns raw PCM; this adds the standard WAV/RIFF header.
 */
function pcmToWav(pcmBase64, sampleRate = 24000) {
    const pcm = Uint8Array.from(atob(pcmBase64), c => c.charCodeAt(0));
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const wavBuffer = new ArrayBuffer(44 + pcm.length);
    const v = new DataView(wavBuffer);

    const set = (off, val, size, le = true) => size === 4 ? v.setUint32(off, val, le) : v.setUint16(off, val, le);
    const str = (off, s) => [...s].forEach((c, i) => v.setUint8(off + i, c.charCodeAt(0)));

    str(0, 'RIFF');
    set(4, 36 + pcm.length, 4);
    str(8, 'WAVE');
    str(12, 'fmt ');
    set(16, 16, 4);            // chunk size
    set(20, 1, 2);             // PCM format
    set(22, numChannels, 2);
    set(24, sampleRate, 4);
    set(28, byteRate, 4);
    set(32, blockAlign, 2);
    set(34, bitsPerSample, 2);
    str(36, 'data');
    set(40, pcm.length, 4);
    new Uint8Array(wavBuffer, 44).set(pcm);
    return wavBuffer;
}

// --- UI Helpers ---
function setStatus(msg, isError = false) {
    const el = document.getElementById('vs-status');
    el.textContent = msg;
    el.className = isError ? 'status-text status-error' : 'status-text status-success';
    el.classList.remove('hidden');
}

function clearStatus() {
    const el = document.getElementById('vs-status');
    el.textContent = '';
    el.classList.add('hidden');
}

function showOutput() {
    document.getElementById('vs-output-section').classList.remove('hidden');
}

function hideOutput() {
    document.getElementById('vs-output-section').classList.add('hidden');
    document.getElementById('vs-summary-output').innerHTML = '';
    lastSummaryText = '';
}
