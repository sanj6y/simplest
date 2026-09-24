/**
 * Put values into form controls in a way React / Vue / Angular forms notice.
 */
import { FieldOption, answerToBool, isPlaceholderOption, pickOption } from './options';
import type { Field } from './scan';
import { textOf } from './scan';
import { StoredFile, storedToFile } from './storage';

export type FillOutcome = 'filled' | 'already' | 'no-option' | 'empty' | 'unsupported' | 'error';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fire(el: Element, type: string, init: Record<string, unknown> = {}) {
  const ev =
    type === 'input'
      ? new InputEvent('input', { bubbles: true, cancelable: true, ...init })
      : type.startsWith('key')
        ? new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init })
        : type.startsWith('mouse') || type === 'click'
          ? new MouseEvent(type, { bubbles: true, cancelable: true, ...init })
          : new Event(type, { bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(ev);
}

export function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else (el as HTMLInputElement).value = value;
}

export function typeInto(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  el.focus();
  fire(el, 'focus');
  setNativeValue(el, value);
  fire(el, 'input', { data: value, inputType: 'insertText' });
  fire(el, 'change');
  fire(el, 'blur');
  el.blur();
}

function setContentEditable(el: HTMLElement, value: string) {
  el.focus();
  el.textContent = value;
  fire(el, 'input');
  fire(el, 'change');
  el.blur();
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Format a YYYY-MM (or YYYY-MM-DD) date for the control it is going into. */
export function formatDate(value: string, field: Field): string {
  const m = value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!m) return value;
  const [, y, mo, d] = m;
  const day = d ?? '01';
  const hints = `${field.hints} ${field.label}`.toLowerCase();
  const ph = (field.el.getAttribute('placeholder') ?? '').toLowerCase();
  if (field.kind === 'month') return `${y}-${mo}`;
  if (field.kind === 'date') return `${y}-${mo}-${day}`;
  if (/\byear\b/.test(hints) && !/month/.test(hints)) return y;
  if (/\bmonth\b/.test(hints) && !/year/.test(hints)) {
    const name = MONTHS[Number(mo) - 1];
    return `${name} | ${name.slice(0, 3)} | ${mo} | ${Number(mo)}`;
  }
  if (/yyyy-mm-dd/.test(ph)) return `${y}-${mo}-${day}`;
  if (/yyyy-mm|yyyy\/mm/.test(ph)) return ph.includes('/') ? `${y}/${mo}` : `${y}-${mo}`;
  if (/dd\/mm\/yyyy/.test(ph)) return `${day}/${mo}/${y}`;
  if (/mm\/dd\/yyyy/.test(ph)) return `${mo}/${day}/${y}`;
  if (/mm\/yyyy|mm \/ yyyy/.test(ph)) return `${mo}/${y}`;
  if (/mm\/yy\b/.test(ph)) return `${mo}/${y.slice(2)}`;
  if (/month|yyyy|year/.test(ph)) return `${MONTHS[Number(mo) - 1]} ${y}`;
  return `${mo}/${y}`;
}

const isDateish = (v: string) => /^\d{4}-\d{2}(-\d{2})?$/.test(v);

function selectOption(sel: HTMLSelectElement, opt: FieldOption) {
  sel.focus();
  setNativeValue(sel, opt.value);
  fire(sel, 'input');
  fire(sel, 'change');
  sel.blur();
}

function clickInput(input: HTMLInputElement) {
  input.focus();
  // A real click toggles state and lets React see it.
  input.click();
  fire(input, 'change');
}

const MENU_SELECTOR = '[role="listbox"] [role="option"], [role="option"], [class*="select__option"], [class*="menu"] [class*="option"], [id$="-listbox"] li, ul[class*="options"] li, [class*="dropdown"] li, [class*="autocomplete"] li';

function visibleMenuOptions(doc: Document, exclude?: Element | null): FieldOption[] {
  const nodes = Array.from(doc.querySelectorAll<HTMLElement>(MENU_SELECTOR));
  const out: FieldOption[] = [];
  for (const n of nodes) {
    if (exclude && exclude.contains(n)) continue;
    if (!n.getClientRects().length) continue;
    const text = textOf(n) || n.getAttribute('aria-label') || '';
    if (!text || text.length > 200) continue;
    out.push({ value: n.getAttribute('data-value') ?? n.id ?? text, text, el: n });
  }
  return out;
}

