import { useState, useEffect, useRef } from 'react';
import { Search, BookOpen, Award, Zap, Shield, Star, ArrowUpDown, Camera, UploadCloud, X, Sparkles, AlertCircle, RefreshCw, Eye } from 'lucide-react';
import { KLINE_PATTERNS } from '../data/klinePatterns';
import { analyzeKlineImageForEncyclopedia } from '../services/aiVisionService';

/**
 * 動態繪製 K 線形態 SVG
 */
export function PatternSVG({ config, width = 90, height = 110 }) {
  if (!config) return null;

  if (config.type === 'single') {
    const { open, close, high, low, color } = config;
    const bodyTop = Math.min(open, close);
    const bodyHeight = Math.max(Math.abs(close - open), 3);

    return (
      <svg width={width} height={height} viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
        <line x1="50" y1={high} x2="50" y2={low} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <rect
          x="32"
          y={bodyTop}
          width="36"
          height={bodyHeight}
          fill={color}
          rx="2"
          stroke={color}
          strokeWidth="1"
        />
      </svg>
    );
  }

  if (config.type === 'dual') {
    const { bars } = config;
    return (
      <svg width={width} height={height} viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
        {bars.map((bar, i) => {
          const x = i === 0 ? 30 : 70;
          const bodyTop = Math.min(bar.open, bar.close);
          const bodyHeight = Math.max(Math.abs(bar.close - bar.open), 3);
          return (
            <g key={i}>
              <line x1={x} y1={bar.high} x2={x} y2={bar.low} stroke={bar.color} strokeWidth="2.5" strokeLinecap="round" />
              <rect
                x={x - 14}
                y={bodyTop}
                width="28"
                height={bodyHeight}
                fill={bar.color}
                rx="2"
                stroke={bar.color}
                strokeWidth="1"
              />
            </g>
          );
        })}
      </svg>
    );
  }

  if (config.type === 'tri') {
    const { bars } = config;
    return (
      <svg width={width} height={height} viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
        {bars.map((bar, i) => {
          const x = 20 + i * 30;
          const bodyTop = Math.min(bar.open, bar.close);
          const bodyHeight = Math.max(Math.abs(bar.close - bar.open), 3);
          return (
            <g key={i}>
              <line x1={x} y1={bar.high} x2={x} y2={bar.low} stroke={bar.color} strokeWidth="2" strokeLinecap="round" />
              <rect
                x={x - 10}
                y={bodyTop}
                width="20"
                height={bodyHeight}
                fill={bar.color}
                rx="2"
                stroke={bar.color}
                strokeWidth="1"
              />
            </g>
          );
        })}
      </svg>
    );
  }

  if (config.type === 'multi') {
    const { bars } = config;
    return (
      <svg width={width} height={height} viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
        {bars.map((bar, i) => {
          const x = 12 + i * 19;
          const bodyTop = Math.min(bar.open, bar.close);
          const bodyHeight = Math.max(Math.abs(bar.close - bar.open), 2.5);
          return (
            <g key={i}>
              <line x1={x} y1={bar.high} x2={x} y2={bar.low} stroke={bar.color} strokeWidth="1.8" strokeLinecap="round" />
              <rect
                x={x - 6.5}
                y={bodyTop}
                width="13"
                height={bodyHeight}
                fill={bar.color}
                rx="1"
                stroke={bar.color}
                strokeWidth="0.5"
              />
            </g>
          );
        })}
      </svg>
    );
  }

  return null;
}

/**
 * 圖片壓縮轉 Base64 工具
 */
function resizeImageToBase64(file, maxWidth = 1024, maxHeight = 1024, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('圖片載入失敗，請確認檔案格式'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('檔案讀取失敗'));
    reader.readAsDataURL(file);
  });
}

