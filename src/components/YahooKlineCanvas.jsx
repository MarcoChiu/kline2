import { useRef, useEffect, useState, useMemo } from 'react';
import { Download, Layers } from 'lucide-react';
import { KLINE_PATTERNS } from '../data/klinePatterns';
import { detectHistoricalPatterns } from '../services/localQuantitativeService';

/**
 * Yahoo 奇摩股市風格 K 線圖表與籌碼 K 線標註系統
 */
export default function YahooKlineCanvas({ stockData, stockName: propStockName, prediction, detectedPatterns, onPatternClick }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const badgeHitBoxesRef = useRef([]);
  const [hoveredBadgePattern, setHoveredBadgePattern] = useState(null);

  // 統一採用傳入或分析得出之中文股票名稱
  const effectiveStockName = propStockName || stockData?.stockName || stockData?.symbol || '台股標的';

  // 均線顯示狀態
  const [maVisible, setMaVisible] = useState({
    ma5: true,
    ma10: true,
    ma20: true,
    ma60: true,
    ma120: false,
    ma240: false
  });

  // 籌碼 K 線標註圖層開關
  const [showChipAnnotations, setShowChipAnnotations] = useState(true);

  // 游標懸浮索引 (null 代表最新一根)
  const [hoverIndex, setHoverIndex] = useState(null);

  // 歷史數據整理
  const historicalData = useMemo(() => {
    if (!stockData || !stockData.historicalData || stockData.historicalData.length === 0) {
      return [];
    }
    return stockData.historicalData;
  }, [stockData]);

  // 全歷史 K 棒形態極速掃描 (毫秒級計算)
  const historicalPatternMatches = useMemo(() => {
    if (!historicalData || historicalData.length === 0) return [];
    return detectHistoricalPatterns(historicalData);
  }, [historicalData]);

  // 依據 K 棒索引快速查詢形態
  const patternByIndex = useMemo(() => {
    const map = new Map();
    historicalPatternMatches.forEach(p => map.set(p.index, p));
    return map;
  }, [historicalPatternMatches]);

  // 擷取 AI 關鍵價位 (天花板 / 地板 / 防守線)
  const primaryResistance = prediction?.resistanceLevels?.[0];
  const primarySupport = prediction?.supportLevels?.[0];
  const stopLoss = prediction?.orderBooking?.stopLossLimit;

  // 取得最新一根 K 棒的形態
  const latestPattern = detectedPatterns?.[0] || (historicalPatternMatches.length > 0 ? historicalPatternMatches[historicalPatternMatches.length - 1] : null);

  // 手機裝置偵測與響應式高度
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);

  const activeIndex = hoverIndex !== null && hoverIndex >= 0 && hoverIndex < historicalData.length
    ? hoverIndex
    : (historicalData.length > 0 ? historicalData.length - 1 : null);

  const currentItem = activeIndex !== null ? historicalData[activeIndex] : null;
  const prevItem = activeIndex !== null && activeIndex > 0 ? historicalData[activeIndex - 1] : currentItem;

  // 計算選中項目的漲跌
  const priceChange = currentItem && prevItem ? Number((currentItem.close - prevItem.close).toFixed(2)) : 0;
  const changePercent = prevItem && prevItem.close ? Number(((priceChange / prevItem.close) * 100).toFixed(2)) : 0;

  // 當前 Hover 的 K 棒是否具有形態訊號 (僅針對過去歷史天數)
  const isHoveringPastCandle = hoverIndex !== null && hoverIndex < historicalData.length - 1;
  const hoveredPastPattern = isHoveringPastCandle ? patternByIndex.get(hoverIndex) : null;
  const displayPattern = hoveredPastPattern || latestPattern;

  // 統一保證形態必有對應交易日期 (最新日與歷史日 100% 都有日期)
  const effectiveLatestDate = currentItem?.date || stockData?.latest?.date || (historicalData.length > 0 ? historicalData[historicalData.length - 1]?.date : '');
  const patternDate = isHoveringPastCandle
    ? (displayPattern?.date || (hoverIndex !== null && historicalData[hoverIndex]?.date) || '')
    : (displayPattern?.date || effectiveLatestDate);

  // 繪製 Canvas 圖表
  const renderChart = () => {
    const canvas = canvasRef.current;
    if (!canvas || historicalData.length === 0) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 2;

    const displayWidth = canvas.clientWidth || 800;
    const mobileMode = displayWidth < 640;
    const displayHeight = mobileMode ? 380 : 480;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);

    const width = displayWidth;
    const height = displayHeight;

    // 清空背景 (Yahoo 奇摩經典白底)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 版面劃分
    const paddingLeft = 8;
    const paddingRight = mobileMode ? 50 : 60; // 留給 Y 軸價格與量能數值
    const topChartTop = 15;
    const topChartHeight = mobileMode ? 220 : 280;
    const midGap = mobileMode ? 28 : 35; // 成交量標題列空間
    const bottomChartTop = topChartTop + topChartHeight + midGap;
    const bottomChartHeight = mobileMode ? 85 : 110;
    const chartWidth = width - paddingLeft - paddingRight;

    // 1. 繪製股票中文標題、代碼與價格行情 (確保產生的圖片清楚包含中文股名)
    ctx.save();
    ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'left';
    const stockDisplayName = effectiveStockName;
    const stockSymbolText = stockData?.symbol ? `(${stockData.symbol})` : '';
    ctx.fillText(`${stockDisplayName} ${stockSymbolText}`.trim(), paddingLeft + 12, topChartTop + 24);

    if (currentItem) {
      const isUp = priceChange > 0;
      const isDown = priceChange < 0;
      const priceColor = isUp ? '#ef4444' : isDown ? '#10b981' : '#64748b';
      ctx.font = 'bold 13px "JetBrains Mono", monospace';
      ctx.fillStyle = priceColor;
      const priceText = `${currentItem.close}  ${priceChange > 0 ? '+' : ''}${priceChange} (${changePercent > 0 ? '+' : ''}${changePercent}%)`;
      ctx.fillText(priceText, paddingLeft + 12, topChartTop + 42);

      ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`資料日期：${currentItem.date}`, paddingLeft + 12, topChartTop + 57);
    }

    // Yahoo! 股市 水印靠右上方
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = 'rgba(203, 213, 225, 0.4)';
    ctx.textAlign = 'right';
    ctx.fillText('Yahoo! 股市', width - paddingRight - 10, topChartTop + 24);
    ctx.restore();

    // 2. 計算主圖價格範圍 (OHLC + 均線)
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let minPriceIdx = -1;
    let maxPriceIdx = -1;

    historicalData.forEach((d, idx) => {
      if (d.low < minPrice) {
        minPrice = d.low;
        minPriceIdx = idx;
      }
      if (d.high > maxPrice) {
        maxPrice = d.high;
        maxPriceIdx = idx;
      }
      if (maVisible.ma5 && d.ma5) {
        minPrice = Math.min(minPrice, d.ma5);
        maxPrice = Math.max(maxPrice, d.ma5);
      }
      if (maVisible.ma10 && d.ma10) {
        minPrice = Math.min(minPrice, d.ma10);
        maxPrice = Math.max(maxPrice, d.ma10);
      }
      if (maVisible.ma20 && d.ma20) {
        minPrice = Math.min(minPrice, d.ma20);
        maxPrice = Math.max(maxPrice, d.ma20);
      }
      if (maVisible.ma60 && d.ma60) {
        minPrice = Math.min(minPrice, d.ma60);
        maxPrice = Math.max(maxPrice, d.ma60);
      }
    });

    // 增加 6% 留白緩衝
    const priceBuffer = (maxPrice - minPrice) * 0.06 || 1;
    const chartMinPrice = minPrice - priceBuffer;
    const chartMaxPrice = maxPrice + priceBuffer;
    const priceRange = chartMaxPrice - chartMinPrice || 1;

    const getY = (price) => {
      return topChartTop + (1 - (price - chartMinPrice) / priceRange) * topChartHeight;
    };

    // 3. 計算副圖成交量範圍
    let maxVolumeLots = 0;
    historicalData.forEach((d) => {
      const vol = d.volumeLots || (d.volume ? Math.round(d.volume / 1000) : 0);
      if (vol > maxVolumeLots) maxVolumeLots = vol;
      if (d.mv5 && d.mv5 > maxVolumeLots) maxVolumeLots = d.mv5;
      if (d.mv20 && d.mv20 > maxVolumeLots) maxVolumeLots = d.mv20;
    });
    maxVolumeLots = maxVolumeLots * 1.15 || 100;

    const getVolY = (volLots) => {
      return bottomChartTop + (1 - volLots / maxVolumeLots) * bottomChartHeight;
    };

    // 4. 繪製主圖與副圖網格線與 Y 軸標籤
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;

    // 主圖網格與價格軸
    const priceSteps = 6;
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'left';

    for (let i = 0; i <= priceSteps; i++) {
      const p = chartMinPrice + (priceRange / priceSteps) * i;
      const y = getY(p);

      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();

      // 價格標籤 (靠右對齊在右側邊界)
      ctx.fillText(p.toFixed(p > 100 ? 1 : 2), width - paddingRight + 6, y + 4);
    }

    // 副圖網格與成交量軸
    const volSteps = 3;
    for (let i = 1; i <= volSteps; i++) {
      const v = (maxVolumeLots / volSteps) * i;
      const y = getVolY(v);

      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();

      const label = v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${Math.round(v)}`;
      ctx.fillText(label, width - paddingRight + 6, y + 4);
    }

    // 5. 繪製 K 棒與成交量柱狀體
    const count = historicalData.length;
    const barWidth = Math.max(2, (chartWidth / count) * 0.7);
    const stepX = chartWidth / count;

    const getX = (idx) => paddingLeft + idx * stepX + stepX / 2;

    // 記錄月份變更點供 X 軸繪製
    const monthMarkers = [];
    let lastMonth = null;

    historicalData.forEach((d, idx) => {
      const x = getX(idx);
      const isUp = d.close >= d.open;
      const candleColor = isUp ? '#ef4444' : '#10b981'; // 經典紅漲綠跌

      const yOpen = getY(d.open);
      const yClose = getY(d.close);
      const yHigh = getY(d.high);
      const yLow = getY(d.low);

      // (A) 繪製上下影線
      ctx.strokeStyle = candleColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();

      // (B) 繪製 K 棒實體 (蠟燭本體)
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(1.5, Math.abs(yClose - yOpen));
      ctx.fillStyle = candleColor;
      ctx.fillRect(x - barWidth / 2, bodyTop, barWidth, bodyHeight);

      // (C) 繪製成交量柱狀圖
      const volLots = d.volumeLots || (d.volume ? Math.round(d.volume / 1000) : 0);
      const yVol = getVolY(volLots);
      const baseVolY = bottomChartTop + bottomChartHeight;
      const volHeight = Math.max(1, baseVolY - yVol);

      ctx.fillStyle = candleColor;
      ctx.fillRect(x - barWidth / 2, yVol, barWidth, volHeight);

      // (D) 檢查月份標記
      if (d.date) {
        const month = d.date.substring(5, 7);
        if (lastMonth && month !== lastMonth) {
          monthMarkers.push({
            x,
            label: `${parseInt(month, 10)}月`
          });
        }
        lastMonth = month;
      }
    });

    // 6. 繪製底部 X 軸月份時間刻度
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, bottomChartTop + bottomChartHeight);
    ctx.lineTo(width - paddingRight, bottomChartTop + bottomChartHeight);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';

    monthMarkers.forEach((m) => {
      // 繪製刻度虛線與文字
      ctx.beginPath();
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = '#e2e8f0';
      ctx.moveTo(m.x, topChartTop);
      ctx.lineTo(m.x, bottomChartTop + bottomChartHeight);
      ctx.stroke();
      ctx.setLineDash([]); // 重設實線

      ctx.fillText(m.label, m.x, bottomChartTop + bottomChartHeight + 16);
    });

    // 7. 繪製 MA 均線 (主圖)
    const drawLine = (propName, color, lineWidth = 1.2) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      let started = false;

      historicalData.forEach((d, idx) => {
        const val = d[propName];
        if (val !== null && val !== undefined) {
          const x = getX(idx);
          const y = getY(val);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      });
      if (started) ctx.stroke();
    };

    if (maVisible.ma5) drawLine('ma5', '#2563eb', 1.3);     // MA5 藍色
    if (maVisible.ma10) drawLine('ma10', '#8b5cf6', 1.3);   // MA10 紫色
    if (maVisible.ma20) drawLine('ma20', '#f97316', 1.4);   // MA20 橘色
    if (maVisible.ma60) drawLine('ma60', '#eab308', 1.4);   // MA60 黃色
    if (maVisible.ma120) drawLine('ma120', '#0891b2', 1.2); // MA120 青色
    if (maVisible.ma240) drawLine('ma240', '#64748b', 1.2); // MA240 灰色

    // 8. 繪製 MV 量均線 (副圖)
    const drawVolLine = (propName, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      let started = false;

      historicalData.forEach((d, idx) => {
        const val = d[propName];
        if (val !== null && val !== undefined) {
          const x = getX(idx);
          const y = getVolY(val);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      });
      if (started) ctx.stroke();
    };

    drawVolLine('mv5', '#2563eb');  // MV5 藍色
    drawVolLine('mv20', '#f97316'); // MV20 橘色

    // 9. 標註區間最高價與最低價標籤 (奇摩經典標示)
    if (maxPriceIdx >= 0 && historicalData[maxPriceIdx]) {
      const hx = getX(maxPriceIdx);
      const hy = getY(historicalData[maxPriceIdx].high);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = hx > width - 120 ? 'right' : 'left';
      ctx.fillText(`▲ ${maxPrice.toFixed(2)}`, hx > width - 120 ? hx - 4 : hx + 4, hy - 4);
    }

    if (minPriceIdx >= 0 && historicalData[minPriceIdx]) {
      const lx = getX(minPriceIdx);
      const ly = getY(historicalData[minPriceIdx].low);
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = lx > width - 120 ? 'right' : 'left';
      ctx.fillText(`▼ ${minPrice.toFixed(2)}`, lx > width - 120 ? lx - 4 : lx + 4, ly + 14);
    }

    // 10. 籌碼 K 線 App 標註圖層 (Chip-K Annotations Overlay)
    if (showChipAnnotations) {
      ctx.save();
      badgeHitBoxesRef.current = [];

      // (A) 繪製 AI 預測之天花板壓力線 (紅虛線) + 右側價格軸標籤
      if (primaryResistance && primaryResistance >= chartMinPrice && primaryResistance <= chartMaxPrice) {
        const resY = getY(primaryResistance);
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.moveTo(paddingLeft, resY);
        ctx.lineTo(width - paddingRight, resY);
        ctx.stroke();
        ctx.setLineDash([]);

        // 右側價格軸標籤 (TradingView 樣式紅膠囊，不遮擋左側文字與走勢)
        const tagW = paddingRight - 6;
        const tagH = 16;
        const tagX = width - paddingRight + 3;
        const tagY = resY - tagH / 2;
        ctx.fillStyle = '#ef4444';
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(tagX, tagY, tagW, tagH, 3);
          ctx.fill();
        } else {
          ctx.fillRect(tagX, tagY, tagW, tagH);
        }
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${primaryResistance}`, tagX + tagW / 2, resY + 3.5);
      }

      // (B) 繪製 AI 預測之地板支撐線 (綠虛線) + 右側價格軸標籤
      if (primarySupport && primarySupport >= chartMinPrice && primarySupport <= chartMaxPrice) {
        const supY = getY(primarySupport);
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.moveTo(paddingLeft, supY);
        ctx.lineTo(width - paddingRight, supY);
        ctx.stroke();
        ctx.setLineDash([]);

        // 右側價格軸標籤 (TradingView 樣式綠膠囊)
        const tagW = paddingRight - 6;
        const tagH = 16;
        const tagX = width - paddingRight + 3;
        const tagY = supY - tagH / 2;
        ctx.fillStyle = '#10b981';
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(tagX, tagY, tagW, tagH, 3);
          ctx.fill();
        } else {
          ctx.fillRect(tagX, tagY, tagW, tagH);
        }
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${primarySupport}`, tagX + tagW / 2, supY + 3.5);
      }

      // (C) 繪製防守停損點 (Invalidation Level) + 右側價格軸標籤
      if (stopLoss && stopLoss >= chartMinPrice && stopLoss <= chartMaxPrice) {
        const slY = getY(stopLoss);
        ctx.beginPath();
        ctx.setLineDash([2, 3]);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.2;
        ctx.moveTo(paddingLeft, slY);
        ctx.lineTo(width - paddingRight, slY);
        ctx.stroke();
        ctx.setLineDash([]);

        // 右側價格軸標籤 (TradingView 樣式橘膠囊)
        const tagW = paddingRight - 6;
        const tagH = 16;
        const tagX = width - paddingRight + 3;
        const tagY = slY - tagH / 2;
        ctx.fillStyle = '#f59e0b';
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(tagX, tagY, tagW, tagH, 3);
          ctx.fill();
        } else {
          ctx.fillRect(tagX, tagY, tagW, tagH);
        }
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${stopLoss}`, tagX + tagW / 2, slY + 3.5);
      }

      // (D) 歷史 K 棒形態微型標記 (Historical Pattern Badges)
      const lastBarIdx = historicalData.length - 1;
      historicalPatternMatches.forEach((pMatch) => {
        if (pMatch.index >= lastBarIdx) return; // 最新一根在 (E) 處繪製醒目主氣泡

        const px = getX(pMatch.index);
        const candle = pMatch.candle;
        const isBull = pMatch.sentiment === 'bullish';
        const markerColor = isBull ? '#ef4444' : '#10b981';
        
        // 標記在 K 棒上方(空頭)或下方(多頭)
        const py = isBull
          ? getY(candle.low) + 13
          : getY(candle.high) - 13;

        const isHovered = hoverIndex === pMatch.index || (hoveredBadgePattern && hoveredBadgePattern.index === pMatch.index);

        // 記錄 HitBox 供滑鼠點擊與懸浮
        badgeHitBoxesRef.current.push({
          x: px - 12,
          y: py - 10,
          width: 24,
          height: 20,
          pattern: pMatch,
          index: pMatch.index
        });

        // 繪製形態標記
        ctx.save();
        if (isHovered) {
          ctx.beginPath();
          ctx.arc(px, py, 8, 0, Math.PI * 2);
          ctx.fillStyle = isBull ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)';
          ctx.fill();
          ctx.strokeStyle = markerColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // 小圓圈節點
        ctx.beginPath();
        ctx.arc(px, py, isHovered ? 5.5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = markerColor;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // 懸浮時浮現精緻形態氣泡
        if (isHovered) {
          ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          const tipText = pMatch.date ? `🔥 ${pMatch.date} ${pMatch.name}` : `🔥 ${pMatch.name}`;
          const tipWidth = ctx.measureText(tipText).width + 14;
          const tipH = 18;
          const tipX = Math.max(paddingLeft, Math.min(px - tipWidth / 2, width - paddingRight - tipWidth));
          const tipY = isBull ? py + 10 : py - 22;

          ctx.fillStyle = '#0f172a';
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(tipX, tipY, tipWidth, tipH, 4);
            ctx.fill();
          } else {
            ctx.fillRect(tipX, tipY, tipWidth, tipH);
          }
          ctx.strokeStyle = markerColor;
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(tipText, tipX + tipWidth / 2, tipY + 12.5);
        }

        ctx.restore();
      });

      ctx.restore();
    }

    // 11. 十字游標 (Crosshair) 繪製
    if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < count && historicalData[hoverIndex]) {
      const hx = getX(hoverIndex);
      const hItem = historicalData[hoverIndex];
      const hy = getY(hItem.close);

      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;

      // 垂直游標線 (貫穿主圖與副圖)
      ctx.beginPath();
      ctx.moveTo(hx, topChartTop);
      ctx.lineTo(hx, bottomChartTop + bottomChartHeight);
      ctx.stroke();

      // 水平游標線 (主圖收盤價位)
      ctx.beginPath();
      ctx.moveTo(paddingLeft, hy);
      ctx.lineTo(width - paddingRight, hy);
      ctx.stroke();

      ctx.restore();
    }
  };

  // 監聽重繪與視窗縮放
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
      renderChart();
    };
    renderChart();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historicalData, effectiveStockName, maVisible, showChipAnnotations, hoverIndex, prediction, detectedPatterns, hoveredBadgePattern, historicalPatternMatches, isMobile]);

  // 手機觸控支援：在 K 線圖上滑動手指進行查價與歷史形態辨識
  const handleTouchMove = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    const canvas = canvasRef.current;
    if (!canvas || historicalData.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = touch.clientX - rect.left;

    const paddingLeft = 8;
    const paddingRight = canvas.clientWidth < 640 ? 50 : 60;
    const chartWidth = canvas.clientWidth - paddingLeft - paddingRight;

    if (clientX >= paddingLeft && clientX <= canvas.clientWidth - paddingRight) {
      const count = historicalData.length;
      const stepX = chartWidth / count;
      const rawIdx = Math.floor((clientX - paddingLeft) / stepX);
      const clampedIdx = Math.max(0, Math.min(count - 1, rawIdx));
      setHoverIndex(clampedIdx);
    }
  };

  const handleTouchStart = (e) => {
    handleTouchMove(e);
  };

  const handleTouchEnd = () => {
    // 手機放開手指後保留 4 秒，讓使用者有充裕時間點擊頂部百科或看清數值
    setTimeout(() => {
      setHoverIndex(null);
    }, 4000);
  };

  // 滑鼠互動：計算游標所在 K 棒索引與氣泡懸浮偵測
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || historicalData.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // 檢查是否懸浮在任一形態標籤或歷史節點上
    let hoveredHit = null;
    if (showChipAnnotations && badgeHitBoxesRef.current.length > 0) {
      hoveredHit = badgeHitBoxesRef.current.find(b =>
        clientX >= b.x - 3 && clientX <= b.x + b.width + 3 &&
        clientY >= b.y - 3 && clientY <= b.y + b.height + 3
      );
    }

    if (hoveredHit) {
      canvas.style.cursor = 'pointer';
      if (hoveredBadgePattern?.index !== hoveredHit.pattern.index) {
        setHoveredBadgePattern(hoveredHit.pattern);
      }
    } else {
      canvas.style.cursor = 'crosshair';
      if (hoveredBadgePattern !== null) {
        setHoveredBadgePattern(null);
      }
    }

    const paddingLeft = 10;
    const paddingRight = 60;
    const chartWidth = canvas.clientWidth - paddingLeft - paddingRight;

    if (clientX < paddingLeft || clientX > canvas.clientWidth - paddingRight) {
      setHoverIndex(null);
      return;
    }

    const count = historicalData.length;
    const stepX = chartWidth / count;
    const rawIdx = Math.floor((clientX - paddingLeft) / stepX);
    const clampedIdx = Math.max(0, Math.min(count - 1, rawIdx));
    setHoverIndex(clampedIdx);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
    setHoveredBadgePattern(null);
  };

  // 點擊 Canvas 上的形態氣泡觸發 Modal
  const handleCanvasClick = (e) => {
    if (!showChipAnnotations || !onPatternClick) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const clickedBadge = badgeHitBoxesRef.current.find(b =>
      clientX >= b.x - 5 && clientX <= b.x + b.width + 5 &&
      clientY >= b.y - 5 && clientY <= b.y + b.height + 5
    );

    const targetPattern = clickedBadge?.pattern || (hoverIndex !== null ? patternByIndex.get(hoverIndex) : null);
    if (!targetPattern) return;

    // 搜尋百科完整資料庫
    let matched = KLINE_PATTERNS.find(p => 
      p.id === targetPattern?.patternId || 
      (targetPattern?.name && p.name && (targetPattern.name.toLowerCase().includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(targetPattern.name.toLowerCase()))) ||
      (targetPattern?.name && p.chineseName && (targetPattern.name.includes(p.chineseName) || p.chineseName.includes(targetPattern.name))) ||
      (targetPattern?.description && (targetPattern.description.includes(p.name.split(' ')[0]) || targetPattern.description.includes(p.chineseName.split(' ')[0])))
    );

    if (!matched && targetPattern) {
      matched = {
        name: targetPattern.name,
        chineseName: targetPattern.name,
        summary: targetPattern.description || '由技術指標與走勢特徵判定之形態。',
        marketPsychology: 'K 棒呈現多空激烈博弈，請密切留意關鍵支撐與壓力位。',
        sentiment: targetPattern.sentiment || 'bullish',
        winRate: targetPattern.confidence || 80,
        tradingRules: ['跌破當前關鍵防守線或前日低點請嚴格執行停損。', '若放量突破上方壓力天花板可順勢偏多應對。']
      };
    }

    if (matched) {
      onPatternClick(matched);
    }
  };

  // 下載高畫質圖檔功能 (使用分析/校正後的繁體中文股名)
  const handleDownloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    const stockName = effectiveStockName;
    const symbol = stockData?.symbol || '';
    const dateStr = currentItem?.date || new Date().toISOString().split('T')[0];

    link.download = `${stockName}_${symbol}_K線圖_${dateStr}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (!stockData || historicalData.length === 0) {
    return null;
  }

  const isUp = priceChange > 0;
  const isDown = priceChange < 0;
  const priceColor = isUp ? '#ef4444' : isDown ? '#10b981' : '#64748b';

  return (
    <div className="glass-panel" style={{ padding: '16px', margin: '16px 0', background: '#ffffff', color: '#1e293b', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)', maxWidth: '100%', boxSizing: 'border-box' }}>
      
      {/* 頂部操作工具列 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
        
        {/* 左側標籤 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ fontWeight: '800', fontSize: '1.2rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
            {effectiveStockName} <span style={{ color: '#64748b', fontWeight: '500', fontSize: '0.95rem' }}>({stockData.symbol})</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: '#64748b', background: '#f8fafc', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
            資料時間：{currentItem ? currentItem.date : stockData.latest?.date}
          </span>
        </div>

        {/* 右側按鈕組 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          
          {/* 籌碼標註圖層開關 */}
          <button
            onClick={() => setShowChipAnnotations(!showChipAnnotations)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: '600',
              cursor: 'pointer',
              border: showChipAnnotations ? '1px solid #38bdf8' : '1px solid #cbd5e1',
              background: showChipAnnotations ? 'rgba(56, 189, 248, 0.1)' : '#ffffff',
              color: showChipAnnotations ? '#0284c7' : '#64748b'
            }}
          >
            <Layers size={14} />
            <span>籌碼 K 線標註圖層：{showChipAnnotations ? '開啟' : '關閉'}</span>
          </button>

          {/* 下載圖片按鈕 */}
          <button
            onClick={handleDownloadImage}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: '600',
              cursor: 'pointer',
              border: '1px solid #2563eb',
              background: '#2563eb',
              color: '#ffffff'
            }}
          >
            <Download size={14} />
            <span>下載高解析度 PNG</span>
          </button>
        </div>

      </div>

      {/* Yahoo 奇摩標準報價資訊列 (開、高、低、收、量、漲跌) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '0.92rem', marginBottom: '10px', color: '#334155' }}>
        <div style={{ fontWeight: '600', color: '#64748b', fontSize: '0.88rem' }}>
          {currentItem ? currentItem.date : ''}
        </div>
        <div>開 <span style={{ fontWeight: '700', color: priceColor }}>{currentItem?.open}</span></div>
        <div>高 <span style={{ fontWeight: '700', color: '#ef4444' }}>{currentItem?.high}</span></div>
        <div>低 <span style={{ fontWeight: '700', color: '#10b981' }}>{currentItem?.low}</span></div>
        <div>收 <span style={{ fontWeight: '700', color: priceColor }}>{currentItem?.close}</span></div>
        <div>量(張) <span style={{ fontWeight: '700', color: '#0f172a' }}>{currentItem?.volumeLots?.toLocaleString() || Math.round((currentItem?.volume || 0) / 1000).toLocaleString()}</span></div>
        <div>
          漲跌 <span style={{ fontWeight: '700', color: priceColor }}>
            {priceChange > 0 ? `+${priceChange}` : priceChange} ({priceChange > 0 ? `+${changePercent}%` : `${changePercent}%`})
          </span>
        </div>
      </div>

      {/* MA 均線切換控制與數值列 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '0.85rem', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
        
        {/* MA5 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: '#2563eb', fontWeight: '600' }}>
          <input
            type="checkbox"
            checked={maVisible.ma5}
            onChange={(e) => setMaVisible({ ...maVisible, ma5: e.target.checked })}
            style={{ accentColor: '#2563eb', cursor: 'pointer' }}
          />
          <span>MA5 {currentItem?.ma5 ?? '-'}</span>
        </label>

        {/* MA10 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: '#8b5cf6', fontWeight: '600' }}>
          <input
            type="checkbox"
            checked={maVisible.ma10}
            onChange={(e) => setMaVisible({ ...maVisible, ma10: e.target.checked })}
            style={{ accentColor: '#8b5cf6', cursor: 'pointer' }}
          />
          <span>MA10 {currentItem?.ma10 ?? '-'}</span>
        </label>

        {/* MA20 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: '#f97316', fontWeight: '600' }}>
          <input
            type="checkbox"
            checked={maVisible.ma20}
            onChange={(e) => setMaVisible({ ...maVisible, ma20: e.target.checked })}
            style={{ accentColor: '#f97316', cursor: 'pointer' }}
          />
          <span>MA20 {currentItem?.ma20 ?? '-'}</span>
        </label>

        {/* MA60 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: '#d97706', fontWeight: '600' }}>
          <input
            type="checkbox"
            checked={maVisible.ma60}
            onChange={(e) => setMaVisible({ ...maVisible, ma60: e.target.checked })}
            style={{ accentColor: '#d97706', cursor: 'pointer' }}
          />
          <span>MA60 {currentItem?.ma60 ?? '-'}</span>
        </label>

        {/* MA120 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: '#0891b2', fontWeight: '600' }}>
          <input
            type="checkbox"
            checked={maVisible.ma120}
            onChange={(e) => setMaVisible({ ...maVisible, ma120: e.target.checked })}
            style={{ accentColor: '#0891b2', cursor: 'pointer' }}
          />
          <span>MA120 {currentItem?.ma120 ?? '-'}</span>
        </label>

      </div>

      {/* 頂部 AI 關鍵位與形態戰法百科按鈕列 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        flexWrap: 'wrap',
        marginBottom: '10px',
        padding: '8px 12px',
        borderRadius: '8px',
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
      }}>
        {/* 左側：AI 關鍵價位 (天花板 / 地板 / 防守線) */}
        {showChipAnnotations && (primaryResistance || primarySupport || stopLoss) ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: '700', color: '#475569', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              🎯 AI 關鍵位：
            </span>
            {primaryResistance && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontWeight: '700',
                fontSize: '0.8rem'
              }}>
                🔴 壓力 <strong style={{ fontSize: '0.85rem' }}>{primaryResistance}</strong>
              </span>
            )}
            {primarySupport && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#059669',
                fontWeight: '700',
                fontSize: '0.8rem'
              }}>
                🟢 支撐 <strong style={{ fontSize: '0.85rem' }}>{primarySupport}</strong>
              </span>
            )}
            {stopLoss && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#d97706',
                fontWeight: '700',
                fontSize: '0.8rem'
              }}>
                ⚠️ 防守 <strong style={{ fontSize: '0.85rem' }}>{stopLoss}</strong>
              </span>
            )}
          </div>
        ) : <div />}

        {/* 右側：【形態戰法 點擊詳解】按鈕（永久固定在上方，統一保證 100% 標註精準日期，手機極致友善！） */}
        {displayPattern && (
          <button
            type="button"
            onClick={() => onPatternClick && onPatternClick(displayPattern)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              border: '1px solid #38bdf8',
              color: '#38bdf8',
              fontWeight: '700',
              fontSize: '0.82rem',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.18)',
              transition: 'all 0.15s ease',
              minHeight: '34px'
            }}
            title="點擊查看形態戰法、主力心理與實戰回測教學"
          >
            {patternDate && (
              <span style={{
                background: 'rgba(56, 189, 248, 0.18)',
                color: '#7dd3fc',
                padding: '2px 7px',
                borderRadius: '4px',
                fontSize: '0.74rem',
                fontWeight: '700',
                fontFamily: '"JetBrains Mono", monospace'
              }}>
                {patternDate}
              </span>
            )}
            <span>🔥 {displayPattern.name}</span>
            <span style={{
              fontSize: '0.72rem',
              background: '#0284c7',
              color: '#ffffff',
              padding: '2px 7px',
              borderRadius: '4px',
              fontWeight: '600'
            }}>
              📖 點擊查看百科詳解
            </span>
          </button>
        )}
      </div>

      {/* Canvas 畫布容器 (支援桌面滑鼠與手機觸控滑動) */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          overflow: 'hidden',
          borderRadius: '4px',
          background: '#ffffff',
          cursor: hoveredBadgePattern ? 'pointer' : 'crosshair',
          touchAction: 'none'
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleCanvasClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: `${isMobile ? 380 : 480}px`, display: 'block' }}
        />
      </div>

      {/* 副圖成交量資訊列 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', color: '#64748b', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f8fafc', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontWeight: '600', color: '#1e293b' }}>指標：成交量</span>
          <span>量(張) <strong style={{ color: priceColor }}>{currentItem?.volumeLots?.toLocaleString()}</strong></span>
          <span style={{ color: '#2563eb' }}>MV5 <strong>{currentItem?.mv5 ?? '-'}</strong></span>
          <span style={{ color: '#f97316' }}>MV20 <strong>{currentItem?.mv20 ?? '-'}</strong></span>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          {isMobile ? '👆 手指在圖表上滑動可查價與辨識歷史形態' : '滑鼠移動至圖表可啟動十字游標查價與歷史形態辨識'}
        </div>
      </div>

    </div>
  );
}
