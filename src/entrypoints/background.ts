import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { ClassifyRequest, ClassifyResponse, Message } from '../lib/messages';
import { DEFAULT_MODEL, getSettings, Settings } from '../lib/storage';

const AnswerSchema = z.object({
  answers: z.array(
    z.object({
      fieldId: z.string(),
      key: z.string().describe('snake_case canonical key; reuse an existing knowledge-base key when the question means the same thing'),
      question: z.string().describe('short canonical phrasing of the question'),
      answer: z.string().describe('text to fill, or the exact option text to select; empty when needsUser is true'),
      kind: z.enum(['yesno', 'agree', 'choice', 'text']),
      confidence: z.enum(['high', 'medium', 'low']),
      needsUser: z.boolean().describe('true when the answer depends on facts not in the knowledge base or profile'),
      reason: z.string().describe('one short sentence'),
    }),
  ),
});

const SYSTEM = `You fill out job application forms on behalf of one applicant.

You receive the applicant's knowledge base (canonical questions with their saved answers), a short PII-free profile summary, and a list of form fields (label, control type, options if any, section heading). For every field return one entry.

Rules:
- Reuse an existing knowledge-base key whenever the field asks the same thing in different words. Otherwise invent a concise snake_case key.
- If the knowledge base has an answer for that key, use it. When the field has options, pick the option whose text best matches and return that exact option text as the answer.
- For acknowledgements, certifications, consents, privacy/terms agreements, and "we may use AI in hiring" notices, the answer is Yes / the affirmative option.
- For "how did you hear about us" style questions, answer LinkedIn, or the closest option (e.g. "Job board", "Social media", "Online", "Other").
- Questions whose answer is a fact or preference you do not have (salary expectations, start dates, specific certifications, security clearance details, whether they hold a specific license, essay questions, cover letter text, "why do you want to work here") must be returned with needsUser=true and an empty answer. Never guess personal facts.
- Do not answer with anything that is not supported by the knowledge base or profile summary. When unsure, needsUser=true.
- kind: yesno for yes/no questions, agree for consent checkboxes, choice for dropdowns/radios with options, text otherwise.
- confidence: high when the knowledge base directly covers it, medium when you inferred it from a closely related entry, low otherwise.`;

function buildUserMessage(req: ClassifyRequest): string {
  const kbText = req.kb
    .map((e) => `- ${e.key} [${e.kind}${e.skip ? ', SKIP: never answer' : ''}]: "${e.question}" -> ${e.answer ? JSON.stringify(e.answer) : '(no answer saved)'}`)
    .join('\n');
  const fieldsText = req.fields
    .map((f) => {
      const opts = f.options.length ? `\n  options: ${f.options.map((o) => JSON.stringify(o)).join(', ')}` : '';
      return `- id=${f.id} kind=${f.kind}${f.required ? ' required' : ''}${f.section ? ` section="${f.section}"` : ''}\n  label: ${JSON.stringify(f.label)}${opts}`;
    })
    .join('\n');
  return `Page: ${req.pageTitle}\n\nApplicant profile summary:\n${req.profileSummary || '(none)'}\n\nKnowledge base:\n${kbText}\n\nFields:\n${fieldsText}`;
}

/** JSON schema for OpenAI structured outputs (strict mode). zod already emits additionalProperties:false + required. */
function openAISchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(AnswerSchema) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

async function classifyOpenAI(req: ClassifyRequest, settings: Settings): Promise<ClassifyResponse> {
  const model = settings.model || DEFAULT_MODEL.openai;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildUserMessage(req) },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'application_answers', strict: true, schema: openAISchema() } },
    }),
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const err = (await res.json()) as { error?: { message?: string } };
      if (err.error?.message) detail = err.error.message;
    } catch {
      /* ignore */
    }
    if (res.status === 401) return { ok: false, error: 'Invalid OpenAI API key.' };
    if (res.status === 429) return { ok: false, error: `OpenAI rate limit / quota: ${detail}` };
    return { ok: false, error: `OpenAI error: ${detail}` };
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string | null; refusal?: string | null } }[] };
  const msg = data.choices?.[0]?.message;
  if (msg?.refusal) return { ok: false, error: `The model declined: ${msg.refusal}` };
  if (!msg?.content) return { ok: false, error: 'Empty response from OpenAI.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(msg.content);
  } catch {
    return { ok: false, error: 'OpenAI returned invalid JSON.' };
  }
  const result = AnswerSchema.safeParse(parsed);
  if (!result.success) return { ok: false, error: 'OpenAI response did not match the expected shape.' };
  return { ok: true, answers: result.data.answers, model };
}

async function classifyAnthropic(req: ClassifyRequest, settings: Settings): Promise<ClassifyResponse> {
  const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
  const model = settings.model || DEFAULT_MODEL.anthropic;
  try {
    const response = await client.messages.parse({
      model,
      max_tokens: 16000,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      output_config: { effort: 'medium', format: zodOutputFormat(AnswerSchema) },
      messages: [{ role: 'user', content: buildUserMessage(req) }],
    });
    if (response.stop_reason === 'refusal') return { ok: false, error: 'The model declined this request.' };
    const parsed = response.parsed_output;
    if (!parsed) return { ok: false, error: 'Could not parse the model response.' };
    return { ok: true, answers: parsed.answers, model };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, error: 'Invalid Anthropic API key.' };
    if (e instanceof Anthropic.RateLimitError) return { ok: false, error: 'Rate limited, try again in a moment.' };
    if (e instanceof Anthropic.APIError) return { ok: false, error: `API error ${e.status}: ${e.message}` };
    return { ok: false, error: (e as Error).message };
  }
}

async function classify(req: ClassifyRequest): Promise<ClassifyResponse> {
  const settings = await getSettings();
  if (!settings.apiKey) return { ok: false, error: 'No API key set. Open Simplest options and add your API key under Settings.' };
  try {
    return settings.provider === 'anthropic' ? await classifyAnthropic(req, settings) : await classifyOpenAI(req, settings);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
    if (msg?.type === 'classify') {
      classify(msg).then(sendResponse, (e: Error) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
    if (msg?.type === 'openOptions') {
      browser.runtime.openOptionsPage();
      sendResponse({ ok: true });
      return false;
    }
    return false;
  });

  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') browser.runtime.openOptionsPage();
  });
});
