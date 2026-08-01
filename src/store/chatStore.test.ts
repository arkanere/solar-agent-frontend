import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_LEAD_PROFILE, type ChatMessage } from '@/lib/types';

const MESSAGES_KEY = 'chatMessages';
const PROFILE_KEY = 'leadProfile';
const VOICE_KEY = 'chatVoiceOutput';

/**
 * A fresh module instance per scenario.
 *
 * `persist` rehydrates once, at import time, so every test that cares about what
 * was already in localStorage has to seed it and *then* import. `resetModules`
 * is what makes that possible.
 */
async function freshStore() {
  vi.resetModules();
  return await import('@/store/chatStore');
}

const message = (over: Partial<ChatMessage> = {}): ChatMessage => ({
  role: 'user',
  content: 'hello',
  timestamp: 1,
  ...over,
});

beforeEach(() => localStorage.clear());
afterEach(() => vi.resetModules());

describe('cold start', () => {
  it('seeds the welcome message and writes all three keys', async () => {
    const { useChatStore, WELCOME_MESSAGE } = await freshStore();
    const state = useChatStore.getState();

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({
      role: 'assistant',
      content: WELCOME_MESSAGE,
    });
    expect(localStorage.getItem(MESSAGES_KEY)).toContain('Solar Vipani assistant');
    expect(localStorage.getItem(PROFILE_KEY)).toBeTruthy();
    expect(localStorage.getItem(VOICE_KEY)).toBe('0');
  });

  it('does not seed a greeting over a stored transcript', async () => {
    localStorage.setItem(
      MESSAGES_KEY,
      JSON.stringify([message({ role: 'user', content: 'Stored question' })]),
    );
    const { useChatStore } = await freshStore();
    expect(useChatStore.getState().messages).toEqual([
      { role: 'user', content: 'Stored question', timestamp: 1 },
    ]);
  });

  it('falls back to the greeting when the stored transcript is corrupt', async () => {
    localStorage.setItem(MESSAGES_KEY, '{ not json');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { useChatStore, WELCOME_MESSAGE } = await freshStore();
    expect(useChatStore.getState().messages[0].content).toBe(WELCOME_MESSAGE);
  });

  it('spreads a stored profile over the empty one, so new fields come back', async () => {
    // A profile written before `pincode` existed.
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: 'Asha' }));
    const { useChatStore } = await freshStore();
    const profile = useChatStore.getState().leadProfile;
    expect(profile.name).toBe('Asha');
    expect(Object.keys(profile).sort()).toEqual(Object.keys(EMPTY_LEAD_PROFILE).sort());
    expect(profile.pincode).toBeNull();
  });

  it('reads the voice toggle back as a boolean', async () => {
    localStorage.setItem(VOICE_KEY, '1');
    const { useChatStore } = await freshStore();
    expect(useChatStore.getState().voiceOutputEnabled).toBe(true);
  });
});

describe('message actions', () => {
  it('appends, patches, removes and truncates', async () => {
    const { useChatStore } = await freshStore();
    const store = useChatStore.getState();
    store.reset();

    store.appendMessage(message({ role: 'user', content: 'one' }));
    store.appendMessage(message({ role: 'assistant', content: 'two' }));
    expect(useChatStore.getState().messages.map((m) => m.content)).toEqual([
      expect.stringContaining('Solar Vipani assistant'),
      'one',
      'two',
    ]);

    // A patch merges: fields it does not mention are left alone.
    store.patchLastMessage({ stopped: true });
    store.patchLastMessage({ content: 'two (edited)' });
    const last = useChatStore.getState().messages.at(-1)!;
    expect(last).toMatchObject({ content: 'two (edited)', stopped: true });

    store.removeMessageAt(1);
    expect(useChatStore.getState().messages.map((m) => m.content)).toEqual([
      expect.stringContaining('Solar Vipani assistant'),
      'two (edited)',
    ]);

    store.truncateFrom(1);
    expect(useChatStore.getState().messages).toHaveLength(1);
  });

  it('treats a patch on an empty transcript as a no-op', async () => {
    const { useChatStore } = await freshStore();
    useChatStore.setState({ messages: [] });
    useChatStore.getState().patchLastMessage({ content: 'nothing to patch' });
    expect(useChatStore.getState().messages).toEqual([]);
  });
});

