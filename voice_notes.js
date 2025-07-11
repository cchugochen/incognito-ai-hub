// voice_notes.js (v19.4)
// - Ensured correct payload structure for background script.
// - Refined UI state management.
document.addEventListener('DOMContentLoaded', () => {
    const recordBtn = document.getElementById('record-btn');
    const timerDisplay = document.getElementById('timer');
    const statusText = document.getElementById('status-text');
    const audioSourceSelect = document.getElementById('audio-source');
    const spokenLangSelect = document.getElementById('spoken-lang');

    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;
    let timerInterval;
    let seconds = 0;
    const MAX_RECORDING_TIME = 600;

    function setStatus(message, isError = false) {
        statusText.textContent = message;
        statusText.style.color = isError ? '#dc3545' : '#007aff';
        if (!isError && message !== '錄音中...') {
            setTimeout(() => setStatus(''), 3000);
        }
    }

    async function initializeAudio() {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioDevices = devices.filter(device => device.kind === 'audioinput');
            
            if (audioDevices.length === 0) {
                setStatus('找不到麥克風裝置。', true);
                recordBtn.disabled = true;
                return;
            }
            
            audioSourceSelect.innerHTML = '';
            audioDevices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `麥克風 ${audioSourceSelect.length + 1}`;
                audioSourceSelect.appendChild(option);
            });
        } catch (err) {
            setStatus('無法取得麥克風權限。請檢查瀏覽器設定。', true);
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
            updateUIRecording(true);
        } catch (err) {
            setStatus('無法啟動錄音，請檢查裝置。', true);
        }
    }

    function stopRecording() {
        if (mediaRecorder?.state === "recording") {
            mediaRecorder.stop();
        }
    }
    
    function processAudio(audioBlob) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result.split(',')[1];
            // This is the correct payload structure expected by background.js v19.3+
            const payload = {
                audioData: { mimeType: audioBlob.type, data: base64data },
                spokenLang: spokenLangSelect.value
            };
            
            setStatus('正在傳送至 AI 進行辨識...');
            recordBtn.disabled = true;

            chrome.runtime.sendMessage({ type: 'PROCESS_VOICE_NOTE', payload: payload }, (response) => {
                if (response && response.success) {
                    setStatus('辨識完成，已開啟新分頁。');
                    setTimeout(() => window.close(), 1500);
                } else {
                    const errorMessage = response?.error || '發生未知錯誤。';
                    setStatus(`辨識失敗: ${errorMessage}`, true);
                }
                recordBtn.disabled = false;
                updateUIRecording(false); // Reset UI after processing
            });
        };
        reader.readAsDataURL(audioBlob);
    }

    function updateUIRecording(recording) {
        isRecording = recording;
        if (isRecording) {
            recordBtn.textContent = '停止錄音';
            recordBtn.classList.add('recording');
            startTimer();
        } else {
            recordBtn.textContent = '開始錄音';
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
