import { KLINE_PATTERNS } from '../data/klinePatterns';

export const GEMINI_MODEL_OPTIONS = [
  { value: 'gemini-2.5-flash', label: '🥇 Gemini 2.5 Flash (最新旗艦・首選)' },
  { value: 'gemini-2.0-flash', label: '⚡ Gemini 2.0 Flash (經典主流・推薦)' },
  { value: 'gemini-2.0-flash-lite', label: '🚀 Gemini 2.0 Flash-Lite (極速輕量)' },
  { value: 'gemini-1.5-flash', label: '💎 Gemini 1.5 Flash (穩定版)' },
  { value: 'gemini-1.5-pro', label: '📊 Gemini 1.5 Pro (長文本專業版)' },
  { value: 'gemini-2.0-flash-thinking-exp-01-21', label: '🧠 Gemini 2.0 Flash Thinking (深度推理版)' }
];

const DEFAULT_GEMINI_MODELS = GEMINI_MODEL_OPTIONS.map(({ value }) => value);
const GEMINI_MODEL_CACHE_TTL = 5 * 60 * 1000;
let geminiModelCache = null;




/**
 * 智能數據辨識入口 (純文本數據，無圖片)
 */
export async function analyzeKlineFromData(stockData, apiKey = null, selectedModel = 'auto', patternCount = 12, marketContext = null) {
  if (!apiKey || apiKey.trim().length < 10) {
    throw new Error('請先設定 Gemini API Key 才能進行數據分析');
  }

  console.log('正在呼叫 Google Gemini Data API, 指定模型:', selectedModel, '型態數量:', patternCount, '包含跨市場數據:', !!marketContext);
  const geminiResult = await callGeminiDataAnalysis(stockData, apiKey.trim(), selectedModel, patternCount, marketContext);
  if (geminiResult) return geminiResult;

  throw new Error('Gemini API 未回傳有效結果，請稍後再試');
}

/**
 * 畫板模擬手繪組合 AI 深度推演
 */
export async function analyzeSimulatedCandles(candles, apiKey = null, selectedModel = 'auto') {
  if (!apiKey || apiKey.trim().length < 10) {
    throw new Error('請先設定 Gemini API Key 才能進行 AI 走勢推演');
  }

  const prompt = `你是一位資深嚴謹客觀的量化技術與籌碼分析師。
使用者在 K 線模擬畫板中手動組合了以下 ${candles.length} 根連續日 K 棒序列與成交量配置（依時間序由左至右）：

${candles.map((c, i) => {
  const type = c.color === '#ef4444' ? '陽線 (紅K)' : c.color === '#10b981' ? '陰線 (綠K)' : '十字星/變盤線';
  const vol = c.volumeLevel === 'burst' ? '爆量 (巨大成交量)' : c.volumeLevel === 'dry' ? '窒息量 (極度萎縮)' : '一般均量';
  const shadow = c.shadowType ? ` (特徵: ${c.shadowType})` : '';
  return `Day ${i + 1}: ${type}${shadow} [開盤價座標: ${c.open}, 收盤價座標: ${c.close}, 最高價座標: ${c.high}, 最低價座標: ${c.low}] | 成交量態樣: ${vol}`;
}).join('\n')}

請根據經典形態學物理力道、量價關係（量增價漲、量縮價跌、量價背離或爆量滯漲）、主力洗盤或拉抬心態進行深度技術推演。

請以嚴格的 JSON 格式回傳（使用繁體中文，禁止使用任何 Emoji 表情符號）：
{
  "detectedPatternName": "辨識出的核心形態名稱 (如：早晨之星破底翻、上升三法中繼突破、高檔射擊之星誘多...)",
  "sentiment": "bullish" 或 "bearish" 或 "neutral",
  "winRate": 85,
  "marketPsychology": "主力心態與多空博弈深度解析 (說明大戶如何藉由這組走勢與量能進行洗盤、出貨或吸籌)",
  "nextDayForecast": "明日推演劇本 (偏多、偏空、區間的三套應對劇本與觸發條件)",
  "tradingStrategy": [
    "操作策略要點 1 (進場點與買進條件)",
    "操作策略要點 2 (關鍵失效防守點/停損底線)",
    "操作策略要點 3 (波段獲利目標測量)"
  ]
}`;

  const resolvedModel = normalizeModelName(selectedModel);
  const modelsToTry = [resolvedModel, 'gemini-2.5-flash', 'gemini-2.0-flash'].filter((m, i, arr) => arr.indexOf(m) === i);

  for (const model of modelsToTry) {
    try {
      const response = await requestGeminiModel(model, apiKey.trim(), prompt, null, null);
      if (!response.ok) continue;
      const json = await response.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        return parseGeminiJson(rawText);
      }
    } catch (err) {
      console.warn(`[${model}] 模擬推演失敗，嘗試後備模型:`, err);
    }
  }

  throw new Error('AI 走勢推演失敗，請確認 API Key 是否有效。');
}

