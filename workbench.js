// workbench.js (v25.1 - Full Language Integration)
import { populateLanguageSelector, getEffectiveUILanguageCode, supportedLanguages } from './scripts/language_manager.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Set document title dynamically
    document.title = chrome.i18n.getMessage('workbenchTitle');

    // --- Language Selector Initialization ---
    const textSourceLang = document.getElementById('text-source-lang');
    const textTargetLang = document.getElementById('text-target-lang');
    const imgSourceLang = document.getElementById('img-source-lang');
    const imgTargetLang = document.getElementById('img-target-lang');
    
    // Populate selectors according to the v25.1 plan
    await populateLanguageSelector(textSourceLang, { 
        includeAutoDetect: true, 
        includePrefLangs: true, 
        defaultValue: 'auto' 
    });
    await populateLanguageSelector(textTargetLang, { 
        includeSystemDefault: true, 
        includePrefLangs: true, 
        defaultValue: 'system-default' 
    });
    await populateLanguageSelector(imgSourceLang, { 
        includeAutoDetect: true, 
        includePrefLangs: true, 
        defaultValue: 'auto' 
    });
    await populateLanguageSelector(imgTargetLang, { 
        includeSystemDefault: true, 
        includePrefLangs: true, 
        defaultValue: 'system-default' 
    });


    // --- Tab Functionality ---
    const tabs = document.querySelectorAll('.tab-link');
    const contents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('active'));
            contents.forEach(item => item.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // --- Status & Text Processing ---
    const statusText = document.getElementById('status-text');
    const textInput = document.getElementById('text-input');
    const processTextBtn = document.getElementById('process-text-btn');

    function setStatus(message, isError = false) {
        statusText.textContent = message;
        statusText.className = isError ? 'status-error' : 'status-success';
        if (!isError && message) {
            setTimeout(() => statusText.textContent = '', 3000);
        }
    }

    processTextBtn.addEventListener('click', async () => {
        const text = textInput.value.trim();
        if (text.length === 0) {
            setStatus(chrome.i18n.getMessage("statusPleasePaste"), true);
            return;
        }
        setStatus(chrome.i18n.getMessage("statusProcessing"));
        processTextBtn.disabled = true;
        
        const payload = {
            text: text,
            targetLang: textTargetLang.value, // Pass the selected value directly
            sourceLang: textSourceLang.value 
        };

        chrome.runtime.sendMessage({ type: 'PROCESS_PASTED_TEXT', payload: payload }, (response) => {
            if (chrome.runtime.lastError) {
                setStatus(chrome.i18n.getMessage("statusFailed", chrome.runtime.lastError.message), true);
            } else if (response && response.success) {
                setStatus(chrome.i18n.getMessage("statusSuccess"));
                setTimeout(() => window.close(), 1500);
            } else {
                const errorMessage = response?.error || 'Unknown error.';
                setStatus(chrome.i18n.getMessage("statusFailed", errorMessage), true);
            }
            processTextBtn.disabled = false;
        });
    });

    // --- Image Processing ---
    const uploadBox = document.getElementById('upload-box');
    const fileInput = document.getElementById('file-input');
    const previewImage = document.getElementById('preview-image');
    const uploadPlaceholder = document.getElementById('upload-placeholder');
    const processImageBtn = document.getElementById('process-image-btn');
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
            setStatus(chrome.i18n.getMessage("errorPleaseUploadImage"), true);
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

    processImageBtn.addEventListener('click', async () => {
        if (!fileData) return;
        processImageBtn.disabled = true;
        setStatus(chrome.i18n.getMessage("statusUploading"));
        
        const payload = {
            imageData: fileData,
            sourceLang: imgSourceLang.value,
            targetLang: imgTargetLang.value // Pass the selected value directly
        };

        chrome.runtime.sendMessage({ type: 'PROCESS_UPLOADED_FILE', payload: payload }, (response) => {
             if (chrome.runtime.lastError) {
                setStatus(chrome.i18n.getMessage("statusFailed", chrome.runtime.lastError.message), true);
            } else if (response && response.success) {
                setStatus(chrome.i18n.getMessage("statusUploadSuccess"));
                setTimeout(() => window.close(), 1500);
            } else {
                const errorMessage = response?.error || 'Unknown error.';
                setStatus(chrome.i18n.getMessage("statusFailed", errorMessage), true);
            }
            processImageBtn.disabled = false;
        });
    });
});
