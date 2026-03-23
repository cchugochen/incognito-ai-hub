/**
 * scripts/gemini-api.js (v27.0)
 * Shared Gemini API utility for all extension pages.
 * Eliminates duplicated URL construction and fetch logic across reader.js, incognito.js, and background.js.
 */

/**
 * Builds the correct Gemini API endpoint URL.
 * Supports both full "models/..." paths and short model names.
 * @param {string} model - The model name (e.g., "gemini-2.5-flash" or "models/gemini-2.5-flash")
 * @param {string} apiKey - The user's Gemini API key
 * @param {string} [method="generateContent"] - The API method to call
 * @returns {string} The full API URL
 */
export function buildGeminiUrl(model, apiKey, method = 'generateContent') {
    const base = 'https://generativelanguage.googleapis.com/v1beta';
    const path = model.startsWith('models/') ? model : `models/${model}`;
    return `${base}/${path}:${method}?key=${apiKey}`;
}

/**
 * Executes a Gemini API call with unified error handling.
 * Handles network errors, API errors, safety blocks, and invalid responses.
 * @param {string} apiUrl - The full API endpoint URL
 * @param {object} payload - The request payload to send as JSON
 * @returns {Promise<string>} The extracted text from the API response
 * @throws {Error} With a localized error message on failure
 */
export async function geminiApiCall(apiUrl, payload) {
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (!response.ok) {
            const errorDetails = result.error?.message || JSON.stringify(result);
            throw new Error(chrome.i18n.getMessage('errorApiRequestFailed', errorDetails) || `API Error: ${errorDetails}`);
        }

        if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
            return result.candidates[0].content.parts[0].text;
        }

        if (result.promptFeedback?.blockReason) {
            throw new Error(chrome.i18n.getMessage('errorApiRejected', result.promptFeedback.blockReason));
        }

        const finishReason = result.candidates?.[0]?.finishReason;
        if (finishReason === 'RECITATION') {
            const err = new Error(chrome.i18n.getMessage('errorApiRecitation'));
            err.code = 'RECITATION';
            throw err;
        }
        if (finishReason && finishReason !== 'STOP') {
            throw new Error(chrome.i18n.getMessage('errorApiStopped', finishReason));
        }

        console.error('[gemini-api] Invalid API response structure:', result);
        throw new Error(chrome.i18n.getMessage('errorApiInvalidResponse'));

    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error(chrome.i18n.getMessage('errorNetwork'));
        }
        throw error;
    }
}

/**
 * Reads the stored API key and translation model from chrome.storage.sync.
 * @param {object} [defaults={}] - Default values to merge with storage result
 * @returns {Promise<{geminiApiKey: string, translationModel: string}>}
 */
export async function getStoredApiConfig(defaults = {}) {
    return chrome.storage.sync.get({
        geminiApiKey: '',
        translationModel: 'gemini-3.1-flash-lite-preview',
        ...defaults
    });
}
