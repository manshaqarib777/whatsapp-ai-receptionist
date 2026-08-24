export type VoiceCommand =
  | { kind: 'open_inbox'; requiresConfirmation: false }
  | { kind: 'search'; query: string; requiresConfirmation: false }
  | { kind: 'draft_reply'; text: string; requiresConfirmation: true }
  | { kind: 'stop'; requiresConfirmation: false }
  | { kind: 'unknown'; requiresConfirmation: false };

export function interpretVoiceCommand(input: string): VoiceCommand {
  const text = input.trim();
  const normalized = text.toLocaleLowerCase('en');
  if (/^(open|go to) (the )?inbox[.!]?$/.test(normalized))
    return { kind: 'open_inbox', requiresConfirmation: false };
  if (/^(stop|cancel|never mind)[.!]?$/.test(normalized))
    return { kind: 'stop', requiresConfirmation: false };
  const search = text.match(/^(?:search|find)\s+(?:for\s+)?(.+)$/i);
  if (search?.[1])
    return { kind: 'search', query: search[1].trim(), requiresConfirmation: false };
  const draft = text.match(/^(?:draft|reply|say)\s+(.+)$/i);
  if (draft?.[1])
    return { kind: 'draft_reply', text: draft[1].trim(), requiresConfirmation: true };
  return { kind: 'unknown', requiresConfirmation: false };
}
