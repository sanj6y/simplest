/**
 * Site adapters: small per-ATS hooks for things the generic engine cannot guess,
 * mostly "add another education / job" buttons and page-specific quirks.
 */
export interface Adapter {
  name: string;
  matches(url: URL): boolean;
  /** Selector or text for the button that adds an education row. */
  addEducation?: string | RegExp;
  /** Selector or text for the button that adds a work experience row. */
  addWork?: string | RegExp;
  /** Called before scanning; use for expanding collapsed sections. */
  prepare?(): Promise<void>;
  /** Milliseconds to wait for combobox menus to render. */
  menuDelay?: number;
  /**
   * Wait for the page's network to go idle (and at least this long since navigation) before filling.
   * Forms that autosave drafts (Ashby) drop changes made before their initial state has loaded.
   */
  settleMs?: number;
  /**
   * After filling, click toggle buttons and checkboxes away and back so the site sees a fresh change
   * event once it is ready. Needed on Ashby, where an early click updates the UI but is never saved.
   */
  reassertToggles?: boolean;
}

const greenhouse: Adapter = {
  name: 'greenhouse',
  matches: (u) => /greenhouse\.io$/.test(u.hostname) || u.searchParams.has('gh_jid') || !!document.querySelector('#grnhse_app, [id^="grnhse"], form#application-form, form[action*="greenhouse"]'),
  addEducation: /add (another )?(education|school)/i,
  addWork: /add (another )?(employment|experience|job|work)/i,
  menuDelay: 350,
};

const lever: Adapter = {
  name: 'lever',
  matches: (u) => /lever\.co$/.test(u.hostname),
  menuDelay: 250,
};

const ashby: Adapter = {
  name: 'ashby',
  matches: (u) => /ashbyhq\.com$/.test(u.hostname) || !!document.querySelector('[class*="ashby"]'),
  addEducation: /add (another )?education/i,
  addWork: /add (another )?(experience|position)/i,
  menuDelay: 400,
  settleMs: 1500,
  reassertToggles: true,
};

const workday: Adapter = {
  name: 'workday',
  matches: (u) => /myworkday(jobs|site)?\.com$/.test(u.hostname) || /workday/.test(u.hostname),
  addEducation: /add (another )?(education)/i,
  addWork: /add (another )?(work experience|experience)/i,
  menuDelay: 600,
  async prepare() {
    // Workday renders sections lazily; scroll through once so inputs mount.
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 300));
    window.scrollTo(0, 0);
  },
};

const generic: Adapter = {
  name: 'generic',
  matches: () => true,
  addEducation: /add (another |more |additional )?(education|school|degree)/i,
  addWork: /add (another |more |additional )?(experience|employment|position|job|work)/i,
  menuDelay: 350,
};

export const ADAPTERS: Adapter[] = [greenhouse, lever, ashby, workday, generic];

export function pickAdapter(url = new URL(location.href)): Adapter {
  for (const a of ADAPTERS) {
    try {
      if (a.matches(url)) return a;
    } catch {
      /* ignore */
    }
  }
  return generic;
}

export function findButton(matcher: string | RegExp, root: ParentNode = document): HTMLElement | null {
  if (typeof matcher === 'string') return root.querySelector<HTMLElement>(matcher);
  const candidates = root.querySelectorAll<HTMLElement>('button, a, [role=button]');
  for (const c of Array.from(candidates)) {
    const t = (c.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (t && t.length < 60 && matcher.test(t)) return c;
  }
  return null;
}
