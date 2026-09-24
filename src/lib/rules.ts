/**
 * Tier 1: deterministic rules that map a field to a profile value.
 */
import { Profile, fullName } from './profile';
import type { Field, FieldKind } from './scan';

export const SKIP = '__skip__';
export const FILE_RESUME = '__file:resume__';
export const FILE_COVER = '__file:cover__';

export interface RuleMatch {
  rule: string;
  value: string;
}

type Family = 'education' | 'work';

interface Ctx {
  profile: Profile;
  field: Field;
  index: (family: Family, sub: string) => number;
}

interface Rule {
  name: string;
  test: RegExp;
  not?: RegExp;
  /** Only when the hints (name/id/autocomplete) match, not the label. */
  hintsOnly?: boolean;
  kinds?: FieldKind[];
  /** Restrict to a section family (education / work) inferred from the section heading or hints. */
  family?: Family;
  resolve: (c: Ctx) => string | undefined;
}

const TEXTY: FieldKind[] = ['text', 'textarea', 'combobox', 'select', 'number', 'date', 'month'];
const CHOICE: FieldKind[] = ['select', 'combobox', 'radio', 'buttons', 'text'];

const QUESTION = /\?|\bare you\b|\bdo you\b|\bhave you\b|\bwill you\b|\bwould you\b|\bcan you\b|\bplease\b/i;
const eduPat = /educ|school|academic|degree|universit|college/i;
const workPat = /experience|employment|work history|job history|position|employer|career/i;

export function familyOf(field: Field): Family | undefined {
  const s = `${field.section} ${field.hints}`;
  if (eduPat.test(s)) return 'education';
  if (workPat.test(s)) return 'work';
  return undefined;
}

const edu = (c: Ctx, sub: keyof Profile['education'][number]) => {
  const i = c.field.rowIndex ?? c.index('education', sub);
  const e = c.profile.education[i];
  if (!e) return SKIP;
  const v = e[sub];
  return typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v;
};
const work = (c: Ctx, sub: keyof Profile['work'][number]) => {
  const i = c.field.rowIndex ?? c.index('work', sub);
  const w = c.profile.work[i];
  if (!w) return SKIP;
  const v = w[sub];
  return typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v;
};

const P = (c: Ctx) => c.profile.personal;
const A = (c: Ctx) => c.profile.personal.address;
const L = (c: Ctx) => c.profile.links;

