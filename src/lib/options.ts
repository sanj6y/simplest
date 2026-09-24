/**
 * Pick the dropdown / radio option that best matches an answer.
 */

export interface FieldOption {
  value: string;
  text: string;
  el?: HTMLElement;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9+#.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const YES = ['yes', 'y', 'true', 'i agree', 'agree', 'i accept', 'accept', 'i confirm', 'confirm', 'i acknowledge', 'acknowledge', 'i do', 'i have', 'i am', 'i consent', 'consent', 'ok', 'okay', 'sure', 'i understand', 'yes i'];
const NO = ['no', 'n', 'false', 'i do not', 'i dont', 'do not', 'dont', 'decline', 'i am not', 'i have not', 'not', 'no i', 'never'];
const DECLINE = ['decline', 'prefer not', 'do not wish', 'dont wish', 'not to answer', 'choose not', 'rather not', 'not specified', 'not disclosed', 'self-identify', 'self identify'];

/** Alternative spellings for common answers. Each key is matched by prefix/inclusion on the normalised answer. */
const SYNONYMS: Array<[RegExp, string[]]> = [
  [/^january$|^jan$|^01$|^1$/, ['january', 'jan', '01', '1']],
  [/^february$|^feb$|^02$|^2$/, ['february', 'feb', '02', '2']],
  [/^march$|^mar$|^03$|^3$/, ['march', 'mar', '03', '3']],
  [/^april$|^apr$|^04$|^4$/, ['april', 'apr', '04', '4']],
  [/^may$|^may$|^05$|^5$/, ['may', 'may', '05', '5']],
  [/^june$|^jun$|^06$|^6$/, ['june', 'jun', '06', '6']],
  [/^july$|^jul$|^07$|^7$/, ['july', 'jul', '07', '7']],
  [/^august$|^aug$|^08$|^8$/, ['august', 'aug', '08', '8']],
  [/^september$|^sep$|^09$|^9$/, ['september', 'sep', '09', '9', 'sept']],
  [/^october$|^oct$|^10$|^10$/, ['october', 'oct', '10', '10']],
  [/^november$|^nov$|^11$|^11$/, ['november', 'nov', '11', '11']],
  [/^december$|^dec$|^12$|^12$/, ['december', 'dec', '12', '12']],
  [/^united states( of america)?$|^usa?$|^u s a?$/, ['united states', 'united states of america', 'usa', 'us', 'u.s.', 'u.s.a.', 'america']],
  [/^united kingdom$|^uk$/, ['united kingdom', 'uk', 'great britain', 'england']],
  [/^linkedin$/, ['linkedin', 'linked in', 'social media', 'social network', 'job board', 'online']],
  [/^indeed$/, ['indeed', 'job board']],
  [/^male$|^man$/, ['male', 'man', 'he/him']],
  [/^female$|^woman$/, ['female', 'woman', 'she/her']],
  [/^non ?binary$/, ['non-binary', 'nonbinary', 'non binary', 'they/them', 'gender non-conforming']],
  [/^asian/, ['asian', 'asian (not hispanic or latino)', 'asian or asian american', 'south asian', 'east asian']],
  [/^white/, ['white', 'white (not hispanic or latino)', 'caucasian', 'european']],
  [/^black|^african/, ['black', 'african american', 'black or african american']],
  [/^hispanic|^latin/, ['hispanic', 'latino', 'hispanic or latino', 'latinx']],
  [/^two or more/, ['two or more races', 'multiracial', 'mixed']],
  [/^native hawaiian|^pacific/, ['native hawaiian', 'pacific islander']],
  [/^american indian|^native american|^alaska/, ['american indian', 'alaska native', 'native american', 'indigenous']],
  [/not (a )?(protected )?veteran|^no$/, ['i am not a protected veteran', 'not a protected veteran', 'i am not a veteran', 'not a veteran', 'no', 'none']],
  [/^(yes, )?i am a (protected )?veteran|^veteran/, ['i identify as one or more of the classifications of a protected veteran', 'protected veteran', 'veteran', 'yes']],
  [/no,? i (do not|dont) (have|want)|^no disability|do not have a disability/, ['no, i do not have a disability', "no, i don't have a disability", 'no disability', 'i do not have a disability', 'no']],
  [/^yes,? i have a disability|^disability/, ['yes, i have a disability', 'yes']],
  [/^bachelor|^b\.?s\.?$|^b\.?a\.?$|^bs\b|^ba\b/, ['bachelor', "bachelor's", 'bachelors', 'bachelor of science', 'bachelor of arts', 'bs', 'ba', 'b.s.', 'b.a.', 'undergraduate', 'baccalaureate']],
  [/^master|^m\.?s\.?$|^m\.?a\.?$|^ms\b|^ma\b|^meng|^mba/, ['master', "master's", 'masters', 'master of science', 'master of arts', 'ms', 'ma', 'm.s.', 'm.a.', 'graduate', 'mba', 'meng']],
  [/^ph\.?d|^doctor/, ['phd', 'ph.d.', 'ph.d', 'doctorate', 'doctoral', 'doctor of philosophy']],
  [/^high school|^secondary/, ['high school', 'secondary', 'high school diploma', 'ged']],
  [/^associate/, ['associate', "associate's", 'associates', 'aa', 'as']],
  [/^mobile|^cell/, ['mobile', 'cell', 'cellular', 'personal']],
  [/^remote/, ['remote', 'fully remote', 'work from home', 'wfh']],
  [/^hybrid/, ['hybrid', 'flexible']],
  [/^on ?site|^in ?office|^in ?person/, ['on-site', 'onsite', 'in-office', 'in office', 'in person', 'in-person', 'office']],
];

function candidatesFor(answer: string): string[] {
  const parts = answer
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    const n = norm(p);
    if (!n) continue;
    out.push(n);
    for (const [test, syns] of SYNONYMS) if (test.test(n)) out.push(...syns.map(norm));
    if (YES.includes(n)) out.push(...YES);
    if (NO.includes(n)) out.push(...NO);
    if (DECLINE.some((d) => n.includes(d))) out.push(...DECLINE);
  }
  return Array.from(new Set(out));
}

