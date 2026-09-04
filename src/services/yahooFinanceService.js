/**
 * K-Line Master - 股票與市場行情數據服務
 * 整合 FinMind 官方開放資料集（原生 CORS 直連）與 Yahoo Finance 多層代理備援架構
 */

/**
 * 通用 K 線資料正規化與技術指標（MA、MV）計算
 */
function formatKLineDataSet(validData, symbol, stockName, meta = {}, days = 90) {
  if (!validData || validData.length === 0) {
    throw new Error('無有效的歷史價格資料');
  }

  // 確保日期由舊至新嚴格排序
  validData.sort((a, b) => new Date(a.date) - new Date(b.date));

  // 計算價格均線 (MA)
  const calculateMA = (data, period) => {
    return data.map((item, index) => {
      if (index < period - 1) return null;
      const sum = data.slice(index - period + 1, index + 1).reduce((acc, curr) => acc + curr.close, 0);
      return Number((sum / period).toFixed(2));
    });
  };

  // 計算量均線 (MV，以張為單位)
  const calculateMV = (data, period) => {
    return data.map((item, index) => {
      if (index < period - 1) return null;
      const sum = data.slice(index - period + 1, index + 1).reduce((acc, curr) => acc + (curr.volume || 0), 0);
      return Number((sum / period / 1000).toFixed(2));
    });
  };

  const ma5 = calculateMA(validData, 5);
  const ma10 = calculateMA(validData, 10);
  const ma20 = calculateMA(validData, 20);
  const ma60 = calculateMA(validData, 60);
  const ma120 = calculateMA(validData, 120);
  const ma240 = calculateMA(validData, 240);

  const mv5 = calculateMV(validData, 5);
  const mv20 = calculateMV(validData, 20);

  const formattedData = validData.map((item, index) => {
    const volumeLots = item.volume ? Math.round(item.volume / 1000) : 0;
    return {
      ...item,
      volumeLots,
      ma5: ma5[index],
      ma10: ma10[index],
      ma20: ma20[index],
      ma60: ma60[index],
      ma120: ma120[index],
      ma240: ma240[index],
      mv5: mv5[index],
      mv20: mv20[index]
    };
  });

  // 只回傳最近 `days` 天的數據以利前端圖表渲染與節省 Token
  const recentData = formattedData.slice(-days);
  const latest = recentData[recentData.length - 1];
  const previous = recentData.length > 1 ? recentData[recentData.length - 2] : latest;

  const priceChange = Number((latest.close - previous.close).toFixed(2));
  const changePercent = Number(((priceChange / previous.close) * 100).toFixed(2));

  const volumeLots = latest.volume ? Math.round(latest.volume / 1000) : 0;
  const formattedVolume = `${volumeLots.toLocaleString()} 張 (${(latest.volume || 0).toLocaleString()} 股)`;

  // 計算 52 週（約近 250 個交易日）最高與最低價
  const recent250 = validData.slice(-250);
  const fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh ?? Math.max(...recent250.map(d => d.high));
  const fiftyTwoWeekLow = meta.fiftyTwoWeekLow ?? Math.min(...recent250.map(d => d.low));

  return {
    symbol,
    stockName: stockName || symbol,
    meta: {
      fiftyTwoWeekHigh,
      fiftyTwoWeekLow,
      regularMarketDayHigh: meta.regularMarketDayHigh ?? latest.high,
      regularMarketDayLow: meta.regularMarketDayLow ?? latest.low,
      chartPreviousClose: meta.chartPreviousClose ?? previous.close
    },
    latest: {
      date: latest.date,
      open: typeof latest.open === 'number' ? Number(latest.open.toFixed(2)) : (latest.close || 0),
      high: typeof latest.high === 'number' ? Number(latest.high.toFixed(2)) : (latest.close || 0),
      low: typeof latest.low === 'number' ? Number(latest.low.toFixed(2)) : (latest.close || 0),
      close: typeof latest.close === 'number' ? Number(latest.close.toFixed(2)) : 0,
      volume: latest.volume || 0,
      formattedVolume,
      priceChange: typeof priceChange === 'number' && !isNaN(priceChange) ? priceChange : 0,
      changePercent: typeof changePercent === 'number' && !isNaN(changePercent) ? changePercent : 0,
      ma5: latest.ma5,
      ma10: latest.ma10,
      ma20: latest.ma20,
      ma60: latest.ma60,
      ma120: latest.ma120,
      ma240: latest.ma240
    },
    historicalData: recentData,
    fullHistoricalData: formattedData
  };
}