export const RULES: Rule[] = [
  // ---- files
  { name: 'resume', test: /resume|résumé|\bcv\b|curriculum/i, kinds: ['file'], resolve: () => FILE_RESUME },
  { name: 'cover-letter', test: /cover ?letter/i, kinds: ['file'], resolve: () => FILE_COVER },

  // ---- autocomplete attributes are the most reliable signal
  { name: 'ac-given', test: /\bgiven-name\b/, hintsOnly: true, resolve: (c) => P(c).firstName },
  { name: 'ac-family', test: /\bfamily-name\b/, hintsOnly: true, resolve: (c) => P(c).lastName },
  { name: 'ac-email', test: /\bemail\b/, hintsOnly: true, kinds: ['text'], not: /confirm|verify|repeat/, resolve: (c) => P(c).email },
  { name: 'ac-tel', test: /\btel\b|\btel-national\b/, hintsOnly: true, resolve: (c) => P(c).phone },
  { name: 'ac-org', test: /\borganization\b/, hintsOnly: true, resolve: (c) => work(c, 'company') },
  { name: 'ac-org-title', test: /\borganization-title\b/, hintsOnly: true, resolve: (c) => work(c, 'title') },
  { name: 'ac-address1', test: /\baddress-line1\b|\bstreet-address\b/, hintsOnly: true, resolve: (c) => A(c).line1 },
  { name: 'ac-address2', test: /\baddress-line2\b/, hintsOnly: true, resolve: (c) => A(c).line2 },
  { name: 'ac-postal', test: /\bpostal-code\b/, hintsOnly: true, resolve: (c) => A(c).postalCode },
  { name: 'ac-city', test: /\baddress-level2\b/, hintsOnly: true, resolve: (c) => A(c).city },
  { name: 'ac-state', test: /\baddress-level1\b/, hintsOnly: true, resolve: (c) => A(c).state },
  { name: 'ac-country', test: /\bcountry-name\b|\bcountry\b/, hintsOnly: true, kinds: CHOICE, resolve: (c) => A(c).country },

  // ---- names
  { name: 'full-name', test: /^(your |full |legal |candidate |applicant )?(full |legal )?name$|full legal name|first and last name|^name (first|and)/i, kinds: TEXTY, resolve: (c) => fullName(c.profile) },
  { name: 'first-name', test: /first ?name|given ?name|forename|^first$/i, kinds: TEXTY, not: /emergency|reference|referr|manager|supervisor|contact/i, resolve: (c) => P(c).firstName },
  { name: 'last-name', test: /last ?name|surname|family ?name|^last$/i, kinds: TEXTY, not: /emergency|reference|referr|manager|supervisor|contact/i, resolve: (c) => P(c).lastName },
  { name: 'preferred-name', test: /preferred (first )?name|nickname|name you go by|go by|what should we call you/i, kinds: TEXTY, resolve: (c) => P(c).preferredName || P(c).firstName },
  { name: 'middle-name', test: /middle (name|initial)/i, kinds: TEXTY, resolve: () => SKIP },
  { name: 'pronouns', test: /\bpronouns?\b/i, not: /pronounc/i, resolve: (c) => c.profile.eeo.pronouns },

  // ---- contact
  { name: 'email', test: /e-?mail/i, kinds: TEXTY, not: /confirm|verify|re-?enter|repeat|manager|supervisor|reference|referr|emergency/i, resolve: (c) => P(c).email },
  { name: 'email-confirm', test: /(confirm|verify|re-?enter|repeat).*e-?mail|e-?mail.*(confirm|verify|again)/i, kinds: TEXTY, resolve: (c) => P(c).email },
  { name: 'phone-country-code', test: /country code|dial(ing)? code|phone code/i, resolve: (c) => P(c).phoneCountryCode },
  { name: 'phone-type', test: /phone type|type of phone|device type/i, resolve: () => 'Mobile' },
  { name: 'phone', test: /phone|mobile|cell|telephone|contact number/i, kinds: TEXTY, not: /type|extension|\bext\b|country|manager|supervisor|reference|emergency|referr/i, resolve: (c) => P(c).phone },

  // ---- links
  { name: 'linkedin', test: /linked ?in/i, kinds: TEXTY, resolve: (c) => L(c).linkedin },
  { name: 'github', test: /git ?hub/i, kinds: TEXTY, resolve: (c) => L(c).github },
  { name: 'portfolio', test: /portfolio|personal (web ?site|site|url|page)|website|personal url|blog|homepage/i, kinds: TEXTY, not: /company|employer|linkedin|github/i, resolve: (c) => L(c).portfolio || L(c).website },
  { name: 'other-url', test: /^(other )?(url|link|website|links?)( ?\d)?$|other (website|url|link)|additional (link|url)|online profile/i, kinds: TEXTY, resolve: (c) => L(c).other || L(c).portfolio || L(c).website || SKIP },

  // ---- address
  { name: 'address-line2', test: /address (line ?)?2|apt|apartment|suite|unit ?(number|#)?$/i, kinds: TEXTY, resolve: (c) => A(c).line2 || SKIP },
  { name: 'address-line1', test: /street|address (line ?1)?$|^(home |mailing |current |street )?address$|address line 1/i, kinds: TEXTY, not: /e-?mail|line ?2|city|state|zip|postal|country|ip address/i, resolve: (c) => A(c).line1 },
  { name: 'city', test: /\bcity\b|\btown\b/i, kinds: TEXTY, not: /country|university|school|company|employer|state/i, resolve: (c) => A(c).city },
  { name: 'state', test: /\bstate\b|province|region|county/i, kinds: TEXTY, not: /country|united states|statement|estate|real estate|status/i, resolve: (c) => A(c).state },
  { name: 'postal', test: /zip|postal|postcode/i, kinds: TEXTY, resolve: (c) => A(c).postalCode },
  { name: 'country', test: /\bcountry\b|\bnation(ality)?\b/i, kinds: CHOICE, not: new RegExp(/code|county|citizen|residence|reside|live|based|located|sponsor|visa|authori/i.source + '|' + QUESTION.source, 'i'), resolve: (c) => A(c).country },
  { name: 'dob', test: /date of birth|birth ?date|\bdob\b|birthday/i, resolve: (c) => P(c).dateOfBirth || SKIP },

  // ---- education
  { name: 'school', test: /school|universit|college|institution|alma mater|where did you study/i, kinds: TEXTY, not: /high school|graduat|year|date|type|level|email|address|current(ly)? (a )?student|enrolled/i, resolve: (c) => edu(c, 'school') },
  { name: 'degree', test: /degree|qualification|education level|level of education|highest (level|degree|education)/i, kinds: [...TEXTY, 'radio', 'buttons'], not: /major|field|subject|date|year|complet/i, resolve: (c) => edu(c, 'degree') },
  { name: 'major', test: /\bmajor\b|field of study|discipline|concentration|area of study|program of study|course of study|\bsubject\b/i, kinds: TEXTY, not: /minor/i, resolve: (c) => edu(c, 'field') },
  { name: 'minor', test: /\bminor\b/i, kinds: TEXTY, resolve: () => SKIP },
  { name: 'gpa', test: /\bgpa\b|grade point|cumulative grade/i, kinds: TEXTY, resolve: (c) => edu(c, 'gpa') || SKIP },
  { name: 'grad-date', test: /graduat|completion date|date (of )?complet|degree date|(expected|anticipated) (end|finish)/i, kinds: TEXTY, resolve: (c) => edu(c, 'endDate') },
  { name: 'edu-start', test: /start|from|begin|attended from/i, family: 'education', kinds: TEXTY, not: QUESTION, resolve: (c) => edu(c, 'startDate') },
  { name: 'edu-end', test: /\bend\b|\bto\b|until|through|finish|left/i, family: 'education', kinds: TEXTY, not: QUESTION, resolve: (c) => edu(c, 'endDate') },
  { name: 'edu-current', test: /current(ly)?|present|still (attend|enrolled)|in progress/i, family: 'education', kinds: ['checkbox', 'radio', 'buttons'], resolve: (c) => edu(c, 'current') },
  { name: 'edu-location', test: /location|city/i, family: 'education', kinds: TEXTY, not: QUESTION, resolve: (c) => edu(c, 'location') || SKIP },

  // ---- work
  { name: 'company', test: /company|employer|organi[sz]ation|\bfirm\b|business name/i, kinds: TEXTY, not: /website|url|email|phone|why|interested|hear|referr|relative|related|worked (for|at)|previous(ly)? (employ|work)|current(ly)? (employ|work)|size|industry|your (own )?company/i, resolve: (c) => work(c, 'company') },
  { name: 'job-title', test: /job ?title|^title$|^(current |most recent |previous |last )?(title|position|role)$|position held|role held|occupation|current title/i, kinds: TEXTY, not: /apply|applied|interested|desired|preferred|which|what (position|role) are/i, resolve: (c) => work(c, 'title') },
  { name: 'work-description', test: /description|responsibilit|duties|summary of (work|role)|what did you do|accomplishments/i, family: 'work', kinds: ['textarea', 'text'], not: QUESTION, resolve: (c) => work(c, 'description') },
  { name: 'work-start', test: /start|from|begin|since/i, family: 'work', kinds: TEXTY, not: QUESTION, resolve: (c) => work(c, 'startDate') },
  { name: 'work-end', test: /\bend\b|\bto\b|until|through|finish|left/i, family: 'work', kinds: TEXTY, not: QUESTION, resolve: (c) => work(c, 'endDate') || SKIP },
  { name: 'work-current', test: /current(ly)?|present|still (work|employed)|i (currently )?work here|ongoing/i, family: 'work', kinds: ['checkbox', 'radio', 'buttons'], resolve: (c) => work(c, 'current') },
  { name: 'work-location', test: /location|city/i, family: 'work', kinds: TEXTY, not: QUESTION, resolve: (c) => work(c, 'location') || SKIP },
  // generic start/end when the section is unknown: assume work history
  { name: 'start-date', test: /start ?date|date started|^from$/i, kinds: TEXTY, not: new RegExp(/available|expected|earliest|desired|preferred|can you|when can/i.source + '|' + QUESTION.source, 'i'), resolve: (c) => work(c, 'startDate') },
  { name: 'end-date', test: /end ?date|date ended|^to$|^until$/i, kinds: TEXTY, not: QUESTION, resolve: (c) => work(c, 'endDate') || SKIP },

  // ---- skills
  { name: 'skills', test: /\bskills?\b|technolog(y|ies) (you know|proficien)|programming languages/i, kinds: ['text', 'textarea'], resolve: (c) => c.profile.skills.join(', ') || SKIP },

  // ---- voluntary self-identification
  { name: 'gender', test: /\bgender\b|\bsex\b/i, not: /sexual|identity|transgender|pronoun|non-?binary/i, resolve: (c) => c.profile.eeo.gender },
  { name: 'hispanic', test: /hispanic|latin/i, resolve: (c) => c.profile.eeo.hispanicLatino },
  { name: 'race', test: /\brace\b|ethnic/i, resolve: (c) => c.profile.eeo.race },
  { name: 'veteran', test: /veteran|military|armed forces/i, resolve: (c) => c.profile.eeo.veteran },
  { name: 'disability', test: /disabilit|handicap|impairment/i, not: /accommodat/i, resolve: (c) => c.profile.eeo.disability },
  { name: 'sexual-orientation', test: /sexual orientation|\borientation\b/i, resolve: (c) => c.profile.eeo.sexualOrientation },
  { name: 'transgender', test: /transgender|gender identity/i, resolve: (c) => c.profile.eeo.transgender || c.profile.eeo.gender },
];

export interface RuleEngine {
  match(field: Field): RuleMatch | null;
}

/** Create a per-page engine so repeated education/work rows get successive indexes. */
export function createRuleEngine(profile: Profile): RuleEngine {
  const counters = new Map<string, number>();
  const index = (family: Family, sub: string) => {
    const k = `${family}:${sub}`;
    const n = counters.get(k) ?? 0;
    counters.set(k, n + 1);
    return n;
  };
  return {
    match(field) {
      const label = field.label;
      const hints = field.hints;
      const fam = familyOf(field);
      for (const r of RULES) {
        if (r.kinds && !r.kinds.includes(field.kind)) continue;
        if (r.family && fam !== r.family) continue;
        const hit = r.hintsOnly ? r.test.test(hints) : r.test.test(label) || r.test.test(hints);
        if (!hit) continue;
        if (r.not && (r.not.test(label) || r.not.test(hints))) continue;
        const value = r.resolve({ profile, field, index });
        if (value === undefined) continue;
        return { rule: r.name, value };
      }
      return null;
    },
  };
}
