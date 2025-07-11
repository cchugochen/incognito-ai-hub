# **風颱翻譯工作台 (HongThai Reader)**

「風颱翻譯工作台」是一款簡單的 Chrome 擴充功能，旨在解決日常工作中遇到的數位閱讀與翻譯挑戰。

## **開發動機**

身為非專業工程師，在公用電腦上閱讀學術論文（特別是鎖右鍵或圖片格式的 PDF），或臨時需要語音輸入處理不同語言時，時常感到現有工具的不足，例如Google翻譯。本專案的初衷，避開便是打造一個簡單且盡可能尊重使用者隱私的 AI 輔助工具。

專案以「颱風天」命名，獻給所有在崗位上努力不懈的專業人士。

## **核心功能**

* **網頁全文翻譯**：一鍵擷取並辨識當前網頁畫面，克服傳統翻譯工具無法處理的頁面限制。  
* **多模式工作台**：  
  * **文字貼上**：直接從 Word、PDF 或其他來源複製文字進行處理。  
  * **圖片/截圖辨識 (OCR)**：上傳螢幕截圖或圖片，AI 將自動辨識其中文字。  
  * **語音筆記**：支援中英夾雜的語音輸入，快速將您的想法轉為文字。  
* **沉浸式閱讀體驗**：在專屬的閱讀模式中，逐段對照原文與翻譯，並可自訂字體、行高與背景。  
* **使用者資料安全**：  
  * 以Google Gemini API為核心工具。 需由使用者自行提供 Google Gemini API 金鑰，確保所有 AI 請求都在使用者與 Google 之間進行。  
  * 所有操作皆在使用者本機瀏覽器端完成，無後台伺服器。

## **安裝與使用**

### **安裝方式**

1. **下載專案**：點擊此頁面右上方的 Code \-\> Download ZIP，並解壓縮。  
2. **開啟 Chrome 擴充功能頁面**：在 Chrome 網址列輸入 chrome://extensions。  
3. **啟用開發人員模式**：在頁面右上角，開啟「開發人員模式」。  
4. **載入擴充功能**：點擊左上方的「載入未封裝的擴充功能」，並選擇您剛剛解壓縮的資料夾。  
5. 「風颱翻譯工作台」的圖示將會出現在您的 Chrome 工具列上。

### **使用方式**

1. **設定 API 金鑰**：首次使用前，請右鍵點擊擴充功能圖示，選擇「選項」，並貼上您自己的 Google Gemini API 金鑰。您可以參考內附的「新手申請Gemini金鑰簡易教學」。  
2. **開始使用**：點擊工具列上的圖示，即可根據您的需求選擇不同功能。

## **技術工具**

* HTML, CSS, JavaScript (ES6)  
* Chrome Extension Manifest V3  
* Google Gemini API

## **貢獻**

歡迎任何形式的貢獻，包含回報問題 (Issues)、提出功能建議或發送合併請求 (Pull Requests)。

## **支持作者**

如果這個工具對您的工作或研究有所幫助，歡迎考慮請我喝杯咖啡，支持我持續開發與維護！

\<a href="https://www.buymeacoffee.com/hugocc0825" target="\_blank"\>\<img src="https://cdn.buymeacoffee.com/buttons/v2/default-green.png" alt="Buy Me A Coffee" style="height: 45px \!important;width: 160px \!important;" \>\</a\>

## **版權**

Copyright (c) 2025 Dr. Cheng-Che Chen (陳正哲). All Rights Reserved.  
This project is licensed under the MIT License. See the LICENSE file for details.