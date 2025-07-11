// workbench.js (v19.3)
document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-link');
    const contents = document.querySelectorAll('.tab-content');
    const statusText = document.getElementById('status-text');

    // Tab 切換邏輯
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('active'));
            contents.forEach(item => item.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // --- 通用狀態設定函數 ---
    function setStatus(message, isError = false) {
        statusText.textContent = message;
        statusText.style.color = isError ? '#dc3545' : '#007bff';
        if (!isError) {
            setTimeout(() => statusText.textContent = '', 3000);
        }
    }

    // --- 文字貼上模式 ---
    const textInput = document.getElementById('text-input');
    const processTextBtn = document.getElementById('process-text-btn');
    const textTargetLang = document.getElementById('text-target-lang');

    processTextBtn.addEventListener('click', () => {
        const text = textInput.value.trim();
        if (text.length === 0) {
            setStatus('請先貼上文字。', true);
            return;
        }
        setStatus('處理中...');
        processTextBtn.disabled = true;
        
        const payload = {
            text: text,
            targetLang: textTargetLang.value
            // sourceLang 在此模式下由 AI 自動偵測，故不傳遞
        };

        chrome.runtime.sendMessage({ type: 'PROCESS_PASTED_TEXT', payload: payload }, (response) => {
            if (response && response.success) {
                setStatus('處理成功！正在打開閱讀模式...');
                setTimeout(() => window.close(), 1500);
            } else {
                const errorMessage = response?.error || '發生未知錯誤。';
                setStatus(`處理失敗: ${errorMessage}`, true);
            }
            processTextBtn.disabled = false;
        });
    });

    // --- 截圖上傳模式 ---
    const uploadBox = document.getElementById('upload-box');
    const fileInput = document.getElementById('file-input');
    const previewImage = document.getElementById('preview-image');
    const uploadPlaceholder = document.getElementById('upload-placeholder');
    const processImageBtn = document.getElementById('process-image-btn');
    const imgSourceLang = document.getElementById('img-source-lang');
    const imgTargetLang = document.getElementById('img-target-lang');
    let fileData = null;

    uploadBox.addEventListener('click', () => fileInput.click());
    uploadBox.addEventListener('dragover', e => { e.preventDefault(); uploadBox.classList.add('dragover'); });
    uploadBox.addEventListener('dragleave', () => uploadBox.classList.remove('dragover'));
    uploadBox.addEventListener('drop', e => {
        e.preventDefault();
        uploadBox.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', e => {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });

    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            setStatus('錯誤：請上傳圖片檔案。', true);
            return;
        }
        const reader = new FileReader();
        reader.onload = e => {
            previewImage.src = e.target.result;
            previewImage.classList.remove('hidden');
            uploadPlaceholder.classList.add('hidden');
            processImageBtn.classList.remove('hidden');
            setStatus('');
            fileData = e.target.result.split(',')[1];
        };
        reader.readAsDataURL(file);
    }

    processImageBtn.addEventListener('click', () => {
        if (!fileData) return;
        processImageBtn.disabled = true;
        setStatus('正在發送到 AI 進行辨識...');
        
        const payload = {
            imageData: fileData,
            sourceLang: imgSourceLang.value,
            targetLang: imgTargetLang.value
        };

        chrome.runtime.sendMessage({ type: 'PROCESS_UPLOADED_FILE', payload: payload }, (response) => {
            if (response && response.success) {
                setStatus('辨識成功！正在打開閱讀模式...');
                setTimeout(() => window.close(), 1500);
            } else {
                const errorMessage = response?.error || '發生未知錯誤。';
                setStatus(`辨識失敗: ${errorMessage}`, true);
            }
            processImageBtn.disabled = false;
        });
    });
});
