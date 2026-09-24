/**
 * Turn the page's form controls into a flat list of Fields with the best label we can find.
 */
import { FieldOption, isPlaceholderOption } from './options';

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'month'
  | 'select'
  | 'combobox'
  | 'checkbox'
  | 'checkbox-group'
  | 'radio'
  | 'buttons'
  | 'file';

export interface Field {
  id: string;
  el: HTMLElement;
  kind: FieldKind;
  /** Best visible label / question text. */
  label: string;
  /** name, id, placeholder, autocomplete, aria attributes; lower-cased, space separated. */
  hints: string;
  /** Nearest heading / legend text above the field. */
  section: string;
  options: FieldOption[];
  required: boolean;
  currentValue: string;
  /** All inputs for radio / checkbox groups. */
  members?: HTMLInputElement[];
  /** Toggle buttons for a 'buttons' field (Ashby-style Yes / No widgets, segmented controls). */
  buttons?: HTMLElement[];
  /** Explicit row index parsed from name/id such as education[1][school] or work_start_date_2. */
  rowIndex?: number;
}

export function cssEscape(s: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(s);
  return s.replace(/["\\\]\[]/g, '\\$&');
}

const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'search', 'password', 'range', 'color']);

export function textOf(el: Element | null | undefined): string {
  if (!el) return '';
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('input, select, textarea, button, script, style, svg').forEach((n) => n.remove());
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function cleanLabel(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/\s*\*\s*$/g, '')
    .replace(/^\*\s*/g, '')
    .replace(/\((required|optional)\)/gi, '')
    .replace(/\brequired\b\s*$/i, '')
    .trim();
}

function isVisible(el: HTMLElement): boolean {
  if (el.closest('[hidden], [aria-hidden="true"]') && !el.matches('input[type=file], input[type=checkbox], input[type=radio]')) return false;
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') {
    // Custom checkboxes / file inputs are often hidden on purpose but still functional.
    return el.matches('input[type=file], input[type=checkbox], input[type=radio]');
  }
  if (el.matches('input[type=file], input[type=checkbox], input[type=radio]')) return true;
  const rects = el.getClientRects();
  return rects.length > 0 && (rects[0].width > 0 || rects[0].height > 0);
}

function labelFromFor(el: HTMLElement): string {
  for (const key of [el.id, el.getAttribute('name')]) {
    if (!key) continue;
    try {
      const lab = el.ownerDocument.querySelector<HTMLLabelElement>(`label[for="${cssEscape(key)}"]`);
      const t = textOf(lab);
      if (t) return t;
    } catch {
      /* ignore */
    }
  }
  return '';
}

function labelFromAria(el: HTMLElement): string {
  const by = el.getAttribute('aria-labelledby');
  if (by) {
    const txt = by
      .split(/\s+/)
      .map((id) => textOf(el.ownerDocument.getElementById(id)))
      .filter(Boolean)
      .join(' ');
    if (txt) return txt;
  }
  const described = el.getAttribute('aria-describedby');
  const label = el.getAttribute('aria-label') ?? '';
  if (label && described) {
    const d = described
      .split(/\s+/)
      .map((id) => textOf(el.ownerDocument.getElementById(id)))
      .filter(Boolean)
      .join(' ');
    if (d && d.length < 400 && !d.includes(label)) return `${label} ${d}`;
  }
  return label;
}

const LABELISH = 'label, legend, [class*="label" i], [class*="question" i], [class*="title" i], [class*="heading" i], [class*="prompt" i], [class*="text" i], h1, h2, h3, h4, h5, h6, p, span, div, strong, b';

/** Look for label-like text in preceding siblings while walking up a few ancestors. */
function labelFromNeighbors(el: HTMLElement): string {
  let node: HTMLElement | null = el;
  for (let depth = 0; depth < 6 && node; depth++) {
    // Previous siblings of this node, closest first.
    let sib = node.previousElementSibling as HTMLElement | null;
    let hops = 0;
    while (sib && hops < 4) {
      if (!sib.querySelector('input, select, textarea, [role=combobox]')) {
        const t = sib.matches(LABELISH) ? textOf(sib) : textOf(sib.querySelector(LABELISH));
        const clean = t || textOf(sib);
        if (clean && clean.length <= 400) return clean;
      } else {
        break; // reached another field
      }
      sib = sib.previousElementSibling as HTMLElement | null;
      hops++;
    }
    // A label-ish element that is the first child of the ancestor (common React layout).
    const parent: HTMLElement | null = node.parentElement;
    if (parent && depth > 0) {
      const first = parent.firstElementChild as HTMLElement | null;
      if (first && first !== node && !first.contains(el) && !first.querySelector('input, select, textarea, [role=combobox]')) {
        const t = first.matches(LABELISH) ? textOf(first) : '';
        if (t && t.length <= 400) return t;
      }
    }
    node = parent;
    if (node && (node.tagName === 'FORM' || node.tagName === 'BODY')) break;
  }
  return '';
}

