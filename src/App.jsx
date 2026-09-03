import { useState, useEffect } from 'react';
import Header from './components/Header';
import StockInput from './components/StockInput';
import AnalysisResult from './components/AnalysisResult';
import PatternEncyclopedia from './components/PatternEncyclopedia';
import InteractiveCanvas from './components/InteractiveCanvas';
import ApiKeyModal from './components/ApiKeyModal';
import BackToTop from './components/BackToTop';
import { analyzeKlineFromData } from './services/aiVisionService';
import { generateLocalQuantitativeAnalysis } from './services/localQuantitativeService';
import { fetchStockData, fetchMarketContextData } from './services/yahooFinanceService';
import confetti from 'canvas-confetti';

export default function App() {
  const [activeTab, setActiveTab] = useState('analyzer'); // 'analyzer' | 'encyclopedia' | 'simulator'
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash');
  const [patternCount, setPatternCount] = useState(12);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  const [loadedSimulatorPattern, setLoadedSimulatorPattern] = useState(null);

  // 讀取儲存的 API Key 與模型設定
  useEffect(() => {
    const savedKey = localStorage.getItem('kline_gemini_api_key');
    if (savedKey) setApiKey(savedKey);

    const savedModel = localStorage.getItem('kline_gemini_model');
    if (savedModel) {
      const fixedModel = savedModel.includes('2.5') ? 'gemini-2.0-flash' : savedModel;
      setSelectedModel(fixedModel);
      localStorage.setItem('kline_gemini_model', fixedModel);
    }

    const savedPatternCount = localStorage.getItem('kline_pattern_count');
    if (savedPatternCount) setPatternCount(Number(savedPatternCount));
  }, []);

  const handleSaveApiKey = (key) => {
    setApiKey(key);
    if (key) {
      localStorage.setItem('kline_gemini_api_key', key);
    } else {
      localStorage.removeItem('kline_gemini_api_key');
    }
  };

  const handleSaveModel = (model) => {
    setSelectedModel(model);
    localStorage.setItem('kline_gemini_model', model);
  };

  const handleSavePatternCount = (count) => {
    setPatternCount(count);
    localStorage.setItem('kline_pattern_count', count.toString());
  };

  // 從百科直接帶入特定型態至模擬測試畫板
  const handleLoadToSimulator = (pattern) => {
    setLoadedSimulatorPattern(pattern);
    setActiveTab('simulator');
  };

  // 選擇股號並自動獲取數據分析 (支援免 Key 純量化模式與 AI 深度推演)
  const handleStockSubmit = async (stockCode, options = { includeUS: true, includeFutures: true }) => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setActiveTab('analyzer');

    try {
      // 1. 抓取個股 2 年歷史 K 線與跨市場數據
      const [stockData, marketContext] = await Promise.all([
        fetchStockData(stockCode),
        fetchMarketContextData(options)
      ]);
      
      let result = null;

      // 2. 若有設定有效 Gemini Key，嘗試執行 AI 深度推演
      if (apiKey && apiKey.trim().length >= 10) {
        try {
          result = await analyzeKlineFromData(stockData, apiKey, selectedModel, patternCount, marketContext);
        } catch (aiErr) {
          console.warn('Gemini AI 分析失敗，自動降級為本地純量化分析模式:', aiErr);
          result = generateLocalQuantitativeAnalysis(stockData, marketContext);
        }
      } else {
        // 免 Key 模式：直接以本地確定性量化引擎生成
        result = generateLocalQuantitativeAnalysis(stockData, marketContext);
      }

      const finalStockName = result?.stockName || stockData?.stockName || stockCode;

      setAnalysisResult({
        ...result,
        stockName: finalStockName,
        stockData: {
          ...(result?.stockData || stockData),
          stockName: finalStockName
        }
      });



      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#3b82f6', '#10b981', '#ef4444']
      });
    } catch (err) {
      console.error('抓取或分析失敗:', err);
      alert(`⚠️ 處理失敗：${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // (已移除圖片辨識功能，專注於即時資料抓取)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '0 12px 40px', maxWidth: '100vw', overflowX: 'hidden', boxSizing: 'border-box' }}>
      
      {/* 頂部導航 */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasApiKey={!!apiKey}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
      />

      {/* 主要內容區 */}
      <main style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', flex: 1, minWidth: 0, boxSizing: 'border-box' }}>
        
        {activeTab === 'analyzer' && (
          <div>
            <StockInput
              onStockSubmit={handleStockSubmit}
              isAnalyzing={isAnalyzing}
            />

            <AnalysisResult
              result={analysisResult}
              isAnalyzing={isAnalyzing}
              hasApiKey={!!apiKey}
              onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
              onSelectPatternView={() => {
                setActiveTab('encyclopedia');
              }}
            />
          </div>
        )}


        {activeTab === 'encyclopedia' && (
          <PatternEncyclopedia
            onLoadToSimulator={handleLoadToSimulator}
            apiKey={apiKey}
            selectedModel={selectedModel}
            onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
          />
        )}

        {activeTab === 'simulator' && (
          <InteractiveCanvas
            loadedPattern={loadedSimulatorPattern}
            onClearLoadedPattern={() => setLoadedSimulatorPattern(null)}
            apiKey={apiKey}
            selectedModel={selectedModel}
            onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
          />
        )}

      </main>

      {/* 頁尾資訊 */}
      <footer style={{ textAlign: 'center', marginTop: '30px', padding: '20px 0', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        <p>K-Line Master | 股票 K 線智能分析與走勢預判系統 &copy; 2026</p>
        <p style={{ marginTop: '4px', fontSize: '0.72rem' }}>
          本系統分析結果僅供學術與技術形態研究參考，不構成任何實質投資建議。投資有風險，入市需謹慎。
        </p>
        <p style={{ marginTop: '6px', fontSize: '0.72rem', color: '#60a5fa', fontFamily: 'monospace' }}>
          Build Time: {typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'Dev'} build
        </p>
      </footer>

      {/* API Key & Model Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
        selectedModel={selectedModel}
        onSaveModel={handleSaveModel}
        patternCount={patternCount}
        onSavePatternCount={handleSavePatternCount}
      />

      {/* Back to Top 浮動按鈕 */}
      <BackToTop />

    </div>
  );
}