/**
 * 拍照 / 圖片辨識 K 線形態 (多模態視覺辨識)
 */
export async function analyzeKlineImageForEncyclopedia(base64Image, apiKey = null, selectedModel = 'auto') {
  if (!apiKey || apiKey.trim().length < 10) {
    throw new Error('請先設定 Gemini API Key 才能進行圖片拍照辨識');
  }

  let mimeType = 'image/png';
  let cleanBase64 = base64Image;

  const dataUriMatch = base64Image.match(/^data:(image\/[a-zA-Z0-9\-+.]+);base64,([\s\S]+)$/);
  if (dataUriMatch) {
    mimeType = dataUriMatch[1];
    cleanBase64 = dataUriMatch[2].replace(/\s/g, '');
  } else {
    cleanBase64 = base64Image.replace(/\s/g, '');
  }

  const patternReferenceList = KLINE_PATTERNS.map(p => `${p.id}: ${p.name} (${p.chineseName})`).join(', ');

  const prompt = `你是一位專業嚴謹客觀的量化技術與籌碼分析師。
請仔細觀察並視覺辨識這張股票 K 線圖表中的核心 K 棒形態或最新走勢特徵。

我們內建的 52 種 K 線形態庫 ID 參考如下：
${patternReferenceList}

請從技術形態學物理力道出發，特別針對「新手」給出極度精確、直截了當的買賣結論（不需要冗長晦澀的學術解釋）。

請嚴格以繁體中文輸出以下 JSON 格式（嚴禁輸出任何 markdown 標記以外的閒聊字眼，嚴禁在文字中使用任何表情符號）：
{
  "patternName": "辨識出的核心形態名稱 (例如：大陽線突破、早晨之星、低檔槌子線、高檔射擊之星、多頭吞噬等)",
  "matchedPatternId": "若符合上述 52 種常見形態之一，請填寫最精確的 ID (例如 'big_bull', 'morning_star', 'hammer' 等；若無精確吻合則填 null)",
  "actionDecision": "強制從這三個詞中選一個輸出：【買進】、【觀望】、【賣出】。絕對不可輸出其他詞彙",
  "canBuyText": "可以買進 或 建議賣出 或 觀望等待",
  "beginnerSummary": "一句話告訴新手現在該怎麼做 (簡短直接，例如：'出現多方轉折起漲訊號，回測不破低點可買進' 或 '高檔爆量長黑出貨，持股者應立即賣出，空手者切勿接刀')",
  "stopLossPoint": "防守停損位置建議 (例如：'跌破此形態最低點無條件停損出場')",
  "winRate": 80,
  "sentiment": "bullish 或 bearish 或 neutral",
  "keyReason": "極簡一句話點出多空力道關鍵 (例如：'長下影線探底帶出強勁支撐買盤')"
}`;

  let availableModels = [];
  try {
    availableModels = await fetchAvailableGeminiModels(apiKey);
  } catch (err) {
    console.warn('無法取得 Gemini 模型清單，改用內建備援清單:', err.message);
  }

  const modelsToTry = getGeminiModelCandidates(selectedModel, availableModels);
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const response = await requestGeminiModel(model, apiKey.trim(), prompt, mimeType, cleanBase64);
      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        lastError = new Error(`[${model}] ${errorJson.error?.message || response.statusText}`);
        continue;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const parsed = parseGeminiJson(rawText);
      return parsed;
    } catch (err) {
      console.warn(`[${model}] 圖片形態辨識失敗，嘗試後備模型:`, err);
      lastError = err;
    }
  }

  throw lastError || new Error('圖片形態辨識失敗，請檢查 API Key 是否有效。');
}

