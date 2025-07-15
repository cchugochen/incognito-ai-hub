# **無痕風颱工作台 (Hong-Thai Incognito Reader)**

**版本 v23.3**

「無痕風颱工作台」是一款為重視隱私的專業人士所設計的 Chrome 擴充功能，整合了多模態 AI 工具，旨在解決日常工作與學術研究中遇到的數位閱讀和翻譯挑戰。

## **開發動機**

身為臨床工作者，在醫療機構使用公用電腦上閱讀學術論文（特別是鎖右鍵或圖片格式的 PDF），或臨時需要處理不同語言的內容與對話時，時常感到現有工具的不足與對隱私的擔憂。

本專案的核心理念，便是打造一個**完全無痕、不追蹤、不儲存使用者對話、符合台灣資安規範**的 AI 輔助工具。

專案以「颱風天」命名，獻給所有在崗位上努力不懈的專業人士。

## **核心功能**

#### **1\. 無痕-Gemini 2.5 Pro 對話框 (v23新增)**

* 直接呼叫 Gemini 2.5 Pro 模型，提供頂尖的分析與多模態對話能力。  
* **完全無痕**：所有對話紀錄僅存於當前頁面的記憶體中，關閉分頁即完全清除。  
* 支援最多 4 張圖片的上傳，可與文字提示一併發送進行分析。

#### **2\. 多模式翻譯與辨識工具**

* **網頁全文翻譯**：一鍵擷取並辨識當前網頁畫面，克服傳統翻譯工具無法處理的頁面限制。
  
* **文字/截圖工作台**：直接貼上文字，或上傳螢幕截圖進行 OCR 辨識與翻譯。
  
* **無痕-語音輸入筆記**：(v22新增) 支援中英夾雜的語音輸入，快速將您的想法轉為文字。建議用於數分鐘內的快速筆記。還可以立刻翻譯成其他語言。

#### **3\. 隱私與安全優先**

* **自帶金鑰 (BYOK)**：需由使用者自行提供 Google Gemini API 金鑰，確保所有 AI 請求都在使用者與 Google 之間直接進行，開發者不經手任何資料。  
* **無後台伺服器**：所有操作皆在使用者本機瀏覽器端完成。  
* **無使用者資料收集**：本工具不收集、不儲存任何使用者輸入的內容或個人資訊。

## **安裝與使用**

#### **安裝方式**

* **推薦**：至 [Chrome 線上應用程式商店](https://chromewebstore.google.com/detail/idgjihjkhbkeapkikoajehmldbiphaaf?utm_source=item-share-cb) 安裝。  
* **手動安裝**：  
  1. 下載本專案的 ZIP 檔並解壓縮。  
  2. 在 Chrome 網址列輸入 chrome://extensions 並開啟「開發人員模式」。  
  3. 點擊「載入未封裝的擴充功能」，並選擇解壓縮後的資料夾。

#### **首次使用**

1. 在擴充功能圖示上按右鍵，選擇「選項」。  
2. 在設定頁面中，貼上您自己的 Google Gemini API 金鑰。  
3. 您可以參考內附的「新手申請Gemini金鑰簡易教學」來獲取免費金鑰。

## **技術堆疊**

* HTML, CSS, JavaScript (ES6)  
* Chrome Extension Manifest V3  
* Google Gemini API (gemini-2.5-pro & gemini-2.0-flash)

## **貢獻與支持**

* 歡迎任何形式的貢獻，包含透過 [GitHub Issues](https://www.google.com/search?q=https://github.com/cchugochen/hongthai-reader/issues) 回報問題、提出功能建議或發送合併請求 (Pull Requests)。  
* 如果這個工具對您的工作或研究有所幫助，歡迎到 [Buy Me a Coffee](https://www.buymeacoffee.com/hugocc0825) 請我喝杯飲料，支持我持續開發與維護！

## **版權**

Copyright (c) 2025 Dr. Cheng-Che Chen. All Rights Reserved.  
This project is licensed under the MIT License. See the LICENSE file for details.
