/**
 * scripts/local-api.js (v27.2.3)
 * OpenAI-compatible API utility for local model support (Ollama, LM Studio).
 * Provides shared helpers for incognito.js, reader.js, and background.js.
 */

/**
 * Normalizes a local-model endpoint by trimming whitespace and removing
 * trailing slashes.
 * @param {string} baseUrl
 * @returns {string}
 */
export function normalizeLocalApiBaseUrl(baseUrl) {
    return (baseUrl || '').trim().replace(/\/+$/, '');
}

/**
 * Builds an OpenAI-compatible endpoint URL. Supports both bare host URLs
 * (http://host:port) and versioned roots (http://host:port/v1).
 * @param {string} baseUrl
 * @param {string} path
 * @returns {string}
 */
export function buildOpenAICompatibleUrl(baseUrl, path) {
    const base = normalizeLocalApiBaseUrl(baseUrl);
    if (!base) return '';
    return /\/v\d+$/.test(base) ? `${base}${path}` : `${base}/v1${path}`;
}

/**
 * Builds an Ollama native endpoint URL from either a bare root or a /v1 root.
 * @param {string} baseUrl
 * @param {string} path
 * @returns {string}
 */
export function buildOllamaNativeUrl(baseUrl, path) {
    const base = normalizeLocalApiBaseUrl(baseUrl).replace(/\/v\d+$/, '');
    return base ? `${base}${path}` : '';
}

async function fetchJson(url) {
    let response;
    try {
        response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
    } catch (e) {
        throw new Error(chrome.i18n.getMessage('errorLocalModelConnect'));
    }

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || err.message || `HTTP ${response.status}`);
    }
    return response.json().catch(() => ({}));
}

function uniqueModelNames(names) {
    return Array.from(new Set(
        names
            .map(name => (typeof name === 'string' ? name.trim() : ''))
            .filter(Boolean)
    ));
}

function extractOpenAIModelNames(payload) {
    if (!Array.isArray(payload?.data)) return null;
    return uniqueModelNames(payload.data.map(model => model?.id || model?.name || model?.model));
}

function extractOllamaModelNames(payload) {
    if (!Array.isArray(payload?.models)) return null;
    return uniqueModelNames(payload.models.map(model => model?.name || model?.model));
}

/**
 * Fetches the model catalog from a local AI endpoint.
 * Tries the OpenAI-compatible /v1/models endpoint first, then falls back to
 * Ollama's native /api/tags endpoint.
 * @param {string} baseUrl
 * @returns {Promise<{models: string[], source: 'openai'|'ollama', url: string}>}
 */
export async function fetchLocalModelCatalog(baseUrl) {
    const openAiUrl = buildOpenAICompatibleUrl(baseUrl, '/models');
    if (!openAiUrl) throw new Error(chrome.i18n.getMessage('errorLocalModelConnect'));
    const ollamaUrl = buildOllamaNativeUrl(baseUrl, '/api/tags');
    let openAiModels = null;

    try {
        const payload = await fetchJson(openAiUrl);
        openAiModels = extractOpenAIModelNames(payload);
        if (openAiModels && openAiModels.length > 0) {
            return { models: openAiModels, source: 'openai', url: openAiUrl };
        }
    } catch (openAiError) {
        try {
            const payload = await fetchJson(ollamaUrl);
            const models = extractOllamaModelNames(payload);
            if (models !== null) {
                return { models, source: 'ollama', url: ollamaUrl };
            }
        } catch (ollamaError) {
            throw new Error(ollamaError.message || openAiError.message || chrome.i18n.getMessage('errorLocalModelConnect'));
        }
        throw new Error(openAiError.message || chrome.i18n.getMessage('errorLocalModelConnect'));
    }

    const payload = await fetchJson(ollamaUrl);
    const models = extractOllamaModelNames(payload);
    if (models && models.length > 0) {
        return { models, source: 'ollama', url: ollamaUrl };
    }
    if (openAiModels !== null) {
        return { models: openAiModels, source: 'openai', url: openAiUrl };
    }
    if (models !== null) {
        return { models, source: 'ollama', url: ollamaUrl };
    }
    return { models: [], source: 'openai', url: openAiUrl };
}

/**
 * Sends a chat completion request to an OpenAI-compatible local model endpoint.
 * @param {string} baseUrl - The base URL of the local server (e.g., "http://localhost:11434/v1")
 * @param {string} modelName - The model name to use (e.g., "llama3.2")
 * @param {Array<{role: string, content: string}>} messages - Chat history in OpenAI format
 * @returns {Promise<string>} The assistant's reply text
 * @throws {Error} With a localized error message on failure
 */
export async function localModelCall(baseUrl, modelName, messages) {
    const url = buildOpenAICompatibleUrl(baseUrl, '/chat/completions');
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
 * Derives localModelEnabled from the new aiMode field, with fallback to the
 * legacy localModelEnabled boolean for backward compatibility.
 * @returns {Promise<{localModelEnabled: boolean, localModelEndpoint: string, localModelName: string, aiMode: string}>}
 */
export async function getLocalModelConfig() {
    const items = await chrome.storage.sync.get({
        aiMode: null,
        localModelEnabled: false,
        localModelEndpoint: 'http://localhost:11434/v1',
        localModelName: 'llama3.2'
    });
    // Derive localModelEnabled: use aiMode if set, otherwise fall back to legacy boolean
    const aiMode = items.aiMode ?? (items.localModelEnabled ? 'hybrid' : 'gemini');
    return {
        aiMode,
        localModelEnabled: aiMode === 'hybrid' || aiMode === 'local',
        localModelEndpoint: items.localModelEndpoint,
        localModelName: items.localModelName
    };
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
