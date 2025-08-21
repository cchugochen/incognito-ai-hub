Incognito AI Hub by Gemini / 無痕AI風颱工作台
A simple, privacy-first Chrome extension designed for those who value privacy, integrating multimodal AI tools to solve digital reading and translation challenges in daily work and academic research. The core concept is to create a completely incognito, non-tracking AI-assisted tool that does not store user conversations and is dedicated to improving privacy. The project is named "Hong-Thai" (颱風, Typhoon) to honor all professionals who work tirelessly at their posts.

「無痕風颱工作台」是一款為重視隱私的人所設計的簡單Chrome擴充功能，整合了多模態 AI 工具，旨在解決日常工作與學術研究中遇到的數位閱讀和翻譯。核心理念，便是打造一個完全無痕、不追蹤、不儲存使用者對話、致力於改善隱私的 AI 輔助工具。原始專案以「颱風天」命名，獻給所有在崗位上努力不懈的專業人士。

Core Features / 核心功能
1. Incognito Gemini Chat (Added in v23, Updated in v24.2)
Directly calls the Gemini 2.5 Pro model, providing top-tier analysis and multimodal conversation capabilities.

Completely Incognito: All conversation history is stored only in the current page's memory and is completely erased when the tab is closed.

Supports uploading up to 4 images to be sent along with text prompts for analysis.

v24.2 Update: Added shortcut keys for pasting images and five preset prompt slots.

1. 無痕 Gemini 對話框 (v23新增, v24.2更新)
直接呼叫 Gemini 2.5 Pro 模型，提供頂尖的分析與多模態對話能力。

完全無痕：所有對話紀錄僅存於當前頁面的記憶體中，關閉分頁即完全清除。

支援最多 4 張圖片的上傳，可與文字提示一併發送進行分析。

v24.2更新：Gemini無痕對話增加快捷鍵貼圖、新增五組預設提示語。

2. Multimodal Translation & Recognition Tools
Full-page Web Translation: One-click capture and recognition of the current webpage, overcoming limitations of traditional translation tools.

Text/Screenshot Workbench: Directly paste text or upload screenshots for OCR recognition and translation.

Incognito Voice Notes: (New in v22) Supports mixed Chinese/English voice input to quickly convert your thoughts into text. Recommended for short notes. Can also be translated into other languages instantly.

2. 多模式翻譯與辨識工具
網頁全文翻譯：一鍵擷取並辨識當前網頁畫面，克服傳統翻譯工具無法處理的頁面限制。

文字/截圖工作台：直接貼上文字，或上傳螢幕截圖進行 OCR 辨識與翻譯。

無痕-語音輸入筆記：(v22新增) 支援中英夾雜的語音輸入，快速將您的想法轉為文字。建議用於數分鐘內的快速筆記。還可以立刻翻譯成其他語言。

3. Privacy & Security First / 隱私與安全優先

Our core principle is to give you full control over your data. This extension is designed with the following commitments to protect your privacy:

我們的核心原則是讓您完全掌控自己的資料。本擴充功能的設計基於以下隱私承諾：

* **Bring Your Own Key (BYOK) / 自備金鑰**: All AI requests are made directly between your browser and Google's servers using your own API key. We never see or handle your key.
    * 所有 AI 請求都使用您自己的 API 金鑰，在您的瀏覽器與 Google 伺服器之間直接完成。我們絕不會經手或看到您的金鑰。
* **No Backend Server / 無後台伺服器**: The extension operates entirely on your local machine. We do not have any servers to store or process your data.
    * 本擴充功能完全在您的本機電腦上運作，我們沒有任何用來儲存或處理您資料的後台伺服器。
* **No User Data Collection / 不收集使用者資料**: We do not collect, log, or store any content you process (text, images, or voice). In Incognito Chat, conversations are deleted the moment you close the tab.
    * 我們不收集、記錄或儲存您處理的任何內容（文字、圖片或語音）。在「無痕對話」中，所有對話紀錄在您關閉分頁時立即銷毀。

For a detailed explanation of our data handling practices, please see the full **[Privacy Policy](privacy.html)**.

想了解更詳細的資料處理作法，請參閱完整的 **[隱私權政策](privacy.html)**。

Installation & Usage / 安裝與使用
Installation / 安裝方式
Recommended: Install from the Chrome Web Store.

Manual Installation:

Download the project's ZIP file and unzip it.

In Chrome, navigate to chrome://extensions and enable "Developer mode".

Click "Load unpacked" and select the unzipped folder.

推薦：至 Chrome 線上應用程式商店 安裝。

手動安裝：

下載本專案的 ZIP 檔並解壓縮。

在 Chrome 網址列輸入 chrome://extensions 並開啟「開發人員模式」。

點擊「載入未封裝的擴充功能」，並選擇解壓縮後的資料夾。

First-time Setup / 首次使用
Right-click on the extension icon and select "Options".

On the settings page, paste your own Google Gemini API key.

You can refer to the included "Easy Tutorial for Gemini API Key" to get a free key.

在擴充功能圖示上按右鍵，選擇「選項」。

在設定頁面中，貼上您自己的 Google Gemini API 金鑰。

您可以參考內附的「新手申請Gemini金鑰簡易教學」來獲取免費金鑰。

Tech Stack / 技術堆疊
HTML, CSS, JavaScript (ES6)

Chrome Extension Manifest V3

Google Gemini API (gemini-2.5-pro & gemini-2.0-flash)

Contribution & Support / 貢獻與支持
Contributions of any kind are welcome, including reporting issues via GitHub Issues, suggesting features, or sending Pull Requests.

If this tool has been helpful for your work or research, consider buying me a coffee to support its continued development and maintenance!

歡迎任何形式的貢獻，包含透過 GitHub Issues 回報問題、提出功能建議或發送合併請求 (Pull Requests)。

如果這個工具對您的工作或研究有所幫助，歡迎到 Buy Me a Coffee 請我喝杯飲料，支持我持續開發與維護！

License / 版權
Copyright (c) 2025 Dr. Cheng-Che Chen. All Rights Reserved.
This project is licensed under the MIT License. See the LICENSE file for details.