/**
 * 取得可用之 Yahoo Finance 代理服務清單（排除報 403 之棄用無 Key Proxy）
 */
function getProxyList() {
  const isLocalDev = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const proxies = [];

  // 1. 本地 Vite 開發環境優先使用 Vite Proxy (乾淨穩定且無外部限制)
  if (isLocalDev) {
    proxies.push('LOCAL_VITE_PROXY');
  }

  // 2. 使用者於設定中配置的自訂 Proxy 或 Corsproxy.io API Key
  try {
    const customProxy = typeof localStorage !== 'undefined' ? localStorage.getItem('kline_custom_proxy') : null;
    if (customProxy && customProxy.trim()) {
      proxies.push(customProxy.trim());
    }

    const corsproxyKey = typeof localStorage !== 'undefined' ? localStorage.getItem('kline_corsproxy_api_key') : null;
    if (corsproxyKey && corsproxyKey.trim()) {
      proxies.push(`https://corsproxy.io/?key=${corsproxyKey.trim()}&url=`);
    }
  } catch {
    // 忽略 localStorage 異常
  }

  // 3. 公開可用 CORS 代理備援（注意：corsproxy.io 未帶 Key 會報 403，故不再加入無 Key corsproxy.io）
  proxies.push('https://api.allorigins.win/raw?url=');
  proxies.push('https://api.codetabs.com/v1/proxy?quest=');

  return proxies;
}

/**
 * 從 FinMind 官方開放資料集獲取台股 K 線歷史數據（原生支援 CORS，免代理直連）
 */
async function fetchStockDataFromFinMind(stockCode, days = 90) {
  const cleanCode = stockCode.trim().toUpperCase().replace(/\.(TW|TWO)$/, '');

  // 檢查是否符合台股代號格式（4~6 碼數字，可帶一碼英文字母，如 2330, 0050, 6488, 00400A）
  if (!/^[0-9]{4,6}[A-Z]?$/.test(cleanCode)) {
    return null;
  }

  // 抓取 2 年歷史資料以計算 MA120/MA240
  const startDate = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const priceUrl = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=${cleanCode}&start_date=${startDate}`;
  const infoUrl = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo&data_id=${cleanCode}`;

  try {
    const [priceRes, infoRes] = await Promise.all([
      fetch(priceUrl, { signal: AbortSignal.timeout(8000) }),
      fetch(infoUrl, { signal: AbortSignal.timeout(5000) }).catch(() => null)
    ]);

    if (!priceRes.ok) {
      return null;
    }

    const priceJson = await priceRes.json().catch(() => ({}));
    if (!priceJson.data || !Array.isArray(priceJson.data) || priceJson.data.length === 0) {
      return null;
    }

    let stockName = cleanCode;
    let symbolSuffix = '.TW';

    if (infoRes && infoRes.ok) {
      const infoJson = await infoRes.json().catch(() => ({}));
      const infoItem = infoJson.data?.[0];
      if (infoItem?.stock_name) {
        stockName = infoItem.stock_name;
      }
      if (infoItem?.type === 'tpex') {
        symbolSuffix = '.TWO';
      }
    }

    const validData = priceJson.data
      .filter(item => typeof item.close === 'number' && !isNaN(item.close) && item.close > 0)
      .map(item => ({
        date: item.date,
        open: Number(Number(item.open || item.close).toFixed(2)),
        high: Number(Number(item.max || item.close).toFixed(2)),
        low: Number(Number(item.min || item.close).toFixed(2)),
        close: Number(Number(item.close).toFixed(2)),
        volume: Number(item.Trading_Volume || 0)
      }));

    if (validData.length === 0) {
      return null;
    }

    const finalSymbol = `${cleanCode}${symbolSuffix}`;
    return formatKLineDataSet(validData, finalSymbol, stockName, {}, days);
  } catch (err) {
    console.warn(`FinMind 載入 ${cleanCode} 失敗，將轉向 Yahoo Finance:`, err.message);
    return null;
  }
}

