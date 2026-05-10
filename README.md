# Daily English Gate

Chrome 擴充功能：每天第一次切回 Chrome 視窗時自動開啟 ChatGPT，追蹤實際使用時間，養成每日英語對話習慣。

## 功能

- 每天第一次切回 Chrome 視窗時自動開啟 ChatGPT
- 追蹤 ChatGPT 分頁的 **實際 active 時間**（切換到其他分頁自動暫停）
- 累積 10 分鐘後標記當天完成，跳出完成通知
- 工具列 badge 即時顯示狀態：
  - 🔴 `!` — 今日尚未開始
  - 🔵 `Xm` — 練習中，顯示剩餘分鐘數
  - 🟢 `N` — 已完成，顯示連續天數
- 晚上 8 點仍未完成時推播提醒
- Popup 顯示進度環、連續天數、本週完成次數

## 安裝

1. 下載或 clone 本 repo
2. 前往 `chrome://extensions/`
3. 開啟右上角**開發人員模式**
4. 點擊**載入未封裝項目**，選擇本資料夾

## 運作方式

```
每天第一次切回 Chrome 視窗
  └─ 自動開啟 ChatGPT 分頁

ChatGPT 分頁在前景
  └─ 每分鐘累積 active 時間（heartbeat alarm）
  └─ 切換到其他分頁 → 暫停計時

累積達 10 分鐘
  └─ 標記今日完成
  └─ 更新連續天數、本週統計
  └─ 推播完成通知

晚上 8 點（若未完成）
  └─ 推播提醒通知
```

**為什麼用 active 時間而非固定計時器？**

固定 10 分鐘計時器在分頁開著就算完成，無法確認你真的在練習。
Active 時間追蹤確保你必須停留在 ChatGPT 分頁，文字或語音模式皆適用。

## Popup 介面

| 狀態 | 顯示 |
|---|---|
| 今日未開始 | 空進度環 + 「立即開始」按鈕 |
| 練習中（ChatGPT 在前景） | 藍色進度環填滿中 + `ChatGPT 使用中 ▶` |
| 練習中（ChatGPT 不在前景） | 進度環暫停 + 黃色提示 `切換到 ChatGPT 分頁繼續` |
| 今日已完成 | 綠色進度環滿 + `✓ 今日練習已完成！` |

## 資料儲存

所有資料儲存於 `chrome.storage.local`，僅在本機，不上傳任何伺服器。

```jsonc
{
  "lastSessionDate": "2026-05-11",       // 今日是否已觸發
  "sessionCompleted": true,              // 今日是否完成
  "accumulatedActiveSecs": 600,          // 累積 active 秒數
  "chatGptTabId": 42,                    // 追蹤的分頁 ID
  "completedDays": { "2026-05-10": true }, // 歷史完成紀錄
  "streak": 3,                           // 連續天數
  "weeklyCount": 4                       // 本週完成天數
}
```

## 已知限制

- **無法驗證你真的在對話**：active 時間只代表 ChatGPT 分頁在前景，不代表你在輸入或說話。OpenAI 沒有提供 ChatGPT Web 的使用記錄 API。
- **語音模式同樣適用**：計時機制與輸入方式無關，文字和語音皆可。
- **streak 依賴當天完成**：若當天未滿 10 分鐘，streak 不累積。

## 技術

- Manifest V3
- 純 JavaScript，無後端、無外部依賴
- Service Worker + `chrome.alarms`（heartbeat 每分鐘一次，alarm 在 SW 被回收後仍存活）

## 權限說明

| 權限 | 用途 |
|---|---|
| `storage` | 儲存練習紀錄、streak、本週統計 |
| `tabs` | 開啟 ChatGPT 分頁、追蹤 active 分頁 |
| `alarms` | 每分鐘 heartbeat、晚間提醒排程 |
| `windows` | 偵測視窗焦點切換以暫停/恢復計時 |
| `notifications` | 完成通知、晚間提醒推播 |
