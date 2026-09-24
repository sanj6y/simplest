import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { getKB, getProfile, getResume, getSettings } from '../../lib/storage';

export function App() {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<{ name: string; kb: number; hasKey: boolean; hasResume: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      const [p, kb, s, r] = await Promise.all([getProfile(), getKB(), getSettings(), getResume()]);
      setInfo({
        name: [p.personal.firstName, p.personal.lastName].filter(Boolean).join(' ') || 'No profile yet',
        kb: kb.filter((e) => e.answer).length,
        hasKey: !!s.apiKey,
        hasResume: !!r,
      });
    })();
  }, []);

  async function fill() {
    setBusy(true);
    setStatus('Filling…');
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');
      let res: { ok: boolean; error?: string } | undefined;
      try {
        res = (await browser.tabs.sendMessage(tab.id, { type: 'fill' })) as typeof res;
      } catch {
        // Content script not loaded (page opened before install). Inject it and retry.
        await browser.scripting.executeScript({ target: { tabId: tab.id }, files: ['/content-scripts/content.js'] });
        await new Promise((r) => setTimeout(r, 300));
        res = (await browser.tabs.sendMessage(tab.id, { type: 'fill' })) as typeof res;
      }
      setStatus(res?.ok ? 'Done. Check the panel on the page.' : `Failed: ${res?.error ?? 'unknown error'}`);
    } catch (e) {
      setStatus(`Could not run on this page: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <h1>Simplest</h1>
      {info && (
        <div className="muted">
          {info.name} · {info.kb} saved answers
          {!info.hasResume && <div className="warn">No resume uploaded yet.</div>}
          {!info.hasKey && <div className="warn">No API key: unknown questions will be asked to you instead of the model.</div>}
        </div>
      )}
      <button className="primary" onClick={fill} disabled={busy}>
        Fill this page
      </button>
      <button className="ghost" onClick={() => browser.runtime.openOptionsPage()}>
        Edit profile & answers
      </button>
      {status && <div className="status">{status}</div>}
    </div>
  );
}