function clickMenuOption(el: HTMLElement) {
  el.scrollIntoView?.({ block: 'nearest' });
  fire(el, 'mousedown', { button: 0 });
  fire(el, 'mouseup', { button: 0 });
  el.click();
}

/** Fill a custom dropdown / autocomplete. Returns true when an option got picked. */
export async function fillCombobox(field: Field, answer: string, menuDelay = 350): Promise<FillOutcome> {
  const el = field.el;
  const doc = el.ownerDocument;
  const input = el instanceof HTMLInputElement ? el : (el.querySelector('input') as HTMLInputElement | null);
  const candidates = answer.split('|').map((s) => s.trim()).filter(Boolean);
  if (!candidates.length) return 'empty';

  for (const cand of candidates) {
    // Open the menu
    el.scrollIntoView?.({ block: 'center' });
    if (input) {
      input.focus();
      fire(input, 'focus');
      fire(el, 'mousedown', { button: 0 });
      fire(input, 'click');
      setNativeValue(input, cand);
      fire(input, 'input', { data: cand, inputType: 'insertText' });
      fire(input, 'keydown', { key: 'ArrowDown', code: 'ArrowDown' });
    } else {
      fire(el, 'mousedown', { button: 0 });
      el.click();
    }
    await sleep(menuDelay);

    let options = visibleMenuOptions(doc, null);
    if (!options.length) {
      await sleep(menuDelay);
      options = visibleMenuOptions(doc, null);
    }
    if (options.length) {
      const pick = pickOption(cand, options, 45) ?? (options.length === 1 && !isPlaceholderOption(options[0].text) ? options[0] : null);
      if (pick?.el) {
        clickMenuOption(pick.el);
        await sleep(80);
        if (input && !input.value && input.getAttribute('aria-expanded') !== 'false') {
          // Some libraries need Enter after highlighting
          fire(input, 'keydown', { key: 'Enter', code: 'Enter' });
        }
        return 'filled';
      }
    }
    // Nothing matched: fall back to keyboard selection of the first highlighted result for exact-ish answers.
    if (input && options.length === 0 && input.value) {
      fire(input, 'keydown', { key: 'Enter', code: 'Enter' });
      fire(input, 'keyup', { key: 'Enter', code: 'Enter' });
      await sleep(80);
      if (input.value) return 'filled';
    }
    // close the menu before trying the next candidate
    if (input) fire(input, 'keydown', { key: 'Escape', code: 'Escape' });
  }
  return 'no-option';
}

export function fillFile(field: Field, stored: StoredFile): FillOutcome {
  const input = field.el as HTMLInputElement;
  try {
    const dt = new DataTransfer();
    dt.items.add(storedToFile(stored));
    input.files = dt.files;
    fire(input, 'input');
    fire(input, 'change');
    return 'filled';
  } catch {
    return 'error';
  }
}

/**
 * Wait until no network resource has completed for `idleMs`, and until at least `minSinceNavMs`
 * have passed since navigation, giving up after `maxMs`.
 */
export async function waitForSettle(minSinceNavMs: number, idleMs = 500, maxMs = 6000): Promise<void> {
  const start = performance.now();
  const remaining = minSinceNavMs - performance.now();
  if (remaining > 0) await sleep(Math.min(remaining, maxMs));
  let last = performance.getEntriesByType('resource').length;
  let lastChange = performance.now();
  while (performance.now() - start < maxMs) {
    await sleep(100);
    const n = performance.getEntriesByType('resource').length;
    if (n !== last) {
      last = n;
      lastChange = performance.now();
    } else if (performance.now() - lastChange >= idleMs) {
      break;
    }
  }
}

function pressToggle(btn: HTMLElement) {
  fire(btn, 'mousedown', { button: 0 });
  fire(btn, 'mouseup', { button: 0 });
  btn.click();
}

/**
 * Re-apply a toggle-button or checkbox choice by clicking away and back, so the site receives a
 * fresh change after its own state has loaded. Ends in the same visible state it started in.
 */
