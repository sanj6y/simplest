import { browser } from 'wxt/browser';
import { defaultProfile, Profile, ProfileSchema } from './profile';
import { KBEntry, mergeKB } from './kb';

export type Provider = 'openai' | 'anthropic';

export interface Settings {
  provider: Provider;
  apiKey: string;
  model: string;
  /** Overwrite fields that already have a value. */
  overwriteExisting: boolean;
  /** Show the floating Fill button on pages that look like application forms. */
  showFloatingButton: boolean;
  /** Ask the model about fields the rules and knowledge base cannot answer. */
  useModel: boolean;
}

export const DEFAULT_MODEL: Record<Provider, string> = {
  openai: 'gpt-5-mini',
  anthropic: 'claude-opus-5',
};

export const defaultSettings: Settings = {
  provider: 'openai',
  apiKey: '',
  model: DEFAULT_MODEL.openai,
  overwriteExisting: false,
  showFloatingButton: true,
  useModel: true,
};

export interface StoredFile {
  name: string;
  type: string;
  size: number;
  base64: string;
}

const KEYS = {
  profile: 'profile',
  kb: 'kb',
  settings: 'settings',
  resume: 'resume',
  coverLetter: 'coverLetter',
} as const;

async function get<T>(key: string): Promise<T | undefined> {
  const res = await browser.storage.local.get(key);
  return res[key] as T | undefined;
}

async function set(key: string, value: unknown): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

export async function getProfile(): Promise<Profile> {
  const raw = await get<unknown>(KEYS.profile);
  if (!raw) return structuredClone(defaultProfile);
  const parsed = ProfileSchema.safeParse(raw);
  return parsed.success ? parsed.data : structuredClone(defaultProfile);
}

export async function saveProfile(p: Profile): Promise<void> {
  await set(KEYS.profile, ProfileSchema.parse(p));
}

export async function getKB(): Promise<KBEntry[]> {
  const stored = await get<KBEntry[]>(KEYS.kb);
  return mergeKB(stored);
}

export async function saveKB(entries: KBEntry[]): Promise<void> {
  await set(KEYS.kb, entries);
}

export async function getSettings(): Promise<Settings> {
  const stored = await get<Partial<Settings>>(KEYS.settings);
  const merged: Settings = { ...defaultSettings, ...(stored ?? {}) };
  // Settings saved before the provider switch may pair the OpenAI provider with a Claude model (or vice versa).
  const looksAnthropic = /^claude/i.test(merged.model);
  const looksOpenAI = /^(gpt|o\d)/i.test(merged.model);
  if ((merged.provider === 'openai' && looksAnthropic) || (merged.provider === 'anthropic' && looksOpenAI)) merged.model = DEFAULT_MODEL[merged.provider];
  return merged;
}

export async function saveSettings(s: Settings): Promise<void> {
  await set(KEYS.settings, s);
}

export async function getResume(): Promise<StoredFile | null> {
  return (await get<StoredFile>(KEYS.resume)) ?? null;
}

export async function saveResume(file: StoredFile | null): Promise<void> {
  if (file) await set(KEYS.resume, file);
  else await browser.storage.local.remove(KEYS.resume);
}

export async function getCoverLetter(): Promise<StoredFile | null> {
  return (await get<StoredFile>(KEYS.coverLetter)) ?? null;
}

export async function saveCoverLetter(file: StoredFile | null): Promise<void> {
  if (file) await set(KEYS.coverLetter, file);
  else await browser.storage.local.remove(KEYS.coverLetter);
}

export async function fileToStored(file: File): Promise<StoredFile> {
  const buf = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return { name: file.name, type: file.type || 'application/pdf', size: file.size, base64: btoa(binary) };
}

export function storedToFile(stored: StoredFile): File {
  const binary = atob(stored.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], stored.name, { type: stored.type });
}

export interface ExportBundle {
  version: 1;
  profile: Profile;
  kb: KBEntry[];
  settings: Omit<Settings, 'apiKey'>;
  resume: StoredFile | null;
  coverLetter: StoredFile | null;
}

export async function exportAll(): Promise<ExportBundle> {
  const [profile, kb, settings, resume, coverLetter] = await Promise.all([
    getProfile(),
    getKB(),
    getSettings(),
    getResume(),
    getCoverLetter(),
  ]);
  const { apiKey: _omit, ...rest } = settings;
  return { version: 1, profile, kb, settings: rest, resume, coverLetter };
}

export async function importAll(bundle: ExportBundle): Promise<void> {
  const current = await getSettings();
  await Promise.all([
    saveProfile(bundle.profile),
    saveKB(bundle.kb),
    saveSettings({ ...current, ...bundle.settings, apiKey: current.apiKey }),
    saveResume(bundle.resume ?? null),
    saveCoverLetter(bundle.coverLetter ?? null),
  ]);
}
