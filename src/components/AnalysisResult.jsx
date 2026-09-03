import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Target, ShieldAlert, Cpu, Award, Zap, Compass, X, Shield, Globe, BookmarkCheck, History, Sparkles } from 'lucide-react';
import { KLINE_PATTERNS } from '../data/klinePatterns';
import { PatternSVG } from './PatternEncyclopedia';
import YahooKlineCanvas from './YahooKlineCanvas';
import { runPatternBacktest } from '../services/backtestService';

export default function AnalysisResult({ result, isAnalyzing, onOpenApiKeyModal }) {
  const [isEditing, setIsEditing] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [activeModalPattern, setActiveModalPattern] = useState(null);

  // 依據當前時間動態判定交易時態（必須在所有 early return 前調用）
  const sessionInfo = useMemo(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeNum = hours * 100 + minutes;

    if (timeNum >= 0 && timeNum < 830) {
      return {
        isToday: true
      };
    } else if (timeNum >= 830 && timeNum < 900) {
      return {
        sessionType: 'pre_match_today',
        timeLabel: '今日試撮中',
        bookingTitle: '今日開盤試撮掛單建議',
        bookingSubtitle: '08:30 ~ 09:00 交易所模擬撮合階段，掛單即時進場試撮排隊',
        forecastTitle: '今日早盤多空概率 & 情境推演',
        badgeColor: '#fbbf24',
        isToday: true
      };
    } else if (timeNum >= 900 && timeNum < 1330) {
      return {
        sessionType: 'in_session_today',
        timeLabel: '盤中交易中',
        bookingTitle: '今日盤中關鍵掛單與防守建議',
        bookingSubtitle: '09:00 ~ 13:30 盤中連續撮合交易，請依關鍵支撐/天花板價位委託',
        forecastTitle: '今日盤中走勢推演 & 關鍵階梯',
        badgeColor: '#10b981',
        isToday: true
      };
    } else {
      return {
        sessionType: 'after_hours_next_day',
        timeLabel: '明日早鳥',
        bookingTitle: '明日早鳥預約掛單建議',
        bookingSubtitle: '盤後 14:00 ~ 隔日 08:30 可預先於券商 App 掛上預約條件單／限價單',
        forecastTitle: '明日多空概率 & 情境推演',
        badgeColor: '#818cf8',
        isToday: false
      };
    }
  }, []);

  useEffect(() => {
    if (result) {
      setCustomName(result.stockName || '');
      setCustomCode(result.stockCode || '');
      setCustomPrice(result.currentPrice?.toString() || '');
      setIsEditing(false);
    }
  }, [result]);

  // 執行該檔個股本地真實歷史回測 (近 2 年 ~500 根) - 必須在所有 early return 前調用
  const backtestResults = useMemo(() => {
    if (!result || !result.stockData) return null;
    const fullHistory = result.stockData.fullHistoricalData || result.stockData.historicalData || [];
    if (fullHistory.length === 0) return null;

    const targetPattern = result.detectedPatterns?.[0];
    const patternId = targetPattern?.patternId || 'big_bull';
    const patternName = targetPattern?.name || '大陽線';
    const isBullish = (result.prediction?.bullishProbability ?? 50) >= (result.prediction?.bearishProbability ?? 50);

    return runPatternBacktest(fullHistory, patternId, patternName, isBullish ? 'bullish' : 'bearish');
  }, [result]);

  if (isAnalyzing) {
    return (
      <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', margin: '24px 0' }}>
        <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', marginBottom: '16px' }}>
          <div className="animate-spin-custom">
            <Cpu size={36} />
          </div>
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#f8fafc', marginBottom: '8px' }}>
          AI 量化模型正在解析 K 線歷史數據...
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto' }}>
          正在計算 MA 均線多空排列、掃描 K 棒組合型態並推演明日多空機率與防守點...
        </p>
      </div>
    );
  }

  if (!result) return null;

  const {
    priceChange,
    changePercent,
    movingAverages = {},
    detectedPatterns = [],
    prediction = {},
    volume,
    latestDate,
    analyzedAt
  } = result;
  const displayName = customName || result.stockName;
  const displayCode = customCode || result.stockCode;
  const displayPrice = customPrice ? parseFloat(customPrice) : result.currentPrice;
  const numChange = typeof priceChange === 'number' ? priceChange : (parseFloat(priceChange) || 0);
  const numPercent = typeof changePercent === 'number' ? changePercent : (parseFloat(changePercent) || 0);
  const isDown = numChange < 0 || (numChange === 0 && numPercent < 0);
  const isFlat = numChange === 0 && numPercent === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', margin: '24px 0' }}>
      
      {/* 0. 分析模式狀態提示橫幅 (純量化技術分析 vs Gemini AI 深度推演) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderRadius: '10px', background: result.isLocalAnalyzed ? 'rgba(59, 130, 246, 0.08)' : 'rgba(139, 92, 246, 0.1)', border: `1px solid ${result.isLocalAnalyzed ? 'rgba(59, 130, 246, 0.3)' : 'rgba(139, 92, 246, 0.35)'}`, flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {result.isLocalAnalyzed ? <Zap size={18} color="#60a5fa" /> : <Sparkles size={18} color="#c084fc" />}
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#ffffff' }}>
              {result.isLocalAnalyzed ? '⚡ 本地純量化技術分析模式 (免費無限制秒查)' : '✨ Gemini AI 深度量化推演模式 (已啟用雲端大模型)'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {result.isLocalAnalyzed ? '已完成 2 年 K 棒掃描、MA 均線排列、確定性形態辨識、歷史勝率回測與部位風控精算。' : '結合主力籌碼物理學、夜盤跨市場共振及多套隔日多空應對情境推演。'}
            </div>
          </div>
        </div>

        {result.isLocalAnalyzed && onOpenApiKeyModal && (
          <button
            onClick={onOpenApiKeyModal}
            className="btn-primary"
            style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Sparkles size={13} />
            <span>配置 Key 解鎖 AI 深度解讀</span>
          </button>
        )}
      </div>

      {/* 1. 股票基本行情與均線總覽橫幅 */}
      <div className="glass-panel" style={{ padding: '20px 24px', background: 'linear-gradient(135deg, rgba(26, 34, 52, 0.8) 0%, rgba(18, 24, 36, 0.9) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          
          {/* 股名與現價 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {isEditing ? (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="股票名稱"
                      style={{ width: '110px', background: 'rgba(0,0,0,0.5)', border: '1px solid #3b82f6', borderRadius: '6px', padding: '4px 8px', color: '#fff', fontSize: '1rem', fontWeight: '700' }}
                    />
                    <input
                      type="text"
                      value={customCode}
                      onChange={(e) => setCustomCode(e.target.value)}
                      placeholder="代碼"
                      style={{ width: '70px', background: 'rgba(0,0,0,0.5)', border: '1px solid #3b82f6', borderRadius: '6px', padding: '4px 8px', color: '#fff', fontSize: '1rem', fontFamily: 'monospace' }}
                    />
                    <input
                      type="text"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      placeholder="價格"
                      style={{ width: '80px', background: 'rgba(0,0,0,0.5)', border: '1px solid #3b82f6', borderRadius: '6px', padding: '4px 8px', color: '#fff', fontSize: '1rem', fontFamily: 'monospace' }}
                    />
                    <button onClick={() => setIsEditing(false)} className="btn-primary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                      完成
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#ffffff' }}>
                      {displayName}
                    </h2>
                    {displayCode && (
                      <span className="font-mono" style={{ fontSize: '1rem', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '6px' }}>
                        {displayCode}
                      </span>
                    )}
                    <button
                      onClick={() => setIsEditing(true)}
                      style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      校正股名與價格
                    </button>
                  </>
                )}
                
                <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid currentColor' }}>
                  {`✨ ${result.usedModel ? result.usedModel.replace('gemini-', 'Gemini ').replace('-exp-01-21', '').replace('-exp-02-05', '') : 'Gemini AI'} 大模型`}
                </span>
                {analyzedAt && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    更新：{analyzedAt}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                成交量態勢：<span style={{ color: '#f8fafc', fontWeight: '600' }}>{volume || '標準量能'}</span>
              </p>
            </div>

            <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '16px' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: isDown ? 'var(--tw-bear)' : (isFlat ? '#e2e8f0' : 'var(--tw-bull)'), display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isDown ? <TrendingDown size={24} /> : (isFlat ? <Minus size={24} color="#94a3b8" /> : <TrendingUp size={24} />)}
                <span className="font-mono">{displayPrice}</span>
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: '600', color: isDown ? '#6ee7b7' : (isFlat ? '#94a3b8' : '#fca5a5') }}>
                {numChange > 0 ? `+${numChange}` : numChange} ({numPercent > 0 ? `+${numPercent}%` : `${numPercent}%`})
              </div>
            </div>
          </div>

          {/* 均線儀表板 */}
          {movingAverages && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {movingAverages.ma5 && (
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#60a5fa', fontWeight: '600' }}>MA5 (週線)</div>
                  <div className="font-mono" style={{ fontSize: '0.95rem', fontWeight: '700' }}>{movingAverages.ma5}</div>
                </div>
              )}
              {movingAverages.ma10 && (
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#a78bfa', fontWeight: '600' }}>MA10 (雙週)</div>
                  <div className="font-mono" style={{ fontSize: '0.95rem', fontWeight: '700' }}>{movingAverages.ma10}</div>
                </div>
              )}
              {movingAverages.ma20 && (
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#fbbf24', fontWeight: '600' }}>MA20 (月線)</div>
                  <div className="font-mono" style={{ fontSize: '0.95rem', fontWeight: '700' }}>{movingAverages.ma20}</div>
                </div>
              )}
              {movingAverages.ma60 && (
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: '600' }}>MA60 (季線)</div>
                  <div className="font-mono" style={{ fontSize: '0.95rem', fontWeight: '700' }}>{movingAverages.ma60}</div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* 2. 即時 OHLCV 行情數據明細列 (大字體清晰版) */}
        <div className="ohlc-grid" style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '600', marginBottom: '4px' }}>開盤價 (Open)</div>
            <div className="font-mono" style={{ fontSize: '1.35rem', fontWeight: '800', color: '#f8fafc' }}>
              {result.openPrice ?? '--'}
            </div>
          </div>
          <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <div style={{ fontSize: '0.85rem', color: '#fca5a5', fontWeight: '600', marginBottom: '4px' }}>最高價 (High)</div>
            <div className="font-mono" style={{ fontSize: '1.35rem', fontWeight: '800', color: '#f87171' }}>
              {result.highPrice ?? '--'}
            </div>
          </div>
          <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            <div style={{ fontSize: '0.85rem', color: '#6ee7b7', fontWeight: '600', marginBottom: '4px' }}>最低價 (Low)</div>
            <div className="font-mono" style={{ fontSize: '1.35rem', fontWeight: '800', color: '#34d399' }}>
              {result.lowPrice ?? '--'}
            </div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '600', marginBottom: '4px' }}>收盤價 (Close)</div>
            <div className="font-mono" style={{ fontSize: '1.35rem', fontWeight: '800', color: isDown ? '#34d399' : (isFlat ? '#f8fafc' : '#f87171') }}>
              {result.closePrice ?? displayPrice}
            </div>
          </div>
          <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
            <div style={{ fontSize: '0.85rem', color: '#fde68a', fontWeight: '600', marginBottom: '4px' }}>總成交量 (Volume)</div>
            <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: '800', color: '#fbbf24' }}>
              {result.volume || '--'}
            </div>
          </div>
          <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
            <div style={{ fontSize: '0.85rem', color: '#93c5fd', fontWeight: '600', marginBottom: '4px' }}>資料日期 (Date)</div>
            <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: '800', color: '#60a5fa' }}>
              {latestDate || result.latestDate || '--'}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Yahoo 奇摩標準風格 K 線圖表與籌碼 K 線標註系統 */}
      {result.stockData && result.stockData.historicalData && result.stockData.historicalData.length > 0 && (
        <YahooKlineCanvas
          stockData={{
            ...result.stockData,
            stockName: displayName
          }}
          stockName={displayName}
          prediction={prediction}
          detectedPatterns={detectedPatterns}
          onPatternClick={(pattern) => setActiveModalPattern(pattern)}
        />
      )}

      {/* 3. 跨市場聯動行情與共振分析板塊 */}
      {((result.marketContext && ((result.marketContext.usMarkets && result.marketContext.usMarkets.length > 0) || (result.marketContext.futuresAndIndex && result.marketContext.futuresAndIndex.length > 0))) || prediction.marketContextImpact) && (
        <div className="glass-panel" style={{ padding: '20px', border: '1px solid rgba(56, 189, 248, 0.3)', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(12, 32, 54, 0.75) 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={18} color="#38bdf8" />
              <h3 style={{ fontSize: '1.08rem', fontWeight: '700', color: '#f8fafc', margin: 0 }}>
                跨市場聯動行情與共振分析
              </h3>
            </div>
            <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              台指期貨 / 美股與國際指數
            </span>
          </div>

          {/* 數據卡片列：台指期與大盤優先，美股與國際指數接續 */}
          {result.marketContext && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: '10px', marginBottom: '12px' }}>
              {[...(result.marketContext.futuresAndIndex || []), ...(result.marketContext.usMarkets || [])].map((item, idx) => {
                const itemIsDown = item.priceChange < 0;
                const itemIsFlat = item.priceChange === 0;
                return (
                  <div key={idx} style={{ background: 'rgba(0,0,0,0.35)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '600' }}>{item.name}</span>
                      <span className="font-mono" style={{ fontSize: '0.7rem', color: '#64748b' }}>{item.symbol}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span className="font-mono" style={{ fontSize: '1.05rem', fontWeight: '700', color: '#f8fafc' }}>
                        {typeof item.price === 'number' ? item.price.toLocaleString() : item.price}
                      </span>
                      <span className="font-mono" style={{ fontSize: '0.82rem', fontWeight: '600', color: itemIsDown ? 'var(--tw-bear)' : (itemIsFlat ? '#94a3b8' : 'var(--tw-bull)') }}>
                        {item.priceChange > 0 ? `+${item.priceChange}` : item.priceChange} ({item.changePercent > 0 ? `+${item.changePercent}%` : `${item.changePercent}%`})
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* AI 跨市場影響解析 */}
          {prediction.marketContextImpact && (
            <div style={{ background: 'rgba(56, 189, 248, 0.06)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.2)', fontSize: '0.86rem', color: '#e0f2fe', lineHeight: '1.5' }}>
              <strong style={{ color: '#38bdf8' }}>🌐 跨市場共振評估：</strong>
              {prediction.marketContextImpact}
            </div>
          )}
        </div>
      )}

      {/* 3. 【核心重點】明日盤前/早鳥預約掛單建議 (Order Booking Matrix) */}
      <div className="glass-panel" style={{ padding: '22px', border: '1px solid rgba(59, 130, 246, 0.4)', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.85) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
              <BookmarkCheck size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f8fafc', margin: 0 }}>
                  {sessionInfo.bookingTitle}
                </h3>
                <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: `${sessionInfo.badgeColor}20`, color: sessionInfo.badgeColor, border: `1px solid ${sessionInfo.badgeColor}40`, fontWeight: '600' }}>
                  {sessionInfo.timeLabel}
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                {sessionInfo.bookingSubtitle}
              </p>
            </div>
          </div>

          {/* 結論標籤 */}
          {prediction.actionDecision && (
            <div style={{
              padding: '6px 16px',
              borderRadius: '8px',
              fontWeight: '900',
              fontSize: '1.1rem',
              color: '#fff',
              background: prediction.actionDecision.includes('買') ? '#10b981' : prediction.actionDecision.includes('賣') ? '#ef4444' : '#f59e0b',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>綜合策略：</span>
              <span>{prediction.actionDecision}</span>
            </div>
          )}
        </div>

        {/* 預約單三價位矩陣 */}
        {(() => {
          const booking = prediction.orderBooking || {};
          const buyPrice = booking.buyLimit || prediction.supportLevels?.[0] || movingAverages?.ma5 || (displayPrice ? (displayPrice * 0.985).toFixed(2) : '--');
          const takeProfitPrice = booking.takeProfitLimit || prediction.resistanceLevels?.[0] || (displayPrice ? (displayPrice * 1.035).toFixed(2) : '--');
          const stopLossPrice = booking.stopLossLimit || prediction.supportLevels?.[1] || movingAverages?.ma20 || (displayPrice ? (displayPrice * 0.95).toFixed(2) : '--');

          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '12px', marginBottom: '14px', alignItems: 'start' }}>
              
              {/* 1. 逢低掛單買進價 */}
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#6ee7b7', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <TrendingUp size={16} /> 🟢 逢低買進掛單價
                  </span>
                  <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.2)', color: '#a7f3d0', padding: '2px 6px', borderRadius: '4px' }}>
                    支撐承接
                  </span>
                </div>
                <div className="font-mono" style={{ fontSize: '1.7rem', fontWeight: '800', color: '#34d399', marginBottom: '4px' }}>
                  {buyPrice} <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>元</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#cbd5e1', margin: 0, lineHeight: '1.4' }}>
                  {booking.buyNote || '拉回第一道地板或 MA5 均線時逢低分批低接'}
                </p>
              </div>

              {/* 2. 逢高掛單停利價 */}
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#fca5a5', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Target size={16} /> 🔴 逢高停利掛單價
                  </span>
                  <span style={{ fontSize: '0.72rem', background: 'rgba(239, 68, 68, 0.2)', color: '#fecaca', padding: '2px 6px', borderRadius: '4px' }}>
                    天花板壓力
                  </span>
                </div>
                <div className="font-mono" style={{ fontSize: '1.7rem', fontWeight: '800', color: '#f87171', marginBottom: '4px' }}>
                  {takeProfitPrice} <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>元</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#cbd5e1', margin: 0, lineHeight: '1.4' }}>
                  {booking.takeProfitNote || '衝高遇第一道天花板或前波高點分批停利入袋'}
                </p>
              </div>

              {/* 3. 嚴格防守停損價 */}
              <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#fcd34d', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldAlert size={16} /> 🛡️ 破線停損出場價
                  </span>
                  <span style={{ fontSize: '0.72rem', background: 'rgba(245, 158, 11, 0.2)', color: '#fef3c7', padding: '2px 6px', borderRadius: '4px' }}>
                    最後防線
                  </span>
                </div>
                <div className="font-mono" style={{ fontSize: '1.7rem', fontWeight: '800', color: '#fbbf24', marginBottom: '4px' }}>
                  {stopLossPrice} <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>元</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#cbd5e1', margin: 0, lineHeight: '1.4' }}>
                  {booking.stopLossNote || '跌破 MA20 月線或關鍵地板需無條件保命出場'}
                </p>
              </div>

            </div>
          );
        })()}

        {/* 簡潔直白白話指引 */}
        {prediction.beginnerAdvice && (
          <div style={{ background: 'rgba(0,0,0,0.25)', padding: '12px 14px', borderRadius: '8px', fontSize: '0.88rem', color: '#e2e8f0', lineHeight: '1.5' }}>
            <strong style={{ color: '#60a5fa' }}>💡 操作守則速覽：</strong>{prediction.beginnerAdvice}
          </div>
        )}
      </div>

      {/* 3. 明日走勢推演 & 關鍵天花板與地板階梯 */}
      <div className="responsive-grid-2">
        
        {/* 左側：明日勝率雷達與走勢推演 */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Compass size={18} color="#06b6d4" />
              <span>{sessionInfo.forecastTitle}</span>
            </h3>
            <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
              AI 綜合評估
            </span>
          </div>

          {/* 勝率進度條 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span style={{ color: '#fca5a5', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <TrendingUp size={14} /> 偏多上漲
                </span>
                <span className="font-mono" style={{ color: '#fca5a5', fontWeight: '700' }}>{prediction.bullishProbability ?? 50}%</span>
              </div>
              <div style={{ width: '100%', height: '7px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${prediction.bullishProbability ?? 50}%`, height: '100%', background: 'linear-gradient(90deg, #f87171, #ef4444)', borderRadius: '4px' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span style={{ color: '#fcd34d', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Minus size={14} /> 區間整理
                </span>
                <span className="font-mono" style={{ color: '#fcd34d', fontWeight: '700' }}>{prediction.neutralProbability ?? 20}%</span>
              </div>
              <div style={{ width: '100%', height: '7px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${prediction.neutralProbability ?? 20}%`, height: '100%', background: 'linear-gradient(90deg, #fbbf24, #f59e0b)', borderRadius: '4px' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span style={{ color: '#6ee7b7', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <TrendingDown size={14} /> 偏空回測
                </span>
                <span className="font-mono" style={{ color: '#6ee7b7', fontWeight: '700' }}>{prediction.bearishProbability ?? 30}%</span>
              </div>
              <div style={{ width: '100%', height: '7px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${prediction.bearishProbability ?? 30}%`, height: '100%', background: 'linear-gradient(90deg, #34d399, #10b981)', borderRadius: '4px' }} />
              </div>
            </div>
          </div>

          {/* 情境推演 */}
          <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)' }}>
            <p style={{ fontSize: '0.86rem', color: '#f1f5f9', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-line' }}>
              {prediction.nextDayForecast || prediction.sentimentSummary}
            </p>
          </div>
        </div>

        {/* 右側：關鍵「天花板 (壓力)」與「地板 (支撐)」 */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={18} color="#f59e0b" />
              <span>天花板 (壓力) 與 地板 (支撐)</span>
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              關鍵價位
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* 上方天花板 (壓力) */}
            <div style={{ background: 'rgba(239, 68, 68, 0.06)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
              <div style={{ fontSize: '0.8rem', color: '#f87171', fontWeight: '800', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <TrendingUp size={14} /> 🔴 天花板 (賣壓)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {prediction.resistanceLevels?.map((lvl, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{i === 0 ? '第一壓力' : i === 1 ? '第二壓力' : '歷史大壓'}</span>
                    <span className="font-mono" style={{ fontWeight: '700', color: '#ffffff' }}>{lvl} 元</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 下方地板 (支撐) */}
            <div style={{ background: 'rgba(16, 185, 129, 0.06)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
              <div style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: '800', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <TrendingDown size={14} /> 🟢 地板 (支撐)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {prediction.supportLevels?.map((lvl, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{i === 0 ? '第一支撐' : i === 1 ? '關鍵防守' : '停損底線'}</span>
                    <span className="font-mono" style={{ fontWeight: '700', color: '#ffffff' }}>{lvl} 元</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 操盤錦囊精華 */}
          {prediction.tradingStrategy?.length > 0 && (
            <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '6px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: '700', marginBottom: '4px' }}>⚡ 操盤關鍵：</div>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                {prediction.tradingStrategy.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

      </div>

      {/* 4. 鎖定 K 線形態 */}
      {detectedPatterns && detectedPatterns.length > 0 && (
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={18} color="#8b5cf6" />
              <span>鎖定之 K 線型態特徵</span>
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              共鎖定 {detectedPatterns.length} 個型態
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '12px' }}>
            {detectedPatterns.map((item, idx) => {
              let matchedEncyclopedia = KLINE_PATTERNS.find(p => 
                p.id === item.patternId || 
                item.name?.toLowerCase().includes(p.name.toLowerCase()) || 
                item.name?.includes(p.chineseName) ||
                (item.description && (item.description.includes(p.name.split(' ')[0]) || item.description.includes(p.chineseName.split(' ')[0])))
              );

              return (
                <div key={idx} className="glass-card" style={{ padding: '14px', borderLeft: '4px solid #8b5cf6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: '800', fontSize: '0.98rem', color: '#f8fafc' }}>
                      {matchedEncyclopedia ? matchedEncyclopedia.name : item.name}
                    </span>
                    <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.2)', color: '#c4b5fd', fontWeight: '600' }}>
                      符合度 {item.confidence}%
                    </span>
                  </div>
                  
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: '1.4', margin: '0 0 6px 0' }}>
                    {item.description}
                  </p>

                  {matchedEncyclopedia && (
                    <button
                      type="button"
                      onClick={() => setActiveModalPattern(matchedEncyclopedia)}
                      style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '0.78rem', cursor: 'pointer', padding: 0, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      查看【{matchedEncyclopedia.name.split(' ')[0]}】操盤守則 →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. 本地真實歷史回測數據報告 (Quantitative Backtest Report) */}
      {backtestResults && backtestResults.sampleCount > 0 && (
        <div className="glass-panel" style={{ padding: '22px', border: '1px solid rgba(139, 92, 246, 0.35)', background: 'linear-gradient(135deg, rgba(20, 16, 38, 0.9) 0%, rgba(15, 23, 42, 0.85) 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa' }}>
                <History size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#f8fafc', margin: 0 }}>
                  【{displayName}】歷史真實回測報告：{detectedPatterns?.[0]?.name || '當前形態'}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  回溯該檔個股過去 2 年共 {backtestResults.totalBarsAnalyzed} 根日 K 棒，逐筆檢驗訊號觸發後的實際持有報酬率
                </p>
              </div>
            </div>

            <span style={{ fontSize: '0.78rem', padding: '4px 10px', borderRadius: '20px', background: 'rgba(139, 92, 246, 0.2)', color: '#c4b5fd', border: '1px solid rgba(139, 92, 246, 0.4)', fontWeight: '700' }}>
              歷史共出現 {backtestResults.sampleCount} 次有效樣本
            </span>
          </div>

          {/* 1日/3日/5日/10日 回測數據卡片 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(130px, 100%), 1fr))', gap: '10px', marginBottom: '14px' }}>
            {[
              { label: '持有 1 日 (T+1)', key: '1D' },
              { label: '持有 3 日 (T+3)', key: '3D' },
              { label: '持有 5 日 (T+5)', key: '5D' },
              { label: '持有 10 日 (T+10)', key: '10D' }
            ].map(({ label, key }) => {
              const stat = backtestResults.periods[key];
              if (!stat) return null;
              const isWinGood = stat.winRate >= 60;
              const isWinMid = stat.winRate >= 50 && stat.winRate < 60;

              return (
                <div
                  key={key}
                  style={{
                    background: 'rgba(0, 0, 0, 0.35)',
                    padding: '12px',
                    borderRadius: '10px',
                    border: `1px solid ${isWinGood ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: '600', marginBottom: '4px' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '900', color: isWinGood ? '#34d399' : isWinMid ? '#fbbf24' : '#f87171' }}>
                    {stat.winRate}% <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '500' }}>勝率</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: stat.avgReturn >= 0 ? '#6ee7b7' : '#fca5a5', marginTop: '4px', fontWeight: '600' }}>
                    平均報酬: {stat.avgReturn >= 0 ? `+${stat.avgReturn}%` : `${stat.avgReturn}%`}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                    盈虧比: {stat.profitFactor} ({stat.wins}勝 {stat.losses}敗)
                  </div>
                </div>
              );
            })}
          </div>

          {/* 最近出現歷史日期 */}
          {backtestResults.recentOccurrenceDates?.length > 0 && (
            <div style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: '#cbd5e1' }}>📅 最近觸發日期：</span>
              {backtestResults.recentOccurrenceDates.map((dateStr, dIdx) => (
                <span key={dIdx} style={{ padding: '1px 6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                  {dateStr}
                </span>
              ))}
            </div>
          )}
        </div>
      )}


      {/* 7. 點擊形態彈出的百科詳解 Modal (不切換頁面) */}
      {activeModalPattern && (
        <div
          onClick={() => setActiveModalPattern(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-panel"
            style={{
              maxWidth: '580px',
              width: '100%',
              padding: '24px',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: `1px solid ${activeModalPattern.sentiment === 'bullish' ? 'rgba(239, 68, 68, 0.4)' : activeModalPattern.sentiment === 'bearish' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#ffffff' }}>
                    {activeModalPattern.name}
                  </h3>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: activeModalPattern.sentiment === 'bullish' ? 'var(--tw-bull-bg)' : activeModalPattern.sentiment === 'bearish' ? 'var(--tw-bear-bg)' : 'rgba(245, 158, 11, 0.15)',
                      color: activeModalPattern.sentiment === 'bullish' ? '#fca5a5' : activeModalPattern.sentiment === 'bearish' ? '#6ee7b7' : '#fcd34d',
                      border: `1px solid ${activeModalPattern.sentiment === 'bullish' ? 'var(--tw-bull-border)' : activeModalPattern.sentiment === 'bearish' ? 'var(--tw-bear-border)' : 'rgba(245, 158, 11, 0.3)'}`
                    }}
                  >
                    {activeModalPattern.sentiment === 'bullish' ? '🚀 建議買進' : activeModalPattern.sentiment === 'bearish' ? '🔻 快逃/賣出' : '⚠️ 建議觀望'}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {activeModalPattern.chineseName}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveModalPattern(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* SVG 圖形示意 */}
            <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'center', marginBottom: '16px', border: '1px solid var(--border-subtle)' }}>
              <PatternSVG config={activeModalPattern.svgConfig} width={130} height={120} />
            </div>

            {/* 白話圖解 */}
            <div style={{ marginBottom: '14px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '4px' }}>
                💡 白話圖解：
              </h4>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {activeModalPattern.summary}
              </p>
            </div>

            {/* 主力心態 */}
            <div style={{ marginBottom: '14px', background: 'rgba(59, 130, 246, 0.05)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <Zap size={15} /> 主力心態與力量物理學：
              </h4>
              <p style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: '1.6' }}>
                {activeModalPattern.marketPsychology}
              </p>
            </div>

            {/* 實戰操盤交易守則 */}
            <div style={{ marginBottom: '16px', background: 'rgba(16, 185, 129, 0.05)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Shield size={15} /> 實戰操盤交易守則：
              </h4>
              <ul style={{ paddingLeft: '20px', fontSize: '0.88rem', color: '#cbd5e1', lineHeight: '1.6' }}>
                {activeModalPattern.tradingRules?.map((rule, rIdx) => (
                  <li key={rIdx} style={{ marginBottom: '4px' }}>{rule}</li>
                ))}
              </ul>
            </div>

            {/* 勝率與關閉按鈕 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Award size={16} color="#f59e0b" />
                <span>歷史上真的成真的機率高達：<strong style={{ color: '#fff', fontSize: '1rem' }}>{activeModalPattern.winRate}%</strong></span>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalPattern(null)}
                className="btn-primary"
                style={{ padding: '8px 20px', fontSize: '0.85rem' }}
              >
                關閉視窗
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