export default function PatternEncyclopedia({ onLoadToSimulator, apiKey, selectedModel, onOpenApiKeyModal }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [scopeFilter, setScopeFilter] = useState('top12'); // 'top12' | 'all' | 'favorites'
  const [categoryFilter, setCategoryFilter] = useState('all'); // all | single | dual | multi
  const [sentimentFilter, setSentimentFilter] = useState('all'); // all | bullish | bearish | neutral
  const [positionFilter, setPositionFilter] = useState('all'); // all | bottom | top | breakout
  const [sortBy, setSortBy] = useState('default'); // 'default' | 'winRateDesc'
  const [favorites, setFavorites] = useState([]);

  // 新手模式開關 (預設開啟，直球對決買賣判斷)
  const [isBeginnerMode, setIsBeginnerMode] = useState(() => {
    const saved = localStorage.getItem('kline_beginner_mode');
    return saved !== null ? saved === 'true' : true;
  });

  // 拍照辨識 Modal 狀態
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [photoAnalysisResult, setPhotoAnalysisResult] = useState(null);
  const [photoAnalysisError, setPhotoAnalysisError] = useState(null);
  const [highlightedPatternId, setHighlightedPatternId] = useState(null);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // 讀取本地書籤收藏
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kline_favorite_patterns');
      if (saved) setFavorites(JSON.parse(saved));
    } catch (e) {
      console.warn('無法讀取收藏型態:', e);
    }
  }, []);

  // 監聽鍵盤剪貼簿貼上 (Ctrl+V) 圖片
  useEffect(() => {
    const handlePaste = (e) => {
      if (!isPhotoModalOpen) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            processImageFile(blob);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isPhotoModalOpen]);

  // 切換新手模式
  const handleToggleBeginnerMode = (val) => {
    setIsBeginnerMode(val);
    localStorage.setItem('kline_beginner_mode', val.toString());
  };

  // 切換收藏
  const toggleFavorite = (patternId, e) => {
    if (e) e.stopPropagation();
    setFavorites(prev => {
      let updated;
      if (prev.includes(patternId)) {
        updated = prev.filter(id => id !== patternId);
      } else {
        updated = [...prev, patternId];
      }
      try {
        localStorage.setItem('kline_favorite_patterns', JSON.stringify(updated));
      } catch (err) {
        console.warn('無法儲存收藏型態:', err);
      }
      return updated;
    });
  };

  // 處理上傳檔案
  const processImageFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('請選取有效的圖檔 (JPG, PNG, WebP)');
      return;
    }

    try {
      setPhotoAnalysisError(null);
      setPhotoAnalysisResult(null);
      const base64 = await resizeImageToBase64(file);
      setSelectedImage(base64);
    } catch (err) {
      console.error('圖片轉換失敗:', err);
      setPhotoAnalysisError(err.message || '無法載入圖片');
    }
  };

  // 開始 AI 拍照辨識
  const handleStartPhotoAnalysis = async () => {
    if (!selectedImage) return;

    if (!apiKey || apiKey.trim().length < 10) {
      setPhotoAnalysisError('尚未配置有效的 Google Gemini API Key。請先配置 Key 以解鎖 AI 雲端神經網路辨識！');
      return;
    }

    setIsAnalyzingImage(true);
    setPhotoAnalysisError(null);
    setPhotoAnalysisResult(null);

    try {
      const result = await analyzeKlineImageForEncyclopedia(selectedImage, apiKey, selectedModel);
      setPhotoAnalysisResult(result);
    } catch (err) {
      console.error('拍照辨識失敗:', err);
      setPhotoAnalysisError(err.message || '辨識遭遇問題，請稍候重試');
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  // 在百科中定位特定形態卡片
  const handleLocatePattern = (patternId) => {
    if (!patternId) return;
    setScopeFilter('all');
    setHighlightedPatternId(patternId);
    setIsPhotoModalOpen(false);

    setTimeout(() => {
      const el = document.getElementById(`pattern-card-${patternId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 250);

    setTimeout(() => {
      setHighlightedPatternId(null);
    }, 6000);
  };

  // 篩選型態
  const filteredPatterns = KLINE_PATTERNS.filter((pattern) => {
    const matchesSearch =
      pattern.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pattern.chineseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pattern.summary.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesScope =
      scopeFilter === 'all' ||
      (scopeFilter === 'top12' && pattern.isTopFrequent) ||
      (scopeFilter === 'favorites' && favorites.includes(pattern.id));

    const matchesCategory = categoryFilter === 'all' || pattern.category === categoryFilter;
    const matchesSentiment = sentimentFilter === 'all' || pattern.sentiment === sentimentFilter;

    // 位階篩選
    const loc = pattern.locationType || '';
    let matchesPosition = true;
    if (positionFilter === 'bottom') {
      matchesPosition = loc.includes('底') || loc.includes('起漲') || pattern.sentiment === 'bullish';
    } else if (positionFilter === 'top') {
      matchesPosition = loc.includes('高') || loc.includes('做頭') || loc.includes('逃命') || loc.includes('頂') || pattern.sentiment === 'bearish';
    } else if (positionFilter === 'breakout') {
      matchesPosition = loc.includes('突破') || loc.includes('中繼') || loc.includes('主升');
    }

    return matchesSearch && matchesScope && matchesCategory && matchesSentiment && matchesPosition;
  });

  // 排序
  const sortedPatterns = [...filteredPatterns].sort((a, b) => {
    if (sortBy === 'winRateDesc') {
      return b.winRate - a.winRate;
    }
    return 0;
  });

  return (
    <div style={{ margin: '20px 0' }}>
      
      {/* 頂部搜尋、模式切換與拍照辨識按鈕 */}
      <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <BookOpen size={22} color="#3b82f6" />
                <span>經典 K 線形態實戰作戰圖鑑</span>
              </h2>
              <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px', background: isBeginnerMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)', color: isBeginnerMode ? '#34d399' : '#60a5fa', border: `1px solid ${isBeginnerMode ? 'rgba(16, 185, 129, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`, fontWeight: '700' }}>
                {isBeginnerMode ? '🐣 新手極簡模式啟用中' : '📊 專業作戰模式'}
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {isBeginnerMode
                ? '新手友善：不囉嗦長篇大論，直接告訴您能不能買進／賣出與停損底線！'
                : '專業視圖：結合形態學物理、主力心理、位階判定與具體進出場 SOP，支援一鍵帶入模擬畫板演練'}
            </p>
          </div>

          {/* 右上角操作群：新手模式切換 + 拍照辨識按鈕 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            
            {/* 新手模式 vs 專業模式切換按鈕 */}
            <div style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.4)', padding: '3px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <button
                onClick={() => handleToggleBeginnerMode(true)}
                style={{
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '7px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: isBeginnerMode ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
                  color: isBeginnerMode ? '#ffffff' : '#94a3b8',
                  boxShadow: isBeginnerMode ? '0 2px 8px rgba(16, 185, 129, 0.4)' : 'none'
                }}
              >
                🐣 新手模式 (買賣直判)
              </button>
              <button
                onClick={() => handleToggleBeginnerMode(false)}
                style={{
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '7px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: !isBeginnerMode ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent',
                  color: !isBeginnerMode ? '#ffffff' : '#94a3b8',
                  boxShadow: !isBeginnerMode ? '0 2px 8px rgba(59, 130, 246, 0.4)' : 'none'
                }}
              >
                📊 專業作戰模式
              </button>
            </div>

            {/* 拍照 / 圖片辨識按鈕 */}
            <button
              onClick={() => setIsPhotoModalOpen(true)}
              className="btn-primary"
              style={{
                fontSize: '0.85rem',
                padding: '7px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                borderColor: '#a855f7',
                boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)'
              }}
            >
              <Camera size={16} />
              <span>📸 拍照 / 圖片辨識形態</span>
            </button>

          </div>
        </div>

        {/* 搜尋框與排序 */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', width: '100%', marginTop: '16px' }}>
          <div style={{ position: 'relative', minWidth: 0, flex: '1 1 180px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="搜尋型態名稱、關鍵字..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '9px 12px 9px 36px',
                color: '#fff',
                fontSize: '0.88rem',
                outline: 'none'
              }}
            />
          </div>

          {/* 勝率排序切換按鈕 */}
          <button
            onClick={() => setSortBy(prev => prev === 'winRateDesc' ? 'default' : 'winRateDesc')}
            className={`btn-${sortBy === 'winRateDesc' ? 'primary' : 'secondary'}`}
            style={{ fontSize: '0.82rem', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
            title="按歷史勝率由高到低排序"
          >
            <ArrowUpDown size={15} color={sortBy === 'winRateDesc' ? '#fff' : '#f59e0b'} />
            <span>{sortBy === 'winRateDesc' ? '🏆 勝率最高優先' : '預設排序'}</span>
          </button>
        </div>

        {/* 核心實戰範圍切換 (Top 12 vs 52 全集 vs 我的收藏) */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setScopeFilter('top12')}
            className={`btn-${scopeFilter === 'top12' ? 'primary' : 'secondary'}`}
            style={{ fontSize: '0.85rem', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Zap size={15} color={scopeFilter === 'top12' ? '#fff' : '#f59e0b'} />
            <span>🔥 實戰高頻必背 (TOP 12 精選)</span>
          </button>

          <button
            onClick={() => setScopeFilter('all')}
            className={`btn-${scopeFilter === 'all' ? 'primary' : 'secondary'}`}
            style={{ fontSize: '0.85rem', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <BookOpen size={15} />
            <span>📚 全部 52 種 K 棒形態大全</span>
          </button>

          <button
            onClick={() => setScopeFilter('favorites')}
            className={`btn-${scopeFilter === 'favorites' ? 'primary' : 'secondary'}`}
            style={{ fontSize: '0.85rem', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Star size={15} color={scopeFilter === 'favorites' ? '#fbbf24' : '#94a3b8'} fill={scopeFilter === 'favorites' ? '#fbbf24' : 'none'} />
            <span>⭐ 我的收藏 ({favorites.length})</span>
          </button>
        </div>

        {/* 股價位階篩選器 */}
        <div className="scrollable-tabs" style={{ gap: '8px', marginTop: '14px', alignItems: 'center', paddingBottom: '4px' }}>
          <span style={{ fontSize: '0.8rem', color: '#93c5fd', fontWeight: '700', flexShrink: 0 }}>📍 股價位階：</span>
          {[
            { id: 'all', label: '全部位階' },
            { id: 'bottom', label: '🟢 底部築底 / 起漲反轉' },
            { id: 'top', label: '🔴 高檔做頭 / 逃命反轉' },
            { id: 'breakout', label: '🚀 中繼整理 / 突破加速' }
          ].map((pos) => (
            <button
              key={pos.id}
              onClick={() => setPositionFilter(pos.id)}
              className="btn-secondary"
              style={{
                fontSize: '0.8rem',
                padding: '5px 12px',
                flexShrink: 0,
                background: positionFilter === pos.id ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                borderColor: positionFilter === pos.id ? '#60a5fa' : 'var(--border-subtle)',
                color: positionFilter === pos.id ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: positionFilter === pos.id ? '700' : 'normal'
              }}
            >
              {pos.label}
            </button>
          ))}
        </div>

        {/* 分類按鈕列 */}
        <div className="scrollable-tabs" style={{ gap: '8px', marginTop: '10px', alignItems: 'center', paddingBottom: '4px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', flexShrink: 0 }}>形態維度：</span>
          {[
            { id: 'all', label: '全部' },
            { id: 'single', label: '單一 K 棒' },
            { id: 'dual', label: '雙 K 組合' },
            { id: 'multi', label: '三 K 及多 K' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className="btn-secondary"
              style={{
                fontSize: '0.8rem',
                padding: '5px 12px',
                flexShrink: 0,
                background: categoryFilter === cat.id ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                borderColor: categoryFilter === cat.id ? '#3b82f6' : 'var(--border-subtle)',
                color: categoryFilter === cat.id ? '#60a5fa' : 'var(--text-secondary)'
              }}
            >
              {cat.label}
            </button>
          ))}

          <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)', margin: '0 4px', flexShrink: 0 }} />

          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', flexShrink: 0 }}>買賣建議：</span>
          {[
            { id: 'all', label: '全部' },
            { id: 'bullish', label: '🟢 可以買進', color: '#6ee7b7' },
            { id: 'bearish', label: '🔴 建議賣出', color: '#fca5a5' },
            { id: 'neutral', label: '🟡 觀望等待', color: '#fcd34d' }
          ].map((sent) => (
            <button
              key={sent.id}
              onClick={() => setSentimentFilter(sent.id)}
              className="btn-secondary"
              style={{
                fontSize: '0.8rem',
                padding: '5px 12px',
                flexShrink: 0,
                background: sentimentFilter === sent.id ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                borderColor: sentimentFilter === sent.id ? 'rgba(255, 255, 255, 0.3)' : 'var(--border-subtle)',
                color: sentimentFilter === sent.id ? '#ffffff' : (sent.color || 'var(--text-secondary)')
              }}
            >
              {sent.label}
            </button>
          ))}
        </div>
      </div>

      {/* 形態卡片網格 */}
      {sortedPatterns.length === 0 ? (
        <div className="glass-panel" style={{ padding: '50px 20px', textAlign: 'center', margin: '20px 0' }}>
          <BookOpen size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#f8fafc', marginBottom: '6px' }}>
            查無符合條件的 K 線形態
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
            {scopeFilter === 'favorites' ? '您目前尚未收藏任何型態，可在型態右上角點擊 ⭐ 加入收藏！' : '請嘗試切換「52 種形態大全」或重設篩選條件。'}
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setScopeFilter('all');
              setCategoryFilter('all');
              setSentimentFilter('all');
              setPositionFilter('all');
              setSortBy('default');
            }}
            className="btn-secondary"
            style={{ fontSize: '0.85rem', padding: '6px 16px' }}
          >
            重設所有篩選條件
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: '18px' }}>
          {sortedPatterns.map((pattern, index) => {
            const isBull = pattern.sentiment === 'bullish';
            const isBear = pattern.sentiment === 'bearish';
            const isFav = favorites.includes(pattern.id);
            const isHighlighted = highlightedPatternId === pattern.id;

            // ==========================================
            // 視圖 A: 新手模式 (簡潔直判，不囉嗦長篇大論)
            // ==========================================
            if (isBeginnerMode) {
              return (
                <div
                  key={pattern.id}
                  id={`pattern-card-${pattern.id}`}
                  className="glass-card"
                  style={{
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    borderLeft: `5px solid ${isBull ? '#10b981' : isBear ? '#ef4444' : '#f59e0b'}`,
                    position: 'relative',
                    boxShadow: isHighlighted ? '0 0 25px rgba(250, 204, 21, 0.6)' : undefined,
                    border: isHighlighted ? '2px solid #facc15' : undefined,
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div>
                    {/* 頂部超大直觀買賣標籤 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        background: isBull ? 'rgba(16, 185, 129, 0.2)' : isBear ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        border: `1px solid ${isBull ? '#10b981' : isBear ? '#ef4444' : '#f59e0b'}`,
                        color: isBull ? '#34d399' : isBear ? '#f87171' : '#fbbf24',
                        fontWeight: '800',
                        fontSize: '0.92rem'
                      }}>
                        <span>{isBull ? '🟢 可以買進' : isBear ? '🔴 建議賣出' : '🟡 觀望等待'}</span>
                        <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>
                          {isBull ? '(偏多訊號)' : isBear ? '(偏空避險)' : '(方向未定)'}
                        </span>
                      </div>

                      {/* 收藏按鈕 */}
                      <button
                        onClick={(e) => toggleFavorite(pattern.id, e)}
                        style={{
                          background: isFav ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          border: `1px solid ${isFav ? '#fbbf24' : 'var(--border-subtle)'}`,
                          borderRadius: '6px',
                          padding: '5px 7px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isFav ? '#fbbf24' : '#94a3b8'
                        }}
                        title={isFav ? '取消收藏' : '加入收藏'}
                      >
                        <Star size={15} fill={isFav ? '#fbbf24' : 'none'} />
                      </button>
                    </div>

                    {/* 形態名稱 */}
                    <div style={{ marginBottom: '10px' }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ffffff', margin: 0 }}>
                        {pattern.name}
                      </h3>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                        {pattern.chineseName}
                      </div>
                    </div>

                    {/* SVG 圖示預覽 (新手一眼核對型態形狀) */}
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.35)', padding: '12px', borderRadius: '10px', marginBottom: '12px' }}>
                      <PatternSVG config={pattern.svgConfig} width={90} height={100} />
                    </div>

                    {/* 新手直觀動作指引卡 (極簡一句話，核心關鍵) */}
                    <div style={{
                      background: isBull ? 'rgba(16, 185, 129, 0.08)' : isBear ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                      border: `1px solid ${isBull ? 'rgba(16, 185, 129, 0.25)' : isBear ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
                      borderRadius: '8px',
                      padding: '10px 12px',
                      marginBottom: '10px'
                    }}>
                      <div style={{ fontSize: '0.86rem', color: '#f1f5f9', lineHeight: '1.5', fontWeight: '600' }}>
                        {isBull ? '💡 實戰動作：' : isBear ? '⚠️ 避險動作：' : '⏳ 觀望動作：'}
                        <span style={{ color: isBull ? '#a7f3d0' : isBear ? '#fecaca' : '#fde68a' }}>
                          {pattern.entryRule || (isBull ? '出現轉折止跌起漲，回測不破防守點可買進。' : isBear ? '走勢做頭或破線轉弱，持股者宜逢高出清。' : '多空雙方僵持，空手者切勿追價，等待突破。')}
                        </span>
                      </div>
                    </div>

                    {/* 停損防守線 (新手絕對必看) */}
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '6px', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Shield size={14} color="#f87171" style={{ flexShrink: 0 }} />
                      <div>
                        <strong style={{ color: '#fca5a5' }}>停損底線：</strong>
                        <span>{pattern.stopLossRule || '跌破此形態最低點立即退場'}</span>
                      </div>
                    </div>

                  </div>

                  {/* 底部勝率與帶入畫板 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', marginTop: 'auto', gap: '8px' }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Award size={14} color="#f59e0b" />
                      <span>勝率：<strong style={{ color: '#fff', fontSize: '0.95rem' }}>{pattern.winRate}%</strong></span>
                    </div>

                    {onLoadToSimulator && (
                      <button
                        onClick={() => onLoadToSimulator(pattern)}
                        className="btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '4px 8px', color: '#60a5fa' }}
                        title="帶入畫板演練"
                      >
                        🕹️ 帶入畫板
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            // ==========================================
            // 視圖 B: 專業作戰模式 (完整 SOP、心理學與位階)
            // ==========================================
            return (
              <div
                key={pattern.id}
                id={`pattern-card-${pattern.id}`}
                className="glass-card"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderLeft: `4px solid ${isBull ? 'var(--tw-bull)' : isBear ? 'var(--tw-bear)' : '#f59e0b'}`,
                  position: 'relative',
                  boxShadow: isHighlighted ? '0 0 25px rgba(250, 204, 21, 0.6)' : undefined,
                  border: isHighlighted ? '2px solid #facc15' : undefined,
                  transition: 'all 0.3s ease'
                }}
              >
                <div>
                  {/* 頂部形態名稱、位階與徽章 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#f8fafc', margin: 0 }}>
                          {pattern.name}
                        </h3>
                        {pattern.isTopFrequent && (
                          <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.2)', color: '#fcd34d', border: '1px solid rgba(245, 158, 11, 0.4)', fontWeight: '700' }}>
                            TOP 實戰
                          </span>
                        )}
                        {sortBy === 'winRateDesc' && (
                          <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: index === 0 ? 'rgba(234, 179, 8, 0.3)' : 'rgba(255,255,255,0.1)', color: index === 0 ? '#facc15' : '#cbd5e1', fontWeight: '800' }}>
                            #{index + 1}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {pattern.chineseName}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: '700',
                          padding: '4px 8px',
                          borderRadius: '8px',
                          background: isBull ? 'var(--tw-bull-bg)' : isBear ? 'var(--tw-bear-bg)' : 'rgba(245, 158, 11, 0.15)',
                          color: isBull ? '#fca5a5' : isBear ? '#6ee7b7' : '#fcd34d',
                          border: `1px solid ${isBull ? 'var(--tw-bull-border)' : isBear ? 'var(--tw-bear-border)' : 'rgba(245, 158, 11, 0.3)'}`,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {isBull ? '🚀 買進' : isBear ? '🔻 賣出' : '⚠️ 觀望'}
                      </span>

                      {/* 收藏按鈕 */}
                      <button
                        onClick={(e) => toggleFavorite(pattern.id, e)}
                        style={{
                          background: isFav ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          border: `1px solid ${isFav ? '#fbbf24' : 'var(--border-subtle)'}`,
                          borderRadius: '6px',
                          padding: '5px 7px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isFav ? '#fbbf24' : '#94a3b8',
                          transition: 'all 0.2s ease'
                        }}
                        title={isFav ? '點擊取消收藏' : '加入我的常用收藏'}
                      >
                        <Star size={15} fill={isFav ? '#fbbf24' : 'none'} />
                      </button>
                    </div>
                  </div>

                  {/* 位階判定標籤 */}
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                      📍 適用位階：{pattern.locationType || (isBull ? '底部反轉 / 起漲段' : isBear ? '高檔反轉 / 逃命段' : '區間整理 / 方向待定')}
                    </span>
                  </div>

                  {/* SVG 圖解與內容 */}
                  <div style={{ margin: '14px 0', background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: '100px', width: '100%', marginBottom: '12px' }}>
                      <PatternSVG config={pattern.svgConfig} width={105} height={115} />
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <strong style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                        📖 白話特徵：
                      </strong>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginTop: '3px', margin: 0 }}>
                        {pattern.summary}
                      </p>
                    </div>

                    {/* 實戰操盤 SOP 核心卡 */}
                    <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.06)', marginTop: '10px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <Shield size={15} /> 實戰操盤 SOP 指引
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
                        <div style={{ color: '#e2e8f0' }}>
                          <span style={{ color: '#60a5fa', fontWeight: '600' }}>• 進場觸發：</span>
                          {pattern.entryRule || pattern.tradingRules[0]}
                        </div>
                        <div style={{ color: '#e2e8f0' }}>
                          <span style={{ color: '#f87171', fontWeight: '600' }}>• 停損防守：</span>
                          {pattern.stopLossRule || pattern.tradingRules[1] || '跌破此形態最低點立即停損'}
                        </div>
                        {pattern.targetRule && (
                          <div style={{ color: '#e2e8f0' }}>
                            <span style={{ color: '#34d399', fontWeight: '600' }}>• 獲利目標：</span>
                            {pattern.targetRule}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>

                {/* 底部勝率與一鍵帶入畫板 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', marginTop: 'auto', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Award size={15} color="#f59e0b" />
                    <span>
                      歷史勝率：<strong style={{ color: '#fff', fontSize: '0.95rem' }}>{pattern.winRate}%</strong>
                    </span>
                  </div>

                  {onLoadToSimulator && (
                    <button
                      onClick={() => onLoadToSimulator(pattern)}
                      className="btn-secondary"
                      style={{ fontSize: '0.78rem', padding: '4px 10px', color: '#60a5fa', borderColor: 'rgba(59, 130, 246, 0.4)' }}
                      title="將此形態直接載入至畫板，繼續插入 K 棒演練後續走勢"
                    >
                      🕹️ 帶入畫板演練
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* 拍照 / 圖片辨識 K 線形態 Modal */}
      {/* ============================================================ */}
      {isPhotoModalOpen && (
        <div
          onClick={() => setIsPhotoModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300,
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-panel"
            style={{
              maxWidth: '620px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              background: 'linear-gradient(135deg, rgba(20, 24, 38, 0.95) 0%, rgba(15, 18, 28, 0.98) 100%)',
              boxShadow: '0 15px 40px rgba(0,0,0,0.7)'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.2)', color: '#c084fc' }}>
                  <Camera size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ffffff', margin: 0 }}>
                    拍照 / 圖片辨識 K 線形態
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    上傳看盤軟體截圖或手機拍照，AI 視覺神經秒辨形態並直判買賣建議
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsPhotoModalOpen(false)}
                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#94a3b8', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Hidden File Inputs */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.[0]) processImageFile(e.target.files[0]);
              }}
            />
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.[0]) processImageFile(e.target.files[0]);
              }}
            />

            {/* 沒有選取圖片時的上傳區 */}
            {!selectedImage ? (
              <div>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) processImageFile(e.dataTransfer.files[0]);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed rgba(139, 92, 246, 0.4)',
                    borderRadius: '12px',
                    padding: '36px 20px',
                    textAlign: 'center',
                    background: 'rgba(139, 92, 246, 0.04)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    marginBottom: '16px'
                  }}
                >
                  <UploadCloud size={40} color="#a855f7" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontSize: '1rem', fontWeight: '700', color: '#f8fafc', marginBottom: '6px' }}>
                    點擊上傳圖片 或 將 K 線圖拖曳至此
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                    支援 PNG、JPG、WebP 格式，亦可直接在畫面上按 <strong style={{ color: '#c084fc' }}>Ctrl + V</strong> 貼上截圖
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="btn-primary"
                    style={{ fontSize: '0.85rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Camera size={16} />
                    <span>開啟手機相機拍照</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary"
                    style={{ fontSize: '0.85rem', padding: '8px 16px' }}
                  >
                    從相簿 / 檔案選取
                  </button>
                </div>
              </div>
            ) : (
              /* 已選取圖片預覽區 */
              <div>
                <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', maxHeight: '240px', background: '#000', marginBottom: '14px', textAlign: 'center' }}>
                  <img
                    src={selectedImage}
                    alt="K 線預覽"
                    style={{ maxHeight: '240px', width: 'auto', maxWidth: '100%', objectFit: 'contain' }}
                  />
                  <button
                    onClick={() => {
                      setSelectedImage(null);
                      setPhotoAnalysisResult(null);
                      setPhotoAnalysisError(null);
                    }}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'rgba(0,0,0,0.6)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '50%',
                      padding: '6px',
                      color: '#fff',
                      cursor: 'pointer'
                    }}
                    title="重新選取圖片"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>

                {/* 辨識按鈕 */}
                {!photoAnalysisResult && (
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '14px' }}>
                    <button
                      onClick={handleStartPhotoAnalysis}
                      disabled={isAnalyzingImage}
                      className="btn-primary"
                      style={{
                        padding: '10px 24px',
                        fontSize: '0.95rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                        borderColor: '#a855f7'
                      }}
                    >
                      {isAnalyzingImage ? (
                        <>
                          <div className="animate-spin-custom">
                            <Sparkles size={16} />
                          </div>
                          <span>Gemini AI 正在視覺辨識形態...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          <span>✨ 開始 AI 形態辨識</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        setSelectedImage(null);
                        setPhotoAnalysisResult(null);
                        setPhotoAnalysisError(null);
                      }}
                      className="btn-secondary"
                      style={{ fontSize: '0.85rem', padding: '8px 14px' }}
                    >
                      重新選取
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 未設定 API Key 提示引導 */}
            {(!apiKey || apiKey.trim().length < 10) && (
              <div style={{ margin: '14px 0', padding: '12px 14px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#fcd34d' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>需配置 Gemini API Key 才能呼叫雲端多模態視覺模型辨識。</span>
                </div>
                {onOpenApiKeyModal && (
                  <button
                    onClick={() => {
                      setIsPhotoModalOpen(false);
                      onOpenApiKeyModal();
                    }}
                    className="btn-primary"
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                  >
                    立即配置 Key
                  </button>
                )}
              </div>
            )}

            {/* 錯誤訊息 */}
            {photoAnalysisError && (
              <div style={{ margin: '14px 0', padding: '12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{photoAnalysisError}</span>
              </div>
            )}

            {/* ============================================================ */}
            {/* 辨識結果看板 (新手友善：直白告訴能否買賣與停損) */}
            {/* ============================================================ */}
            {photoAnalysisResult && (
              <div style={{ marginTop: '16px', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', padding: '18px', border: '1px solid rgba(255,255,255,0.1)' }}>
                
                {/* 買賣決策大徽章 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    background: photoAnalysisResult.sentiment === 'bullish' ? 'rgba(16, 185, 129, 0.25)' : photoAnalysisResult.sentiment === 'bearish' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)',
                    border: `1.5px solid ${photoAnalysisResult.sentiment === 'bullish' ? '#10b981' : photoAnalysisResult.sentiment === 'bearish' ? '#ef4444' : '#f59e0b'}`,
                    color: photoAnalysisResult.sentiment === 'bullish' ? '#34d399' : photoAnalysisResult.sentiment === 'bearish' ? '#f87171' : '#fbbf24',
                    fontWeight: '900',
                    fontSize: '1.1rem'
                  }}>
                    <span>
                      {photoAnalysisResult.sentiment === 'bullish' ? '🟢 【可以買進】' : photoAnalysisResult.sentiment === 'bearish' ? '🔴 【建議賣出 / 避險】' : '🟡 【觀望等待】'}
                    </span>
                    <span style={{ fontSize: '0.78rem', opacity: 0.9 }}>
                      {photoAnalysisResult.canBuyText || photoAnalysisResult.actionDecision}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Award size={16} />
                    <span>勝率/信心度：{photoAnalysisResult.winRate || 80}%</span>
                  </div>
                </div>

                {/* 形態名稱 */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>辨識出的核心形態：</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#ffffff', marginTop: '2px' }}>
                    {photoAnalysisResult.patternName}
                  </div>
                  {photoAnalysisResult.keyReason && (
                    <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: '4px' }}>
                      {photoAnalysisResult.keyReason}
                    </div>
                  )}
                </div>

                {/* 新手白話指引 */}
                <div style={{
                  background: photoAnalysisResult.sentiment === 'bullish' ? 'rgba(16, 185, 129, 0.1)' : photoAnalysisResult.sentiment === 'bearish' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: `1px solid ${photoAnalysisResult.sentiment === 'bullish' ? 'rgba(16, 185, 129, 0.3)' : photoAnalysisResult.sentiment === 'bearish' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                  marginBottom: '12px'
                }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>
                    💡 新手一句話操作指引：
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: '1.5' }}>
                    {photoAnalysisResult.beginnerSummary}
                  </div>
                </div>

                {/* 停損防守位 */}
                {photoAnalysisResult.stopLossPoint && (
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 12px', borderRadius: '8px', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={16} color="#f87171" style={{ flexShrink: 0 }} />
                    <div>
                      <strong style={{ color: '#fca5a5' }}>🛡️ 停損防守位置：</strong>
                      <span>{photoAnalysisResult.stopLossPoint}</span>
                    </div>
                  </div>
                )}

                {/* 底部功能：在百科中定位形態 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
                  <button
                    onClick={() => {
                      setSelectedImage(null);
                      setPhotoAnalysisResult(null);
                    }}
                    className="btn-secondary"
                    style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                  >
                    辨識另一張
                  </button>

                  {photoAnalysisResult.matchedPatternId && (
                    <button
                      onClick={() => handleLocatePattern(photoAnalysisResult.matchedPatternId)}
                      className="btn-primary"
                      style={{ fontSize: '0.82rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Eye size={14} />
                      <span>在百科中定位此形態</span>
                    </button>
                  )}
                </div>

              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
