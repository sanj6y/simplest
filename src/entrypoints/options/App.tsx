import { useEffect, useState } from 'react';
import { KBEntry, KBKind, toKey } from '../../lib/kb';
import { defaultProfile, Education, Profile, Work } from '../../lib/profile';
import {
  DEFAULT_MODEL,
  ExportBundle,
  Provider,
  Settings,
  StoredFile,
  exportAll,
  fileToStored,
  getCoverLetter,
  getKB,
  getProfile,
  getResume,
  getSettings,
  importAll,
  saveCoverLetter,
  saveKB,
  saveProfile,
  saveResume,
  saveSettings,
} from '../../lib/storage';

type Tab = 'profile' | 'education' | 'work' | 'documents' | 'eeo' | 'answers' | 'settings' | 'backup';

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'education', label: 'Education' },
  { id: 'work', label: 'Work experience' },
  { id: 'documents', label: 'Resume & skills' },
  { id: 'eeo', label: 'Voluntary disclosures' },
  { id: 'answers', label: 'Answers' },
  { id: 'settings', label: 'Settings' },
  { id: 'backup', label: 'Backup' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('profile');
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [kb, setKB] = useState<KBEntry[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [resume, setResume] = useState<StoredFile | null>(null);
  const [cover, setCover] = useState<StoredFile | null>(null);
  const [toast, setToast] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, k, s, r, c] = await Promise.all([getProfile(), getKB(), getSettings(), getResume(), getCoverLetter()]);
      setProfile(p);
      setKB(k);
      setSettings(s);
      setResume(r);
      setCover(c);
      setLoaded(true);
    })();
  }, []);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 1600);
  }

  async function save() {
    await saveProfile(profile);
    await saveKB(kb);
    if (settings) await saveSettings(settings);
    flash('Saved');
  }

  if (!loaded || !settings) return <div style={{ padding: 30 }}>Loading…</div>;

  const up = (patch: (p: Profile) => void) => {
    const next = structuredClone(profile);
    patch(next);
    setProfile(next);
  };

  return (
    <div className="layout">
      <nav>
        <h1>Simplest</h1>
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
        <div style={{ padding: 12 }}>
          <button className="btn primary" style={{ width: '100%' }} onClick={save}>
            Save
          </button>
        </div>
      </nav>
      <main>
        {tab === 'profile' && <ProfileTab profile={profile} up={up} />}
        {tab === 'education' && <EducationTab profile={profile} up={up} />}
        {tab === 'work' && <WorkTab profile={profile} up={up} />}
        {tab === 'documents' && (
          <DocumentsTab
            profile={profile}
            up={up}
            resume={resume}
            cover={cover}
            onResume={async (f) => {
              setResume(f);
              await saveResume(f);
              flash(f ? 'Resume saved' : 'Resume removed');
            }}
            onCover={async (f) => {
              setCover(f);
              await saveCoverLetter(f);
              flash(f ? 'Cover letter saved' : 'Cover letter removed');
            }}
          />
        )}
        {tab === 'eeo' && <EEOTab profile={profile} up={up} />}
        {tab === 'answers' && <AnswersTab kb={kb} setKB={setKB} />}
        {tab === 'settings' && <SettingsTab settings={settings} setSettings={setSettings} />}
        {tab === 'backup' && (
          <BackupTab
            onImported={async () => {
              const [p, k, s, r, c] = await Promise.all([getProfile(), getKB(), getSettings(), getResume(), getCoverLetter()]);
              setProfile(p);
              setKB(k);
              setSettings(s);
              setResume(r);
              setCover(c);
              flash('Imported');
            }}
          />
        )}
        <div style={{ marginTop: 20 }}>
          <button className="btn primary" onClick={save}>
            Save changes
          </button>
        </div>
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', hint, full, placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; hint?: string; full?: boolean; placeholder?: string }) {
  return (
    <label className={`f ${full ? 'full' : ''}`}>
      {label}
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

function Select({ label, value, onChange, options, full }: { label: string; value: string; onChange: (v: string) => void; options: string[]; full?: boolean }) {
  return (
    <label className={`f ${full ? 'full' : ''}`}>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— leave blank —</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

type UP = (patch: (p: Profile) => void) => void;

function ProfileTab({ profile, up }: { profile: Profile; up: UP }) {
  const p = profile.personal;
  const a = p.address;
  const l = profile.links;
  return (
    <>
      <h2>Profile</h2>
      <p className="lead">The basics every application asks for.</p>
      <div className="card">
        <div className="grid">
          <Field label="First name" value={p.firstName} onChange={(v) => up((x) => (x.personal.firstName = v))} />
          <Field label="Last name" value={p.lastName} onChange={(v) => up((x) => (x.personal.lastName = v))} />
          <Field label="Preferred name" value={p.preferredName} onChange={(v) => up((x) => (x.personal.preferredName = v))} hint="Optional" />
          <Field label="Email" type="email" value={p.email} onChange={(v) => up((x) => (x.personal.email = v))} />
          <Field label="Phone" type="tel" value={p.phone} onChange={(v) => up((x) => (x.personal.phone = v))} placeholder="2175550123" />
          <Field label="Phone country code" value={p.phoneCountryCode} onChange={(v) => up((x) => (x.personal.phoneCountryCode = v))} />
          <Field label="Date of birth" type="date" value={p.dateOfBirth} onChange={(v) => up((x) => (x.personal.dateOfBirth = v))} hint="Only filled when a form asks" />
        </div>
      </div>
      <div className="card">
        <div className="grid">
          <Field label="Street address" value={a.line1} onChange={(v) => up((x) => (x.personal.address.line1 = v))} full />
          <Field label="Apt / unit" value={a.line2} onChange={(v) => up((x) => (x.personal.address.line2 = v))} />
          <Field label="City" value={a.city} onChange={(v) => up((x) => (x.personal.address.city = v))} />
          <Field label="State" value={a.state} onChange={(v) => up((x) => (x.personal.address.state = v))} placeholder="Illinois" />
          <Field label="ZIP / postal code" value={a.postalCode} onChange={(v) => up((x) => (x.personal.address.postalCode = v))} />
          <Field label="Country" value={a.country} onChange={(v) => up((x) => (x.personal.address.country = v))} />
        </div>
      </div>
      <div className="card">
        <div className="grid">
          <Field label="LinkedIn URL" type="url" value={l.linkedin} onChange={(v) => up((x) => (x.links.linkedin = v))} />
          <Field label="GitHub URL" type="url" value={l.github} onChange={(v) => up((x) => (x.links.github = v))} />
          <Field label="Portfolio URL" type="url" value={l.portfolio} onChange={(v) => up((x) => (x.links.portfolio = v))} />
          <Field label="Personal website" type="url" value={l.website} onChange={(v) => up((x) => (x.links.website = v))} />
          <Field label="Other URL" type="url" value={l.other} onChange={(v) => up((x) => (x.links.other = v))} hint='Used for "Other website" fields' full />
        </div>
      </div>
    </>
  );
}

function EducationTab({ profile, up }: { profile: Profile; up: UP }) {
  const blank = (): Education => ({ school: '', degree: '', field: '', gpa: '', startDate: '', endDate: '', current: false, location: '' });
  return (
    <>
      <h2>Education</h2>
      <p className="lead">Most recent first. Dates are month + year.</p>
      {profile.education.map((e, i) => (
        <div className="item" key={i}>
          <div className="item-head">
            <span>{e.school || `School ${i + 1}`}</span>
            <div className="row">
              {i > 0 && (
                <button className="btn small" onClick={() => up((x) => x.education.splice(i - 1, 0, ...x.education.splice(i, 1)))}>
                  ↑
                </button>
              )}
              <button className="btn small danger" onClick={() => up((x) => x.education.splice(i, 1))}>
                Remove
              </button>
            </div>
          </div>
          <div className="grid">
            <Field label="School" value={e.school} onChange={(v) => up((x) => (x.education[i].school = v))} full placeholder="University of Illinois Urbana-Champaign" />
            <Field label="Degree" value={e.degree} onChange={(v) => up((x) => (x.education[i].degree = v))} placeholder="Bachelor of Science" />
            <Field label="Major / field of study" value={e.field} onChange={(v) => up((x) => (x.education[i].field = v))} placeholder="Computer Science" />
            <Field label="GPA" value={e.gpa} onChange={(v) => up((x) => (x.education[i].gpa = v))} placeholder="3.8" />
            <Field label="Location" value={e.location} onChange={(v) => up((x) => (x.education[i].location = v))} placeholder="Champaign, IL" />
            <Field label="Start" type="month" value={e.startDate} onChange={(v) => up((x) => (x.education[i].startDate = v))} />
            <Field label="End / expected graduation" type="month" value={e.endDate} onChange={(v) => up((x) => (x.education[i].endDate = v))} />
            <label className="check full">
              <input type="checkbox" checked={e.current} onChange={(ev) => up((x) => (x.education[i].current = ev.target.checked))} /> Currently attending
            </label>
          </div>
        </div>
      ))}
      <button className="btn" onClick={() => up((x) => x.education.push(blank()))}>
        + Add education
      </button>
    </>
  );
}

function WorkTab({ profile, up }: { profile: Profile; up: UP }) {
  const blank = (): Work => ({ company: '', title: '', location: '', startDate: '', endDate: '', current: false, description: '' });
  return (
    <>
      <h2>Work experience</h2>
      <p className="lead">Most recent first. Internships count.</p>
      {profile.work.map((w, i) => (
        <div className="item" key={i}>
          <div className="item-head">
            <span>{w.company ? `${w.title || 'Role'} · ${w.company}` : `Position ${i + 1}`}</span>
            <div className="row">
              {i > 0 && (
                <button className="btn small" onClick={() => up((x) => x.work.splice(i - 1, 0, ...x.work.splice(i, 1)))}>
                  ↑
                </button>
              )}
              <button className="btn small danger" onClick={() => up((x) => x.work.splice(i, 1))}>
                Remove
              </button>
            </div>
          </div>
          <div className="grid">
            <Field label="Company" value={w.company} onChange={(v) => up((x) => (x.work[i].company = v))} />
            <Field label="Title" value={w.title} onChange={(v) => up((x) => (x.work[i].title = v))} placeholder="Software Engineering Intern" />
            <Field label="Location" value={w.location} onChange={(v) => up((x) => (x.work[i].location = v))} />
            <div />
            <Field label="Start" type="month" value={w.startDate} onChange={(v) => up((x) => (x.work[i].startDate = v))} />
            <Field label="End" type="month" value={w.endDate} onChange={(v) => up((x) => (x.work[i].endDate = v))} hint="Leave blank if current" />
            <label className="check full">
              <input type="checkbox" checked={w.current} onChange={(ev) => up((x) => (x.work[i].current = ev.target.checked))} /> I currently work here
            </label>
            <label className="f full">
              Description
              <textarea value={w.description} onChange={(ev) => up((x) => (x.work[i].description = ev.target.value))} />
            </label>
          </div>
        </div>
      ))}
      <button className="btn" onClick={() => up((x) => x.work.push(blank()))}>
        + Add position
      </button>
    </>
  );
}

function FileBox({ label, file, onChange, accept }: { label: string; file: StoredFile | null; onChange: (f: StoredFile | null) => void; accept: string }) {
  return (
    <div className="card">
      <strong>{label}</strong>
      <div className="filebox" style={{ marginTop: 8 }}>
        {file ? (
          <>
            <span>
              {file.name} <span className="muted">({Math.round(file.size / 1024)} KB)</span>
            </span>
            <button className="btn small danger" onClick={() => onChange(null)}>
              Remove
            </button>
          </>
        ) : (
          <span className="muted">Nothing uploaded</span>
        )}
        <label className="btn small">
          {file ? 'Replace' : 'Upload'}
          <input
            type="file"
            accept={accept}
            style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) onChange(await fileToStored(f));
              e.target.value = '';
            }}
          />
        </label>
      </div>
    </div>
  );
}

function DocumentsTab({ profile, up, resume, cover, onResume, onCover }: { profile: Profile; up: UP; resume: StoredFile | null; cover: StoredFile | null; onResume: (f: StoredFile | null) => void; onCover: (f: StoredFile | null) => void }) {
  return (
    <>
      <h2>Resume & skills</h2>
      <p className="lead">Files are stored locally in the extension and attached to any file input labelled resume / cover letter.</p>
      <FileBox label="Resume" file={resume} onChange={onResume} accept=".pdf,.doc,.docx" />
      <FileBox label="Cover letter (optional)" file={cover} onChange={onCover} accept=".pdf,.doc,.docx" />
      <div className="card">
        <label className="f">
          Skills (comma separated)
          <textarea value={profile.skills.join(', ')} onChange={(e) => up((x) => (x.skills = e.target.value.split(',').map((s) => s.trim()).filter(Boolean)))} placeholder="Python, TypeScript, React, SQL" />
        </label>
      </div>
    </>
  );
}

function EEOTab({ profile, up }: { profile: Profile; up: UP }) {
  const e = profile.eeo;
  return (
    <>
      <h2>Voluntary disclosures</h2>
      <p className="lead">Type the answer you want picked. Matching is fuzzy, so "Asian" will select "Asian (Not Hispanic or Latino)". Leave blank to leave the question untouched.</p>
      <div className="card">
        <div className="grid">
          <Select label="Gender" value={e.gender} onChange={(v) => up((x) => (x.eeo.gender = v))} options={['Male', 'Female', 'Non-binary', 'Decline to self-identify']} />
          <Select label="Hispanic or Latino?" value={e.hispanicLatino} onChange={(v) => up((x) => (x.eeo.hispanicLatino = v))} options={['Yes', 'No', 'Decline to self-identify']} />
          <Field label="Race / ethnicity" value={e.race} onChange={(v) => up((x) => (x.eeo.race = v))} hint="e.g. Asian, White, Black or African American, Two or more races, Decline to self-identify" full />
          <Field label="Veteran status" value={e.veteran} onChange={(v) => up((x) => (x.eeo.veteran = v))} full />
          <Field label="Disability status" value={e.disability} onChange={(v) => up((x) => (x.eeo.disability = v))} full />
          <Field label="Sexual orientation" value={e.sexualOrientation} onChange={(v) => up((x) => (x.eeo.sexualOrientation = v))} hint="Optional" />
          <Field label="Transgender?" value={e.transgender} onChange={(v) => up((x) => (x.eeo.transgender = v))} hint="Optional, e.g. No" />
          <Field label="Pronouns" value={e.pronouns} onChange={(v) => up((x) => (x.eeo.pronouns = v))} hint="Optional, e.g. he/him" />
        </div>
      </div>
    </>
  );
}

const KINDS: KBKind[] = ['yesno', 'agree', 'choice', 'text'];

function AnswersTab({ kb, setKB }: { kb: KBEntry[]; setKB: (k: KBEntry[]) => void }) {
  const [filter, setFilter] = useState('');
  const [newQ, setNewQ] = useState('');
  const [newA, setNewA] = useState('');
  const update = (i: number, patch: Partial<KBEntry>) => {
    const next = kb.map((e, j) => (j === i ? { ...e, ...patch } : e));
    setKB(next);
  };
  const visible = kb.map((e, i) => ({ e, i })).filter(({ e }) => !filter || `${e.key} ${e.question} ${e.answer}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <>
      <h2>Answers</h2>
      <p className="lead">
        The questions that are not in your profile. Blank answers get asked once on the page and remembered. Use <code>|</code> for dropdown fallbacks (<code>LinkedIn | Job board</code>) and tokens like <code>{'{{fullName}}'}</code>, <code>{'{{today}}'}</code>, <code>{'{{location}}'}</code>.
      </p>
      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <input type="text" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 260 }} />
          <span className="muted">{kb.filter((e) => e.answer).length} answered · {kb.filter((e) => !e.answer && !e.skip).length} blank</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '38%' }}>Question</th>
              <th>Answer</th>
              <th style={{ width: 90 }}>Kind</th>
              <th style={{ width: 60 }}>Skip</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ e, i }) => (
              <tr key={e.key}>
                <td>
                  <div>{e.question}</div>
                  <div className="muted">{e.key}</div>
                  {e.aliases.slice(0, 4).map((a) => (
                    <span className="tag" key={a} title={a}>
                      {a.length > 40 ? a.slice(0, 40) + '…' : a}
                    </span>
                  ))}
                  {e.aliases.length > 4 && <span className="tag">+{e.aliases.length - 4}</span>}
                </td>
                <td>
                  <input type="text" value={e.answer} placeholder={e.skip ? 'never filled' : 'ask me once'} onChange={(ev) => update(i, { answer: ev.target.value })} />
                </td>
                <td>
                  <select value={e.kind} onChange={(ev) => update(i, { kind: ev.target.value as KBKind })}>
                    {KINDS.map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input type="checkbox" checked={!!e.skip} onChange={(ev) => update(i, { skip: ev.target.checked })} />
                </td>
                <td>
                  {!e.builtin && (
                    <button className="btn small danger" onClick={() => setKB(kb.filter((_, j) => j !== i))}>
                      ×
                    </button>
                  )}
                  {e.builtin && e.aliases.length > 0 && (
                    <button className="btn small" title="Forget learned phrasings" onClick={() => update(i, { aliases: [] })}>
                      ↺
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <strong>Add a question</strong>
        <div className="grid" style={{ marginTop: 8 }}>
          <Field label="Question (as it appears on forms)" value={newQ} onChange={setNewQ} />
          <Field label="Answer" value={newA} onChange={setNewA} />
        </div>
        <button
          className="btn"
          style={{ marginTop: 10 }}
          disabled={!newQ}
          onClick={() => {
            const key = toKey(newQ);
            if (kb.some((e) => e.key === key)) return;
            setKB([...kb, { key, question: newQ, answer: newA, kind: /^(yes|no)$/i.test(newA) ? 'yesno' : 'text', patterns: [], aliases: [newQ.toLowerCase().replace(/[*:]+/g, ' ').replace(/\s+/g, ' ').trim()] }]);
            setNewQ('');
            setNewA('');
          }}
        >
          Add
        </button>
      </div>
    </>
  );
}

function SettingsTab({ settings, setSettings }: { settings: Settings; setSettings: (s: Settings) => void }) {
  const provider = settings.provider ?? 'openai';
  const keyHint =
    provider === 'openai'
      ? 'Stored locally in the extension. Create one at platform.openai.com/api-keys'
      : 'Stored locally in the extension. Create one at console.anthropic.com';
  const setProvider = (p: Provider) => {
    const wasDefault = !settings.model || settings.model === DEFAULT_MODEL[provider];
    setSettings({ ...settings, provider: p, model: wasDefault ? DEFAULT_MODEL[p] : settings.model });
  };
  return (
    <>
      <h2>Settings</h2>
      <p className="lead">Only field labels, dropdown options, your saved answers, and a PII-free profile summary are sent to the model. Name, email, phone, and address never leave the browser.</p>
      <div className="card">
        <div className="grid">
          <Select label="Model provider" value={provider} onChange={(v) => setProvider((v || 'openai') as Provider)} options={['openai', 'anthropic']} />
          <Field label="Model" value={settings.model} onChange={(v) => setSettings({ ...settings, model: v.trim() })} hint={`Default: ${DEFAULT_MODEL[provider]}`} />
          <Field label={provider === 'openai' ? 'OpenAI API key' : 'Anthropic API key'} type="password" value={settings.apiKey} onChange={(v) => setSettings({ ...settings, apiKey: v.trim() })} hint={keyHint} full />
        </div>
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="check">
            <input type="checkbox" checked={settings.useModel} onChange={(e) => setSettings({ ...settings, useModel: e.target.checked })} /> Ask the model about questions the rules and saved answers cannot handle
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.overwriteExisting} onChange={(e) => setSettings({ ...settings, overwriteExisting: e.target.checked })} /> Overwrite fields that already have a value
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.showFloatingButton} onChange={(e) => setSettings({ ...settings, showFloatingButton: e.target.checked })} /> Show the floating Fill button on pages that look like applications
          </label>
        </div>
      </div>
    </>
  );
}

function BackupTab({ onImported }: { onImported: () => void }) {
  const [err, setErr] = useState('');
  async function download() {
    const bundle = await exportAll();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simplest-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <h2>Backup</h2>
      <p className="lead">Export everything (except the API key) to a JSON file, or restore from one.</p>
      <div className="card row">
        <button className="btn" onClick={download}>
          Export JSON
        </button>
        <label className="btn">
          Import JSON
          <input
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const bundle = JSON.parse(await f.text()) as ExportBundle;
                if (bundle.version !== 1) throw new Error('Unknown backup version');
                await importAll(bundle);
                onImported();
              } catch (ex) {
                setErr((ex as Error).message);
              }
              e.target.value = '';
            }}
          />
        </label>
        {err && <span style={{ color: '#b91c1c' }}>{err}</span>}
      </div>
    </>
  );
}
