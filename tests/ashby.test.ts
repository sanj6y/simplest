import { beforeEach, describe, expect, it } from 'vitest';
import { BUILTIN_KB, findKBEntry } from '../src/lib/kb';
import { defaultProfile, Profile } from '../src/lib/profile';
import { createRuleEngine } from '../src/lib/rules';
import { scanFields } from '../src/lib/scan';
import { fillField } from '../src/lib/fill';

const ASHBY = `
<form>
  <div data-field-path="_systemfield_name"><label for="_systemfield_name">Legal Name</label><div><input name="_systemfield_name" id="_systemfield_name" type="text" placeholder="Type here..."></div></div>
  <div data-field-path="q1"><label for="q1">Are you authorized to work in the country where the job is located?</label>
    <div class="yesno"><button aria-pressed="false" data-option="yes">Yes</button><button aria-pressed="false" data-option="no">No</button><input type="checkbox" tabindex="-1" name="q1"></div></div>
  <div data-field-path="q2"><label for="q2">Will you now or in the future require sponsorship for employment visa status?</label>
    <div class="yesno"><button aria-pressed="false" data-option="yes">Yes</button><button aria-pressed="false" data-option="no">No</button><input type="checkbox" tabindex="-1" name="q2"></div></div>
  <div data-field-path="_systemfield_eeoc_gender"><fieldset><label for="_systemfield_eeoc_gender">Gender</label><div><p>Input gender</p></div>
    <div><span><input type="radio" id="g0" name="_systemfield_eeoc_gender"></span><label for="g0">Male</label></div>
    <div><span><input type="radio" id="g1" name="_systemfield_eeoc_gender"></span><label for="g1">Female</label></div>
    <div><span><input type="radio" id="g2" name="_systemfield_eeoc_gender"></span><label for="g2">Decline to self-identify</label></div>
  </fieldset></div>
  <div data-field-path="_systemfield_eeoc_race"><fieldset><label for="_systemfield_eeoc_race">Race</label>
    <div><span><input type="radio" id="r0" name="_systemfield_eeoc_race"></span><label for="r0">White (Not Hispanic or Latino)</label></div>
    <div><span><input type="radio" id="r1" name="_systemfield_eeoc_race"></span><label for="r1">Asian (Not Hispanic or Latino)</label></div>
  </fieldset></div>
</form>`;

const profile: Profile = structuredClone(defaultProfile);
profile.personal.firstName = 'Ada';
profile.personal.lastName = 'Lovelace';
profile.eeo.gender = 'Female';
profile.eeo.race = 'Asian';

beforeEach(() => {
  document.body.innerHTML = ASHBY;
  Element.prototype.getClientRects = function () {
    return [{ width: 100, height: 20 }] as unknown as DOMRectList;
  };
});

describe('Ashby-style widgets', () => {
  it('detects toggle-button yes/no groups and labels radio groups from the fieldset label', () => {
    const fields = scanFields();
    const labels = fields.map((f) => `${f.kind}:${f.label}`);
    expect(labels).toEqual([
      'text:Legal Name',
      'buttons:Are you authorized to work in the country where the job is located?',
      'buttons:Will you now or in the future require sponsorship for employment visa status?',
      'radio:Gender',
      'radio:Race',
    ]);
    expect(fields[1].options.map((o) => o.text)).toEqual(['Yes', 'No']);
  });

  it('routes and fills them', async () => {
    const fields = scanFields();
    const engine = createRuleEngine(profile);
    const ctx = { overwrite: false, menuDelay: 0 };
    expect(engine.match(fields[0])?.value).toBe('Ada Lovelace');
    expect(engine.match(fields[1])).toBeNull();
    expect(findKBEntry(fields[1].label, BUILTIN_KB)?.key).toBe('authorized_to_work');
    expect(engine.match(fields[2])).toBeNull();
    expect(findKBEntry(fields[2].label, BUILTIN_KB)?.key).toBe('requires_sponsorship');
    const inCountry = { ...fields[2], label: 'Will you now or in the future require sponsorship for employment visa status in this country?' };
    expect(engine.match(inCountry)).toBeNull();
    let clicked = '';
    fields[1].buttons!.forEach((b) => b.addEventListener('click', () => (clicked = b.textContent!)));
    expect(await fillField(fields[1], 'Yes', ctx)).toBe('filled');
    expect(clicked).toBe('Yes');
    expect(engine.match(fields[3])?.value).toBe('Female');
    expect(await fillField(fields[3], 'Female', ctx)).toBe('filled');
    expect((document.getElementById('g1') as HTMLInputElement).checked).toBe(true);
    expect(engine.match(fields[4])?.value).toBe('Asian');
    expect(await fillField(fields[4], 'Asian', ctx)).toBe('filled');
    expect((document.getElementById('r1') as HTMLInputElement).checked).toBe(true);
  });
});
