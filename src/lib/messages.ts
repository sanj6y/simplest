import type { KBEntry, KBKind } from './kb';

export interface FieldSummary {
  id: string;
  label: string;
  kind: string;
  options: string[];
  section: string;
  required: boolean;
}

export interface LLMAnswer {
  fieldId: string;
  key: string;
  question: string;
  answer: string;
  kind: KBKind;
  confidence: 'high' | 'medium' | 'low';
  needsUser: boolean;
  reason: string;
}

export type ClassifyRequest = {
  type: 'classify';
  fields: FieldSummary[];
  kb: Pick<KBEntry, 'key' | 'question' | 'answer' | 'kind' | 'skip'>[];
  profileSummary: string;
  pageTitle: string;
};

export type ClassifyResponse = { ok: true; answers: LLMAnswer[]; model: string } | { ok: false; error: string };

export type FillRequest = { type: 'fill' };
export type StatusRequest = { type: 'status' };
export type OpenOptionsRequest = { type: 'openOptions' };

export type Message = ClassifyRequest | FillRequest | StatusRequest | OpenOptionsRequest;

export interface FillReport {
  filled: number;
  skipped: number;
  unresolved: number;
  asked: number;
  errors: string[];
  usedModel: boolean;
  details: { label: string; outcome: string; source: string }[];
}
