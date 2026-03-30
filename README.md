# PrivoAI 無痕AI工作台 (v28.1)

A privacy-first Chrome extension integrating multimodal AI tools for reading, translation, conversation, and mindfulness. All AI requests go directly between your browser and the AI provider — no backend server, no data collection.

「無痕AI工作台」是一款以隱私為核心的 Chrome 擴充功能，整合了多模態 AI 工具，用於閱讀、翻譯、對話與心靈正念。所有 AI 請求直接在瀏覽器與 AI 服務商之間完成，無後台伺服器，不收集任何資料。

---

## Changelog / 更新紀錄

### v28.1.2 — Dark Mode Auto-Detection & Footer Layout / 深色模式自動偵測 & Footer 捲動佈局

- **Reader dark-mode auto-detect**: `reader.html` now applies `bg-dark` automatically on first load when OS is in dark mode (`prefers-color-scheme: dark`). Manual theme buttons still override. Preference saved to `localStorage` (`reader-bg` key).
- **Reader CSS flash fix**: Added `@media (prefers-color-scheme: dark)` on `body:not([class])` so the toolbar renders dark before JS runs — eliminates flash of light beige toolbar.
- **themes.css**: Patched hardcoded `rgba(247,244,240,0.88)` in `#reader.html .toolbar` to switch dark in dark mode.
- **Incognito footer below fold**: Moved `<footer>` and `<hr>` outside `.container` into document flow — visible only by scrolling down, freeing full viewport for chat.
- **Dharma viewport fix**: Wrapped all views in `.main-content` (`height: 100vh; overflow: hidden`); footer lives below in normal flow. Added `min-height: 300px` to `.messages`. Added `@media (max-height: 800px)` padding compression.

---

### v28.1 — Three Dharma Teachers & UI Fixes / 三位禪師 · 心靈正念 & 介面修正

#### New Feature: Three Dharma Teachers / 新功能：三位禪師 · 心靈正念

A new mindfulness chat page (`dharma.html`) offering three Buddhist dialogue styles, powered by Gemini with dedicated system prompts:

- 🙏 **Dalai (達賴)** — Tibetan Buddhist Gelug tradition. Warm, compassionate guidance rooted in bodhicitta and emptiness.
- ⛰️ **Dharma Drum (法鼓)** — Master Sheng Yen's Chan/Zen style. Direct, penetrating — "Face it, accept it, deal with it, let it go."
- 🪷 **Humanistic (人間)** — Master Hsing Yun's Fo Guang Shan approach. Grounded in daily life, action-oriented compassion.

Includes a **side-by-side comparison mode** that sends the same question to all three traditions simultaneously, and individual single-conversation tabs for each style.

新增心靈正念對話頁面（`dharma.html`），提供三種佛教對話風格，使用 Gemini 搭配專屬系統提示：

- 🙏 **達賴** — 藏傳佛教格魯派，溫暖慈悲，菩提心與空性智慧引導。
- ⛰️ **法鼓** — 聖嚴法師禪宗風格，直指核心——「面對它、接受它、處理它、放下它。」
- 🪷 **人間** — 星雲大師佛光山人間佛教，貼近生活，積極行動的慈悲。

包含**同題比較模式**（同一問題同時送出三種傳統並排顯示），以及各風格的獨立對話分頁。

#### Other v28.1 Changes / 其他變更

- **Incognito Chat responsive fix**: Controls row now wraps properly on narrower screens — the send button is always visible regardless of window width.
- **Voice Summary renamed**: Feature renamed to "AI摘要朗讀podcast" across popup and page title for clearer description.
- **Model updates**: Gemini model catalog updated to 3.1 Flash Lite, 2.5 Flash, and 3.1 Pro.
- **14 UI locales**: Added Czech (`cs`) and Portuguese (`pt`) — now 14 locales total.

- **無痕對話響應式修正**：控制列在較窄螢幕上正確換行，送出按鈕在任何視窗寬度下皆可見。
- **語音摘要改名**：功能更名為「AI摘要朗讀podcast」，popup 按鈕與頁面標題同步更新。
- **模型更新**：Gemini 模型目錄更新至 3.1 Flash Lite、2.5 Flash、3.1 Pro。
- **14 個介面語系**：新增捷克語（`cs`）與葡萄牙語（`pt`），共 14 個語系。

---

### v27.2.3 — 3-Mode AI Service Selector / 三模式 AI 服務選擇器

#### AI Service Mode / AI 服務模式

The Settings page now replaces the old "enable local model" checkbox with a clear **3-mode selector** that non-technical users can understand at a glance:

| Mode | Who it's for | What uses Gemini | What uses Local AI |
|------|-------------|------------------|--------------------|
| **Google Gemini Only** | All features, no local setup needed | Everything | — |
| **Hybrid** | Mix of cloud + local | Images, audio, PDF | Text translation, chat |
| **Local AI Only** | Maximum privacy, no Google API key needed | — (unavailable) | Text translation, chat |

**Important**: Image/audio/PDF processing always requires Google Gemini regardless of mode. In Local AI Only mode, these features are automatically blocked with a clear error message directing users to switch modes.

設定頁面將舊版「啟用本機模型」核取方塊改為直覺的**三模式選擇器**，非技術使用者也能一目了然：

| 模式 | 適合誰 | 使用 Gemini | 使用本機 AI |
|------|--------|------------|------------|
| **僅使用 Google Gemini** | 需要完整功能 | 所有功能 | — |
| **混合模式** | 兼顧雲端與本機 | 圖片、音訊、PDF | 純文字翻譯、對話 |
| **僅使用本機 AI** | 追求最大隱私，不需 Google API | — （功能停用）| 純文字翻譯、對話 |

**注意**：圖片/音訊/PDF 處理無論何種模式均需要 Google Gemini。選擇「僅使用本機 AI」模式時，這些功能會顯示清楚的錯誤訊息，引導使用者切換模式。

#### Other v27.2.3 Changes / 其他變更

- **Long-text warning**: When a local model is active, translating an entire article shows an amber warning that the full text is sent in one request and may exceed the model's context window.
- **Cleaner options UI**: API key + model selector and local endpoint config are now sub-panels inside the AI Service Mode section — only visible when relevant.
- **Backward migration**: Existing users who had "local model enabled" will automatically migrate to Hybrid mode on first open.
- **12 locale updates**: All 12 UI languages updated with new keys (190 total).

- **長文本警告**：使用本機模型時，翻譯整篇文章前會顯示琥珀色提示，說明全文以單次請求傳送，可能超過模型的 context window。
- **選項介面更清晰**：API 金鑰、模型選擇與本機端點設定現作為子面板整合至 AI 服務模式區段中，僅在相關模式下顯示。
- **舊版設定自動遷移**：原先已啟用「本機模型」的使用者，首次開啟設定頁時將自動轉換為混合模式。
- **12 個語系更新**：所有 12 個介面語系新增對應翻譯（共 190 個訊息鍵）。

---

### v27.2 — Reader, TTS & Language Expansion

#### Full-Page Web Translation — Academic Mode / 網頁翻譯學術模式

- **Dual-mode extraction**: Attempts fast DOM extraction first (no screenshot needed for most webpages). Falls back to screenshot OCR only when DOM content is insufficient.
- **Improved OCR prompt**: Structured output with `##`/`###` section markers, multi-column layout handling, and hyphenation correction — optimized for academic papers.
- **Semantic reader rendering**: Headings render as `<h2>/<h3>/<h4>`, pipe-delimited rows as `<table>`, and `>` prefixes as `<blockquote>`.
- **Screenshot Translation Mode**: When OCR is blocked by copyright detection (e.g., Kindle books), the extension automatically falls back to direct screenshot translation and suggests the user reduce font size for more complete results.

- **雙模式擷取**：優先嘗試 DOM 直接提取（無需截圖），內容不足時才回退至截圖 OCR。
- **改進的 OCR 提示**：輸出 `##`/`###` 章節標記、多欄版面處理及連字符修正，針對學術論文最佳化。
- **語意閱讀器渲染**：標題渲染為 `<h2>/<h3>/<h4>`，表格列為 `<table>`，引用為 `<blockquote>`。
- **截圖翻譯模式**：遇到版權保護內容（如 Kindle 電子書）時，自動切換為截圖直接翻譯，並提示縮小字體以獲得更完整的翻譯。

#### Reader Page — Voice Tool & TTS / 閱讀器語音工具

- **Universal voice tool**: The Translate + TTS panel now appears for all content types (voice notes, webpage, text, image) — previously only visible in voice-note mode.
- **Text-to-Speech**: Added **Speak / Stop** button using the Web Speech API. Language is automatically mapped to BCP-47 for accurate voice selection; prefers "Google US English" for English content.
- **Font size sync**: The voice output panel tracks the same font size slider as the main content area.
- **Paragraph rendering**: Translated output is rendered as individual `<p>` elements, matching the visual style of the main reading area.

