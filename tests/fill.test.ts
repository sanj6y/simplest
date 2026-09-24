import { beforeEach, describe, expect, it } from 'vitest';
import { fillField, formatDate } from '../src/lib/fill';
import { scanFields } from '../src/lib/scan';
import { GREENHOUSE_FORM } from './fixtures';

const ctx = { overwrite: false, menuDelay: 0 };

beforeEach(() => {
  document.body.innerHTML = GREENHOUSE_FORM;
  Element.prototype.getClientRects = function () {
    return [{ width: 100, height: 20 }] as unknown as DOMRectList;
  };
});

describe('fillField', () => {
  it('sets text and fires input events', async () => {
    const f = scanFields().find((x) => x.label === 'First Name')!;
    let inputs = 0;
    f.el.addEventListener('input', () => inputs++);
    expect(await fillField(f, 'Ada', ctx)).toBe('filled');
    expect((f.el as HTMLInputElement).value).toBe('Ada');
    expect(inputs).toBe(1);
    // does not overwrite by default
    expect(await fillField(f, 'Grace', ctx)).toBe('already');
    expect((f.el as HTMLInputElement).value).toBe('Ada');
  });

  it('selects options fuzzily', async () => {
    const fields = scanFields();
    const degree = fields.find((x) => x.label === 'Degree')!;
    expect(await fillField(degree, 'Bachelor of Science', ctx)).toBe('filled');
    expect((degree.el as HTMLSelectElement).value).toBe("Bachelor's Degree");
    const race = fields.find((x) => x.label === 'Race')!;
    await fillField(race, 'Asian', ctx);
    expect((race.el as HTMLSelectElement).value).toMatch(/^Asian/);
    const hear = fields.find((x) => x.label === 'How did you hear about this job?')!;
    await fillField(hear, 'LinkedIn | Job board | Other', ctx);
    expect((hear.el as HTMLSelectElement).value).toBe('LinkedIn');
  });

  it('formats dates for month/year selects and text inputs', async () => {
    const fields = scanFields();
    const month = fields.find((x) => x.label === 'Start Date Month')!;
    expect(await fillField(month, '2023-08', ctx)).toBe('filled');
    expect((month.el as HTMLSelectElement).value).toBe('8');
    const year = fields.find((x) => x.label === 'End Date Year')!;
    expect(await fillField(year, '2027-05', ctx)).toBe('filled');
    expect((year.el as HTMLInputElement).value).toBe('2027');
    const fake = { ...month, kind: 'text' as const, hints: '', label: 'Start date', el: Object.assign(document.createElement('input'), { placeholder: 'MM/YYYY' }) };
    expect(formatDate('2023-08', fake)).toBe('08/2023');
  });

  it('clicks radios and checkboxes', async () => {
    const fields = scanFields();
    const gov = fields.find((x) => x.kind === 'radio')!;
    expect(await fillField(gov, 'No', ctx)).toBe('filled');
    expect((gov.options[1].el as HTMLInputElement).checked).toBe(true);
    const ai = fields.find((x) => x.kind === 'checkbox')!;
    expect(await fillField(ai, 'Yes', ctx)).toBe('filled');
    expect((ai.el as HTMLInputElement).checked).toBe(true);
    expect(await fillField(ai, 'Yes', ctx)).toBe('already');
  });
});
