import { describe, expect, it } from 'vitest';
import { interpretVoiceCommand } from './commands';

describe('voice commands', () => {
  it('maps only the closed command vocabulary', () => {
    expect(interpretVoiceCommand('Open the inbox')).toEqual({
      kind: 'open_inbox',
      requiresConfirmation: false,
    });
    expect(interpretVoiceCommand('Search for Ahmed')).toEqual({
      kind: 'search',
      query: 'Ahmed',
      requiresConfirmation: false,
    });
    expect(interpretVoiceCommand('Draft Your booking is confirmed')).toEqual({
      kind: 'draft_reply',
      text: 'Your booking is confirmed',
      requiresConfirmation: true,
    });
    expect(interpretVoiceCommand('delete every customer')).toEqual({
      kind: 'unknown',
      requiresConfirmation: false,
    });
  });
});
