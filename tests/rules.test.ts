import { beforeEach, describe, expect, it } from 'vitest';
import { defaultProfile, Profile } from '../src/lib/profile';
import { createRuleEngine, FILE_COVER, FILE_RESUME } from '../src/lib/rules';
import { scanFields } from '../src/lib/scan';
import { findKBEntry, BUILTIN_KB } from '../src/lib/kb';
import { GREENHOUSE_FORM } from './fixtures';

const profile: Profile = structuredClone(defaultProfile);
profile.personal = { ...profile.personal, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '2175550123' };
profile.links.linkedin = 'https://linkedin.com/in/ada';
profile.links.portfolio = 'https://ada.dev';
profile.education = [{ school: 'University of Illinois Urbana-Champaign', degree: 'Bachelor of Science', field: 'Computer Science', gpa: '3.9', startDate: '2023-08', endDate: '2027-05', current: true, location: '' }];
profile.eeo = { ...profile.eeo, gender: 'Female', hispanicLatino: 'No', race: 'Asian' };

// jsdom has no layout; pretend everything is visible.
beforeEach(() => {
  document.body.innerHTML = GREENHOUSE_FORM;
  Element.prototype.getClientRects = function () {
    return [{ width: 100, height: 20 }] as unknown as DOMRectList;
  };
});

describe('scan + rules on a Greenhouse-style form', () => {
  it('labels and classifies fields', () => {
    const fields = scanFields();
    const byLabel = Object.fromEntries(fields.map((f) => [f.label, f]));
    expect(byLabel['First Name'].kind).toBe('text');
    expect(byLabel['Resume/CV'].kind).toBe('file');
    expect(byLabel['Are you related to a current or former government official?'].kind).toBe('radio');
    expect(byLabel['Are you related to a current or former government official?'].options.map((o) => o.text)).toEqual(['Yes', 'No']);
    expect(byLabel['I understand that Acme may use AI tools to assist in the interview process.'].kind).toBe('checkbox');
    expect(byLabel['School'].section).toBe('Education');
    expect(byLabel['Gender'].section).toBe('Voluntary Self-Identification');
  });

  it('maps profile fields through rules', () => {
    const fields = scanFields();
    const engine = createRuleEngine(profile);
    const got: Record<string, string | null> = {};
    for (const f of fields) got[f.label] = engine.match(f)?.value ?? null;
    expect(got['First Name']).toBe('Ada');
    expect(got['Last Name']).toBe('Lovelace');
    expect(got['Email']).toBe('ada@example.com');
    expect(got['Phone']).toBe('2175550123');
    expect(got['Resume/CV']).toBe(FILE_RESUME);
    expect(got['Cover Letter']).toBe(FILE_COVER);
    expect(got['School']).toBe('University of Illinois Urbana-Champaign');
    expect(got['Degree']).toBe('Bachelor of Science');
    expect(got['Discipline']).toBe('Computer Science');
    expect(got['Start Date Month']).toBe('2023-08');
    expect(got['End Date Year']).toBe('2027-05');
    expect(got['LinkedIn Profile']).toBe('https://linkedin.com/in/ada');
    expect(got['Website']).toBe('https://ada.dev');
    expect(got['Gender']).toBe('Female');
    expect(got['Hispanic/Latino']).toBe('No');
    expect(got['Race']).toBe('Asian');
    expect(got['Veteran Status']).toBe('I am not a protected veteran');
    expect(got['Disability Status']).toBe('No, I do not have a disability');
    // Questions are not profile fields; rules must leave them alone for the knowledge base.
    expect(got['How did you hear about this job?']).toBeNull();
    expect(got['Are you legally authorized to work in the United States?']).toBeNull();
    expect(got['Will you now or in the future require sponsorship for employment visa status?']).toBeNull();
    expect(got['Are you related to a current or former government official?']).toBeNull();
    expect(got['I understand that Acme may use AI tools to assist in the interview process.']).toBeNull();
    expect(got['Why do you want to work at Acme?']).toBeNull();
  });

  it('routes the remaining questions to the knowledge base', () => {
    const fields = scanFields();
    const engine = createRuleEngine(profile);
    const leftovers = fields.filter((f) => !engine.match(f));
    const keys = Object.fromEntries(leftovers.map((f) => [f.label, findKBEntry(f.label, BUILTIN_KB)?.key ?? null]));
    expect(keys['How did you hear about this job?']).toBe('how_heard');
    expect(keys['Are you legally authorized to work in the United States?']).toBe('authorized_to_work');
    expect(keys['Will you now or in the future require sponsorship for employment visa status?']).toBe('requires_sponsorship');
    expect(keys['Are you related to a current or former government official?']).toBe('related_to_government_official');
    expect(keys['I understand that Acme may use AI tools to assist in the interview process.']).toBe('acknowledge_ai_use');
    expect(keys['Why do you want to work at Acme?']).toBe('free_text_essay');
  });

  it('indexes repeated work rows', () => {
    document.body.innerHTML = `
      <h3>Employment</h3>
      <div><label for="c0">Company</label><input id="c0" /><label for="t0">Title</label><input id="t0" /></div>
      <div><label for="c1">Company</label><input id="c1" /><label for="t1">Title</label><input id="t1" /></div>`;
    const p = structuredClone(profile);
    p.work = [
      { company: 'Acme', title: 'Intern', location: '', startDate: '2025-06', endDate: '2025-08', current: false, description: '' },
      { company: 'Globex', title: 'Engineer', location: '', startDate: '2024-06', endDate: '2024-08', current: false, description: '' },
    ];
    const engine = createRuleEngine(p);
    const vals = scanFields().map((f) => engine.match(f)?.value);
    expect(vals).toEqual(['Acme', 'Intern', 'Globex', 'Engineer']);
  });
});
