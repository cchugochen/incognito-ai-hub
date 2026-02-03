/**
 * language_manager.js (v25.2 - Finalized)
 * - Manages the list of supported languages for the extension's UI and features.
 * - Provides functions to determine the effective language based on user settings and browser defaults.
 * - Provides a flexible function to populate language <select> elements with various options including preferred languages.
 */

export const supportedLanguages = [
    { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語' },
    { code: 'ko', name: 'Korean', nativeName: '한국어' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский' },
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
    { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
    { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
    { code: 'zh-TW', name: 'Traditional Chinese', nativeName: '台灣-繁體中文' }
];

// language_manager.js (After - v26)
export async function getEffectiveUILanguageCode() {
    try {
        const { displayLanguage } = await chrome.storage.sync.get({ displayLanguage: 'default' });
        // 如果使用者已在選項中明確設定語言，則優先使用
        if (displayLanguage && displayLanguage !== 'default') {
            return displayLanguage;
        }

        const uiLang = chrome.i18n.getUILanguage().toLowerCase();
        
        // 規則 (1): 如果系統是任何中文語系，預設為繁體中文
        if (uiLang.startsWith('zh')) {
            return 'zh-TW';
        }

        // 規則 (2): 檢查系統語言是否在支援的 11 種語言列表中
        const langCode = uiLang.split('-')[0];
        const isSupported = supportedLanguages.some(l => l.code === langCode);
        if (isSupported) {
            return langCode;
        }

        // 規則 (3): 若以上皆非，則預設為英文
        return 'en';
    } catch (error) {
        console.error("Error getting effective UI language code:", error);
        return 'en'; // 發生錯誤時也預設為英文
    }
}

export async function populateLanguageSelector(selectElement, options = {}) {
    if (!selectElement) return;
    
    selectElement.innerHTML = '';

    const storedPrefs = await chrome.storage.sync.get({ prefLangA: '', prefLangB: '' });

    if (options.includeSystemDefault) {
        const code = await getEffectiveUILanguageCode();
        const langName = supportedLanguages.find(l => l.code === code)?.name || 'English';
        const opt = new Option(chrome.i18n.getMessage('langSystemDefault', langName), 'system-default');
        selectElement.add(opt);
    }
    
    if (options.includeAutoDetect) {
        const opt = new Option(chrome.i18n.getMessage('langAutoDetect'), 'auto');
        selectElement.add(opt);
    }

    if (options.includePrefLangs) {
        if (storedPrefs.prefLangA) {
            const opt = new Option(chrome.i18n.getMessage('langPrefA', storedPrefs.prefLangA), storedPrefs.prefLangA);
            selectElement.add(opt);
        }
        if (storedPrefs.prefLangB) {
            const opt = new Option(chrome.i18n.getMessage('langPrefB', storedPrefs.prefLangB), storedPrefs.prefLangB);
            selectElement.add(opt);
        }
    }

    if (selectElement.options.length > 0 && !options.isDisplayLangSelector) {
        const separator = new Option('──────────', '');
        separator.disabled = true;
        selectElement.add(separator);
    }

    supportedLanguages.forEach(lang => {
        let displayName;
        if (options.isDisplayLangSelector) {
            displayName = `${lang.nativeName}/${lang.name}/#${lang.code}`;
        } else {
            displayName = `${lang.nativeName} / ${lang.name}`;
        }
        const optionValue = options.isDisplayLangSelector ? lang.code : lang.name;
        const opt = new Option(displayName, optionValue);
        selectElement.add(opt);
    });

    if (options.defaultValue) {
        selectElement.value = options.defaultValue;
    }
}
