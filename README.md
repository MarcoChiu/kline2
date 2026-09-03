# 📈 K-Line Master - 股票 K 線智能分析與走勢預判系統

> 基於 **React + Vite + Google Gemini Flash 多模態大模型** 的現代化股票 K 線圖表智能辨識、型態分析、隔日走勢預測與新手友善教學工具。

🔗 **線上體驗直接點擊 (Live Demo)**：[https://marcochiu.github.io/kline2/](https://marcochiu.github.io/kline2/)  
📦 **GitHub 專案倉庫**：[https://github.com/MarcoChiu/kline2.git](https://github.com/MarcoChiu/kline2.git)

---

## 🌟 核心特色

### 1. 📸 拍照 / 圖片辨識 K 線形態 (多模態神經網路)
- **多管道輕鬆匯入**：支援 **手機拍照**、**看盤軟體截圖上傳**、**檔案拖曳**，以及電腦截圖後直接按 **`Ctrl + V` 貼上**。
- **Gemini Vision 智能辨識**：秒級提取 K 棒實體與影線力道，自動比對 52 種常見形態。
- **直球買賣直判**：精準標註 `🟢 【可以買進】`、`🔴 【建議賣出 / 避險】` 或 `🟡 【觀望等待】`，給予新手一句話實戰動作指引與停損防守位置，並支援 **一鍵在百科中定位高亮該形態**。

### 2. 🐣 新手模式 vs 📊 專業模式（一鍵隨心切換）
- **新手極簡模式**：
  - 去除繁複的市場心理物理力道與冗長學術 SOP。
  - 醒目呈現 **買賣大徽章**（買進／賣出／觀望）、**一句話白話動作指引**、**停損防守底線** 與 **歷史勝率**，讓剛入市的新手 3 秒內看懂能不能買、該不該跑。
- **專業作戰模式**：
  - 完整呈現每種形態的物理特徵、主力博弈心態、適用股價位階、進出場 SOP 觸發條件與等距目標測算。
- **設定自動保存**：模式切換自動記憶於瀏覽器，每次開啟皆維持您的最佳操作習慣。

### 3. ⚡ 免 Key 純量化秒查 & Gemini AI 深度推演
- **免 Key 本地量化模式**：無需 API Key 即可秒查全台股 2 年日 K 棒、MA 均線排列、確定性形態掃描與歷史勝率回測。
- **Gemini AI 深度推演模式**：配置 Google Gemini API Key 後，立即解鎖跨市場夜盤牽引分析、隔日多空三大劇本概率與關鍵掛單階梯。

### 4. 📖 完整 52 種經典 K 棒型態百科圖鑑
- 收錄《錢線百分百》48 種戰法中的內困三日翻紅／翻黑，並補齊經典單 K、雙 K 與多 K 實戰型態。
- 全量配備清晰 SVG 向量圖例、位階篩選器（底部築底／高檔做頭／中繼突破）與歷史勝率排行。

### 5. 🕹️ 互動式 K 線模擬測試畫板
- 支援手動畫板排列組合 K 棒走勢，並可直接從百科「一鍵帶入畫板」，由 AI 深度推演後續多空勝率與主力洗盤吸籌心態。

### 6. 📱 行動優先設計 (Mobile-First) & 隱私安全
- 響應式佈局，深色玻璃擬態 (Glassmorphism)，手機單手操作流暢順手。
- API Key 僅安全儲存於使用者本地端 `localStorage`，絕不上傳任何第三方伺服器。

---

## 🚀 快速啟動

### 1. 安裝依賴
```bash
npm install
```

### 2. 本地開發運行
```bash
npm run dev
```
瀏覽器開啟 `http://localhost:3004` 即可開始體驗。

### 3. 一鍵建置與 GitHub Pages 部署
```bash
npm run deploy
```
系統將自動依序執行：
1. `predeploy`: 建置生產環境最佳化 Bundle (`vite build`)。
2. `deploy`: 自動發布至 `gh-pages` 分支。
3. `postdeploy`: 自動提交原始碼變更並推送至 GitHub `main` 分支。

---

## 🏗️ 專案架構

```
kline/
├── .agents/
│   └── AGENTS.md                  # AI 助理角色設定、客觀分析師規範與 Port 編排
├── public/
│   └── .nojekyll                  # 避免 GitHub Pages 忽略底線目錄
├── src/
│   ├── components/
│   │   ├── AnalysisResult.jsx     # 核心分析報告、天花板/地板、均線多空排列
│   │   ├── ApiKeyModal.jsx        # Gemini API Key 配置與模型自訂下拉選單
│   │   ├── BackToTop.jsx          # 浮動置頂按鈕
│   │   ├── Header.jsx             # 頂部導航與 Build Time 標籤
│   │   ├── InteractiveCanvas.jsx  # 互動式 K 線畫板模擬器
│   │   ├── PatternEncyclopedia.jsx# 52 種形態百科、新手模式與拍照辨識 Modal
│   │   ├── StockInput.jsx         # 股號輸入與跨市場情境選項
│   │   └── YahooKlineCanvas.jsx   # 2 年歷史真實 K 線 Canvas 互動繪圖板
│   ├── data/
│   │   └── klinePatterns.js       # 52 種 K 棒型態完整資料庫與 SVG 定義
│   ├── services/
│   │   ├── aiVisionService.js     # Gemini 雲端多模態視覺與走勢分析引擎
│   │   ├── backtestService.js     # 本地 2 年歷史真實形態勝率回測引擎
│   │   ├── localQuantitativeService.js # 本地純量化計算引擎 (免 Key 模式)
│   │   └── yahooFinanceService.js # Yahoo Finance 即時與歷史行情串接
│   ├── styles/
│   │   └── index.css              # 全域玻璃擬態主題與響應式 CSS
│   ├── App.jsx                    # 核心狀態管理與分頁控制
│   └── main.jsx
├── package.json
├── postdeploy.js                  # 自動化提交與推送腳本
├── vite.config.js                 # Vite 設定 (Port 3004、Proxy、__BUILD_TIME__)
└── README.md
```

---

## 📜 免責聲明
本系統之所有分析結果、型態辨識與走勢推演僅供技術分析與學術研究參考，不構成任何實質投資建議。投資必定有風險，入市請務必嚴格執行資金控管與防守紀律。
