# Daily English Gate

Chrome 擴充功能：每天開啟 Chrome 時自動開啟 ChatGPT，追蹤累積使用時間，養成每日英語對話習慣。

## 功能

- 每天第一次切回 Chrome 視窗時自動開啟 ChatGPT
- 追蹤 ChatGPT 分頁的實際 active 時間（離開分頁自動暫停）
- 累積 10 分鐘後標記當天完成
- 工具列 badge 顯示當前狀態（未開始 / 剩餘分鐘 / 連續天數）
- 晚上 8 點未完成時推播提醒
- 記錄連續天數與本週完成次數

## 安裝

1. 前往 `chrome://extensions/`
2. 開啟右上角**開發人員模式**
3. 點擊**載入未封裝項目**，選擇本資料夾

## 技術

- Manifest V3
- 純 JavaScript，無後端、無外部依賴
- `chrome.storage.local` 本機儲存，不上傳任何資料

## 權限說明

| 權限 | 用途 |
|---|---|
| `storage` | 儲存練習紀錄、streak、本週統計 |
| `tabs` | 開啟 ChatGPT 分頁、追蹤 active 分頁 |
| `alarms` | 每分鐘 heartbeat、晚間提醒 |
| `windows` | 偵測視窗焦點切換 |
| `notifications` | 完成通知、晚間提醒推播 |
