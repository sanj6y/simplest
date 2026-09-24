import { z } from 'zod';

const str = () => z.string().default('');

export const EducationSchema = z.object({
  school: str(),
  degree: str(), // e.g. "Bachelor of Science"
  field: str(), // major
  gpa: str(),
  startDate: str(), // YYYY-MM
  endDate: str(), // YYYY-MM (expected graduation is fine)
  current: z.boolean().default(false),
  location: str(),
});

export const WorkSchema = z.object({
  company: str(),
  title: str(),
  location: str(),
  startDate: str(), // YYYY-MM
  endDate: str(), // YYYY-MM, empty when current
  current: z.boolean().default(false),
  description: str(),
});

export const ProfileSchema = z.object({
  personal: z
    .object({
      firstName: str(),
      lastName: str(),
      preferredName: str(),
      email: str(),
      phone: str(),
      phoneCountryCode: z.string().default('+1'),
      dateOfBirth: str(), // YYYY-MM-DD
      address: z
        .object({
          line1: str(),
          line2: str(),
          city: str(),
          state: str(),
          postalCode: str(),
          country: z.string().default('United States'),
        })
        .prefault({}),
    })
    .prefault({}),
  links: z
    .object({
      linkedin: str(),
      github: str(),
      portfolio: str(),
      website: str(),
      other: str(),
    })
    .prefault({}),
  education: z.array(EducationSchema).default([]),
  work: z.array(WorkSchema).default([]),
  skills: z.array(z.string()).default([]),
  // Voluntary self-identification. Stored as the answer text you want picked.
  eeo: z
    .object({
      gender: str(),
      hispanicLatino: str(),
      race: str(),
      veteran: z.string().default('I am not a protected veteran'),
      disability: z.string().default('No, I do not have a disability'),
      sexualOrientation: str(),
      transgender: str(),
      pronouns: str(),
    })
    .prefault({}),
});

export type Profile = z.infer<typeof ProfileSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Work = z.infer<typeof WorkSchema>;

export const defaultProfile: Profile = ProfileSchema.parse({});

export function fullName(p: Profile): string {
  return [p.personal.firstName, p.personal.lastName].filter(Boolean).join(' ');
}

/** Replace {{token}} placeholders in a stored answer with profile values. */
export function renderTemplate(text: string, p: Profile): string {
  const edu = p.education[0];
  const work = p.work[0];
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const tokens: Record<string, string> = {
    firstName: p.personal.firstName,
    lastName: p.personal.lastName,
    fullName: fullName(p),
    email: p.personal.email,
    phone: p.personal.phone,
    city: p.personal.address.city,
    state: p.personal.address.state,
    country: p.personal.address.country,
    postalCode: p.personal.address.postalCode,
    location: [p.personal.address.city, p.personal.address.state].filter(Boolean).join(', '),
    address: [p.personal.address.line1, p.personal.address.line2, p.personal.address.city, [p.personal.address.state, p.personal.address.postalCode].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', '),
    school: edu?.school ?? '',
    degree: edu?.degree ?? '',
    major: edu?.field ?? '',
    gpa: edu?.gpa ?? '',
    gradDate: edu?.endDate ?? '',
    gradYear: (edu?.endDate ?? '').slice(0, 4),
    company: work?.company ?? '',
    title: work?.title ?? '',
    linkedin: p.links.linkedin,
    github: p.links.github,
    portfolio: p.links.portfolio || p.links.website,
    skills: p.skills.join(', '),
    today: `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()}`,
    todayISO: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  };
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => tokens[k] ?? '');
}

/** A PII-free summary handed to the model so it can answer preference-style questions. */
export function profileSummary(p: Profile): string {
  const lines: string[] = [];
  const edu = p.education[0];
  if (edu?.school) {
    lines.push(
      `Education: ${[edu.degree, edu.field].filter(Boolean).join(' in ')} at ${edu.school}` +
        (edu.endDate ? `, graduating ${edu.endDate}` : '') +
        (edu.gpa ? `, GPA ${edu.gpa}` : ''),
    );
  }
  if (p.work.length) {
    lines.push(
      'Work history: ' +
        p.work
          .map((w) => `${w.title || 'role'} at ${w.company}${w.current ? ' (current)' : ''}`)
          .join('; '),
    );
  }
  if (p.skills.length) lines.push(`Skills: ${p.skills.join(', ')}`);
  if (p.personal.address.country) lines.push(`Country of residence: ${p.personal.address.country}`);
  if (p.personal.address.state) lines.push(`Location: ${p.personal.address.city}, ${p.personal.address.state}`);
  return lines.join('\n');
}