/**
 * 從 Yahoo Finance 獲取 K 線歷史數據 (OHLCV)
 */
async function fetchStockDataFromYahoo(stockCode, days = 90) {
  let symbol = stockCode.trim().toUpperCase();
  let symbolsToTry = [symbol];
  if (!symbol.includes('.')) {
    symbolsToTry = [`${symbol}.TW`, `${symbol}.TWO`];
  }

  const range = '2y';
  const interval = '1d';
  const proxies = getProxyList();

  let lastError = null;
  let rawData = null;
  let finalSymbol = symbol;

  for (const proxy of proxies) {
    let proxyFailed = false;

    for (const sym of symbolsToTry) {
      try {
        let url;
        if (proxy === 'LOCAL_VITE_PROXY') {
          url = `/api/yahoo-query/v8/finance/chart/${sym}?range=${range}&interval=${interval}`;
        } else {
          const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=${range}&interval=${interval}`;
          url = proxy.endsWith('=') ? `${proxy}${encodeURIComponent(targetUrl)}` : `${proxy}${targetUrl}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          if (proxy === 'LOCAL_VITE_PROXY' && response.status === 404) {
            continue; // Vite 代理回傳 404 代表該 symbol 不存在，嘗試下一個 symbol
          }
          proxyFailed = true;
          throw new Error(`Proxy ${proxy} returned ${response.status}`);
        }

        let data;
        try {
          data = await response.json();
        } catch {
          proxyFailed = true;
          throw new Error('Proxy 回傳非 JSON 格式');
        }

        if (data.chart && data.chart.error) {
          throw new Error(data.chart.error.description);
        }
        if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
          throw new Error('查無此股票代碼或無交易資料');
        }

        rawData = data.chart.result[0];
        finalSymbol = sym;
        break;
      } catch (err) {
        lastError = err;
        if (proxyFailed) break;
      }
    }

    if (rawData) break;
  }

  if (!rawData) {
    throw new Error(`無法獲取 K 線資料，請確認股號是否正確。(${lastError?.message || '網路連線異常'})`);
  }

  const timestamps = rawData.timestamp || [];
  const quote = rawData.indicators.quote[0] || {};
  const opens = quote.open || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const closes = quote.close || [];
  const volumes = quote.volume || [];

  const validData = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (typeof c === 'number' && !isNaN(c)) {
      const o = typeof opens[i] === 'number' && !isNaN(opens[i]) ? opens[i] : c;
      const h = typeof highs[i] === 'number' && !isNaN(highs[i]) ? highs[i] : Math.max(o, c);
      const l = typeof lows[i] === 'number' && !isNaN(lows[i]) ? lows[i] : Math.min(o, c);
      const v = typeof volumes[i] === 'number' && !isNaN(volumes[i]) ? volumes[i] : 0;
      validData.push({
        date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
        open: Number(o.toFixed(2)),
        high: Number(h.toFixed(2)),
        low: Number(l.toFixed(2)),
        close: Number(c.toFixed(2)),
        volume: v
      });
    }
  }

  const meta = rawData.meta || {};
  const stockName = meta.shortName || meta.longName || finalSymbol;

  return formatKLineDataSet(validData, finalSymbol, stockName, meta, days);
}

/**
 * 獲取個股 K 線歷史資料 (OHLCV)
 * 優先使用官方直連 FinMind (支援台股上市櫃/ETF)，若非台股或抓取失敗則平滑降級至 Yahoo Finance 多重代理
 * @param {string} stockCode - 股票代碼 (如 2330, 0050, 6488 或 TSLA)
 * @param {number} days - 前端回傳天數 (預設 90 天)
 */