- **語音工具全面開放**：翻譯＋朗讀面板現在對所有內容類型（語音筆記、網頁、文字、圖片）均顯示，不再限於語音筆記模式。
- **語音朗讀**：新增**朗讀 / 停止**按鈕，使用 Web Speech API 朗讀翻譯結果；英文優先選用「Google US English」聲音。
- **字體大小同步**：語音輸出面板的字體隨頁面字體滑桿同步調整。
- **段落渲染**：翻譯結果以獨立 `<p>` 元素呈現，視覺風格與主要閱讀區一致。

#### Language Support Expansion / 多語言擴充

- **3 new UI locales**: Spanish (`es`), German (`de`), Arabic (`ar`) — all 12 locales now fully synced with 180 message keys.
- **Extended Chinese-family detection**: Default language detection now maps `yue` (Cantonese), `wuu` (Wu/Shanghainese), `nan` (Min Nan/Hokkien), and `hak` (Hakka) to Traditional Chinese (`zh-TW`), in addition to all `zh-*` region codes.
- **Regional variant collapsing**: All language variants automatically resolve to the base supported locale (e.g., `de-AT`→`de`, `es-MX`→`es`, `pt-BR`→`pt`, `ar-SA`→`ar`). Regions with no supported language default to English.

- **3 個新介面語系**：西班牙語（`es`）、德語（`de`）、阿拉伯語（`ar`）——全部 12 個語系現已完整同步，共 180 個訊息鍵。
- **擴展中文語系偵測**：除所有 `zh-*` 地區碼外，`yue`（粵語）、`wuu`（吳語）、`nan`（閩南語）、`hak`（客家語）均預設對應繁體中文（`zh-TW`）。
- **地區變體自動歸併**：語言變體自動對應基礎支援語系（如 `de-AT`→`de`、`es-MX`→`es`、`pt-BR`→`pt`、`ar-SA`→`ar`）。無對應語系的地區預設為英文，使用者可在選項頁自行調整。

#### Options Page UX / 選項頁使用體驗

- **Sortable preferred language list**: Replaced two fixed text inputs with a 3-slot reorderable list — slots 1 & 2 are dropdowns from the supported language list, slot 3 is a free-text custom language input. Use ↑↓ buttons to set priority. Settings migrate automatically from the old `prefLangA`/`prefLangB` keys.
- **Preset prompt guidance**: A highlighted tip box in the preset section gives users four writing prompts: AI role, audience, response format, and input handling. Each textarea shows an example placeholder.
- **Clearer section descriptions**: All major settings sections now have more descriptive explanations of their purpose and impact.
- **Extension description**: Updated app description to reflect Gemini & Local LLM support; removed outdated "API key required" note.

- **翻譯偏好語系排序**：將原本兩個固定文字輸入改為 3 個可排序的欄位——前兩個為下拉選單（從支援語系清單選擇），第三個為自訂語言文字輸入。可用 ↑↓ 按鈕調整優先順序，設定自動從舊的 `prefLangA`/`prefLangB` 遷移。
- **提示語撰寫指引**：預設集區域新增醒目提示框，提供四個撰寫方向：AI 身份、對象、回應格式、輸入處理。每個文字區域顯示範例佔位文字。
- **更清楚的區段說明**：各主要設定區段新增更詳細的功能說明。
- **擴充說明更新**：更新 Chrome 擴充說明，明確標示支援 Gemini 與 Local LLM，移除舊的「需申請 API 金鑰」說明。

#### Other v27.2 Fixes / 其他修正

- **Preset tooltips**: Hovering over preset buttons (A–G) in Incognito Chat shows a preview of the saved prompt.
- **Reader UI/UX**: Voice tool card redesigned with gradient header and prominent translate/TTS buttons. Visual style is consistent between upper and lower panels.

- **預設提示語提示**：游標移至無痕對話預設按鈕（A–G）時，浮現提示語內容預覽。
- **閱讀器 UI/UX**：語音工具卡片重新設計，漸層標題與顯眼的翻譯/朗讀按鈕，與上方閱讀區視覺風格一致。

---

### v27.1 — Local AI Model Support / 本機 AI 模型支援

- **Ollama / LM Studio integration**: Connect to any OpenAI-compatible local server via a configurable endpoint URL and model name. When enabled, Reader translation and Incognito Chat route to the local model.
- **URL normalization**: Auto-detects whether the endpoint already includes `/v1`; appends it automatically if not, removing the need to type the exact path.
- **API key error fix**: Error messages now correctly direct users to the Settings page.

- **Ollama / LM Studio 整合**：透過可設定的端點 URL 與模型名稱連接本機 AI 伺服器。啟用後，閱讀器翻譯與無痕對話改走本機模型。
- **URL 自動修正**：自動偵測端點是否已含 `/v1`，不足時自動補上，無需手動輸入完整路徑。
- **API 金鑰錯誤修正**：錯誤訊息現在正確引導至設定頁面。

