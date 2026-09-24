/**
 * Knowledge base: canonical questions -> your answers.
 *
 * Every application asks the same twenty questions in slightly different words
 * ("Will you now or in the future require sponsorship?", "Do you need visa
 * sponsorship?"). Each canonical question has a key, a default answer, regex
 * patterns that recognise common phrasings, and a list of learned aliases
 * (exact label texts that were mapped to it by the model or by you).
 */

export type KBKind = 'yesno' | 'agree' | 'choice' | 'text';

export interface KBEntry {
  key: string;
  /** Human-readable canonical question shown in the options page. */
  question: string;
  /**
   * Answer to fill. Empty means "not set yet" and the extension will ask you.
   * May contain {{tokens}} (see renderTemplate) and `|`-separated fallbacks
   * for dropdowns, e.g. "LinkedIn | Job board | Other".
   */
  answer: string;
  kind: KBKind;
  /** Regex sources tested against the normalised label. */
  patterns: string[];
  /** Normalised labels learned at runtime that map to this entry. */
  aliases: string[];
  /** Ship-with-extension entries. Kept so user edits can be merged with updates. */
  builtin?: boolean;
  /** Never fill and never ask. Useful for essay questions you want to write yourself. */
  skip?: boolean;
}

type Seed = Omit<KBEntry, 'aliases' | 'builtin'> & { aliases?: string[] };

const seed = (e: Seed): KBEntry => ({ aliases: [], ...e, builtin: true });

