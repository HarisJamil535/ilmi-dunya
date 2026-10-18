import { useEffect, useRef, useState } from 'react';
import { RefreshCw, WifiOff, X } from 'lucide-react';
import './network-notice.css';

export default function NetworkNotice() {
  const [notice, setNotice] = useState(null);
  const [checking, setChecking] = useState(false);
  const dialog = useRef(null);
  const controller = useRef(null);
  useEffect(() => {
    const failed = event => setNotice(event.detail?.service ? 'service' : 'network');
    const offline = () => setNotice('offline');
    const online = () => setNotice(current => current ? 'network' : null);
    window.addEventListener('app-network-error', failed);
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('app-network-error', failed);
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (notice && !dialog.current.open) dialog.current.showModal();
    if (!notice && dialog.current.open) dialog.current.close();
  }, [notice]);
  const retry = async () => {
    setChecking(true);
    controller.current = new AbortController();
    const timer = setTimeout(() => controller.current.abort(), 15000);
    try {
      const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
      const response = await fetch(`${base}/study-options`, { signal: controller.current.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Unavailable');
      await response.json();
      setNotice(null);
      window.dispatchEvent(new Event('app-network-restored'));
    } catch {
      setNotice(navigator.onLine ? 'network' : 'offline');
    } finally { clearTimeout(timer); setChecking(false); }
  };
  return <dialog ref={dialog} className="network-notice" aria-labelledby="network-notice-title" aria-describedby="network-notice-copy" onCancel={() => setNotice(null)}>
    <button className="network-notice-close" aria-label="Dismiss connection message" onClick={() => setNotice(null)}><X size={20} /></button>
    <WifiOff size={28} className="network-notice-icon" />
    <h2 id="network-notice-title">{notice === 'service' ? 'Temporarily unavailable' : 'A little trouble connecting'}</h2>
    <p id="network-notice-copy">{notice === 'offline' ? 'You appear to be offline. Check your Wi-Fi or mobile data, then try again.' : notice === 'service' ? 'The service is taking a little longer to respond. Please try again shortly.' : 'We could not reach IlmiDunya. Your connection may be slow or interrupted. Check your connection and try again.'}</p>
    <p className="network-notice-hint">If you were saving or submitting, check the result before trying again.</p>
    <div className="network-notice-actions"><button onClick={() => setNotice(null)}>Dismiss</button><button className="network-notice-retry" disabled={checking} onClick={retry}><RefreshCw size={16} className={checking ? 'animate-spin' : ''} />{checking ? 'Checking…' : 'Try connection'}</button></div>
  </dialog>;
}