---

### v27.0 — Modular Refactor / 模組化重構

- **ES6 module architecture**: Split monolithic background logic into independent modules — `scripts/gemini-api.js` (Gemini API calls), `scripts/local-api.js` (local model calls), `scripts/language_manager.js` (language list & detection).
- **CSP compliance**: Removed all inline styles from the options page; extension now passes strict Content Security Policy checks.

- **ES6 模組架構**：將原本的背景腳本拆分為獨立模組 — `scripts/gemini-api.js`（Gemini API 呼叫）、`scripts/local-api.js`（本機模型呼叫）、`scripts/language_manager.js`（語言清單與偵測）。
- **CSP 合規**：移除選項頁面中所有內嵌樣式，通過嚴格的內容安全策略檢查。

---

## Core Features / 核心功能

### 1. Incognito Gemini Chat (4 Tabs) / 無痕 Gemini 對話（4個分頁）

Four independent chat interfaces in one page:

- **Gemini 3.1 Flash Lite** — Lightweight, fastest responses.
- **Gemini 2.5 Flash** — Balanced speed and capability. Supports images (up to 4) and PDF uploads.
- **Gemini 3.1 Pro** — Most powerful model, 1M token context. Best for complex documents and multimodal tasks.
- **Local Model** — Chat with your local Ollama or LM Studio model via OpenAI-compatible API. Text only; no API key required.

Completely incognito: all history is stored in page memory only and erased when the tab is closed. Supports 7 preset prompt slots (A–G) with hover preview tooltips.

四個獨立對話介面：
- **Gemini 3.1 Flash Lite** — 輕量版，回應速度最快。
- **Gemini 2.5 Flash** — 速度與能力兼具。支援最多 4 張圖片及 PDF 上傳。
- **Gemini 3.1 Pro** — 最強大的模型，百萬 Token 上下文。適合複雜文件與多模態任務。
- **本機模型** — 透過 OpenAI 相容 API 與本機 Ollama 或 LM Studio 模型對話，僅支援文字，無需 API 金鑰。

完全無痕：所有對話紀錄僅存於頁面記憶體，關閉分頁即清除。支援 7 組預設提示語（A–G），游標移至按鈕可預覽內容。

---

### 2. Smart Translation Workbench / 智慧翻譯工作台

- **Paste Text**: Paste any text for translation using the AI model.
- **Upload Image (OCR)**: Upload or paste a screenshot; the AI extracts and translates the text.

貼上文字或上傳截圖，AI 自動辨識並翻譯。

---

### 3. Full-Page Web Translation / 網頁全文翻譯

One-click capture of the current webpage with a two-phase extraction strategy:

1. **DOM Extraction** (fast): Directly parses the page structure, preserving headings, paragraphs, tables, and blockquotes as structured Markdown. Works on most standard webpages and academic sites (arXiv, Wikipedia, etc.).
2. **Screenshot OCR Fallback**: For canvas-rendered or dynamically-loaded pages, captures a full-page screenshot and uses Gemini Vision to extract and structure the content.
3. **Screenshot Translation Mode**: If OCR is blocked due to copyright detection (e.g., Kindle), automatically falls back to direct screenshot translation with a note suggesting font size reduction for better coverage.

一鍵擷取當前網頁，採用兩階段策略：
1. **DOM 直接提取**（快速）：解析頁面結構，保留標題、段落、表格與引用，輸出結構化 Markdown。適用於大多數標準網頁與學術網站（arXiv、Wikipedia 等）。
2. **截圖 OCR 回退**：對 Canvas 渲染或動態載入頁面，擷取全頁截圖，以 Gemini Vision 提取並整理內容。
3. **截圖翻譯模式**：若 OCR 因版權偵測被封鎖（如 Kindle），自動改為截圖直接翻譯，並提示縮小字體以提高翻譯完整度。

---

### 4. Incognito Voice Notes / 無痕語音輸入筆記

Record voice (up to 15 minutes) or upload an audio file. Gemini transcribes the speech with speaker diarization. The result opens in the Reader page where you can click any paragraph to translate it instantly.

錄音（最長15分鐘）或上傳音訊檔，Gemini 進行語音轉錄並區分說話者。結果在閱讀器頁面開啟，點選任意段落即可立即翻譯。

---

### 5. Reader Page / 閱讀器頁面