export async function reassertToggle(field: Field): Promise<void> {
  if (field.kind === 'buttons' && field.buttons) {
    const isOn = (b: HTMLElement) => b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-checked') === 'true' || b.getAttribute('aria-selected') === 'true';
    const pressed = field.buttons.find(isOn);
    const other = field.buttons.find((b) => b !== pressed);
    if (!pressed || !other) return;
    pressToggle(other);
    // Each click triggers an autosave request; the next click is dropped while one is in flight.
    await waitForSettle(0, 400, 3000);
    pressToggle(pressed);
    await waitForSettle(0, 400, 3000);
    if (!isOn(pressed)) {
      pressToggle(pressed);
      await waitForSettle(0, 400, 3000);
    }
    return;
  }
  if (field.kind === 'checkbox') {
    const input = (field.members?.[0] ?? field.el) as HTMLInputElement;
    if (!input.checked) return;
    clickInput(input);
    await waitForSettle(0, 400, 3000);
    if (!input.checked) {
      clickInput(input);
      await waitForSettle(0, 400, 3000);
    }
    if (!input.checked) clickInput(input);
  }
}

export interface FillContext {
  overwrite: boolean;
  menuDelay: number;
}

/**
 * Fill one field with an answer. The answer is plain text; `|` separates fallbacks for choices.
 */
export async function fillField(field: Field, answer: string, ctx: FillContext): Promise<FillOutcome> {
  const el = field.el;
  if (!answer && field.kind !== 'checkbox') return 'empty';

  switch (field.kind) {
    case 'text':
    case 'number':
    case 'date':
    case 'month':
    case 'textarea': {
      const live = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : el.isContentEditable ? (el.textContent ?? '') : field.currentValue;
      if (live.trim() && !ctx.overwrite) return 'already';
      const value = isDateish(answer) ? formatDate(answer, field).split('|')[0].trim() : answer;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) typeInto(el, value);
      else if (el.isContentEditable) setContentEditable(el, value);
      else return 'unsupported';
      return 'filled';
    }
    case 'select': {
      const sel = el as HTMLSelectElement;
      const cur = sel.options[sel.selectedIndex];
      if (cur && !isPlaceholderOption(cur.text) && cur.value && !ctx.overwrite) return 'already';
      const value = isDateish(answer) ? formatDate(answer, field) : answer;
      const opt = pickOption(value, field.options);
      if (!opt) return 'no-option';
      selectOption(sel, opt);
      return 'filled';
    }
    case 'radio': {
      const opt = pickOption(answer, field.options);
      if (!opt?.el) return 'no-option';
      const input = opt.el as HTMLInputElement;
      if (input.checked) return 'already';
      if (field.currentValue && !ctx.overwrite) return 'already';
      clickInput(input);
      return 'filled';
    }
    case 'buttons': {
      const opt = pickOption(answer, field.options);
      const btn = opt?.el as HTMLElement | undefined;
      if (!btn) return 'no-option';
      const pressed = btn.getAttribute('aria-pressed') === 'true' || btn.getAttribute('aria-checked') === 'true' || btn.getAttribute('aria-selected') === 'true';
      if (pressed) return 'already';
      if (field.currentValue && !ctx.overwrite) return 'already';
      btn.scrollIntoView?.({ block: 'center' });
      fire(btn, 'mousedown', { button: 0 });
      fire(btn, 'mouseup', { button: 0 });
      btn.click();
      return 'filled';
    }
    case 'checkbox': {
      const input = (field.members?.[0] ?? el) as HTMLInputElement;
      const want = answerToBool(answer);
      if (want === null) return 'no-option';
      if (input.checked === want) return 'already';
      if (!want && !ctx.overwrite && input.checked) return 'already';
      clickInput(input);
      return 'filled';
    }
    case 'checkbox-group': {
      const wanted = answer.split(/[|,;]/).map((s) => s.trim()).filter(Boolean);
      let did = false;
      for (const w of wanted) {
        const opt = pickOption(w, field.options);
        const input = opt?.el as HTMLInputElement | undefined;
        if (input && !input.checked) {
          clickInput(input);
          did = true;
        }
      }
      return did ? 'filled' : field.currentValue ? 'already' : 'no-option';
    }
    case 'combobox': {
      if (field.currentValue && !ctx.overwrite) return 'already';
      const value = isDateish(answer) ? formatDate(answer, field) : answer;
      return fillCombobox(field, value, ctx.menuDelay);
    }
    case 'file':
      return 'unsupported';
    default:
      return 'unsupported';
  }
}
