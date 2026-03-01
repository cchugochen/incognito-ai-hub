/**
 * scripts/local-api.js (v27.1)
 * OpenAI-compatible API utility for local model support (Ollama, LM Studio).
 * Provides shared helpers for incognito.js, reader.js, and background.js.
 */

/**
 * Sends a chat completion request to an OpenAI-compatible local model endpoint.
 * @param {string} baseUrl - The base URL of the local server (e.g., "http://localhost:11434/v1")
 * @param {string} modelName - The model name to use (e.g., "llama3.2")
 * @param {Array<{role: string, content: string}>} messages - Chat history in OpenAI format
 * @returns {Promise<string>} The assistant's reply text
 * @throws {Error} With a localized error message on failure
 */
export async function localModelCall(baseUrl, modelName, messages) {
    // Normalize: support both "http://host:port" and "http://host:port/v1"
    const base = baseUrl.replace(/\/$/, '');
    const url = /\/v\d+$/.test(base) ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelName, messages, stream: false })
        });
    } catch (e) {
        throw new Error(chrome.i18n.getMessage('errorLocalModelConnect'));
    }
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${response.status}`);
    }
    const result = await response.json();
    const text = result.choices?.[0]?.message?.content;
    if (!text) throw new Error(chrome.i18n.getMessage('errorLocalModelFailed'));
    return text;
}

/**
 * Reads local model configuration from chrome.storage.sync.
 * @returns {Promise<{localModelEnabled: boolean, localModelEndpoint: string, localModelName: string}>}
 */
export async function getLocalModelConfig() {
    return chrome.storage.sync.get({
        localModelEnabled: false,
        localModelEndpoint: 'http://localhost:11434/v1',
        localModelName: 'llama3.2'
    });
}

/**
 * Translates text using the local model.
 * @param {string} text - The source text to translate
 * @param {string} targetLanguage - Target language name (e.g., "Traditional Chinese")
 * @param {string} baseUrl - Local model endpoint URL
 * @param {string} modelName - Model name to use
 * @returns {Promise<string>} The translated text
 */
export async function localModelTranslate(text, targetLanguage, baseUrl, modelName) {
    const messages = [
        {
            role: 'system',
            content: `You are an expert translator. Translate the following text into fluent, natural ${targetLanguage}. Output only the translated text itself, without any additional comments or explanations.`
        },
        { role: 'user', content: text }
    ];
    return localModelCall(baseUrl, modelName, messages);
}