export async function fetchStockData(stockCode, days = 90) {
  // 1. 若為台股代碼，優先調用 FinMind 原生免代理 API (速度快、無 CORS 限制、不依賴外部 Proxy)
  const finMindData = await fetchStockDataFromFinMind(stockCode, days);
  if (finMindData) {
    return finMindData;
  }

  // 2. 若 FinMind 無資料或為外盤/自訂代碼，切換至 Yahoo Finance 代理架構
  return await fetchStockDataFromYahoo(stockCode, days);
}

/**
 * 抓取台指期（夜盤/近月 WTX&）最新報價
 */
export async function fetchTaiwanFuturesQuote(displayName = '台指期近一 (夜盤/近月)') {
  const isLocalDev = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // 1. 本地開發優先使用 Vite Proxy 查詢 Yahoo 奇摩即時盤
  if (isLocalDev) {
    try {
      const url = '/api/yahoo-tw/_td-stock/api/resource/StockServices.stockList;symbols=%5B%22WTX%26%22%5D';
      const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const item = data[0];
          const rawPrice = item.price?.raw ?? item.price?.sort ?? item.price?.fmt;
          const price = typeof rawPrice === 'string' ? parseFloat(rawPrice.replace(/,/g, '')) : Number(rawPrice);
          const rawChange = item.change?.raw ?? item.change?.sort ?? item.change?.fmt;
          const priceChange = typeof rawChange === 'string' ? parseFloat(rawChange.replace(/,/g, '')) : Number(rawChange);

          let changePercent = 0;
          if (item.changePercent) {
            changePercent = parseFloat(String(item.changePercent).replace('%', ''));
          } else if (item.regularMarketPreviousClose?.raw) {
            const prev = parseFloat(item.regularMarketPreviousClose.raw);
            changePercent = prev ? Number(((priceChange / prev) * 100).toFixed(2)) : 0;
          }

          if (!isNaN(price) && price > 0) {
            return {
              symbol: 'WTX&',
              name: displayName || item.symbolName || '台指期近一 (夜盤/近月)',
              price: Number(price.toFixed(2)),
              priceChange: Number(priceChange.toFixed(2)),
              changePercent: Number(changePercent.toFixed(2))
            };
          }
        }
      }
    } catch {
      // 降級至 FinMind
    }
  }

  // 2. 透過 FinMind 原生免代理 API 抓取台指期最新日盤/夜盤數據
  try {
    const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const res = await fetch(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanFuturesDaily&data_id=TX&start_date=${startDate}`, {
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      const valid = (data.data || []).filter(d => typeof d.close === 'number' && d.close > 0);
      if (valid.length > 0) {
        const latest = valid[valid.length - 1];
        const price = Number(latest.close);
        const priceChange = Number(latest.spread || 0);
        const changePercent = Number(latest.spread_per || (priceChange && (price - priceChange) ? ((priceChange / (price - priceChange)) * 100).toFixed(2) : 0));
        return {
          symbol: 'WTX&',
          name: displayName || '台指期近一 (夜盤/近月)',
          price,
          priceChange,
          changePercent
        };
      }
    }
  } catch {
    // 忽略錯誤
  }

  return null;
}

/**
 * 抓取單一標的最新報價簡要數據
 */
export async function fetchSingleQuote(symbol, displayName = null) {
  // 台指期代碼專用邏輯
  if (symbol === 'WTX&' || symbol === 'TXF=F' || symbol === 'WTX') {
    const twFutures = await fetchTaiwanFuturesQuote(displayName);
    if (twFutures) return twFutures;
  }

  // 加權指數 / 櫃買指數 原生免代理支援 (CORS 友善)
  if (symbol === '^TWII' || symbol === '^TWOII') {
    const finMindId = symbol === '^TWII' ? 'TAIEX' : 'TPEx';
    const defaultName = symbol === '^TWII' ? '加權指數 (大盤)' : '櫃買指數 (OTC)';
    try {
      const startDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = await fetch(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=${finMindId}&start_date=${startDate}`, {
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const data = await res.json();
        const list = (data.data || []).filter(d => typeof d.close === 'number' && d.close > 0);
        if (list.length > 0) {
          const latest = list[list.length - 1];
          const prev = list.length > 1 ? list[list.length - 2] : latest;
          const price = Number(latest.close);
          const priceChange = Number((price - prev.close).toFixed(2));
          const changePercent = prev.close ? Number(((priceChange / prev.close) * 100).toFixed(2)) : 0;
          return {
            symbol,
            name: displayName || defaultName,
            price: Number(price.toFixed(2)),
            priceChange,
            changePercent
          };
        }
      }
    } catch {
      // 降級至 Yahoo 代理
    }
  }

  // 透過可用代理清單抓取 Yahoo Finance
  const range = '5d';
  const interval = '1d';
  const proxies = getProxyList();

  for (const proxy of proxies) {
    try {
      let url;
      if (proxy === 'LOCAL_VITE_PROXY') {
        url = `/api/yahoo-query/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
      } else {
        const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
        url = proxy.endsWith('=') ? `${proxy}${encodeURIComponent(targetUrl)}` : `${proxy}${targetUrl}`;
      }

      const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!response.ok) continue;

      const data = await response.json();
      const result = data?.chart?.result?.[0];
      if (!result) continue;

      const meta = result.meta || {};
      const quote = result.indicators?.quote?.[0] || {};
      const closes = (quote.close || []).filter(c => c !== null && c !== undefined);

      if (closes.length === 0) continue;

      const latestClose = closes[closes.length - 1];
      const prevClose = closes.length > 1 ? closes[closes.length - 2] : (meta.chartPreviousClose || latestClose);
      const priceChange = Number((latestClose - prevClose).toFixed(2));
      const changePercent = prevClose ? Number(((priceChange / prevClose) * 100).toFixed(2)) : 0;

      return {
        symbol,
        name: displayName || meta.shortName || meta.symbol || symbol,
        price: Number(latestClose.toFixed(2)),
        priceChange,
        changePercent
      };
    } catch {
      // 靜默嘗試下一個 Proxy
    }
  }

  return null;
}

/**
 * 依據勾選條件抓取美股與期貨市場連動數據
 */
export async function fetchMarketContextData({ includeFutures = true, includeUS = true } = {}) {
  const tasks = [];
  const results = {
    futuresAndIndex: [],
    usMarkets: []
  };

  // 1. 台股期現貨抓取
  if (includeFutures) {
    const twSymbols = [
      { symbol: 'WTX&', name: '台指期近一 (夜盤/近月)' },
      { symbol: '^TWII', name: '加權指數 (大盤)' },
      { symbol: '^TWOII', name: '櫃買指數 (OTC)' }
    ];

    twSymbols.forEach(({ symbol, name }) => {
      tasks.push(
        fetchSingleQuote(symbol, name).then(data => {
          if (data) results.futuresAndIndex.push(data);
        }).catch(() => {})
      );
    });
  }

  // 2. 美股與國際主要指數抓取
  if (includeUS) {
    const usSymbols = [
      { symbol: '^SOX', name: '費城半導體' },
      { symbol: '^IXIC', name: '那斯達克' },
      { symbol: '^DJI', name: '道瓊工業' },
      { symbol: '^GSPC', name: 'S&P 500' },
      { symbol: 'TSM', name: '台積電 ADR' },
      { symbol: 'NVDA', name: '輝達 (NVDA)' },
      { symbol: '^N225', name: '日經 225' },
      { symbol: '^HSI', name: '香港恒生' }
    ];

    usSymbols.forEach(({ symbol, name }) => {
      tasks.push(
        fetchSingleQuote(symbol, name).then(data => {
          if (data) results.usMarkets.push(data);
        }).catch(() => {})
      );
    });
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }

  return results;
}