/**
 * 呼叫 Google Gemini 進行純數據分析
 */
async function callGeminiDataAnalysis(stockData, apiKey, selectedModel = 'auto', patternCount = 12, marketContext = null) {
  let patternsToUse = KLINE_PATTERNS;
  if (patternCount === 12) {
    patternsToUse = KLINE_PATTERNS.filter(p => p.isTopFrequent);
  }
  const patternNamesList = patternsToUse.map(p => `- ${p.chineseName} (ID: ${p.id})`).join('\n');

  let marketContextSection = '';
  if (marketContext) {
    const usLines = (marketContext.usMarkets || []).map(m => `  * ${m.name} (${m.symbol}): 報價 ${m.price}, 漲跌 ${m.priceChange >= 0 ? '+' : ''}${m.priceChange} (${m.changePercent >= 0 ? '+' : ''}${m.changePercent}%)`);
    const twLines = (marketContext.futuresAndIndex || []).map(m => `  * ${m.name} (${m.symbol}): 報價 ${m.price}, 漲跌 ${m.priceChange >= 0 ? '+' : ''}${m.priceChange} (${m.changePercent >= 0 ? '+' : ''}${m.changePercent}%)`);

    if (usLines.length > 0 || twLines.length > 0) {
      marketContextSection = `
【跨市場即時/最新連動數據 (美股/期貨/大盤)】:
${usLines.length > 0 ? `美股主要指數與關鍵 ADR:\n${usLines.join('\n')}\n` : ''}${twLines.length > 0 ? `台指期與加權大盤:\n${twLines.join('\n')}\n` : ''}
【跨市場聯動分析重點】:
- 請評估美股（特別是半導體費半 SOX、那指與重要 ADR）的漲跌對該股票明日早盤情緒的連動效應。
- 請評估台指期與大盤強弱，判定是否構成大盤共振推升或逆勢下殺風險。
`;
    }
  }

  const dataContext = `
以下是股票代號 ${stockData.symbol} 近期的 OHLCV 歷史價格與均線資料 (JSON 格式):
${JSON.stringify(stockData.historicalData, null, 2)}

最新一日資料摘要:
- 收盤價: ${stockData.latest.close}
- 漲跌幅: ${stockData.latest.changePercent}%
- MA5: ${stockData.latest.ma5}, MA10: ${stockData.latest.ma10}, MA20: ${stockData.latest.ma20}, MA60: ${stockData.latest.ma60}
${marketContextSection}
`;

  const prompt = `你是一位「嚴謹客觀的量化技術與籌碼分析師 (Strict Quantitative Technical & Chip Analyst)」。
你的唯一職責是透過上述提供的真實 OHLCV 歷史數據、均線資料以及跨市場連動資訊，進行純粹基於數據、線型、價量與資金動向的客觀分析。

核心原則：
1. 絕對客觀，拒絕迎合：絕不為了討好而給出偏頗預測。如數據顯示籌碼鬆動或技術面弱勢，必須直言不諱地指出風險。
2. 籌碼與技術互相印證：籌碼是推升股價的燃料，但價格行為是最終依歸。
3. 無絕對預測：不使用「一定會」、「保證」等字眼。分析明日走勢時，必須提供多套劇本與觸發條件。
4. 風險控管優先：在任何推論中明確點出「失效點(Invalidation Level)」，跌破或突破哪個價位代表推論失敗，應採取防守。

【四大專著實戰量化體系注入（《抓住高勝率波段飆股》、《高盛首席分析師》、《K線高手》、《抓住K線》）】
1. **真假突破三重檢驗**：
   - 檢視均線是否高度收斂糾結？若均線分散乖離過大出現長紅，容易是「假突破誘多」。
   - 突破時成交量是否明顯放大（超過近期均量 1.5 倍以上）？無量突破多為虛漲。
   - 突破後拉回是否出現「窒息量洗盤」且穩守在突破紅K低點或 MA5/MA20 之上？
2. **破底翻與洗盤識別**：
   - 若跌破關鍵支撐後迅速以長紅帶量收復，判定為主力「破底翻誘空洗盤」，具極高勝率。
3. **高檔量價背離警訊**：
   - 股價創波段新高但量能萎縮，或高檔爆巨量收長黑/長上影線，強制示警為主力出貨。
4. **嚴格的 3% 保本與失效防守點 (Invalidation Level)**：
   - 在 tradingStrategy 與 orderBooking 中，必須明確給出技術面防守價（跌破關鍵均線或進場點 3% 即刻保本停損）。

【數據分析重點】
1. **趨勢判定**：依據提供的 MA5, MA10, MA20, MA60，判斷目前是多頭排列、空頭排列還是糾結？價格是在 MA20/MA60 之上還是之下？乖離率是否過大？
2. **K 線型態**：分析最近幾天的開高低收，比對以下 ${patternCount} 種系統支援的型態，挑選最符合目前走勢的型態（請精準對應 ID 與名稱）：
${patternNamesList}
3. **量能分析**：觀察近期的 volume (成交量)，是否有爆量長紅、爆量長黑、量價背離、或窒息量打底的現象？
4. **跨市場連動**：若上方有提供美股/期貨數據，請精準評估其對該股明日開盤與早盤波動的實質影響。

請嚴格執行以下工作流程：
Step 1: 數據特徵提取 (價格、量能、最新 K 棒型態)
Step 2: 均線與趨勢判定 (判斷多空排列與乖離、均線糾結共振)
Step 3: 結構、趨勢與跨市場共振評估 (標示壓力/支撐、真假突破判斷、美股/期貨連動)
Step 4: 明日走勢推演 (情境A偏多、情境B偏空、情境C盤整，各自的機率與條件)
Step 5: 嚴格的操作結論與風險提示 (強制標註 3% 保本點或關鍵均線防守點)
Step 6: 給新手的直白建議 (請根據多空勝率與型態真實評估)

【輸出格式要求】
請「嚴格以合法 JSON 格式」輸出，不可有 JSON 以外的文字。
語氣必須冷靜、專業、克制。絕對禁用任何表情符號 (Emojis)。

JSON 格式定義：
{
  "stockName": "請填寫該股票繁體中文名稱 (例如 2330 為 '台積電', 2609 為 '陽明', 8069 為 '元太')，若未知則填 '${stockData.stockName}'",
  "stockCode": "${stockData.symbol}",
  "openPrice": ${stockData.latest.open},
  "highPrice": ${stockData.latest.high},
  "lowPrice": ${stockData.latest.low},
  "closePrice": ${stockData.latest.close},
  "currentPrice": ${stockData.latest.close},
  "priceChange": ${stockData.latest.priceChange},
  "changePercent": ${stockData.latest.changePercent},
  "latestDate": "${stockData.latest.date}",
  "movingAverages": { "ma5": ${stockData.latest.ma5 || 0}, "ma10": ${stockData.latest.ma10 || 0}, "ma20": ${stockData.latest.ma20 || 0}, "ma60": ${stockData.latest.ma60 || 0} },
  "volume": "${stockData.latest.volume} 股",
  "detectedPatterns": [
    {
      "patternId": "從上述形態庫挑選對應的 ID (如 'big_bull')",
      "name": "從上述形態庫挑選對應的中文名稱",
      "confidence": 90,
      "description": "Step 1 & 2: 詳細描述為何判定為此型態，並加入均線(MA)多空排列與乖離率判定"
    }
  ],
  "prediction": {
    "bullishProbability": 偏多機率(0-100),
    "neutralProbability": 盤整機率(0-100),
    "bearishProbability": 偏空機率(0-100),
    "sentimentSummary": "Step 3: 一句話總結目前均線結構與共振預判",
    "marketContextImpact": "Step 3: 跨市場連動分析（結合美股/期指走勢，具體評估對此股明日早盤或波段的牽引力道，一句話至兩句話）",
    "nextDayForecast": "Step 4: 明日走勢推演 (請使用換行符號 \\n 條列：\\n【情境 A (偏多)】: ...\\n【情境 B (偏空)】: ...\\n【情境 C (區間)】: ...)",
    "supportLevels": [支撐1, 支撐2, 支撐3],
    "resistanceLevels": [壓力1, 壓力2, 壓力3],
    "orderBooking": {
      "buyLimit": 建議低接掛單價(數值，例如 MA5 或第一道地板價),
      "buyNote": "低接理由 (例如: '回測 MA5 均線逢低掛單低接')",
      "takeProfitLimit": 建議停利掛單價(數值，例如第一道天花板壓力價),
      "takeProfitNote": "停利理由 (例如: '衝高挑戰前高天花板分批獲利了結')",
      "stopLossLimit": 建議停損防守價(數值，例如跌破 MA20 或關鍵地板),
      "stopLossNote": "停損理由 (例如: '跌破 MA20 月線無條件出場')"
    },
    "tradingStrategy": [
      "精簡操作結論 (一句話)",
      "防守點提示 (明確點出跌破哪個價位停損)"
    ],
    "actionDecision": "Step 6-1: 懶人包結論。強制從這三個詞中選一個輸出：【買進】、【觀望】、【賣出】。絕對不可輸出其他文字。",
    "beginnerAdvice": "Step 6-2: 針對新手給出極簡潔明確的操作指引（包含【空手者】與【持有者】各一句話）。",
    "riskLevel": "極高 / 高 / 中 / 低風險"
  }
}

${dataContext}
`;

  let availableModels = [];
  try {
    availableModels = await fetchAvailableGeminiModels(apiKey);
  } catch (err) {
    console.warn('無法取得 Gemini 模型清單，改用內建備援清單:', err.message);
  }

  const modelsToTry = getGeminiModelCandidates(selectedModel, availableModels);
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const response = await requestGeminiModel(model, apiKey, prompt, null, null);
      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        const msg = errorJson.error?.message || response.statusText;
        lastError = new Error(`[${model}] ${msg}`);
        continue;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        lastError = new Error(`[${model}] 未回傳任何文字`);
        continue;
      }

      let parsed;
      try {
        parsed = parseGeminiJson(rawText);
      } catch {
        console.error('Gemini 輸出無法解析為 JSON:', rawText);
        lastError = new Error(`[${model}] 無法從回應中擷取 JSON 結構`);
        continue;
      }

      return {
        ...parsed,
        stockName: parsed.stockName || stockData.stockName,
        stockCode: stockData.symbol,
        openPrice: stockData.latest.open,
        highPrice: stockData.latest.high,
        lowPrice: stockData.latest.low,
        closePrice: stockData.latest.close,
        currentPrice: stockData.latest.close,
        priceChange: stockData.latest.priceChange,
        changePercent: stockData.latest.changePercent,
        latestDate: stockData.latest.date,
        movingAverages: {
          ma5: stockData.latest.ma5,
          ma10: stockData.latest.ma10,
          ma20: stockData.latest.ma20,
          ma60: stockData.latest.ma60
        },
        detectedPatterns: Array.isArray(parsed.detectedPatterns) ? parsed.detectedPatterns : [],
        prediction: parsed.prediction || {},
        volume: stockData.latest.formattedVolume || parsed.volume || `${stockData.latest.volume} 股`,
        meta: stockData.meta,
        marketContext: marketContext || null,
        stockData: stockData, // 包含完整 historicalData 與均線
        isGeminiVision: false,
        usedModel: model,
        analyzedAt: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('所有 Gemini 模型均無法解析，請檢查 API Key 是否正確');
}

