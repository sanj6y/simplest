# Simplest

A Chrome extension that autofills job applications. Simplify doesn't fill the questions your profile doesn't cover: "Are you related to a government official?", "Will you require sponsorship?", so it gets
annoying.

It does what Simplify does (name, email, phone, links, education, work history, resume upload, skills, voluntary disclosures) and adds a knowledge base of question-answer pairs that learns as you apply.

## How a field gets filled

1. **Rules.** Deterministic matching on the field's label, name, id, placeholder and autocomplete attribute for profile data: names, contact info, address, LinkedIn / GitHub / portfolio, school, degree, major, GPA, dates, company, title, resume / cover letter file inputs, and the EEO fields.
2. **Knowledge base.** Everything else is matched against canonical questions (`requires_sponsorship`, `related_to_government_official`, `how_heard`, `acknowledge_ai_use`, `agree_terms`, `over_18`, ...) using regex patterns plus phrasings learned on earlier applications. Answers can use `|` fallbacks for dropdowns (`LinkedIn | Job board | Other`) and `{{tokens}}` (`{{fullName}}`, `{{today}}`, `{{location}}`).
3. **Model.** Whatever is still unresolved goes to a GPT model (OpenAI, default `gpt-5-mini`) in one batched call with the field labels, their dropdown options, your knowledge base, and a PII-free profile summary. It maps each field to an existing or new key and picks the option. The mapping is saved, so the same question is free and deterministic next time. Claude (Anthropic) is available as an alternative provider in Settings.
4. **Ask once.** If the answer depends on something the extension does not know (salary, start date, an essay), a panel on the page asks you, saves the answer, and fills the field.

Nothing is submitted automatically. You review and click submit yourself.

## Setup

```bash
pnpm install
pnpm build
```

Then in Chrome: `chrome://extensions` → enable Developer mode → Load unpacked → pick `.output/chrome-mv3`.

The options page opens on first install. Fill in your profile, upload a resume, set your voluntary-disclosure answers, review the Answers tab, and optionally paste an OpenAI API key in Settings so unknown questions go to the model instead of to you. Create a key at https://platform.openai.com/api-keys (pay-as-you-go; a fill that hits the model costs a fraction of a cent, and most fields never reach it). You can change the model string in Settings, or switch the provider to Anthropic and use a Claude model instead.

Without an API key everything still works: the rules and knowledge base fill what they can and the panel asks you for the rest.

For development, `pnpm dev` runs WXT with hot reload and opens a Chrome profile with the extension loaded.

## Using it

On an application page, click the floating **Fill with Simplest** button (it appears on pages that look like application forms) or the toolbar icon → **Fill this page**. A panel shows what was filled, what was skipped, and any questions that need you.

Site adapters exist for Greenhouse, Lever, Ashby and Workday (mostly for "add another education / job" buttons and dropdown timing); everything else uses the generic engine.

## Layout

```
src/
  entrypoints/
    background.ts        # model call (OpenAI chat completions or Claude, structured JSON output)
    content.ts           # floating button, runs the engine in the page
    options/             # profile, education, work, resume, EEO, answers, settings, backup
    popup/               # "Fill this page"
  lib/
    profile.ts           # zod schema + template tokens + PII-free summary
    kb.ts                # canonical questions, patterns, learning
    scan.ts              # DOM -> Field[] with labels, options, section headings
    rules.ts             # tier 1: profile rules
    options.ts           # fuzzy option picking (yes/no, EEO wording, countries, degrees, months)
    fill.ts              # React-safe value setting, selects, radios, checkboxes, comboboxes, file inputs
    engine.ts            # orchestrator: rules -> kb -> model -> ask
    adapters/            # per-ATS hooks
    ui.ts                # in-page shadow-DOM UI
tests/                   # vitest + jsdom
```

```bash
pnpm test        # unit tests
pnpm typecheck
```

## Privacy

Profile, resume, knowledge base and API key live in `chrome.storage.local`. Only field labels, dropdown options, your saved answers and a summary without name / email / phone / address are sent to the model provider, and only when a field could not be resolved locally.
