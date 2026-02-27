# Incognito AI Hub (v27.1) / 無痕AI工作台

A privacy-first Chrome extension integrating multimodal AI tools for reading, translation, and conversation. All AI requests go directly between your browser and the AI provider — no backend server, no data collection.

「無痕AI工作台」是一款以隱私為核心的 Chrome 擴充功能，整合了多模態 AI 工具，用於閱讀、翻譯與對話。所有 AI 請求直接在瀏覽器與 AI 服務商之間完成，無後台伺服器，不收集任何資料。

---

## Core Features / 核心功能

### 1. Incognito Gemini Chat (3 Tabs) / 無痕 Gemini 對話（3個分頁）

Three independent chat interfaces in one page:

- **Gemini 2.5 Flash** — Fast, cost-effective model. Supports images (up to 4) and PDF uploads.
- **Gemini 2.5 Pro** — Most powerful model, 1M token context. Best for complex documents and multimodal tasks.
- **Local Model** — Chat with your local Ollama or LM Studio model via OpenAI-compatible API. Text only; no API key required.

Completely incognito: all history is stored in page memory only and erased when the tab is closed. Supports 7 preset prompt slots (A–G) for quick reuse.

三個獨立對話介面：
- **Gemini 2.5 Flash** — 快速、性價比高。支援最多 4 張圖片及 PDF 上傳。
- **Gemini 2.5 Pro** — 最強大的模型，百萬 Token 上下文。適合複雜文件與多模態任務。
- **本機模型** — 透過 OpenAI 相容 API 與本機 Ollama 或 LM Studio 模型對話，僅支援文字，無需 API 金鑰。

完全無痕：所有對話紀錄僅存於頁面記憶體，關閉分頁即清除。支援 7 組預設提示語（A–G）快速重複使用。

---

### 2. Smart Translation Workbench / 智慧翻譯工作台

- **Paste Text**: Paste any text for translation using the AI model.
- **Upload Image (OCR)**: Upload or paste a screenshot; the AI extracts and translates the text.

貼上文字或上傳截圖，AI 自動辨識並翻譯。

---

### 3. Full-Page Web Translation / 網頁全文翻譯

One-click capture of the current webpage using the Chrome Debugger API, then OCR and translation by Gemini. Overcomes the limitations of traditional translation tools that can't handle canvas-rendered or dynamically-loaded content.

一鍵擷取當前網頁截圖，透過 Gemini 進行 OCR 辨識與翻譯。能處理傳統翻譯工具難以應對的動態渲染頁面。

---

### 4. Incognito Voice Notes / 無痕語音輸入筆記

Record voice (up to 15 minutes) or upload an audio file. Gemini transcribes the speech with speaker diarization. The result opens in the Reader page where you can click any paragraph to translate it instantly.

錄音（最長15分鐘）或上傳音訊檔，Gemini 進行語音轉錄並區分說話者。結果在閱讀器頁面開啟，點選任意段落即可立即翻譯。

---

### 5. Reader Page / 閱讀器頁面

Displays transcribed or extracted text with:
- Click-to-translate for any paragraph (routes to local model if enabled, otherwise Gemini)
- Adjustable font size, line height, and background color (White / Sepia / Dark)
- Voice translation tool for bulk translation of transcribed text
- Save content as `.txt` file

顯示轉錄或擷取的文字，支援：
- 點選段落立即翻譯（優先使用本機模型，否則使用 Gemini）
- 可調整字體大小、行距、背景顏色（白色／米色／深色）
- 語音翻譯工具（對語音轉錄內容進行整體翻譯）
- 儲存為 `.txt` 檔案

---

### 6. Local AI Model Support (v27.1) / 本機 AI 模型支援

Connect to **Ollama** or **LM Studio** (or any OpenAI-compatible server) for privacy-first, offline AI:

- Configure the API endpoint URL and model name in Options
- Supports any HTTP endpoint, including LAN IPs (e.g., `http://192.168.1.x:1234/v1`)
- When enabled, text translation in Reader and Incognito Chat routes to the local model

在「選項」頁面設定 API 端點 URL 與模型名稱，即可使用本機 AI 模型：
- 支援任何 HTTP 端點，包含區域網路 IP
- 啟用後，閱讀器的點擊翻譯與無痕對話的本機分頁將改走本機模型

---

## Privacy & Security / 隱私與安全

- **Bring Your Own Key (BYOK)**: All Gemini requests use your own API key directly between your browser and Google's servers.
- **No Backend Server**: The extension runs entirely on your local machine.
- **No Data Collection**: We do not collect, log, or store any content you process (text, images, or voice).
- **Local Model Option**: Use Ollama/LM Studio for fully offline AI — your data never leaves your network.

See the full [Privacy Policy](privacy.html) for details.

---

## Installation / 安裝

**Recommended**: Install from the [Chrome Web Store](https://chrome.google.com/webstore).

**Manual Installation**:
1. Download the ZIP file and unzip it.
2. In Chrome, go to `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

---

## First-Time Setup / 首次設定

1. Right-click the extension icon → **Options**.
2. Paste your **Google Gemini API key** into the API Key field and click **Save Settings**.
3. *(Optional)* In the **Local AI Model** section, enter your Ollama or LM Studio endpoint and model name to use a local model.

Refer to the built-in **[Tutorial (📖)](tutorial.html)** (accessible from the popup) for a step-by-step guide to getting a free Gemini API key.

---

## Popup Menu Order / 快捷選單順序

| Button | Function |
|--------|----------|
| 🎙️ Voice Notes | Open voice recording / transcription |
| 💬 Incognito Gemini Chat | Open 3-tab AI chat |
| 🔧 Smart Translation Workbench | Open text/image translation |
| 🌐 Translate Current Page | Capture & translate active tab |
| 📖 Tutorial | How to get a Gemini API key |

---

## Tech Stack / 技術堆疊

- HTML, CSS, JavaScript (ES6 Modules)
- Chrome Extension Manifest V3
- Google Gemini API (`gemini-2.5-flash`, `gemini-2.5-pro`)
- OpenAI-compatible API format (`/v1/chat/completions`) for local models
- Module architecture: `scripts/gemini-api.js`, `scripts/local-api.js`, `scripts/language_manager.js`
- i18n support: 9 locales (en, zh_TW, ja, ko, pt, ru, tr, uk, vi)

---

## Contribution & Support / 貢獻與支持

Contributions of any kind are welcome — bug reports via GitHub Issues, feature suggestions, or Pull Requests.

If this tool has been helpful, consider [buying me a coffee](https://www.buymeacoffee.com/hugocc0825) to support continued development!

歡迎任何形式的貢獻。如果本工具對您有所幫助，歡迎請我喝杯飲料以支持持續開發！

---

## License / 版權

Copyright (c) 2025 Dr. Cheng-Che Chen. All Rights Reserved.
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
