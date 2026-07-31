import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import { EMPTY_LEAD_PROFILE, type ChatMessage, type LeadProfile } from '@/lib/types';

/**
 * The opening line, shown whenever there is no stored transcript. Raw HTML
 * rather than markdown, which is why the renderer needs `rehype-raw`.
 */
export const WELCOME_MESSAGE =
  "<p>Hi! I'm the Solar Vipani assistant. Ask me anything about going solar — costs, subsidies, system sizing, or brands.</p>";

/**
 * Backend `context.updates` key → `LeadProfile` field.
 *
 * The server names some of these differently from the profile it receives back,
 * so this map is the only thing keeping the two in sync. A key that is missing
 * here is silently forgotten, and the agent goes on asking the customer for a
 * detail they have already given — hence the dev warning below.
 */
export const CONTEXT_TO_PROFILE: Record<string, keyof LeadProfile> = {
  name: 'name',
  location: 'location',
  propertyType: 'propertyType',
  roofType: 'roofType',
  monthlyElectricityBill: 'monthlyBill',
  electricityConsumption: 'monthlyConsumption',
  budgetRange: 'budgetRange',
  timeline: 'timeline',
  hasDocuments: 'hasDocuments',
  activeObjective: 'activeObjective',
};

/** localStorage keys, shared verbatim with the Svelte app — see `chatStorage`. */
export const MESSAGES_KEY = 'chatMessages';
export const PROFILE_KEY = 'leadProfile';
export const VOICE_KEY = 'chatVoiceOutput';

export interface ChatState {
  messages: ChatMessage[];
  leadProfile: LeadProfile;
  /** A turn is in flight: the request is open but nothing has come back yet. */
  isLoading: boolean;
  /** Deltas are arriving. Distinct from `isLoading` so the UI can swap the
   * typing indicator for the growing reply. */
  isStreaming: boolean;
  /** A persisted mode, not a per-message action: replies are read aloud. */
  voiceOutputEnabled: boolean;

  appendMessage: (message: ChatMessage) => void;
  /** Merge a patch into the last message. No-op on an empty transcript. */
  patchLastMessage: (patch: Partial<ChatMessage>) => void;
  removeMessageAt: (index: number) => void;
  /** Drop `index` and everything after it. */
  truncateFrom: (index: number) => void;
  setLeadProfile: (updates: Partial<LeadProfile>) => void;
  applyContextUpdates: (updates: Record<string, unknown>) => void;
  setLoading: (isLoading: boolean) => void;
  setStreaming: (isStreaming: boolean) => void;
  setVoiceOutputEnabled: (enabled: boolean) => void;
  /** Replace the transcript with the welcome message. */
  greet: () => void;
  /** Back to a fresh conversation: empty profile, welcome message, flags down. */
  reset: () => void;
}

type PersistedState = Pick<ChatState, 'messages' | 'leadProfile' | 'voiceOutputEnabled'>;

function readJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // A corrupt entry must not take the whole app down on boot.
    console.warn(`[chatStore] discarding unparseable localStorage entry "${key}"`);
    return null;
  }
}

/**
 * Persistence in the Svelte app's on-disk format: three separate keys holding
 * bare values, with the voice toggle as `"1"` / `"0"`. The middleware would
 * otherwise write a single key wrapping everything in a `{ state, version }`
 * envelope, which a session started in the Svelte app could not be read from —
 * carrying a transcript across the two implementations is the whole point.
 */
export const chatStorage: PersistStorage<PersistedState> = {
  getItem: () => {
    const messages = readJson<ChatMessage[]>(MESSAGES_KEY);
    const leadProfile = readJson<LeadProfile>(PROFILE_KEY);
    const voice = localStorage.getItem(VOICE_KEY);
    if (messages === null && leadProfile === null && voice === null) return null;

    return {
      state: {
        messages: Array.isArray(messages) ? messages : [],
        // Spread over the empty profile so a stored profile written before a
        // field existed still comes back complete.
        leadProfile: { ...EMPTY_LEAD_PROFILE, ...leadProfile },
        voiceOutputEnabled: voice === '1',
      },
    };
  },
  setItem: (_name, { state }) => {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(state.messages));
    localStorage.setItem(PROFILE_KEY, JSON.stringify(state.leadProfile));
    localStorage.setItem(VOICE_KEY, state.voiceOutputEnabled ? '1' : '0');
  },
  removeItem: () => {
    localStorage.removeItem(MESSAGES_KEY);
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(VOICE_KEY);
  },
};

function welcomeMessage(): ChatMessage {
  return { role: 'assistant', content: WELCOME_MESSAGE, timestamp: Date.now() };
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      leadProfile: EMPTY_LEAD_PROFILE,
      isLoading: false,
      isStreaming: false,
      voiceOutputEnabled: false,

      appendMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),

      patchLastMessage: (patch) =>
        set((s) => {
          if (s.messages.length === 0) return s;
          const messages = s.messages.slice();
          messages[messages.length - 1] = { ...messages[messages.length - 1], ...patch };
          return { messages };
        }),

      removeMessageAt: (index) =>
        set((s) => ({ messages: s.messages.filter((_, i) => i !== index) })),

      truncateFrom: (index) => set((s) => ({ messages: s.messages.slice(0, index) })),

      setLeadProfile: (updates) =>
        set((s) => ({ leadProfile: { ...s.leadProfile, ...updates } })),

      applyContextUpdates: (updates) => {
        const patch: Partial<LeadProfile> = {};

        for (const [key, value] of Object.entries(updates)) {
          const field = CONTEXT_TO_PROFILE[key];
          if (!field) {
            if (import.meta.env?.DEV) {
              console.warn(
                `[chatStore] unmapped context key "${key}" — add it to CONTEXT_TO_PROFILE or the agent will keep asking for it`,
              );
            }
            continue;
          }
          // `false` is a real answer for hasDocuments, so only absent values are
          // skipped. Anything already known stays put rather than being blanked.
          if (value === null || value === undefined || value === '') continue;
          patch[field] = value as never;
        }

        if (Object.keys(patch).length > 0) get().setLeadProfile(patch);
      },

      setLoading: (isLoading) => set({ isLoading }),
      setStreaming: (isStreaming) => set({ isStreaming }),
      setVoiceOutputEnabled: (voiceOutputEnabled) => set({ voiceOutputEnabled }),

      greet: () => set({ messages: [welcomeMessage()] }),

      reset: () =>
        set({
          messages: [welcomeMessage()],
          leadProfile: EMPTY_LEAD_PROFILE,
          isLoading: false,
          isStreaming: false,
        }),
    }),
    {
      name: 'solar-chat',
      storage: chatStorage,
      // The transient flags describe a request in flight; restoring them would
      // leave a reloaded page stuck showing a typing indicator forever.
      partialize: ({ messages, leadProfile, voiceOutputEnabled }) => ({
        messages,
        leadProfile,
        voiceOutputEnabled,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.messages.length === 0) state.greet();
      },
    },
  ),
);
