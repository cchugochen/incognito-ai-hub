/**
 * i18n.js
 * A helper script to automatically localize HTML pages.
 * It finds all elements with `data-i18n` attributes and populates them
 * with the corresponding message from the _locales folder.
 */
function resolveMessagePlaceholders(text) {
    if (!text || !text.includes('__MSG_')) return text;
    return text.replace(/__MSG_([A-Za-z0-9_]+)__/g, (match, messageKey) => {
        const localized = chrome.i18n.getMessage(messageKey);
        return localized || match;
    });
}

function localizeDocumentTitle() {
    document.title = resolveMessagePlaceholders(document.title);
}

function localizeHtmlPage() {
    localizeDocumentTitle();

    // Localize elements that have a data-i18n attribute.
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const messageKey = element.getAttribute('data-i18n');
        // Use innerHTML to support simple HTML tags like <b> in messages.json
        element.innerHTML = chrome.i18n.getMessage(messageKey);
    });

    // Localize placeholder attributes.
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const messageKey = element.getAttribute('data-i18n-placeholder');
        element.placeholder = chrome.i18n.getMessage(messageKey);
    });

    // Localize title attributes (for tooltips).
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const messageKey = element.getAttribute('data-i18n-title');
        element.title = chrome.i18n.getMessage(messageKey);
    });
}

// Set document direction for RTL locales.
const RTL_LOCALES = ['ar', 'he', 'fa', 'ur'];
const uiLang = chrome.i18n.getUILanguage().split('-')[0];
document.documentElement.lang = chrome.i18n.getUILanguage();
if (RTL_LOCALES.includes(uiLang)) {
    document.documentElement.setAttribute('dir', 'rtl');
}

// Some pages keep their localized title in a __MSG_*__ placeholder inside <title>.
// Resolve it as soon as this shared script loads to avoid raw placeholders in tabs.
localizeDocumentTitle();

// Run the localization function when the page content is loaded.
document.addEventListener('DOMContentLoaded', localizeHtmlPage);
