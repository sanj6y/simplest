import { describe, expect, it } from 'vitest';
import { BUILTIN_KB, findKBEntry, learn, mergeKB, normalizeLabel } from '../src/lib/kb';

const key = (label: string) => findKBEntry(label, BUILTIN_KB)?.key ?? null;

describe('knowledge base matching', () => {
  it.each([
    ['How did you hear about this job?', 'how_heard'],
    ['How did you hear about us? *', 'how_heard'],
    ['Where did you find this posting', 'how_heard'],
    ['Will you now or in the future require sponsorship for employment visa status (e.g., H-1B visa status)?', 'requires_sponsorship'],
    ['Do you require visa sponsorship?', 'requires_sponsorship'],
    ['Are you legally authorized to work in the United States?', 'authorized_to_work'],
    ['Do you have the right to work in the UK?', 'authorized_to_work'],
    ['Are you or any of your immediate family members a current or former government official?', 'related_to_government_official'],
    ['Are you related to anyone who works at Acme?', 'related_to_employee'],
    ['Do you have any relatives or friends employed by the company?', 'related_to_employee'],
    ['Have you ever been employed by Acme or any of its subsidiaries?', 'previously_employed_here'],
    ['Have you previously applied to Acme?', 'previously_applied'],
    ['Are you at least 18 years of age?', 'over_18'],
    ['I understand that Acme may use artificial intelligence tools to assist in the interview process.', 'acknowledge_ai_use'],
    ['I certify that the information provided in this application is true and complete.', 'agree_terms'],
    ['I have read and agree to the privacy policy', 'agree_terms'],
    ['By checking this box, I consent to receive SMS text messages from Acme', 'consent_sms'],
    ['Are you willing to relocate?', 'willing_to_relocate'],
    ['What are your salary expectations?', 'expected_salary'],
    ['Desired compensation', 'expected_salary'],
    ['What is your earliest available start date?', 'available_start_date'],
    ['When can you start?', 'available_start_date'],
    ['Have you ever been convicted of a felony?', 'criminal_history'],
    ['Do you consent to a background check?', 'background_check_consent'],
    ['Do you currently hold an active security clearance?', 'security_clearance'],
    ['Are you subject to a non-compete agreement?', 'non_compete'],
    ['Do you require any accommodation during the interview process?', 'disability_accommodation'],
    ['Why do you want to work at Acme?', 'free_text_essay'],
    ['Cover Letter', 'free_text_essay'],
    ['Signature', 'signature'],
    ["Today's Date", 'today_date'],
    ['Are you currently a student?', 'current_student'],
    ['Which country do you currently reside in?', 'country_of_residence'],
    ['What is your current location?', 'current_location'],
  ])('%s -> %s', (label, expected) => {
    expect(key(label)).toBe(expected);
  });

  it('returns null for unrelated labels', () => {
    expect(key('Favorite programming language')).toBeNull();
    expect(key('First Name')).toBeNull();
  });

  it('normalizes labels', () => {
    expect(normalizeLabel('  Are you Over 18?*  (Required) ')).toBe('are you over 18?');
  });

  it('learns aliases and new entries', () => {
    let kb = mergeKB(undefined);
    kb = learn(kb, { key: 'requires_sponsorship', label: 'Need a visa?', answer: 'No' });
    expect(findKBEntry('Need a visa?', kb)?.key).toBe('requires_sponsorship');
    expect(kb.find((e) => e.key === 'requires_sponsorship')?.answer).toBe('No');
    kb = learn(kb, { key: 'Has Driver License', label: "Do you have a driver's license?", answer: 'Yes', kind: 'yesno' });
    const e = findKBEntry("Do you have a driver's license?", kb);
    expect(e?.key).toBe('has_driver_license');
    expect(e?.answer).toBe('Yes');
  });

  it('merges stored answers over builtin defaults', () => {
    const stored = [{ key: 'how_heard', question: 'x', answer: 'Handshake', kind: 'choice' as const, patterns: [], aliases: ['custom phrasing'] }];
    const kb = mergeKB(stored);
    const e = kb.find((x) => x.key === 'how_heard')!;
    expect(e.answer).toBe('Handshake');
    expect(e.patterns.length).toBeGreaterThan(0);
    expect(e.aliases).toEqual(['custom phrasing']);
    expect(kb.length).toBe(BUILTIN_KB.length);
  });
});

describe('knowledge base matching (live-form phrasings)', () => {
  it.each([
    ['AI Policy for Application', 'acknowledge_ai_use'],
    ['When is the earliest you would want to start working with us?', 'available_start_date'],
    ['Agreement to Arbitrate', 'agree_terms'],
    ['Please read the arbitration agreement below', 'agree_terms'],
    ['Are you open to working in-person in one of our offices 25% of the time?', 'work_in_office_ok'],
    ['What is the address from which you plan on working? If you would need to relocate, please note that.', 'work_from_address'],
    ['Have you ever interviewed at Anthropic before?', 'previously_interviewed'],
    ['Do you require visa sponsorship?', 'requires_sponsorship'],
  ])('%s -> %s', (label, expected) => {
    expect(findKBEntry(label, BUILTIN_KB)?.key).toBe(expected);
  });
});