describe('applyContextUpdates', () => {
  it('maps backend keys onto profile fields', async () => {
    const { useChatStore } = await freshStore();
    useChatStore.getState().applyContextUpdates({
      name: 'Asha',
      monthlyElectricityBill: 4500,
      electricityConsumption: 450,
      activeObjective: 'solar_assessment',
    });

    expect(useChatStore.getState().leadProfile).toMatchObject({
      name: 'Asha',
      monthlyBill: 4500,
      monthlyConsumption: 450,
      activeObjective: 'solar_assessment',
    });
  });

  it('keeps `hasDocuments: false` — false is a real answer', async () => {
    const { useChatStore } = await freshStore();
    useChatStore.getState().applyContextUpdates({ hasDocuments: false });
    expect(useChatStore.getState().leadProfile.hasDocuments).toBe(false);
  });

  it('skips null, undefined and empty string without blanking what is known', async () => {
    const { useChatStore } = await freshStore();
    useChatStore.getState().applyContextUpdates({ name: 'Asha', location: 'Kochi' });
    useChatStore.getState().applyContextUpdates({
      name: null,
      location: '',
      roofType: undefined,
    });

    expect(useChatStore.getState().leadProfile).toMatchObject({
      name: 'Asha',
      location: 'Kochi',
      roofType: null,
    });
  });

  it('drops an unmapped key and warns about it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { useChatStore } = await freshStore();
    useChatStore.getState().applyContextUpdates({ favouriteColour: 'orange' });

    expect(useChatStore.getState().leadProfile).toEqual(EMPTY_LEAD_PROFILE);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('favouriteColour'));
  });
});

describe('persistence', () => {
  it('writes only the three Svelte keys, and no transient flags', async () => {
    const { useChatStore } = await freshStore();
    useChatStore.getState().setLoading(true);
    useChatStore.getState().setStreaming(true);
    useChatStore.getState().setLeadProfile({ name: 'Asha' });

    expect(Object.keys(localStorage).sort()).toEqual(
      [MESSAGES_KEY, PROFILE_KEY, VOICE_KEY].sort(),
    );
    const written = localStorage.getItem(PROFILE_KEY)!;
    expect(written).toContain('Asha');
    expect(Object.keys(localStorage).join()).not.toContain('solar-chat');
    expect(localStorage.getItem(MESSAGES_KEY)).not.toContain('isLoading');
  });

  it('round-trips a transcript through a reload', async () => {
    const first = await freshStore();
    first.useChatStore.getState().appendMessage(message({ content: 'Carried over' }));
    first.useChatStore.getState().setVoiceOutputEnabled(true);

    // A fresh import is a page reload as far as the store is concerned.
    const second = await freshStore();
    expect(second.useChatStore.getState().messages.at(-1)?.content).toBe('Carried over');
    expect(second.useChatStore.getState().voiceOutputEnabled).toBe(true);
  });
});

describe('reset', () => {
  it('clears the transcript, profile and flags but keeps the voice preference', async () => {
    const { useChatStore, WELCOME_MESSAGE } = await freshStore();
    const store = useChatStore.getState();
    store.appendMessage(message({ content: 'old turn' }));
    store.setLeadProfile({ name: 'Asha' });
    store.setLoading(true);
    store.setStreaming(true);
    store.setVoiceOutputEnabled(true);

    store.reset();

    const after = useChatStore.getState();
    expect(after.messages).toHaveLength(1);
    expect(after.messages[0].content).toBe(WELCOME_MESSAGE);
    expect(after.leadProfile).toEqual(EMPTY_LEAD_PROFILE);
    expect(after.isLoading).toBe(false);
    expect(after.isStreaming).toBe(false);
    // A mode the customer chose, not conversation state.
    expect(after.voiceOutputEnabled).toBe(true);
  });
});
