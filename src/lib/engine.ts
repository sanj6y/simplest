/**
 * The orchestrator that runs inside the page: scan -> rules -> knowledge base -> model -> ask.
 */
import { browser } from 'wxt/browser';
import { pickAdapter, findButton, Adapter } from './adapters';
import { fillField, fillFile, FillOutcome } from './fill';
import { KBEntry, findKBMatch, learn } from './kb';
import type { ClassifyRequest, ClassifyResponse, FieldSummary, FillReport, LLMAnswer } from './messages';
import { Profile, profileSummary, renderTemplate } from './profile';
import { createRuleEngine, FILE_COVER, FILE_RESUME, SKIP } from './rules';
import { Field, scanFields } from './scan';
import { getCoverLetter, getKB, getProfile, getResume, getSettings, saveKB, StoredFile } from './storage';

export interface PendingQuestion {
  field: Field;
  key: string;
  question: string;
  kind: KBEntry['kind'];
  options: string[];
}

export interface EngineResult {
  report: FillReport;
  pending: PendingQuestion[];
  adapter: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function summarize(f: Field): FieldSummary {
  return {
    id: f.id,
    label: f.label,
    kind: f.kind,
    options: f.options.map((o) => o.text).filter(Boolean).slice(0, 60),
    section: f.section,
    required: f.required,
  };
}

async function ensureRows(adapter: Adapter, matcher: string | RegExp | undefined, countFields: () => number, wanted: number) {
  if (!matcher || wanted <= 0) return;
  for (let i = 0; i < 6 && countFields() < wanted; i++) {
    const btn = findButton(matcher);
    if (!btn) return;
    btn.click();
    await sleep(250);
  }
}

const isEmptyOutcome = (o: FillOutcome) => o === 'empty' || o === 'no-option' || o === 'unsupported' || o === 'error';

export async function runFill(opts: { onProgress?: (msg: string) => void } = {}): Promise<EngineResult> {
  const progress = opts.onProgress ?? (() => {});
  const [profile, kb0, settings, resume, cover] = await Promise.all([getProfile(), getKB(), getSettings(), getResume(), getCoverLetter()]);
  let kb = kb0;
  const adapter = pickAdapter();
  const report: FillReport = { filled: 0, skipped: 0, unresolved: 0, asked: 0, errors: [], usedModel: false, details: [] };
  const pending: PendingQuestion[] = [];
  const ctx = { overwrite: settings.overwriteExisting, menuDelay: adapter.menuDelay ?? 350 };

  await adapter.prepare?.();

  // Make sure there are enough education / work rows before scanning.
  const countSchools = () => scanFields().filter((f) => /school|universit|college|institution/i.test(`${f.label} ${f.hints}`) && f.kind !== 'radio' && f.kind !== 'checkbox').length;
  const countCompanies = () => scanFields().filter((f) => /company|employer|organi[sz]ation/i.test(`${f.label} ${f.hints}`) && (f.kind === 'text' || f.kind === 'combobox')).length;
  if (profile.education.length > 1 && countSchools() >= 1) await ensureRows(adapter, adapter.addEducation, countSchools, profile.education.length);
  if (profile.work.length > 1 && countCompanies() >= 1) await ensureRows(adapter, adapter.addWork, countCompanies, profile.work.length);

  const fields = scanFields();
  progress(`Found ${fields.length} fields`);
  const rules = createRuleEngine(profile);
  const unresolved: Field[] = [];

  const record = (f: Field, outcome: FillOutcome | 'skip' | 'pending', source: string) => {
    report.details.push({ label: f.label || f.hints, outcome, source });
    if (outcome === 'filled') report.filled++;
    else if (outcome === 'pending') report.asked++;
    else if (outcome === 'skip' || outcome === 'already') report.skipped++;
    else report.unresolved++;
  };

  const applyFile = async (f: Field, file: StoredFile | null, what: string) => {
    if (!file) {
      record(f, 'empty', `${what} not uploaded in Simplest`);
      return;
    }
    if (f.currentValue && !settings.overwriteExisting) {
      record(f, 'already', what);
      return;
    }
    record(f, fillFile(f, file), what);
  };

  for (const f of fields) {
    try {
      // Tier 1: profile rules
      const m = rules.match(f);
      if (m) {
        if (m.value === SKIP) {
          record(f, 'skip', `rule:${m.rule}`);
          continue;
        }
        if (m.value === FILE_RESUME) {
          await applyFile(f, resume, 'resume');
          continue;
        }
        if (m.value === FILE_COVER) {
          await applyFile(f, cover, 'cover letter');
          continue;
        }
        if (!m.value) {
          // Profile field empty: nothing to fill. Do not bother the model.
          record(f, 'empty', `rule:${m.rule} (profile empty)`);
          continue;
        }
        const outcome = await fillField(f, m.value, ctx);
        if (outcome === 'no-option' && (f.kind === 'select' || f.kind === 'combobox' || f.kind === 'radio' || f.kind === 'buttons')) {
          // Options did not match the profile text; let the model pick from the list.
          unresolved.push(f);
          continue;
        }
        record(f, outcome, `rule:${m.rule}`);
        continue;
      }
      if (f.kind === 'file') {
        record(f, 'skip', 'unknown file input');
        continue;
      }

      // Tier 2: knowledge base
      const kbMatch = findKBMatch(f.label, kb);
      // A yes/no or agreement entry matched by pattern on a free-text field is probably a false positive
      // ("address from which you plan on working" matching the relocation entry). Let the model decide.
      const kindMismatch = kbMatch?.via === 'pattern' && (kbMatch.entry.kind === 'yesno' || kbMatch.entry.kind === 'agree') && (f.kind === 'text' || f.kind === 'textarea');
      const entry = kbMatch && !kindMismatch ? kbMatch.entry : null;
      if (entry) {
        if (entry.skip) {
          record(f, 'skip', `kb:${entry.key} (marked skip)`);
          continue;
        }
        if (!entry.answer) {
          pending.push({ field: f, key: entry.key, question: entry.question, kind: entry.kind, options: f.options.map((o) => o.text) });
          record(f, 'pending', `kb:${entry.key} (no answer yet)`);
          continue;
        }
        const answer = renderTemplate(entry.answer, profile);
        const outcome = await fillField(f, answer, ctx);
        if (outcome === 'no-option') {
          unresolved.push(f);
          continue;
        }
        record(f, outcome, `kb:${entry.key}`);
        continue;
      }
      unresolved.push(f);
    } catch (e) {
      report.errors.push(`${f.label}: ${(e as Error).message}`);
      record(f, 'error', 'exception');
    }
  }

  // Tier 3: the model, one batched call for everything left.
  const askable = unresolved.filter((f) => f.kind !== 'file');
  if (askable.length && settings.useModel && settings.apiKey) {
    progress(`Asking the model about ${askable.length} question${askable.length === 1 ? '' : 's'}…`);
    report.usedModel = true;
    const req: ClassifyRequest = {
      type: 'classify',
      fields: askable.map(summarize),
      kb: kb.map(({ key, question, answer, kind, skip }) => ({ key, question, answer, kind, skip })),
      profileSummary: profileSummary(profile),
      pageTitle: document.title,
    };
    let res: ClassifyResponse;
    try {
      res = (await browser.runtime.sendMessage(req)) as ClassifyResponse;
    } catch (e) {
      res = { ok: false, error: (e as Error).message };
    }
    if (!res.ok) {
      report.errors.push(`Model: ${res.error}`);
      for (const f of askable) {
        pending.push({ field: f, key: '', question: f.label, kind: 'text', options: f.options.map((o) => o.text) });
        record(f, 'pending', 'model unavailable');
      }
    } else {
      const byId = new Map(res.answers.map((a) => [a.fieldId, a]));
      for (const f of askable) {
        const a: LLMAnswer | undefined = byId.get(f.id);
        if (!a) {
          pending.push({ field: f, key: '', question: f.label, kind: 'text', options: f.options.map((o) => o.text) });
          record(f, 'pending', 'model gave no answer');
          continue;
        }
        const existing = kb.find((e) => e.key === a.key);
        if (existing?.skip) {
          kb = learn(kb, { key: a.key, label: f.label });
          record(f, 'skip', `model→kb:${a.key} (marked skip)`);
          continue;
        }
        if (a.needsUser || a.confidence === 'low' || !a.answer) {
          kb = learn(kb, { key: a.key || f.label, label: f.label, question: a.question || f.label, kind: a.kind });
          pending.push({ field: f, key: a.key || f.label, question: a.question || f.label, kind: a.kind, options: f.options.map((o) => o.text) });
          record(f, 'pending', `model→kb:${a.key} (needs you)`);
          continue;
        }
        const outcome = await fillField(f, a.answer, ctx);
        if (isEmptyOutcome(outcome)) {
          pending.push({ field: f, key: a.key, question: a.question || f.label, kind: a.kind, options: f.options.map((o) => o.text) });
          record(f, 'pending', `model→kb:${a.key} (${outcome})`);
          continue;
        }
        // Learn: remember this label -> key, and the answer if the entry had none.
        kb = learn(kb, { key: a.key, label: f.label, answer: existing?.answer ? undefined : a.answer, question: a.question, kind: a.kind });
        record(f, outcome, `model→kb:${a.key}`);
      }
    }
  } else {
    for (const f of askable) {
      pending.push({ field: f, key: '', question: f.label, kind: 'text', options: f.options.map((o) => o.text) });
      record(f, 'pending', settings.apiKey ? 'model disabled' : 'no API key');
    }
  }

  await saveKB(kb);
  return { report, pending, adapter: adapter.name };
}

/** Save the user's answers from the ask panel and fill the fields. */
export async function answerPending(items: { q: PendingQuestion; answer: string; remember: boolean }[]): Promise<number> {
  const profile = await getProfile();
  let kb = await getKB();
  const adapter = pickAdapter();
  const ctx = { overwrite: true, menuDelay: adapter.menuDelay ?? 350 };
  let filled = 0;
  for (const { q, answer, remember } of items) {
    if (!answer) continue;
    const outcome = await fillField(q.field, renderTemplate(answer, profile), ctx);
    if (outcome === 'filled' || outcome === 'already') filled++;
    if (remember) {
      const kind = q.kind ?? (q.field.kind === 'checkbox' ? 'agree' : q.options.length ? 'choice' : 'text');
      kb = learn(kb, { key: q.key || q.question, label: q.field.label, answer, question: q.question, kind });
    }
  }
  await saveKB(kb);
  return filled;
}
