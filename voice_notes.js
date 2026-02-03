// voice_notes.js (v26.3 - Increased Limit to 15 mins)
import { populateLanguageSelector } from './scripts/language_manager.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Set document title dynamically
    document.title = chrome.i18n.getMessage('voiceTitle');
    
    const recordBtn = document.getElementById('record-btn');
    const timerDisplay = document.getElementById('timer');
    const statusText = document.getElementById('status-text');
    const audioSourceSelect = document.getElementById('audio-source');
    const spokenLangSelect = document.getElementById('spoken-lang');

    // --- Configuration ---
    // Limit set to 15 minutes (900 seconds) to stay within the ~20MB inline payload limit (including Base64 overhead).
    const MAX_RECORDING_TIME = 900; 

    // --- Language Selector Initialization ---
    await populateLanguageSelector(spokenLangSelect, { 
        includeSystemDefault: true,
        includePrefLangs: true,
        defaultValue: 'system-default' 
    });
    
    // Add the special "Chinese with English" option
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

    // --- Audio Source Initialization ---
    async function initializeAudio() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
            
            audioSourceSelect.innerHTML = '';
            audioInputDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || chrome.i18n.getMessage('voiceMicLabel', String(index + 1));
                audioSourceSelect.appendChild(option);
            });

            if (audioInputDevices.length === 0) {
                setStatus(chrome.i18n.getMessage('errorNoMic'), true);
                recordBtn.disabled = true;
            }
        } catch (err) {
            console.error('Error listing audio devices:', err);
            setStatus(chrome.i18n.getMessage('errorMicPermission', err.message), true);
            recordBtn.disabled = true;
        }
    }

    function setStatus(msg, isError = false) {
        statusText.textContent = msg;
        statusText.className = isError ? 'status-error' : 'status-success';
    }

    // --- Recording Control ---
    recordBtn.addEventListener('click', async () => {
        if (!isRecording) {
            startRecording();
        } else {
            stopRecording();
        }
    });

    async function startRecording() {
        const deviceId = audioSourceSelect.value;
        const constraints = { 
            audio: { 
                deviceId: deviceId ? { exact: deviceId } : undefined,
                channelCount: 1, // Mono is sufficient for speech and saves space
                sampleRate: 16000 // Lower sample rate is sufficient for speech
            } 
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            // Prefer webm/opus for efficiency
            const options = { mimeType: 'audio/webm;codecs=opus' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.warn(`${options.mimeType} not supported, falling back to default.`);
                delete options.mimeType;
            }

            mediaRecorder = new MediaRecorder(stream, options);
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                processAudio(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            updateUIRecording(true);
            setStatus(chrome.i18n.getMessage('voiceStatusRecording'));
        } catch (err) {
            console.error('Error starting recording:', err);
            setStatus(chrome.i18n.getMessage('errorMicPermission', err.message), true);
        }
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            updateUIRecording(false);
        }
    }

    function processAudio(audioBlob) {
        setStatus(chrome.i18n.getMessage('voiceStatusTranscribing'));
        recordBtn.disabled = true;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64Audio = reader.result.split(',')[1];
            const mimeType = audioBlob.type || 'audio/webm';
            
            const payload = {
                audioData: {
                    mimeType: mimeType,
                    data: base64Audio
                },
                spokenLang: spokenLangSelect.value
            };

            chrome.runtime.sendMessage({ type: 'PROCESS_VOICE_NOTE', payload: payload }, (response) => {
                if (chrome.runtime.lastError) {
                    setStatus(chrome.i18n.getMessage('voiceStatusFailed', chrome.runtime.lastError.message), true);
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
        timerDisplay.classList.remove('limit-warning'); // Reset warning class
        
        timerInterval = setInterval(() => {
            seconds++;
            const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
            const secs = (seconds % 60).toString().padStart(2, '0');
            timerDisplay.textContent = `${minutes}:${secs}`;
            
            // Visual warning when close to limit (e.g., last 1 minute)
            if (MAX_RECORDING_TIME - seconds <= 60) {
                 timerDisplay.classList.add('limit-warning');
            }

            if (seconds >= MAX_RECORDING_TIME) {
                stopRecording();
                setStatus(chrome.i18n.getMessage('voiceStatusLimitReached'), true);
            }
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
    }

    // --- File Upload Handling (New Feature Support) ---
    // If you plan to add file upload for voice notes in the future, 
    // the logic would go here similar to the incognito page.
    // For now, keeping it focused on recording as per request.

    initializeAudio();
});