const PLACEHOLDER = /^(select|choose|pick|please|--|—|-|none|\.\.\.|\s*)($|\s|\.)|^(select|choose|pick)\b.*(one|option|an? |\.\.\.)/i;

export function isPlaceholderOption(text: string): boolean {
  const t = text.trim();
  return t === '' || PLACEHOLDER.test(t);
}

function score(cand: string, optText: string, optValue: string): number {
  const o = norm(optText);
  const v = norm(optValue);
  if (!o && !v) return 0;
  if (cand === o || cand === v) return 100;
  const oTokens = o.split(' ').filter(Boolean);
  const cTokens = cand.split(' ').filter(Boolean);
  if (o.startsWith(cand + ' ') || o.startsWith(cand + ',') || o.startsWith(cand + ' (')) return 85;
  // "no" must not match "no, i don't" when there is an exact "no" elsewhere; handled by ordering (exact wins).
  if (cTokens.length > 1 && o.includes(cand)) return 70;
  if (cTokens.length === 1 && oTokens.includes(cand) && cand.length > 2) return 60;
  if (oTokens.length > 1 && cand.includes(o) && o.length > 3) return 55;
  if (cTokens.length > 1 && oTokens.length > 1) {
    const overlap = cTokens.filter((t) => oTokens.includes(t) && t.length > 2).length;
    const ratio = overlap / Math.max(cTokens.length, oTokens.length);
    if (ratio >= 0.5) return 40 + ratio * 20;
  }
  return 0;
}

/**
 * Returns the best option for the answer, or null when nothing scores above the threshold.
 * `answer` may contain `|`-separated fallbacks; earlier alternatives win ties.
 */
export function pickOption(answer: string, options: FieldOption[], threshold = 50): FieldOption | null {
  const usable = options.filter((o) => !isPlaceholderOption(o.text));
  if (!usable.length) return null;
  const cands = candidatesFor(answer);
  if (!cands.length) return null;
  let best: { opt: FieldOption; s: number; rank: number } | null = null;
  cands.forEach((cand, rank) => {
    for (const opt of usable) {
      const s = score(cand, opt.text, opt.value);
      if (s <= 0) continue;
      // Prefer earlier candidates when scores are close (within 10)
      if (!best || s > best.s + 10 || (s > best.s && rank <= best.rank)) best = { opt, s, rank };
    }
  });
  return best && (best as { s: number }).s >= threshold ? (best as { opt: FieldOption }).opt : null;
}

/** Interpret an answer as a boolean for checkboxes. */
export function answerToBool(answer: string): boolean | null {
  const n = norm(answer);
  if (!n) return null;
  if (YES.includes(n) || n.startsWith('yes')) return true;
  if (NO.includes(n) || n.startsWith('no')) return false;
  if (n === 'checked' || n === 'check' || n === 'on') return true;
  if (n === 'unchecked' || n === 'uncheck' || n === 'off') return false;
  return null;
}
