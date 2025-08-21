// voice_notes.js (v25.1 - Full Language Integration)
import { populateLanguageSelector } from './scripts/language_manager.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Set document title dynamically
    document.title = chrome.i18n.getMessage('voiceTitle');
    
    const recordBtn = document.getElementById('record-btn');
    const timerDisplay = document.getElementById('timer');
    const statusText = document.getElementById('status-text');
    const audioSourceSelect = document.getElementById('audio-source');
    const spokenLangSelect = document.getElementById('spoken-lang');

    // --- Language Selector Initialization ---
    // Populate the language selector according to the v25.1 plan
    await populateLanguageSelector(spokenLangSelect, { 
        includeSystemDefault: true,
        includePrefLangs: true,
        defaultValue: 'system-default' 
    });
    
    // Add the special "Chinese with English" option after the separator
    const separatorIndex = Array.from(spokenLangSelect.options).findIndex(opt => opt.disabled);
    if (separatorIndex !== -1) {
        const zhEnOption = document.createElement('option');
        zhEnOption.value = "Traditional Chinese with some English";
        zhEnOption.textContent = chrome.i18n.getMessage('voiceLangZhEn');
        spokenLangSelect.insertBefore(zhEnOption, spokenLangSelect.options[separatorIndex]);
    }


    // --- Media Recorder State ---
    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;
    let timerInterval;
    let seconds = 0;
    const MAX_RECORDING_TIME = 600; // 10 minutes

    function setStatus(message, isError = false) {
        statusText.textContent = message;
        statusText.className = isError ? 'status-error' : 'status-success';
        if (!isError && message && message !== chrome.i18n.getMessage('voiceStatusRecording')) {
            setTimeout(() => setStatus(''), 3000);
        }
    }

    async function initializeAudio() {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioDevices = devices.filter(device => device.kind === 'audioinput');
            
            if (audioDevices.length === 0) {
                setStatus(chrome.i18n.getMessage('voiceStatusNoMic'), true);
                recordBtn.disabled = true;
                return;
            }
            
            audioSourceSelect.innerHTML = '';
            audioDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || chrome.i18n.getMessage('voiceMicLabel', String(index + 1));
                audioSourceSelect.appendChild(option);
            });
            recordBtn.disabled = false;
        } catch (err) {
            setStatus(chrome.i18n.getMessage('voiceStatusNoMicPermission'), true);
            recordBtn.disabled = true;
        }
    }

    recordBtn.addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    async function startRecording() {
        if (recordBtn.disabled) return;
        const deviceId = audioSourceSelect.value;
        if (!deviceId) {
            setStatus(chrome.i18n.getMessage('voiceStatusSelectSource'), true);
            return;
        }
        const constraints = { audio: { deviceId: { exact: deviceId } } };

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            audioChunks = [];
            const mimeType = 'audio/webm; codecs=opus';
            mediaRecorder = new MediaRecorder(stream, { mimeType });

            mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: mimeType });
                processAudio(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setStatus(chrome.i18n.getMessage('voiceStatusRecording'));
            updateUIRecording(true);
        } catch (err) {
            setStatus(chrome.i18n.getMessage('voiceErrorStartRecording', err.message), true);
        }
    }

    function stopRecording() {
        if (mediaRecorder?.state === "recording") {
            mediaRecorder.stop();
            updateUIRecording(false);
        }
    }
    
    function processAudio(audioBlob) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result.split(',')[1];
            const payload = {
                audioData: { mimeType: audioBlob.type, data: base64data },
                spokenLang: spokenLangSelect.value // Pass the selected value directly
            };
            
            setStatus(chrome.i18n.getMessage('voiceStatusSending'));
            recordBtn.disabled = true;

            chrome.runtime.sendMessage({ type: 'PROCESS_VOICE_NOTE', payload: payload }, (response) => {
                if (chrome.runtime.lastError) {
                    setStatus(chrome.i18n.getMessage('voiceStatusCommError', chrome.runtime.lastError.message), true);
                } else if (response && response.success) {
                    setStatus(chrome.i18n.getMessage('voiceStatusSuccess'));
                    setTimeout(() => window.close(), 1500);
                } else {
                    const errorMessage = response?.error || chrome.i18n.getMessage('errorUnknown');
                    setStatus(chrome.i18n.getMessage('voiceStatusFailed', errorMessage), true);
                }
                recordBtn.disabled = false;
            });
        };
        reader.readAsDataURL(audioBlob);
    }

    function updateUIRecording(recording) {
        isRecording = recording;
        if (isRecording) {
            recordBtn.textContent = chrome.i18n.getMessage('voiceButtonStop');
            recordBtn.classList.add('recording');
            startTimer();
        } else {
            recordBtn.textContent = chrome.i18n.getMessage('voiceButtonStart');
            recordBtn.classList.remove('recording');
            stopTimer();
        }
    }

    function startTimer() {
        seconds = 0;
        timerDisplay.textContent = '00:00';
        timerInterval = setInterval(() => {
            seconds++;
            const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
            const secs = (seconds % 60).toString().padStart(2, '0');
            timerDisplay.textContent = `${minutes}:${secs}`;
            if (seconds >= MAX_RECORDING_TIME) stopRecording();
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
    }

    initializeAudio();
});
