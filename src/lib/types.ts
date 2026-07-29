/** A citation attached to an assistant reply, from the backend's retrieval metadata. */
export interface Source {
  title: string;
  url: string;
}

export interface MessageIntent {
  intent: string;
  journeyStage: string;
  confidence: number;
}

export interface MessageUsage {
  input: number;
  output: number;
  total: number;
  costINR: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  /** A failed turn. Renders the error state and offers Retry. */
  error?: boolean;
  /** On error messages only: the text to resend when Retry is pressed. */
  userMessage?: string;
  /** The user aborted mid-stream. The partial reply is kept. */
  stopped?: boolean;
  sources?: Source[];
  toolExecuted?: string;
  toolResult?: unknown;
  intent?: MessageIntent;
  usage?: MessageUsage;
}

/**
 * Everything the agent has collected about the customer so far. Sent up in full
 * on every turn: the server folds it into the system prompt, and the LLM is
 * stateless per request, so nothing carries over on its own.
 */
export interface LeadProfile {
  name: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  pincode: string | null;
  propertyType: string | null;
  propertySubtype: string | null;
  roofType: string | null;
  monthlyConsumption: number | string | null;
  monthlyBill: number | string | null;
  powerCutHours: number | string | null;
  budgetRange: string | null;
  timeline: string | null;
  hasDocuments: boolean | null;
  recommendedSystemSize: number | string | null;
  systemType: string | null;
  systemCost: number | string | null;
  subsidyAmount: number | string | null;
  netInvestment: number | string | null;
  /**
   * The conversation's slot-filling objective, set by the server and echoed back
   * each turn so the set of details it asks for stays stable.
   */
  activeObjective: string | null;
}

export const EMPTY_LEAD_PROFILE: LeadProfile = {
  name: null,
  phone: null,
  email: null,
  location: null,
  pincode: null,
  propertyType: null,
  propertySubtype: null,
  roofType: null,
  monthlyConsumption: null,
  monthlyBill: null,
  powerCutHours: null,
  budgetRange: null,
  timeline: null,
  hasDocuments: null,
  recommendedSystemSize: null,
  systemType: null,
  systemCost: null,
  subsidyAmount: null,
  netInvestment: null,
  activeObjective: null,
};

/** One `{ role, content }` pair as sent in the `history` array. */
export interface HistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * A parsed but not yet recognised NDJSON line. Only `type` is guaranteed; every
 * other field is whatever the server sent.
 */
export interface RawStreamEvent {
  type: string;
  [key: string]: unknown;
}

/**
 * One event off the `/api/chatbot` NDJSON stream.
 *
 * `intent`, `context` and `questions` can arrive before the first `delta`, so a
 * consumer has to buffer them; `sources` and `usage` arrive after the last one.
 * Only `delta` is required for a usable UI.
 */
export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'intent'; label: string; stage: string; confidence: number }
  | { type: 'context'; updates: Record<string, unknown> }
  | { type: 'questions'; objective?: string; items?: unknown[]; slots?: unknown[] }
  | { type: 'tool'; name: string; result: unknown }
  | { type: 'workflow'; name: string; eventId: string; status: string }
  | { type: 'sources'; items: Source[] }
  | { type: 'usage'; input: number; output: number; total: number; costINR: number }
  | { type: 'done' }
  | { type: 'error'; message?: string }
  /**
   * An event type this client does not know. Passed through rather than dropped
   * so the backend can start emitting something new without breaking us, and
   * given its own discriminant so narrowing the members above stays exact — a
   * bare `{ type: string }` catch-all would strip the fields off all of them.
   */
  | { type: 'unrecognised'; raw: RawStreamEvent };

/** The event types this client understands, used to route a parsed line. */
const KNOWN_EVENT_TYPES = new Set([
  'delta',
  'intent',
  'context',
  'questions',
  'tool',
  'workflow',
  'sources',
  'usage',
  'done',
  'error',
]);

export function isKnownEventType(type: string): boolean {
  return KNOWN_EVENT_TYPES.has(type);
}