export const BUILTIN_KB: KBEntry[] = [
  seed({
    key: 'how_heard',
    question: 'How did you hear about this job?',
    answer: 'LinkedIn | Job board | Social media | Online | Other',
    kind: 'choice',
    patterns: [
      'how did you (hear|learn|find out|find|come to know) about',
      'how were you referred',
      'where did you (hear|find|see|learn)',
      'source of (application|referral|hire)',
      '^(application |referral |lead )?source$',
      'what prompted you to apply',
    ],
  }),
  seed({
    key: 'requires_sponsorship',
    question: 'Will you now or in the future require sponsorship for an employment visa?',
    answer: '',
    kind: 'yesno',
    patterns: ['sponsor', 'visa', 'h-?1b', 'opt\\b', 'cpt\\b', 'immigration (support|assistance)'],
  }),
  seed({
    key: 'authorized_to_work',
    question: 'Are you legally authorized to work in the country of the job?',
    answer: 'Yes',
    kind: 'yesno',
    patterns: [
      'authori[sz]ed to work',
      'eligible to work',
      'work authori[sz]ation',
      'right to work',
      'legally (permitted|allowed|able) to work',
      'legal(ly)? (eligib|authori)',
      'employment eligibility',
    ],
  }),
  seed({
    key: 'work_authorization_type',
    question: 'What is your work authorization / visa status?',
    answer: '',
    kind: 'choice',
    patterns: ['(work )?authori[sz]ation (type|status|category)', 'visa (type|status|category)', 'immigration status', 'citizenship status'],
  }),
  seed({
    key: 'us_citizen',
    question: 'Are you a U.S. citizen?',
    answer: '',
    kind: 'yesno',
    patterns: ['(u\\.?s\\.?|united states|american) citizen', 'citizen of the (u\\.?s|united states)', '^citizenship$'],
  }),
  seed({
    key: 'us_person_export_control',
    question: 'Are you a U.S. person under export control rules (citizen, permanent resident, asylee, refugee)?',
    answer: '',
    kind: 'yesno',
    patterns: ['export control', '\\bitar\\b', '\\bear\\b', 'u\\.?s\\.? person'],
  }),
  seed({
    key: 'related_to_government_official',
    question: 'Are you or a family member a current or former government official?',
    answer: 'No',
    kind: 'yesno',
    patterns: [
      'government official',
      'public official',
      'politically exposed',
      'foreign official',
      'political party official',
      '(official|employee) of (a|any) (foreign )?government',
      'family member.*(government|public|state) (official|employee)',
      '(government|public) (official|employee).*(family|relative|related)',
    ],
  }),
  seed({
    key: 'government_employment',
    question: 'Have you been employed by a government entity recently?',
    answer: 'No',
    kind: 'yesno',
    patterns: ['(employed|worked) (by|for|with) (a |the |any )?(government|federal|state|public sector)', '(government|federal) (employee|employment)'],
  }),
  seed({
    key: 'related_to_employee',
    question: 'Are you related to anyone who works at this company?',
    answer: 'No',
    kind: 'yesno',
    patterns: [
      '(relative|family member|spouse|immediate family|friend|relation).*(employ|work|company)',
      'related to (any(one)?|an? (current |existing )?(employee|member|director|officer))',
      'know anyone (who works|employed|at)',
      'relationship with (any|an|a) (current )?(employee|member)',
      'family.*(employ|work) (here|at|for)',
    ],
  }),
  seed({
    key: 'previously_employed_here',
    question: 'Have you previously worked for this company?',
    answer: 'No',
    kind: 'yesno',
    patterns: [
      '(previously|ever|formerly|before) (been )?(employed|worked|a contractor|an intern)',
      'former (employee|intern|contractor)',
      'worked (here|for us|with us|at .* before)',
      'prior (employment|work) (with|at|for)',
      'current or former (employee|intern)',
      'currently or previously (employed|worked)',
      'current(ly)? (an )?(employee|intern|contractor) (of|at|with)',
      '^have you (ever )?worked (for|at|with)',
    ],
  }),
  seed({
    key: 'previously_applied',
    question: 'Have you previously applied to this company?',
    answer: 'No',
    kind: 'yesno',
    patterns: ['previously applied', 'applied (here |to .* )?(before|previously|in the past)', 'prior application', 'applied .* in the (past|last)'],
  }),
  seed({
    key: 'previously_interviewed',
    question: 'Have you previously interviewed with this company?',
    answer: 'No',
    kind: 'yesno',
    patterns: ['(previously|ever|before) interviewed', 'interviewed (here|with us|with .* before)'],
  }),
  seed({
    key: 'over_18',
    question: 'Are you at least 18 years old?',
    answer: 'Yes',
    kind: 'yesno',
    patterns: ['(at least|over|above|older than) (18|eighteen)', '18 (years )?(of age|or older|\\+)', 'legal (working )?age', 'minimum age', 'age requirement'],
  }),
  seed({
    key: 'acknowledge_ai_use',
    question: 'Do you acknowledge that AI tools may be used in the hiring process?',
    answer: 'Yes',
    kind: 'agree',
    patterns: [
      '(ai|artificial intelligence|automated|machine learning|algorithm).*(tool|technolog|system|process|assist|interview|hiring|recruit|screen|evaluat)',
      '(hiring|interview|recruit|screen|application).*(ai\\b|artificial intelligence|automated)',
      '\\bai\\b.*(policy|disclosure|statement|usage|use)',
      '(policy|disclosure|statement).*\\bai\\b',
      'use of (ai|artificial intelligence|generative)',
    ],
  }),
  seed({
    key: 'signature',
    question: 'Typed signature (your full name)',
    answer: '{{fullName}}',
    kind: 'text',
    patterns: ['^(e-?|electronic |digital )?signature$', 'signature.*(full )?name', 'type your (full |legal )?name', 'full name.*signature', 'sign(ed)? (by|here)'],
  }),
  seed({
    key: 'today_date',
    question: "Today's date",
    answer: '{{today}}',
    kind: 'text',
    patterns: ["^(today'?s |current )?date$", 'date (signed|of signature|of application|submitted)', 'signature date'],
  }),
  seed({
    key: 'consent_sms',
    question: 'Do you consent to receive text messages / SMS?',
    answer: 'Yes',
    kind: 'agree',
    patterns: ['(text message|sms|texting).*(consent|agree|opt|receive|contact)', '(consent|agree|opt|receive|contact).*(text message|sms|texting)'],
  }),
  seed({
    key: 'consent_contact',
    question: 'Can we contact you about future opportunities / keep your data on file?',
    answer: 'Yes',
    kind: 'agree',
    patterns: [
      '(consent|agree|permission|allow|ok|okay).*(contact|communicat|reach out|email you)',
      'keep (my |your )?(data|information|resume|cv|application|profile) on file',
      'talent (community|network|pool|database)',
      'future (opportunit|position|role|opening|job)',
      'retain (my|your) (data|information|application)',
    ],
  }),
  seed({
    key: 'job_alerts',
    question: 'Subscribe to job alerts / marketing emails?',
    answer: 'No',
    kind: 'agree',
    patterns: ['job alert', 'subscribe', 'newsletter', 'marketing (email|communic|message)', 'promotional'],
  }),
  seed({
    key: 'agree_terms',
    question: 'Do you agree to the terms / privacy policy / certify your answers are accurate?',
    answer: 'Yes',
    kind: 'agree',
    patterns: [
      '(agree|accept|acknowledge|consent|certify|confirm|attest|understand|read|declare).*(terms|privacy|policy|policies|conditions|statement|notice|accurate|true|correct|complete|truthful|signature|agreement|rules|guidelines|process|above|following)',
      'by (checking|submitting|clicking|signing)',
      'e-?signature',
      'i (hereby )?(certify|declare|confirm|acknowledge|agree|understand|accept)',
      'privacy (policy|notice|statement)',
      'terms (of|and) (service|use|conditions)',
      'data (processing|protection|retention)',
      'gdpr',
      'arbitrat',
      '^agreement to',
    ],
  }),
  seed({
    key: 'background_check_consent',
    question: 'Do you consent to a background check / drug screening?',
    answer: 'Yes',
    kind: 'agree',
    patterns: [
      '(consent|agree|willing|authori[sz]e|submit|able|comply).*(background|drug|screen|reference check)',
      '(background|drug|screen|reference check).*(consent|agree|willing|authori[sz]e|comply)',
      'drug (test|screen)',
    ],
  }),
  seed({
    key: 'criminal_history',
    question: 'Have you ever been convicted of a crime?',
    answer: 'No',
    kind: 'yesno',
    patterns: ['convicted', 'felony', 'misdemeanor', 'criminal (record|history|offen|conviction|charge)', 'pled (guilty|no contest)', 'pending (criminal )?charges'],
  }),
  seed({
    key: 'ok_to_contact_employer',
    question: 'May we contact your current / previous employer?',
    answer: 'Yes',
    kind: 'yesno',
    patterns: ['contact (your |my )?(current|previous|former|present) employer'],
  }),
  seed({
    key: 'security_clearance',
    question: 'Do you hold an active security clearance?',
    answer: 'No',
    kind: 'yesno',
    patterns: ['security clearance', 'clearance (level|status)', 'hold a clearance'],
  }),
  seed({
    key: 'non_compete',
    question: 'Are you bound by a non-compete or similar agreement?',
    answer: 'No',
    kind: 'yesno',
    patterns: ['non-?compete', 'non-?solicit', 'restrictive covenant', 'contractual (obligation|agreement|restriction)', 'bound by (any|an) agreement', 'confidentiality agreement.*(prevent|restrict)'],
  }),
  seed({
    key: 'disability_accommodation',
    question: 'Do you need an accommodation for the application or interview process?',
    answer: 'No',
    kind: 'yesno',
    patterns: ['accommodat'],
  }),
  seed({
    key: 'work_from_address',
    question: 'Address / location you plan to work from',
    answer: '{{address}}',
    kind: 'text',
    patterns: ['address (from which|where) you (plan|intend|will|would|expect)', 'work(ing)? (from|at) (address|location)', 'where (do|will|would) you (be )?work(ing)? from'],
  }),
  seed({
    key: 'willing_to_relocate',
    question: 'Are you willing to relocate?',
    answer: 'Yes',
    kind: 'yesno',
    patterns: ['relocat'],
  }),
  seed({
    key: 'willing_to_travel',
    question: 'Are you willing to travel?',
    answer: 'Yes',
    kind: 'yesno',
    patterns: ['willing (and able )?to travel', 'travel (requirement|percentage|up to)', 'able to travel'],
  }),
  seed({
    key: 'work_in_office_ok',
    question: 'Are you able to work from the office location listed?',
    answer: 'Yes',
    kind: 'yesno',
    patterns: [
      '(able|willing|open) to (work|commute|report|be|come)(ing)? (from|to|in|at|in-?person)',
      'in-?person.*(office|day|time|week)',
      '(office|on-?site).*(\\d+ ?%|percent|days? (a|per) week|of the time)',
      'commute',
    ],
  }),
  seed({
    key: 'remote_preference',
    question: 'Work location preference (remote / hybrid / on-site)?',
    answer: '',
    kind: 'choice',
    patterns: ['remote', 'hybrid', 'on-?site', 'in-?office', 'in-?person', 'work (location|arrangement|setting) preference'],
  }),
  seed({
    key: 'available_start_date',
    question: 'When can you start?',
    answer: '',
    kind: 'text',
    patterns: [
      '(earliest|available|expected|desired|preferred|anticipated|possible|target|soonest).*(start|availab|begin|join)',
      'when (can|could|are|would|will|is the earliest) you.*(start|begin|be available|join)',
      'availability (date|to start)',
      'date (you are )?available',
      'start date availability',
      '^availability$',
    ],
  }),
  seed({
    key: 'expected_salary',
    question: 'Expected salary / compensation?',
    answer: '',
    kind: 'text',
    patterns: [
      '(salary|compensation|pay|wage|rate|hourly).*(expect|desir|requir|target|range|goal)',
      '(expect|desir|requir|target|minimum).*(salary|compensation|pay|wage|rate)',
      '^(salary|compensation)$',
    ],
  }),
  seed({
    key: 'notice_period',
    question: 'What is your notice period?',
    answer: '2 weeks',
    kind: 'text',
    patterns: ['notice period', 'how much notice'],
  }),
  seed({
    key: 'currently_employed',
    question: 'Are you currently employed?',
    answer: '',
    kind: 'yesno',
    patterns: ['^are you currently (employed|working)\\??$', 'currently employed\\??$', 'employment status'],
  }),
  seed({
    key: 'current_student',
    question: 'Are you currently a student / enrolled in a degree program?',
    answer: '',
    kind: 'yesno',
    patterns: ['currently (a |an )?(enrolled|attending|student|pursuing)', 'are you a (current |full-?time )?student', 'enrolled in (a |an )?(degree|program|university|college|school)', 'student status'],
  }),
  seed({
    key: 'languages_spoken',
    question: 'Languages you speak',
    answer: 'English',
    kind: 'text',
    patterns: ['languages? (spoken|you speak|proficien|fluen|known)', 'fluent in', 'speak (any|other) language'],
  }),
  seed({
    key: 'country_of_residence',
    question: 'Which country do you currently live in?',
    answer: '{{country}}',
    kind: 'choice',
    patterns: ['country (of residence|do you (currently )?(live|reside)|are you (currently )?(in|located|based))', '(currently )?(live|located|residing|reside|based) in (which|what)'],
  }),
  seed({
    key: 'current_location',
    question: 'Where are you currently located?',
    answer: '{{location}}',
    kind: 'text',
    patterns: ['^(current |your )?location$', 'where are you (currently )?(located|based|living)', 'current (city|location|residence)', 'city (and|,) state'],
  }),
  seed({
    key: 'referral',
    question: 'Were you referred by an employee? (left blank unless you set it)',
    answer: '',
    kind: 'text',
    patterns: ['referr(ed|al)', 'who referred you', 'referee name', 'employee name.*refer'],
    skip: true,
  }),
  seed({
    key: 'free_text_essay',
    question: 'Essay / cover letter style questions (left for you to write)',
    answer: '',
    kind: 'text',
    patterns: [
      'cover letter',
      'why (do you want|are you interested|us|this role|this company|should we)',
      'tell us (about|why|more)',
      'additional (information|comments|details|notes)',
      'anything else',
      'message to (the )?(hiring|recruiter)',
      'describe (a time|your experience|yourself)',
      'what (interests|excites|motivates) you',
      'summary of qualifications',
    ],
    skip: true,
  }),
];

