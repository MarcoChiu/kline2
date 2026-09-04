import { useEffect, useState } from 'react';
import { Key, ShieldCheck, ExternalLink, CheckCircle2, AlertCircle, RefreshCw, Globe, ChevronDown, ChevronUp, Copy, Check, Loader2 } from 'lucide-react';
import { GEMINI_MODEL_OPTIONS, fetchAvailableGeminiModels, getGeminiModelCandidates } from '../services/aiVisionService';
import { testProxyConnection } from '../services/yahooFinanceService';

export const CLOUDFLARE_WORKER_CODE = `export default {
  async fetch(request) {
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
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9,zh-TW;q=0.8,zh;q=0.7'
        }
      });

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

export default function ApiKeyModal({ isOpen, onClose, apiKey, onSaveApiKey, selectedModel = 'auto', onSaveModel, patternCount = 12, onSavePatternCount }) {
  const [inputKey, setInputKey] = useState(apiKey || '');
  const [model, setModel] = useState(selectedModel || 'auto');
  const [localPatternCount, setLocalPatternCount] = useState(patternCount);
  const [corsproxyKey, setCorsproxyKey] = useState(() => {
    try {
      return localStorage.getItem('kline_corsproxy_api_key') || '';
    } catch {
      return '';
    }
  });
  const [customProxy, setCustomProxy] = useState(() => {
    try {
      return localStorage.getItem('kline_custom_proxy') || '';
    } catch {
      return '';
    }
  });
  const [showAdvancedProxy, setShowAdvancedProxy] = useState(false);
  const [showWorkerGuide, setShowWorkerGuide] = useState(false);
  const [copiedWorkerCode, setCopiedWorkerCode] = useState(false);
  const [proxyTestStatus, setProxyTestStatus] = useState(null); // null | 'testing' | 'success' | 'error'
  const [proxyTestMessage, setProxyTestMessage] = useState('');
  const [testStatus, setTestStatus] = useState(null); // null | 'testing' | 'success' | 'error'
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    setModel(selectedModel || 'auto');
    setLocalPatternCount(patternCount || 12);
  }, [selectedModel, patternCount]);

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
    setProxyTestMessage('正在透過您的 Proxy 測試抓取 Yahoo Finance 數據...');
    try {
      const { latency } = await testProxyConnection(customProxy.trim());
      setProxyTestStatus('success');
      setProxyTestMessage(`連線測試成功！伺服器回應正常 (延遲約 ${latency}ms)，美股與指數數據已可正常載入`);
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

  const handleSave = () => {
    onSaveApiKey(inputKey.trim());
    if (onSaveModel) onSaveModel(model);
    if (onSavePatternCount) onSavePatternCount(localPatternCount);
    try {
      if (corsproxyKey.trim()) {
        localStorage.setItem('kline_corsproxy_api_key', corsproxyKey.trim());
      } else {
        localStorage.removeItem('kline_corsproxy_api_key');
      }
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
        padding: '20px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel"
        style={{
          maxWidth: '540px',
          width: '100%',
          padding: '28px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
            <Key size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#ffffff' }}>
              配置 Google Gemini API Key
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              啟用 Gemini Flash 多模態視覺辨識
            </p>
          </div>
        </div>

        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '16px' }}>
          配置 API Key 後，系統將透過 Google 雲端視覺大模型直接讀取截圖中的全部文字、代碼、價格、均線與 K 線結構。
        </p>

        {/* 模型自訂選擇 */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: '#e2e8f0', marginBottom: '6px', fontWeight: '600' }}>
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
              fontSize: '0.9rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {GEMINI_MODEL_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: '#e2e8f0', marginBottom: '6px', fontWeight: '600' }}>
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
              fontSize: '0.9rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value={12}>12 種 (預設新手，最常見反轉型態)</option>
            <option value={52}>52 種 (進階玩家，完整經典圖鑑)</option>
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: '#e2e8f0', marginBottom: '6px', fontWeight: '600' }}>
            Gemini API Key：
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
                fontSize: '0.9rem',
                fontFamily: 'monospace',
                outline: 'none'
              }}
            />
            <button
              onClick={handleTestKey}
              disabled={testStatus === 'testing'}
              className="btn-secondary"
              style={{ fontSize: '0.85rem', padding: '8px 14px', whiteSpace: 'nowrap' }}
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
              fontSize: '0.82rem',
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

        {/* 跨市場 / 代理備援設定 (選填) */}
        <div style={{ marginBottom: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
          <button
            type="button"
            onClick={() => setShowAdvancedProxy(!showAdvancedProxy)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              cursor: 'pointer',
              padding: 0
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
              <Globe size={14} color="#60a5fa" />
              跨市場美股與 Cloudflare Worker 代理設定 (選填)
            </span>
            {showAdvancedProxy ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showAdvancedProxy && (
            <div style={{ marginTop: '12px', padding: '14px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: '1.4', marginBottom: '12px' }}>
                💡 <b>台股與台指期已全面原生直連 FinMind 官方開放資料集</b>，免代理直連且極速載入。若需在 GitHub Pages 上查詢<b>美股（TSLA、NVDA）、ADR 或費半/那斯達克市場連動數據</b>，推薦填入您的專屬 Cloudflare Worker 代理網址（免費、穩定、徹底告別 403）。
              </p>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '6px' }}>
                  Cloudflare Worker 專屬代理網址：
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="例如：https://my-proxy.xxxx.workers.dev"
                    value={customProxy}
                    onChange={(e) => {
                      setCustomProxy(e.target.value);
                      if (proxyTestStatus) setProxyTestStatus(null);
                    }}
                    style={{
                      flex: 1,
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      color: '#fff',
                      fontSize: '0.82rem',
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
                      gap: '4px',
                      padding: '0 12px',
                      fontSize: '0.78rem',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {proxyTestStatus === 'testing' ? (
                      <>
                        <Loader2 size={13} className="animate-spin-custom" />
                        測試中...
                      </>
                    ) : (
                      '測試連線'
                    )}
                  </button>
                </div>
              </div>

              {proxyTestStatus && (
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    marginBottom: '12px',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '6px',
                    lineHeight: '1.4',
                    background:
                      proxyTestStatus === 'success'
                        ? 'rgba(16, 185, 129, 0.12)'
                        : proxyTestStatus === 'error'
                        ? 'rgba(239, 68, 68, 0.12)'
                        : 'rgba(59, 130, 246, 0.12)',
                    color:
                      proxyTestStatus === 'success'
                        ? '#34d399'
                        : proxyTestStatus === 'error'
                        ? '#f87171'
                        : '#60a5fa',
                    border: `1px solid ${
                      proxyTestStatus === 'success'
                        ? 'rgba(16, 185, 129, 0.25)'
                        : proxyTestStatus === 'error'
                        ? 'rgba(239, 68, 68, 0.25)'
                        : 'rgba(59, 130, 246, 0.25)'
                    }`
                  }}
                >
                  {proxyTestStatus === 'success' && <CheckCircle2 size={14} style={{ marginTop: '2px', flexShrink: 0 }} />}
                  {proxyTestStatus === 'error' && <AlertCircle size={14} style={{ marginTop: '2px', flexShrink: 0 }} />}
                  {proxyTestStatus === 'testing' && <Loader2 size={14} className="animate-spin-custom" style={{ marginTop: '2px', flexShrink: 0 }} />}
                  <span>{proxyTestMessage}</span>
                </div>
              )}

              {/* Cloudflare Worker 極簡 3 步教學區塊 */}
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                <button
                  type="button"
                  onClick={() => setShowWorkerGuide(!showWorkerGuide)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#60a5fa',
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>{showWorkerGuide ? '▼ 隱藏' : '▶ 查看'} Cloudflare 3 步極簡部署教學與 Worker 代碼</span>
                </button>

                {showWorkerGuide && (
                  <div style={{ marginTop: '8px', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', fontSize: '0.75rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                    <ol style={{ paddingLeft: '18px', margin: '0 0 10px 0' }}>
                      <li>登入 Cloudflare Dashboard ➜ 點選左側 <b>Workers & Pages</b> ➜ <b>Create application</b> ➜ <b>Create Worker</b> ➜ 點 <b>Deploy</b>。</li>
                      <li>點擊 <b>Edit code</b>，將預設代碼全選替換為下方代碼，按右上角 <b>Deploy</b> 儲存。</li>
                      <li>複製產生的 Worker 網址（如 <code>https://xxx.workers.dev</code>）貼回上方輸入框並按「測試連線」即可！</li>
                    </ol>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
                      <button
                        type="button"
                        onClick={handleCopyWorkerCode}
                        className="btn-secondary"
                        style={{
                          fontSize: '0.72rem',
                          padding: '3px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {copiedWorkerCode ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        {copiedWorkerCode ? '已複製代碼！' : '一鍵複製 Worker 代碼'}
                      </button>
                    </div>
                    <pre style={{
                      margin: 0,
                      padding: '8px',
                      background: 'rgba(0,0,0,0.5)',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontFamily: 'monospace',
                      color: '#a5b4fc',
                      overflowX: 'auto',
                      maxHeight: '130px'
                    }}>
                      {CLOUDFLARE_WORKER_CODE}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          {apiKey && (
            <button
              onClick={handleClear}
              className="btn-secondary"
              style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
            >
              清除 Key
            </button>
          )}
          <button onClick={onClose} className="btn-secondary">
            取消
          </button>
          <button onClick={handleSave} className="btn-primary">
            儲存配置
          </button>
        </div>
      </div>
    </div>
  );
}
