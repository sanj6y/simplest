import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import { answerPending, runFill } from '../lib/engine';
import type { Message } from '../lib/messages';
import { looksLikeApplication } from '../lib/scan';
import { getSettings } from '../lib/storage';
import { SimplestUI } from '../lib/ui';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  main() {
    let ui: SimplestUI | null = null;

    const getUI = () => {
      if (!ui) {
        ui = new SimplestUI({
          onFill: fill,
          onAnswer: answerPending,
          onOpenOptions: () => void browser.runtime.sendMessage({ type: 'openOptions' } satisfies Message),
        });
      }
      ui.mount();
      return ui;
    };

    async function fill() {
      const u = getUI();
      try {
        const { report, pending, adapter } = await runFill({ onProgress: (m) => u.setStatus(m, true) });
        u.showReport(report, pending, adapter);
      } catch (e) {
        u.showError((e as Error).message);
      }
    }

    browser.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
      if (msg?.type === 'fill') {
        getUI()
          .fill()
          .then(() => sendResponse({ ok: true }), (e: Error) => sendResponse({ ok: false, error: e.message }));
        return true;
      }
      if (msg?.type === 'status') {
        sendResponse({ ok: true, application: looksLikeApplication(), url: location.href });
        return false;
      }
      return false;
    });

    // Show the floating button only on pages that look like an application form.
    const maybeShow = async () => {
      const settings = await getSettings();
      if (!settings.showFloatingButton) return;
      if (looksLikeApplication()) getUI();
    };
    void maybeShow();
    // SPA navigation / lazy forms: re-check a few times after load.
    let checks = 0;
    const timer = setInterval(() => {
      if (ui || ++checks > 8) return clearInterval(timer);
      void maybeShow();
    }, 1500);
  },
});
