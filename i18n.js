/**
 * i18n.js
 * A helper script to automatically localize HTML pages.
 * It finds all elements with `data-i18n` attributes and populates them
 * with the corresponding message from the _locales folder.
 */
function localizeHtmlPage() {
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

// Run the localization function when the page content is loaded.
document.addEventListener('DOMContentLoaded', localizeHtmlPage);
