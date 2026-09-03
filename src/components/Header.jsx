import { BookOpen, Key, Sparkles, BarChart2, TrendingUp } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, hasApiKey, onOpenApiKeyModal }) {
  const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'DEV';

  return (
    <header className="glass-panel" style={{ margin: '12px auto 18px', padding: '12px 18px', maxWidth: '1280px', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', maxWidth: '100%', boxSizing: 'border-box' }}>
        
        {/* Logo & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #ef4444 0%, #3b82f6 50%, #10b981 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
            flexShrink: 0
          }}>
            <TrendingUp size={22} color="#ffffff" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em', background: 'linear-gradient(to right, #ffffff, #93c5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
                K-Line Master
              </h1>
              <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '16px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)', fontWeight: '600' }}>
                AI PRO
              </span>
              <span className="font-mono" style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.05)', color: '#94a3b8', border: '1px solid var(--border-subtle)' }}>
                v.{buildTime}
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              股票 K 線智能形態辨識與明日走勢預判系統
            </p>
          </div>
        </div>

        {/* Navigation Tabs (Mobile Scrollable) */}
        <nav className="scrollable-tabs" style={{ gap: '6px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-subtle)', maxWidth: '100%' }}>
          <button
            className={`nav-tab ${activeTab === 'analyzer' ? 'active' : ''}`}
            onClick={() => setActiveTab('analyzer')}
          >
            <Sparkles size={15} />
            <span>K 線分析儀</span>
          </button>


          <button
            className={`nav-tab ${activeTab === 'encyclopedia' ? 'active' : ''}`}
            onClick={() => setActiveTab('encyclopedia')}
          >
            <BookOpen size={15} />
            <span>K 線形態百科</span>
          </button>

          <button
            className={`nav-tab ${activeTab === 'simulator' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulator')}
          >
            <BarChart2 size={15} />
            <span>模擬測試畫板</span>
          </button>
        </nav>

        {/* API Key Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onOpenApiKeyModal}
            className="btn-secondary"
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
            title="設定 Google Gemini API Key 以啟用完整雲端神經網路辨識"
          >
            <Key size={14} color={hasApiKey ? '#10b981' : '#f59e0b'} />
            <span>{hasApiKey ? 'Gemini 已啟用' : '配置 Gemini Key'}</span>
          </button>
        </div>

      </div>
    </header>
  );
}
