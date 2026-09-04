import { useEffect, useState } from 'react';
import { Key, ShieldCheck, ExternalLink, CheckCircle2, AlertCircle, RefreshCw, Globe, ChevronDown, ChevronUp, Copy, Check, Loader2, X, Info, Zap } from 'lucide-react';
import { GEMINI_MODEL_OPTIONS, fetchAvailableGeminiModels, getGeminiModelCandidates } from '../services/aiVisionService';
import { testProxyConnection } from '../services/yahooFinanceService';

export const CLOUDFLARE_WORKER_CODE = `export default {
  async fetch(request) {
    // 1. 處理瀏覽器 CORS Preflight 預檢請求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing target url parameter: ?url=' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    try {
      // 2. 偽裝桌面 Chrome 瀏覽器 Header，防止被 Yahoo Finance 判斷為爬蟲擋下
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9,zh-TW;q=0.8,zh;q=0.7'
        }
      });

      // 3. 轉發回傳時自動補上 Access-Control-Allow-Origin: * 徹底解決前端 403 跨網域阻擋
      const newHeaders = new Headers(response.headers);
      newHeaders.set('Access-Control-Allow-Origin', '*');
      newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      newHeaders.set('Access-Control-Allow-Headers', '*');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};`;

export default function ApiKeyModal({
  isOpen,
  onClose,
  initialTab = 'key',
  apiKey,
  onSaveApiKey,
  selectedModel = 'auto',
  onSaveModel,
  patternCount = 12,
  onSavePatternCount,
  onSaveCustomProxy
}) {
  const [activeModalTab, setActiveModalTab] = useState(initialTab || 'key');
  const [inputKey, setInputKey] = useState(apiKey || '');
  const [model, setModel] = useState(selectedModel || 'auto');
  const [localPatternCount, setLocalPatternCount] = useState(patternCount);
  const [customProxy, setCustomProxy] = useState(() => {
    try {
      return localStorage.getItem('kline_custom_proxy') || '';
    } catch {
      return '';
    }
  });
  const [copiedWorkerCode, setCopiedWorkerCode] = useState(false);
  const [proxyTestStatus, setProxyTestStatus] = useState(null); // null | 'testing' | 'success' | 'error'
  const [proxyTestMessage, setProxyTestMessage] = useState('');
  const [testStatus, setTestStatus] = useState(null); // null | 'testing' | 'success' | 'error'
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveModalTab(initialTab || 'key');
      setInputKey(apiKey || '');
      setModel(selectedModel || 'auto');
      setLocalPatternCount(patternCount || 12);
      try {
        setCustomProxy(localStorage.getItem('kline_custom_proxy') || '');
      } catch {
        // ignore
      }
      setProxyTestStatus(null);
      setTestStatus(null);
    }
  }, [isOpen, initialTab, apiKey, selectedModel, patternCount]);

  if (!isOpen) return null;

  const handleTestKey = async () => {
    if (!inputKey || inputKey.trim().length < 10) {
      setTestStatus('error');
      setTestMessage('請先輸入有效的 Gemini API Key');
      return;
    }

    setTestStatus('testing');
    setTestMessage('正在測試與 Google Gemini 伺服器連線並獲取可用模型...');

    try {
      const models = await fetchAvailableGeminiModels(inputKey.trim());
      const modelsToTest = getGeminiModelCandidates(model, models);
      if (modelsToTest.length === 0) {
        throw new Error('您的 API Key 沒有權限存取可用的 Gemini Flash 視覺模型。');
      }

      let workingModel = null;
      let lastErrorMsg = '';

      for (const targetModel of modelsToTest) {
        try {
          setTestMessage(`正在測試模型：${targetModel}...`);
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': inputKey.trim()
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Hello, reply "OK"' }] }]
            })
          });

          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            lastErrorMsg = errJson.error?.message || `HTTP ${res.status}: ${res.statusText}`;
            continue;
          }

          workingModel = targetModel;
          break;
        } catch (err) {
          lastErrorMsg = err.message;
        }
      }

      if (workingModel) {
        setModel(workingModel);
        setTestStatus('success');
        setTestMessage(`連線測試成功！已選用可用模型：${workingModel}`);
      } else {
        throw new Error(lastErrorMsg || '所有可用模型均測試失敗');
      }
    } catch (err) {
      setTestStatus('error');
      setTestMessage(`連線失敗: ${err.message}`);
    }
  };

  const handleTestProxy = async () => {
    if (!customProxy || !customProxy.trim()) {
      setProxyTestStatus('error');
      setProxyTestMessage('請先填入您的 Cloudflare Worker 或 Proxy 網址');
      return;
    }
    setProxyTestStatus('testing');
    setProxyTestMessage('正在透過您的專屬 Worker 測試抓取 Yahoo Finance 即時行情...');
    try {
      const { latency } = await testProxyConnection(customProxy.trim());
      setProxyTestStatus('success');
      setProxyTestMessage(`連線測試成功！伺服器回應正常 (延遲約 ${latency}ms)，美股與跨市場指數已全面解鎖。`);
    } catch (err) {
      setProxyTestStatus('error');
      setProxyTestMessage(`連線失敗：${err.message}`);
    }
  };

  const handleCopyWorkerCode = () => {
    navigator.clipboard.writeText(CLOUDFLARE_WORKER_CODE);
    setCopiedWorkerCode(true);
    setTimeout(() => setCopiedWorkerCode(false), 2500);
  };

  const handleClearProxy = () => {
    setCustomProxy('');
    setProxyTestStatus(null);
    setProxyTestMessage('');
    if (onSaveCustomProxy) onSaveCustomProxy('');
    try {
      localStorage.removeItem('kline_custom_proxy');
    } catch { }
  };

  const handleSave = () => {
    onSaveApiKey(inputKey.trim());
    if (onSaveModel) onSaveModel(model);
    if (onSavePatternCount) onSavePatternCount(localPatternCount);
    if (onSaveCustomProxy) onSaveCustomProxy(customProxy.trim());
    try {
      if (customProxy.trim()) {
        localStorage.setItem('kline_custom_proxy', customProxy.trim());
      } else {
        localStorage.removeItem('kline_custom_proxy');
      }
    } catch {
      // 忽略
    }
    onClose();
  };

  const handleClear = () => {
    setInputKey('');
    setTestStatus(null);
    onSaveApiKey('');
    if (onSaveModel) onSaveModel('auto');
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '16px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel"
        style={{
          maxWidth: '680px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '16px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.6)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: activeModalTab === 'proxy' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: activeModalTab === 'proxy' ? '#10b981' : '#3b82f6'
            }}>
              {activeModalTab === 'proxy' ? <Globe size={20} /> : <Key size={20} />}
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#ffffff', margin: 0 }}>
                {activeModalTab === 'proxy' ? 'Cloudflare 專屬代理設定 (解決 403 跨網域)' : '配置 Google Gemini AI 核心'}
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                {activeModalTab === 'proxy' ? '解除美股與國際指數跨網域限制，實現零阻礙秒級抓取' : '啟用 Gemini Flash 多模態神經網路與深度走勢推演'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Tabs Switcher */}
        <div style={{ padding: '12px 24px 0', background: 'rgba(15, 23, 42, 0.4)' }}>
          <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.35)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              onClick={() => setActiveModalTab('key')}
              style={{
                flex: 1,
                padding: '9px 14px',
                borderRadius: '8px',
                border: 'none',
                background: activeModalTab === 'key' ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
                color: activeModalTab === 'key' ? '#93c5fd' : '#94a3b8',
                fontWeight: activeModalTab === 'key' ? '700' : '500',
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              <Key size={15} color={inputKey ? '#10b981' : '#f59e0b'} />
              <span>Gemini AI 模型設定</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModalTab('proxy')}
              style={{
                flex: 1,
                padding: '9px 14px',
                borderRadius: '8px',
                border: 'none',
                background: activeModalTab === 'proxy' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                color: activeModalTab === 'proxy' ? '#6ee7b7' : '#94a3b8',
                fontWeight: activeModalTab === 'proxy' ? '700' : '500',
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              <Globe size={15} color={customProxy ? '#10b981' : '#60a5fa'} />
              <span>Cloudflare 專屬代理 (解 403)</span>
            </button>
          </div>
        </div>

        {/* Modal Body (Scrollable) */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, maxHeight: 'calc(90vh - 160px)' }}>
          {/* TAB 1: GEMINI AI 設定 */}
          {activeModalTab === 'key' && (
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '16px' }}>
                配置 API Key 後，系統將透過 Google 雲端視覺大模型直接讀取歷史 K 棒走勢，並綜合技術指標、法人籌碼與盤後籌碼共振進行多維推演。
              </p>

              {/* 模型自訂選擇 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#e2e8f0', marginBottom: '6px', fontWeight: '600' }}>
                  指定使用模型 (AI Model)：
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#1a2234',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#ffffff',
                    fontSize: '0.88rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {GEMINI_MODEL_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {/* 辨識型態數量 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#e2e8f0', marginBottom: '6px', fontWeight: '600' }}>
                  辨識型態數量 (Pattern Count)：
                </label>
                <select
                  value={localPatternCount}
                  onChange={(e) => setLocalPatternCount(Number(e.target.value))}
                  style={{
                    width: '100%',
                    background: '#1a2234',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#ffffff',
                    fontSize: '0.88rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value={12}>12 種 (預設新手，最常見反轉型態)</option>
                  <option value={52}>52 種 (進階玩家，完整經典圖鑑)</option>
                </select>
              </div>

              {/* Gemini Key 輸入框 */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#e2e8f0', marginBottom: '6px', fontWeight: '600' }}>
                  Google Gemini API Key：
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={inputKey}
                    onChange={(e) => {
                      setInputKey(e.target.value);
                      setTestStatus(null);
                    }}
                    style={{
                      flex: 1,
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      color: '#fff',
                      fontSize: '0.88rem',
                      fontFamily: 'monospace',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={handleTestKey}
                    disabled={testStatus === 'testing'}
                    className="btn-secondary"
                    style={{ fontSize: '0.82rem', padding: '8px 14px', whiteSpace: 'nowrap' }}
                  >
                    {testStatus === 'testing' ? <RefreshCw size={14} className="animate-spin-custom" /> : '測試連線'}
                  </button>
                </div>

                {/* 測試結果反饋 */}
                {testStatus && (
                  <div style={{
                    marginTop: '10px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: testStatus === 'success' ? 'rgba(16, 185, 129, 0.15)' : testStatus === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                    color: testStatus === 'success' ? '#34d399' : testStatus === 'error' ? '#f87171' : '#60a5fa',
                    border: `1px solid ${testStatus === 'success' ? 'rgba(16, 185, 129, 0.3)' : testStatus === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
                  }}>
                    {testStatus === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{testMessage}</span>
                  </div>
                )}

                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={14} color="#10b981" /> 僅儲存於您本地瀏覽器 (localStorage)
                  </span>
                  <a
                    href="https://aistudio.google.com/api-keys"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px' }}
                  >
                    前往 Google AI Studio 申請免費 Key <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CLOUDFLARE 專屬代理設定 */}
          {activeModalTab === 'proxy' && (
            <div>
              {/* 狀態卡片 */}
              {customProxy ? (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#34d399',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={20} color="#10b981" style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.88rem' }}>專屬 Cloudflare Worker 代理運行中</div>
                      <div style={{ fontSize: '0.75rem', color: '#a7f3d0', fontFamily: 'monospace', marginTop: '2px', wordBreak: 'break-all' }}>
                        {customProxy}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearProxy}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.72rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)', flexShrink: 0 }}
                  >
                    移除代理
                  </button>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  color: '#fbbf24',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}>
                  <Info size={18} color="#fbbf24" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.86rem' }}>尚未配置專屬代理 (美股將暫停抓取)</div>
                    <div style={{ fontSize: '0.78rem', color: '#fde68a', marginTop: '3px', lineHeight: '1.4' }}>
                      台股（如 2330, 0050）直連官方資料庫不受影響。若需查詢美股（TSLA、NVDA）或費半/那斯達克跨市場連動，請配置下方 Worker 網址以解鎖。
                    </div>
                  </div>
                </div>
              )}

              {/* 網址輸入框 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#e2e8f0', marginBottom: '6px', fontWeight: '600' }}>
                  Cloudflare Worker 專屬代理網址：
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="例如：https://my-proxy.xxxx.workers.dev"
                    value={customProxy}
                    onChange={(e) => {
                      setCustomProxy(e.target.value);
                      setProxyTestStatus(null);
                    }}
                    style={{
                      flex: 1,
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      color: '#fff',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleTestProxy}
                    disabled={proxyTestStatus === 'testing'}
                    className="btn-secondary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '0 14px',
                      fontSize: '0.82rem',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {proxyTestStatus === 'testing' ? (
                      <>
                        <Loader2 size={14} className="animate-spin-custom" />
                        測試中...
                      </>
                    ) : (
                      <>
                        <Zap size={14} color="#60a5fa" />
                        測試連線
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 測試結果反饋 */}
              {proxyTestStatus && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    lineHeight: '1.4',
                    background:
                      proxyTestStatus === 'success'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : proxyTestStatus === 'error'
                          ? 'rgba(239, 68, 68, 0.15)'
                          : 'rgba(59, 130, 246, 0.15)',
                    color:
                      proxyTestStatus === 'success'
                        ? '#34d399'
                        : proxyTestStatus === 'error'
                          ? '#f87171'
                          : '#60a5fa',
                    border: `1px solid ${proxyTestStatus === 'success'
                        ? 'rgba(16, 185, 129, 0.3)'
                        : proxyTestStatus === 'error'
                          ? 'rgba(239, 68, 68, 0.3)'
                          : 'rgba(59, 130, 246, 0.3)'
                      }`
                  }}
                >
                  {proxyTestStatus === 'success' && <CheckCircle2 size={16} style={{ marginTop: '2px', flexShrink: 0 }} />}
                  {proxyTestStatus === 'error' && <AlertCircle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />}
                  {proxyTestStatus === 'testing' && <Loader2 size={16} className="animate-spin-custom" style={{ marginTop: '2px', flexShrink: 0 }} />}
                  <span>{proxyTestMessage}</span>
                </div>
              )}

              {/* 詳細原委說明卡片 */}
              <div style={{
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '16px'
              }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#93c5fd', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Info size={15} /> 為什麼需要這個設定？（技術原理與原委）
                </h4>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.6' }}>
                  <li>
                    <b>台股原生免代理直連</b>：台股上市櫃（如 2330、2603、0050）與台指期夜盤已全面直連 <b>FinMind 開放資料集</b> 與 <b>TWSE 證交所官方開放 API</b>。這兩者官方原生支援 <code>Access-Control-Allow-Origin: *</code>，因此在 GitHub Pages 上完全免代理即可秒速獲取。
                  </li>
                  <li>
                    <b>美股與國際指數受限</b>：查詢美股（TSLA、NVDA、AAPL）、台積電 ADR (TSM) 或抓取<b>費半、那斯達克、S&P 500 市場連動環境</b>時，必須向 Yahoo Finance 請求數據。
                  </li>
                  <li>
                    <b>403 跨網域封鎖原因</b>：純前端靜態部署受瀏覽器同源政策（SOP）限制，直接請求會被瀏覽器強制阻擋；而公共免費 Proxy（Allorigins、Codetabs 等）已被 Yahoo 封鎖黑名單而報 403。
                  </li>
                  <li>
                    <b>Cloudflare 0元治本解法</b>：Cloudflare 每日提供 <b>100,000 次免費請求</b>（個人使用完全免費且用不完）。透過您自己的邊緣節點代抓 Yahoo，IP 乾淨不會被封鎖，回傳時自動補上 CORS 標頭，徹底解決 403。
                  </li>
                </ul>
              </div>

              {/* 超詳細 4 步驟圖文操作指引 */}
              <div style={{
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '16px'
              }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#34d399', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Zap size={15} /> Cloudflare Worker 4 步極簡部署指南 (約 1~2 分鐘)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                  <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', borderLeft: '3px solid #3b82f6' }}>
                    <strong style={{ color: '#fff' }}>步驟 1：登入與建立</strong><br />
                    前往 <a href="https://dash.cloudflare.com/" target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>Cloudflare Dashboard</a> ➜ 點左側選單 <b>Workers 和 Pages</b> ➜ 點右上角藍色按鈕 <b>「建立應用程式」</b>。
                  </div>

                  <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', borderLeft: '3px solid #3b82f6' }}>
                    <strong style={{ color: '#fff' }}>步驟 2：選擇模板並部署</strong><br />
                    在選項中點選第三個綠色地球圖示 <b>「從 Hello World 開始！」</b> ➜ 下方「Protect with Cloudflare Access」保持<b>關閉（灰色）</b> ➜ 點右下角藍色按鈕 <b>「部署」</b>。
                  </div>

                  <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', borderLeft: '3px solid #10b981' }}>
                    <strong style={{ color: '#fff' }}>步驟 3：線上編輯器貼上代碼</strong><br />
                    部署完成後，點擊右上角 <b>「&lt;/&gt; 編輯代碼」</b> ➜ 在線上編輯器中按 <code>Ctrl + A</code> 全選後按 <code>Delete</code> 清空 ➜ 點擊下方 <b>「一鍵複製 Worker 代碼」</b> 貼上 ➜ 點右上角藍色按鈕 <b>「部署」</b> 儲存。
                  </div>

                  <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', borderLeft: '3px solid #10b981' }}>
                    <strong style={{ color: '#fff' }}>步驟 4：複製網址填入本系統</strong><br />
                    回到 Worker 概覽頁，複製右下角「網域與路由」的專屬網址（例如 <code>https://my-proxy.xxxx.workers.dev</code>）➜ 貼入上方輸入框 ➜ 點擊「測試連線」驗證！
                  </div>
                </div>

                {/* Worker 代碼複製區 */}
                <div style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>轉發腳本代碼 (含 Chrome 偽裝與 CORS 注入)：</span>
                    <button
                      type="button"
                      onClick={handleCopyWorkerCode}
                      className="btn-secondary"
                      style={{
                        fontSize: '0.74rem',
                        padding: '4px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        color: copiedWorkerCode ? '#10b981' : '#fff',
                        borderColor: copiedWorkerCode ? '#10b981' : undefined
                      }}
                    >
                      {copiedWorkerCode ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                      {copiedWorkerCode ? '已複製代碼！' : '一鍵複製 Worker 代碼'}
                    </button>
                  </div>
                  <pre style={{
                    margin: 0,
                    padding: '10px',
                    background: 'rgba(0,0,0,0.55)',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontFamily: 'monospace',
                    color: '#a5b4fc',
                    overflowX: 'auto',
                    maxHeight: '130px',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    {CLOUDFLARE_WORKER_CODE}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: '10px',
          justifyContent: 'flex-end',
          background: 'rgba(15, 23, 42, 0.6)'
        }}>
          {activeModalTab === 'key' && apiKey && (
            <button
              onClick={handleClear}
              className="btn-secondary"
              style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', marginRight: 'auto' }}
            >
              清除 Gemini Key
            </button>
          )}

          <button onClick={onClose} className="btn-secondary">
            取消
          </button>
          <button onClick={handleSave} className="btn-primary">
            儲存所有配置
          </button>
        </div>
      </div>
    </div>
  );
}