export async function fetchAvailableGeminiModels(apiKey) {
  const normalizedKey = apiKey.trim();
  const now = Date.now();
  if (geminiModelCache && geminiModelCache.apiKey === normalizedKey && geminiModelCache.expiresAt > now) {
    return geminiModelCache.models;
  }

  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models`,
    { headers: { 'x-goog-api-key': normalizedKey } },
    15000
  );
  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.error?.message || `獲取模型列表失敗 (HTTP ${response.status})`);
  }

  const data = await response.json();
  const models = Array.isArray(data.models) ? data.models : [];
  geminiModelCache = {
    apiKey: normalizedKey,
    models,
    expiresAt: now + GEMINI_MODEL_CACHE_TTL
  };
  return models;
}

export function getGeminiModelCandidates(selectedModel = 'auto', availableModels = []) {
  const selected = normalizeModelName(selectedModel);
  const configuredModels = [...new Set([
    ...(selected && selected !== 'auto' ? [selected] : []),
    ...DEFAULT_GEMINI_MODELS
  ])];
  const availableFlashModels = [...new Set(
    availableModels
      .filter(model => model.supportedGenerationMethods?.includes('generateContent'))
      .map(model => normalizeModelName(model.name))
      .filter(isFreeVisionModel)
  )];

  if (availableFlashModels.length === 0) return configuredModels;

  const availableSet = new Set(availableFlashModels);
  const configuredAvailable = configuredModels.filter(model => availableSet.has(model));
  const discoveredAvailable = availableFlashModels.filter(model => !configuredModels.includes(model));
  return [...new Set([...configuredAvailable, ...discoveredAvailable])];
}

function normalizeModelName(modelName = '') {
  let name = modelName.replace(/^models\//, '').trim();
  if (name.includes('2.5')) {
    name = name.replace('2.5', '2.0');
  }
  return name;
}

function isFreeVisionModel(modelName) {
  if (!modelName || !modelName.startsWith('gemini-')) return false;
  if (/(?:-image|-tts|-live|embedding|robotics|computer-use|deep-research)/i.test(modelName)) return false;
  return /flash|pro|thinking/i.test(modelName);
}

async function requestGeminiModel(model, apiKey, prompt, mimeType, cleanBase64) {
  const isThinkingModel = model.includes('thinking');
  const generationConfig = {
    temperature: 0.2,
    ...(isThinkingModel ? {} : { responseMimeType: 'application/json' })
  };

  const parts = [{ text: prompt }];
  if (mimeType && cleanBase64) {
    parts.push({
      inlineData: {
        mimeType,
        data: cleanBase64
      }
    });
  }

  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig
  });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body
      }, 45000);

      if (response.ok || !retryableStatuses.has(response.status) || attempt === 1) return response;
      await wait(800 * (attempt + 1));
    } catch (err) {
      if (attempt === 1) throw err;
      await wait(800 * (attempt + 1));
    }
  }

  throw new Error(`[${model}] 請求失敗`);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function parseGeminiJson(rawText) {
  const normalizedText = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(normalizedText);
  } catch {
    const start = normalizedText.indexOf('{');
    if (start === -1) throw new Error('找不到 JSON 物件');

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < normalizedText.length; index += 1) {
      const character = normalizedText[index];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === '\\') {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }

      if (character === '"') inString = true;
      if (character === '{') depth += 1;
      if (character === '}') depth -= 1;
      if (depth === 0) {
        const candidate = normalizedText.slice(start, index + 1).replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(candidate);
      }
    }
  }

  throw new Error('JSON 結構不完整');
}