/** Lower-case, strip punctuation and "required" markers, collapse whitespace. */
export function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/\((required|optional|mandatory)\)/g, ' ')
    .replace(/\b(required|optional|mandatory)\b\s*$/g, ' ')
    .replace(/[*:‡†]+/g, ' ')
    .replace(/[“”"']/g, '')
    .replace(/[^a-z0-9?.,/()+\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const regexCache = new Map<string, RegExp>();
function re(src: string): RegExp {
  let r = regexCache.get(src);
  if (!r) {
    try {
      r = new RegExp(src, 'i');
    } catch {
      r = /(?!)/;
    }
    regexCache.set(src, r);
  }
  return r;
}

export interface KBMatch {
  entry: KBEntry;
  /** alias = an exact phrasing learned earlier; pattern = one of the built-in regexes. */
  via: 'alias' | 'pattern';
}

/** Find the knowledge-base entry for a label: learned aliases first, then patterns in order. */
export function findKBMatch(label: string, kb: KBEntry[]): KBMatch | null {
  const norm = normalizeLabel(label);
  if (!norm) return null;
  for (const e of kb) {
    if (e.aliases.some((a) => a === norm)) return { entry: e, via: 'alias' };
  }
  for (const e of kb) {
    if (e.patterns.some((p) => re(p).test(norm))) return { entry: e, via: 'pattern' };
  }
  return null;
}

export function findKBEntry(label: string, kb: KBEntry[]): KBEntry | null {
  return findKBMatch(label, kb)?.entry ?? null;
}

/** Merge stored entries over the builtin list, keeping user answers/aliases and user-added keys. */
export function mergeKB(stored: KBEntry[] | undefined): KBEntry[] {
  if (!stored?.length) return BUILTIN_KB.map((e) => ({ ...e, aliases: [...e.aliases], patterns: [...e.patterns] }));
  const byKey = new Map(stored.map((e) => [e.key, e]));
  const merged: KBEntry[] = BUILTIN_KB.map((b) => {
    const s = byKey.get(b.key);
    if (!s) return { ...b, aliases: [...b.aliases], patterns: [...b.patterns] };
    byKey.delete(b.key);
    return {
      ...b,
      ...s,
      builtin: true,
      // keep builtin patterns up to date but preserve any the user added
      patterns: Array.from(new Set([...(b.patterns ?? []), ...(s.patterns ?? [])])),
      aliases: Array.from(new Set(s.aliases ?? [])),
    };
  });
  for (const extra of byKey.values()) merged.push({ ...extra, aliases: extra.aliases ?? [], patterns: extra.patterns ?? [] });
  return merged;
}

export interface LearnInput {
  key: string;
  label: string;
  answer?: string;
  question?: string;
  kind?: KBKind;
}

/** Record that `label` maps to `key`, creating the entry when needed. Returns a new array. */
export function learn(kb: KBEntry[], input: LearnInput): KBEntry[] {
  const norm = normalizeLabel(input.label);
  const key = toKey(input.key);
  const next = kb.map((e) => ({ ...e, aliases: [...e.aliases] }));
  let entry = next.find((e) => e.key === key);
  if (!entry) {
    entry = {
      key,
      question: input.question || input.label,
      answer: input.answer ?? '',
      kind: input.kind ?? 'text',
      patterns: [],
      aliases: [],
    };
    next.push(entry);
  } else {
    if (input.answer !== undefined && input.answer !== '') entry.answer = input.answer;
    if (input.question && !entry.builtin) entry.question = input.question;
    if (input.kind && !entry.builtin) entry.kind = input.kind;
  }
  if (norm && !entry.aliases.includes(norm)) entry.aliases.push(norm);
  return next;
}

export function toKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'question';
}