function humanize(s: string): string {
  return s
    .replace(/\[(\w+)\]/g, ' $1')
    .replace(/[_\-.]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getLabel(el: HTMLElement): string {
  const tries = [
    () => labelFromAria(el),
    () => labelFromFor(el),
    () => {
      const wrap = el.closest('label');
      return wrap ? textOf(wrap) : '';
    },
    () => labelFromNeighbors(el),
    () => el.getAttribute('placeholder') ?? '',
    () => humanize(el.getAttribute('name') ?? el.id ?? ''),
  ];
  for (const t of tries) {
    const v = cleanLabel(t());
    if (v) return v;
  }
  return '';
}

export function getSection(el: HTMLElement): string {
  let node: HTMLElement | null = el.parentElement;
  for (let depth = 0; depth < 10 && node; depth++) {
    if (node.tagName === 'FIELDSET') {
      const legend = node.querySelector(':scope > legend');
      if (legend) return textOf(legend);
    }
    let sib = node.previousElementSibling as HTMLElement | null;
    let hops = 0;
    while (sib && hops < 8) {
      if (sib.matches('h1,h2,h3,h4,h5,h6,legend,[role=heading]')) return textOf(sib);
      // A heading nested inside a sibling that has its own inputs belongs to that sibling's section.
      if (!sib.querySelector('input, select, textarea, [role=combobox]')) {
        const h = sib.querySelector('h1,h2,h3,h4,h5,h6,legend,[role=heading]');
        if (h) return textOf(h);
      }
      sib = sib.previousElementSibling as HTMLElement | null;
      hops++;
    }
    const heading = node.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > [role=heading]');
    if (heading && !heading.contains(el)) return textOf(heading);
    const attrHint = `${node.id} ${node.className && typeof node.className === 'string' ? node.className : ''} ${node.getAttribute('data-testid') ?? ''}`.toLowerCase();
    if (/education|school|academic/.test(attrHint)) return 'Education';
    if (/experience|employment|work-?history|job-?history|position/.test(attrHint)) return 'Experience';
    node = node.parentElement;
  }
  return '';
}

function hintsOf(el: HTMLElement): string {
  const raw = [
    el.getAttribute('name'),
    el.id,
    el.getAttribute('placeholder'),
    el.getAttribute('autocomplete'),
    el.getAttribute('data-testid'),
    el.getAttribute('data-qa'),
    el.getAttribute('data-field'),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  // Keep the raw attributes (autocomplete tokens like given-name need their hyphens) and add a
  // word-split copy so `_systemfield_eeoc_gender` still matches \bgender\b.
  const split = raw.replace(/[_\-.[\]]+/g, ' ').replace(/\s+/g, ' ').trim();
  return split && split !== raw ? `${raw} ${split}` : raw;
}

function rowIndexOf(el: HTMLElement): number | undefined {
  const s = `${el.getAttribute('name') ?? ''} ${el.id ?? ''}`;
  const m = s.match(/\[(\d+)\]|[_\-.](\d+)(?:[_\-.\]]|$)|-(\d+)-/);
  if (!m) return undefined;
  const n = Number(m[1] ?? m[2] ?? m[3]);
  return Number.isFinite(n) ? n : undefined;
}

function optionsOfSelect(sel: HTMLSelectElement): FieldOption[] {
  return Array.from(sel.options).map((o) => ({ value: o.value, text: o.textContent?.trim() ?? '' }));
}

function inputLabel(input: HTMLInputElement): string {
  const own = labelFromFor(input) || textOf(input.closest('label')) || labelFromAria(input);
  if (own) return cleanLabel(own);
  const next = input.nextElementSibling;
  if (next && !next.querySelector('input')) return cleanLabel(textOf(next));
  return cleanLabel(humanize(input.value));
}

/** Label for a radio/checkbox *group*: the fieldset legend or nearest question text above the first member. */
/** A label inside `container` that describes the whole group rather than one option. */
function groupLabelInside(container: HTMLElement, members: HTMLInputElement[]): string {
  const memberIds = new Set(members.map((m) => m.id).filter(Boolean));
  const memberLabels = new Set(members.map((m) => m.closest('label')).filter(Boolean));
  const candidates = container.querySelectorAll<HTMLElement>('legend, label, [role=heading], h1, h2, h3, h4, h5, h6, [class*="label" i], [class*="heading" i], [class*="question" i]');
  for (const c of Array.from(candidates)) {
    if (c.querySelector('input')) continue;
    if (memberLabels.has(c as HTMLLabelElement)) continue;
    const forAttr = c.getAttribute('for');
    if (forAttr && memberIds.has(forAttr)) continue;
    const t = textOf(c);
    if (t && t.length <= 400) return t;
  }
  return '';
}

function groupLabel(first: HTMLInputElement, members: HTMLInputElement[] = [first]): string {
  const fs = first.closest('fieldset');
  if (fs) {
    const legend = fs.querySelector(':scope > legend');
    if (legend) return cleanLabel(textOf(legend));
    const inside = groupLabelInside(fs, members);
    if (inside) return cleanLabel(inside);
  }
  const group = first.closest('[role=radiogroup], [role=group]') as HTMLElement | null;
  if (group) {
    const a = labelFromAria(group);
    if (a) return cleanLabel(a);
    const inside = groupLabelInside(group, members);
    if (inside) return cleanLabel(inside);
  }
  // Walk up until the container holds all members, then look inside it and at its neighbors.
  const name = first.name;
  let container: HTMLElement | null = first.parentElement;
  while (container && container.tagName !== 'FORM' && container.tagName !== 'BODY') {
    const found = container.querySelectorAll(`input[name="${cssEscape(name)}"]`);
    if (found.length > 1) break;
    container = container.parentElement;
  }
  if (container) {
    const inside = groupLabelInside(container, members);
    if (inside) return cleanLabel(inside);
    // One more level: the group wrapper is often nested inside a field container that holds the label.
    const wrapper = container.closest('[data-field-path], [class*="field" i], [class*="question" i]') as HTMLElement | null;
    if (wrapper && wrapper !== container) {
      const w = groupLabelInside(wrapper, members);
      if (w) return cleanLabel(w);
    }
    const t = labelFromNeighbors(container);
    if (t) return cleanLabel(t);
  }
  return cleanLabel(humanize(name));
}

let counter = 0;

const TOGGLE_SELECTOR = 'button[aria-pressed], button[data-option], [role="radio"]:not(input), [role="checkbox"]:not(input), button[role="option"]';

/** Groups of toggle buttons that act like a radio group (Ashby Yes/No, segmented controls). */
function scanToggleGroups(root: ParentNode, nextId: () => string): { fields: Field[]; consumed: Set<Element> } {
  const fields: Field[] = [];
  const consumed = new Set<Element>();
  const byParent = new Map<HTMLElement, HTMLElement[]>();
  for (const b of Array.from(root.querySelectorAll<HTMLElement>(TOGGLE_SELECTOR))) {
    if (b.closest('[data-simplest-ui]') || !b.parentElement) continue;
    if (!b.getClientRects().length) continue;
    const list = byParent.get(b.parentElement) ?? [];
    list.push(b);
    byParent.set(b.parentElement, list);
  }
  for (const [parent, buttons] of byParent) {
    if (buttons.length < 2) continue;
    const options: FieldOption[] = buttons.map((b) => ({ value: b.getAttribute('data-option') ?? b.getAttribute('data-value') ?? textOf(b), text: textOf(b) || b.getAttribute('aria-label') || '', el: b }));
    const pressed = buttons.find((b) => b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-checked') === 'true' || b.getAttribute('aria-selected') === 'true');
    const wrapper = (parent.closest('[data-field-path], fieldset, [role=group], [role=radiogroup], [class*="field" i], [class*="question" i]') as HTMLElement | null) ?? parent.parentElement ?? parent;
    const hiddenInput = parent.querySelector<HTMLInputElement>('input[type=checkbox], input[type=radio], input[type=hidden]');
    const label =
      (hiddenInput ? labelFromFor(hiddenInput) : '') ||
      labelFromAria(parent) ||
      groupLabelInside(wrapper, []) ||
      labelFromNeighbors(parent) ||
      '';
    if (!label) continue;
    buttons.forEach((b) => consumed.add(b));
    parent.querySelectorAll('input').forEach((i) => consumed.add(i));
    fields.push({
      id: nextId(),
      el: buttons[0],
      kind: 'buttons',
      label: cleanLabel(label),
      hints: hintsOf(hiddenInput ?? parent),
      section: getSection(parent),
      options,
      required: hiddenInput?.required || wrapper.querySelector('[class*="required" i]') !== null,
      currentValue: pressed ? textOf(pressed) : '',
      buttons,
    });
  }
  return { fields, consumed };
}

export function scanFields(root: ParentNode = document): Field[] {
  const fields: Field[] = [];
  const seenGroups = new Set<string>();
  const toggles = scanToggleGroups(root, () => `f${++counter}`);
  const controls = root.querySelectorAll<HTMLElement>(
    'input, select, textarea, [role="combobox"], button[aria-haspopup="listbox"], [contenteditable="true"]',
  );

  for (const el of Array.from(controls)) {
    if (el.closest('[data-simplest-ui]')) continue;
    if (toggles.consumed.has(el)) continue;
    if ((el as HTMLInputElement).disabled) continue;
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') ?? 'text').toLowerCase();
    if (tag === 'input' && SKIP_TYPES.has(type)) continue;
    if (!isVisible(el)) continue;

    const base = {
      id: `f${++counter}`,
      el,
      hints: hintsOf(el),
      section: getSection(el),
      required: (el as HTMLInputElement).required || el.getAttribute('aria-required') === 'true',
      rowIndex: rowIndexOf(el),
    };

    if (tag === 'input' && (type === 'radio' || type === 'checkbox')) {
      const input = el as HTMLInputElement;
      const name = input.name;
      const form = input.form ?? root;
      const members = name
        ? (Array.from(form.querySelectorAll<HTMLInputElement>(`input[type="${type}"][name="${cssEscape(name)}"]`)))
        : [input];
      if (type === 'radio' || members.length > 1) {
        const key = `${type}:${name}`;
        if (seenGroups.has(key)) continue;
        seenGroups.add(key);
        const options: FieldOption[] = members.map((m) => ({ value: m.value, text: inputLabel(m), el: m }));
        fields.push({
          ...base,
          el: members[0],
          kind: type === 'radio' ? 'radio' : 'checkbox-group',
          label: groupLabel(members[0], members),
          options,
          currentValue: members.filter((m) => m.checked).map((m) => m.value).join(','),
          members,
        });
      } else {
        fields.push({
          ...base,
          kind: 'checkbox',
          label: getLabel(input),
          options: [],
          currentValue: input.checked ? 'checked' : '',
          members: [input],
        });
      }
      continue;
    }

    if (tag === 'select') {
      const sel = el as HTMLSelectElement;
      const options = optionsOfSelect(sel);
      const selected = sel.options[sel.selectedIndex];
      fields.push({
        ...base,
        kind: 'select',
        label: getLabel(sel),
        options,
        currentValue: selected && !isPlaceholderOption(selected.text) ? selected.value : '',
      });
      continue;
    }

    if (tag === 'textarea' || el.getAttribute('contenteditable') === 'true') {
      fields.push({ ...base, kind: 'textarea', label: getLabel(el), options: [], currentValue: (el as HTMLTextAreaElement).value ?? el.textContent ?? '' });
      continue;
    }

    if (tag === 'input' && type === 'file') {
      fields.push({ ...base, kind: 'file', label: getLabel(el) || labelFromNeighbors(el) || 'file', options: [], currentValue: (el as HTMLInputElement).files?.length ? 'has-file' : '' });
      continue;
    }

    const isCombo =
      el.getAttribute('role') === 'combobox' ||
      el.getAttribute('aria-haspopup') === 'listbox' ||
      el.getAttribute('aria-autocomplete') === 'list' ||
      !!el.closest('[class*="select__control"], [class*="select-control"], [class*="react-select"], [class*="autocomplete"], [class*="combobox"]');

    if (isCombo) {
      const value = (el as HTMLInputElement).value || textOf(el.closest('[class*="select__control"], [class*="control"]')?.querySelector('[class*="single-value"], [class*="selected"]')) || (tag === 'button' ? textOf(el) : '');
      fields.push({ ...base, kind: 'combobox', label: getLabel(el), options: [], currentValue: value && !isPlaceholderOption(value) ? value : '' });
      continue;
    }

    if (tag === 'input') {
      const kind: FieldKind = type === 'number' ? 'number' : type === 'date' ? 'date' : type === 'month' ? 'month' : 'text';
      fields.push({ ...base, kind, label: getLabel(el), options: [], currentValue: (el as HTMLInputElement).value });
    }
  }
  fields.push(...toggles.fields);
  fields.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  return fields;
}

/** Cheap heuristic: does this page look like a job application form? */
export function looksLikeApplication(doc: Document = document): boolean {
  const text = (doc.body?.innerText ?? '').toLowerCase().slice(0, 20000);
  const hasFile = !!doc.querySelector('input[type=file]');
  const hits = ['resume', 'first name', 'last name', 'linkedin', 'apply', 'application', 'work authorization', 'sponsorship', 'cover letter'].filter((k) => text.includes(k)).length;
  const inputs = doc.querySelectorAll('input:not([type=hidden]), select, textarea').length;
  return (hasFile && hits >= 2) || (hits >= 4 && inputs >= 5);
}
