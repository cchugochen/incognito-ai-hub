/**
 * language_manager.js (v27.3)
 * - Manages the list of supported languages for the extension's UI and features.
 * - Added Arabic (ar), German (de), Spanish (es).
 * - Improved language detection: extended Chinese-family mapping, cleaner region-variant handling.
 */

export const supportedLanguages = [
    { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
    { code: 'de', name: 'German', nativeName: 'Deutsch' },
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語' },
    { code: 'ko', name: 'Korean', nativeName: '한국어' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский' },
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
    { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
    { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
    { code: 'zh-TW', name: 'Traditional Chinese', nativeName: '台灣-繁體中文' }
];

export async function getEffectiveUILanguageCode() {
    try {
        const { displayLanguage } = await chrome.storage.sync.get({ displayLanguage: 'default' });
        // 如果使用者已在選項中明確設定語言，則優先使用
        if (displayLanguage && displayLanguage !== 'default') {
            return displayLanguage;
        }

        const uiLang = chrome.i18n.getUILanguage().toLowerCase();
        const langCode = uiLang.split('-')[0];

        // Rule (1): Chinese language family → Traditional Chinese (zh-TW)
        // Covers all regional variants and related languages:
        //   zh-TW (Taiwan), zh-HK (Hong Kong), zh-CN (Mainland China),
        //   zh-SG (Singapore), zh-MO (Macau) — all map to Traditional Chinese
        //   yue (Cantonese / 廣東話, spoken in HK & Guangdong)
        //   wuu (Wu / 吳語, Shanghainese)
        //   nan (Min Nan / 閩南語, Hokkien / Taiwanese)
        //   hak (Hakka / 客家話)
        const CHINESE_FAMILY_CODES = new Set(['zh', 'yue', 'wuu', 'nan', 'hak']);
        if (CHINESE_FAMILY_CODES.has(langCode)) {
            return 'zh-TW';
        }

        // Rule (2): Match base language code against supported list.
        // Regional variants are automatically collapsed (de-AT→de, es-MX→es,
        // pt-BR→pt, ar-SA→ar, etc.). Languages with no match fall through.
        const isSupported = supportedLanguages.some(l => l.code === langCode);
        if (isSupported) {
            return langCode;
        }

        // Rule (3): No supported language found → default to English.
        return 'en';
    } catch (error) {
        console.error("Error getting effective UI language code:", error);
        return 'en'; // 發生錯誤時也預設為英文
    }
}

export async function populateLanguageSelector(selectElement, options = {}) {
    if (!selectElement) return;
    
    selectElement.innerHTML = '';

    // Read new ordered array; fall back to old A/B keys for migration compatibility
    const storedPrefs = await chrome.storage.sync.get({ prefLangs: null, prefLangA: '', prefLangB: '' });
    const prefLangs = storedPrefs.prefLangs
        ?? [storedPrefs.prefLangA, storedPrefs.prefLangB].filter(Boolean);

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
        prefLangs.filter(lang => lang).forEach(lang => {
            const opt = new Option(chrome.i18n.getMessage('langPref', lang), lang);
            selectElement.add(opt);
        });
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