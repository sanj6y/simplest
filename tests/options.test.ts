import { describe, expect, it } from 'vitest';
import { answerToBool, pickOption } from '../src/lib/options';

const opts = (...texts: string[]) => texts.map((t) => ({ value: t, text: t }));

describe('pickOption', () => {
  it('matches exact and case-insensitive', () => {
    expect(pickOption('Yes', opts('Select...', 'Yes', 'No'))?.text).toBe('Yes');
    expect(pickOption('no', opts('Yes', 'No'))?.text).toBe('No');
  });
  it('prefers exact "No" over "No, I do not..."', () => {
    expect(pickOption('No', opts('Yes, I have a disability', 'No, I do not have a disability', 'No'))?.text).toBe('No');
  });
  it('handles LinkedIn variants and fallbacks', () => {
    expect(pickOption('LinkedIn', opts('Indeed', 'Linkedin', 'Other'))?.text).toBe('Linkedin');
    expect(pickOption('LinkedIn', opts('Social Media - LinkedIn', 'Referral'))?.text).toBe('Social Media - LinkedIn');
    expect(pickOption('LinkedIn | Job board | Other', opts('Company website', 'Job Board', 'Other'))?.text).toBe('Job Board');
    expect(pickOption('LinkedIn', opts('Company website', 'Referral'))).toBeNull();
  });
  it('handles EEO wording', () => {
    expect(pickOption('I am not a protected veteran', opts('I identify as one or more of the classifications of a protected veteran', 'I am not a protected veteran', "I don't wish to answer"))?.text).toBe('I am not a protected veteran');
    expect(pickOption('I am not a protected veteran', opts('Yes', 'No', 'Decline'))?.text).toBe('No');
    expect(pickOption('No, I do not have a disability', opts("Yes, I have a disability, or have had one in the past", "No, I do not have a disability and have not had one in the past", "I do not want to answer"))?.text).toMatch(/^No, I do not/);
    expect(pickOption('Asian', opts('White (Not Hispanic or Latino)', 'Asian (Not Hispanic or Latino)', 'Decline To Self Identify'))?.text).toMatch(/^Asian/);
    expect(pickOption('Decline to self-identify', opts('Male', 'Female', 'I don\'t wish to answer'))?.text).toBe("I don't wish to answer");
    expect(pickOption('Male', opts('Man', 'Woman', 'Non-binary'))?.text).toBe('Man');
  });
  it('handles countries and degrees', () => {
    expect(pickOption('United States', opts('Canada', 'United States of America', 'Mexico'))?.text).toBe('United States of America');
    expect(pickOption('United States', opts('CA', 'USA', 'MX'))?.text).toBe('USA');
    expect(pickOption('Bachelor of Science', opts("High School", "Bachelor's Degree", "Master's Degree"))?.text).toBe("Bachelor's Degree");
    expect(pickOption('Bachelor of Science', opts('BS', 'MS', 'PhD'))?.text).toBe('BS');
  });
  it('handles months', () => {
    expect(pickOption('September | 09 | 9', opts('01', '02', '09', '10'))?.text).toBe('09');
    expect(pickOption('September | 09 | 9', opts('Jan', 'Sep', 'Oct'))?.text).toBe('Sep');
  });
  it('ignores placeholder options', () => {
    expect(pickOption('Select', opts('Select...', 'Yes'))).toBeNull();
  });
});

describe('answerToBool', () => {
  it('parses yes/no', () => {
    expect(answerToBool('Yes')).toBe(true);
    expect(answerToBool('I agree')).toBe(true);
    expect(answerToBool('No')).toBe(false);
    expect(answerToBool('maybe')).toBeNull();
  });
});