Displays transcribed or extracted text with:
- **Click-to-translate** for any paragraph (routes to local model if enabled, otherwise Gemini)
- **Text-to-Speech**: Speak translated content aloud using the Web Speech API (Speak / Stop toggle)
- **Semantic rendering**: Headings (`##`, `###`, `####`), tables (`|`), and blockquotes (`>`) render as proper HTML elements
- Adjustable font size, line height, and background color (White / Sepia / Dark)
- Save content as `.txt` file

顯示轉錄或擷取的文字，支援：
- **點選段落立即翻譯**（優先使用本機模型，否則使用 Gemini）
- **語音朗讀**：使用 Web Speech API 朗讀翻譯結果（朗讀 / 停止切換）
- **語意渲染**：標題（`##`、`###`、`####`）、表格（`|`）及引用（`>`）渲染為對應的 HTML 元素
- 可調整字體大小、行距、背景顏色（白色／米色／深色）
- 儲存為 `.txt` 檔案

---

### 6. Local AI Model Support / 本機 AI 模型支援

Connect to **Ollama** or **LM Studio** (or any OpenAI-compatible server) for privacy-first, offline AI:

- Configure the API endpoint URL and model name in Options
- Supports both bare base URLs (e.g., `http://127.0.0.1:1234`) and versioned paths (e.g., `http://localhost:11434/v1`) — the `/v1` segment is auto-detected
- Supports any HTTP endpoint, including LAN IPs (e.g., `http://192.168.1.x:1234`)
- When enabled, text translation in Reader and Incognito Chat routes to the local model

在「選項」頁面設定 API 端點 URL 與模型名稱，即可使用本機 AI 模型：
- 支援基礎 URL（如 `http://127.0.0.1:1234`）或附帶版本路徑（如 `http://localhost:11434/v1`），自動補上 `/v1` 路徑
- 支援任何 HTTP 端點，包含區域網路 IP
- 啟用後，閱讀器的點擊翻譯與無痕對話的本機分頁將改走本機模型

---

### 7. Three Dharma Teachers / 三位禪師 · 心靈正念 [Beta]

A mindfulness chat page with three Buddhist dialogue styles powered by Gemini:

- 🙏 **Dalai** — Tibetan Gelug compassion and bodhicitta guidance
- ⛰️ **Dharma Drum** — Chan/Zen directness inspired by Master Sheng Yen
- 🪷 **Humanistic** — Fo Guang Shan's action-oriented daily Buddhism

Features side-by-side comparison mode and individual conversation tabs. Uses the same Gemini API key as other features — no additional setup required.

以三種佛教對話風格提供心靈正念對話：

- 🙏 **達賴** — 藏傳格魯派慈悲與菩提心引導
- ⛰️ **法鼓** — 聖嚴法師禪宗直指風格
- 🪷 **人間** — 佛光山人間佛教，貼近日常的行動佛法

支援同題比較模式與各風格獨立對話分頁。使用既有的 Gemini API Key，無需額外設定。

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
| 💬 Incognito Gemini Chat | Open 4-tab AI chat |
| 🔧 Smart Translation Workbench | Open text/image translation |
| 🌐 Translate Current Page | Capture & translate active tab |
| **Beta** | |
| 🔊 AI摘要朗讀podcast | Summarize & read aloud content |
| 🪷 三位禪師 · 心靈正念 | Three Dharma Teachers mindfulness chat |
| 📖 Tutorial | How to get a Gemini API key |

---

## Tech Stack / 技術堆疊

- HTML, CSS, JavaScript (ES6 Modules)
- Chrome Extension Manifest V3
- Google Gemini API (`gemini-3.1-flash-lite`, `gemini-2.5-flash`, `gemini-3.1-pro`)
- Web Speech API (`SpeechSynthesisUtterance`) for Text-to-Speech
- OpenAI-compatible API format (`/v1/chat/completions`) for local models
- Module architecture: `scripts/gemini-api.js`, `scripts/local-api.js`, `scripts/language_manager.js`
- i18n support: 14 locales (en, zh_TW, ja, ko, pt, pt_BR, ru, tr, uk, vi, es, de, ar, cs)

---

## Contribution & Support / 貢獻與支持

Contributions of any kind are welcome — bug reports via GitHub Issues, feature suggestions, or Pull Requests.

If this tool has been helpful, consider [buying me a coffee](https://www.buymeacoffee.com/hugocc0825) to support continued development!

歡迎任何形式的貢獻。如果本工具對您有所幫助，歡迎請我喝杯飲料以支持持續開發！

---

## License / 版權

Copyright (c) 2025 Dr. Cheng-Che Chen. All Rights Reserved.
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
