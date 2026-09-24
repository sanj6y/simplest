/**
 * In-page UI: a floating Fill button and a panel for questions that need you.
 * Rendered inside a shadow root so page CSS cannot touch it.
 */
import type { PendingQuestion } from './engine';
import type { FillReport } from './messages';

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif; }
.root { position: fixed; right: 20px; bottom: 20px; z-index: 2147483646; display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.pill { display: inline-flex; align-items: center; gap: 8px; background: #111827; color: #fff; border: 0; border-radius: 999px; padding: 10px 16px; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 6px 20px rgba(0,0,0,.25); }
.pill:hover { background: #1f2937; }
.pill[disabled] { opacity: .7; cursor: default; }
.pill .dot { width: 8px; height: 8px; border-radius: 50%; background: #34d399; }
.panel { width: 380px; max-height: 70vh; overflow: auto; background: #fff; color: #111827; border-radius: 14px; box-shadow: 0 12px 40px rgba(0,0,0,.28); padding: 14px 16px; font-size: 13px; line-height: 1.45; }
.panel h3 { margin: 0 0 6px; font-size: 14px; }
.panel .sub { color: #6b7280; margin-bottom: 10px; }
.q { border-top: 1px solid #e5e7eb; padding: 10px 0; }
.q label { display: block; font-weight: 600; margin-bottom: 6px; }
.q .orig { color: #6b7280; font-weight: 400; font-size: 12px; margin-bottom: 6px; }
.q input[type=text], .q select, .q textarea { width: 100%; padding: 7px 9px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; }
.q textarea { min-height: 60px; resize: vertical; }
.q .row { display: flex; gap: 10px; align-items: center; margin-top: 6px; color: #6b7280; font-size: 12px; }
.q .quick { display: flex; gap: 6px; margin-bottom: 6px; flex-wrap: wrap; }
.q .quick button { border: 1px solid #d1d5db; background: #f9fafb; border-radius: 999px; padding: 3px 10px; font-size: 12px; cursor: pointer; }
.q .quick button:hover { background: #e5e7eb; }
.actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
.btn { border: 0; border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn.primary { background: #111827; color: #fff; }
.btn.ghost { background: #f3f4f6; color: #111827; }
.summary { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.summary span { background: #f3f4f6; border-radius: 6px; padding: 3px 8px; }
.err { color: #b91c1c; margin-top: 6px; white-space: pre-wrap; }
details { margin-top: 8px; }
details summary { cursor: pointer; color: #6b7280; }
.detail { font-size: 12px; color: #374151; display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; margin-top: 6px; }
.detail .o-filled { color: #047857; }
.detail .o-pending, .detail .o-no-option, .detail .o-empty, .detail .o-error, .detail .o-unsupported { color: #b45309; }
.detail .o-already, .detail .o-skip { color: #6b7280; }
`;

export interface UIHandlers {
  onFill(): Promise<void>;
  onAnswer(items: { q: PendingQuestion; answer: string; remember: boolean }[]): Promise<number>;
  onOpenOptions(): void;
}

export class SimplestUI {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private root: HTMLElement;
  private pill: HTMLButtonElement;
  private panel: HTMLElement | null = null;

  constructor(private handlers: UIHandlers) {
    this.host = document.createElement('div');
    this.host.setAttribute('data-simplest-ui', '');
    this.shadow = this.host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    this.shadow.appendChild(style);
    this.root = document.createElement('div');
    this.root.className = 'root';
    this.shadow.appendChild(this.root);
    this.pill = document.createElement('button');
    this.pill.className = 'pill';
    this.pill.innerHTML = '<span class="dot"></span><span>Fill with Simplest</span>';
    this.pill.addEventListener('click', () => void this.fill());
    this.root.appendChild(this.pill);
  }

  mount() {
    if (!this.host.isConnected) document.documentElement.appendChild(this.host);
  }

  hidePill() {
    this.pill.style.display = 'none';
  }

  setStatus(text: string, busy = false) {
    this.pill.disabled = busy;
    this.pill.querySelector('span:last-child')!.textContent = text;
  }

  async fill() {
    this.setStatus('Filling…', true);
    try {
      await this.handlers.onFill();
    } finally {
      this.setStatus('Fill again', false);
    }
  }

  showReport(report: FillReport, pending: PendingQuestion[], adapter: string) {
    this.closePanel();
    const panel = document.createElement('div');
    panel.className = 'panel';
    const h = document.createElement('h3');
    h.textContent = pending.length ? `${pending.length} question${pending.length === 1 ? '' : 's'} need${pending.length === 1 ? 's' : ''} you` : 'Done';
    panel.appendChild(h);
    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = `Detected: ${adapter}${report.usedModel ? ' · asked the model' : ''}`;
    panel.appendChild(sub);

    const summary = document.createElement('div');
    summary.className = 'summary';
    summary.innerHTML = `<span>Filled ${report.filled}</span><span>Skipped ${report.skipped}</span><span>Unresolved ${report.unresolved + report.asked}</span>`;
    panel.appendChild(summary);

    const rows: { q: PendingQuestion; get: () => string; remember: () => boolean }[] = [];
    for (const q of pending) {
      const box = document.createElement('div');
      box.className = 'q';
      const label = document.createElement('label');
      label.textContent = q.question || q.field.label;
      box.appendChild(label);
      if (q.question && q.field.label && q.question !== q.field.label) {
        const orig = document.createElement('div');
        orig.className = 'orig';
        orig.textContent = `On this page: “${q.field.label}”`;
        box.appendChild(orig);
      }
      let get: () => string;
      const opts = q.options.filter((o) => o && !/^(select|choose|--|please)/i.test(o));
      if (opts.length) {
        const sel = document.createElement('select');
        sel.innerHTML = `<option value="">— pick —</option>` + opts.map((o) => `<option>${escapeHtml(o)}</option>`).join('');
        box.appendChild(sel);
        get = () => sel.value;
      } else if (q.kind === 'yesno' || q.kind === 'agree' || q.field.kind === 'checkbox' || q.field.kind === 'buttons') {
        const quick = document.createElement('div');
        quick.className = 'quick';
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Yes / No';
        for (const v of ['Yes', 'No']) {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = v;
          b.addEventListener('click', () => (input.value = v));
          quick.appendChild(b);
        }
        box.appendChild(quick);
        box.appendChild(input);
        get = () => input.value;
      } else if (q.field.kind === 'textarea') {
        const ta = document.createElement('textarea');
        box.appendChild(ta);
        get = () => ta.value;
      } else {
        const input = document.createElement('input');
        input.type = 'text';
        box.appendChild(input);
        get = () => input.value;
      }
      const row = document.createElement('div');
      row.className = 'row';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      const cbl = document.createElement('label');
      cbl.style.fontWeight = '400';
      cbl.style.margin = '0';
      cbl.appendChild(cb);
      cbl.appendChild(document.createTextNode(' Remember this answer'));
      row.appendChild(cbl);
      const jump = document.createElement('a');
      jump.href = '#';
      jump.textContent = 'show field';
      jump.addEventListener('click', (e) => {
        e.preventDefault();
        q.field.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        q.field.el.style.outline = '2px solid #f59e0b';
        setTimeout(() => (q.field.el.style.outline = ''), 2000);
      });
      row.appendChild(jump);
      box.appendChild(row);
      panel.appendChild(box);
      rows.push({ q, get, remember: () => cb.checked });
    }

    if (report.errors.length) {
      const err = document.createElement('div');
      err.className = 'err';
      err.textContent = report.errors.join('\n');
      panel.appendChild(err);
    }

    const details = document.createElement('details');
    const ds = document.createElement('summary');
    ds.textContent = 'What happened to each field';
    details.appendChild(ds);
    const grid = document.createElement('div');
    grid.className = 'detail';
    for (const d of report.details) {
      const a = document.createElement('span');
      a.textContent = d.label.slice(0, 80);
      const b = document.createElement('span');
      b.className = `o-${d.outcome}`;
      b.textContent = `${d.outcome} · ${d.source}`;
      grid.appendChild(a);
      grid.appendChild(b);
    }
    details.appendChild(grid);
    panel.appendChild(details);

    const actions = document.createElement('div');
    actions.className = 'actions';
    const opt = document.createElement('button');
    opt.className = 'btn ghost';
    opt.textContent = 'Edit profile';
    opt.addEventListener('click', () => this.handlers.onOpenOptions());
    actions.appendChild(opt);
    const close = document.createElement('button');
    close.className = 'btn ghost';
    close.textContent = 'Close';
    close.addEventListener('click', () => this.closePanel());
    actions.appendChild(close);
    if (rows.length) {
      const save = document.createElement('button');
      save.className = 'btn primary';
      save.textContent = 'Save & fill';
      save.addEventListener('click', async () => {
        save.disabled = true;
        save.textContent = 'Filling…';
        const items = rows.map((r) => ({ q: r.q, answer: r.get(), remember: r.remember() }));
        const n = await this.handlers.onAnswer(items);
        save.textContent = `Filled ${n}`;
        setTimeout(() => this.closePanel(), 900);
      });
      actions.appendChild(save);
    }
    panel.appendChild(actions);

    this.panel = panel;
    this.root.insertBefore(panel, this.pill);
  }

  showError(message: string) {
    this.closePanel();
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `<h3>Something went wrong</h3><div class="err"></div><div class="actions"><button class="btn ghost">Close</button></div>`;
    panel.querySelector('.err')!.textContent = message;
    panel.querySelector('button')!.addEventListener('click', () => this.closePanel());
    this.panel = panel;
    this.root.insertBefore(panel, this.pill);
  }

  closePanel() {
    this.panel?.remove();
    this.panel = null;
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
