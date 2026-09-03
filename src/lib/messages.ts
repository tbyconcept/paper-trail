import type { StrokeDocument } from '@/components/handwriting-canvas';
import { supabase } from '@/lib/supabase';

export type FlightMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content_type: 'typed' | 'handwritten';
  content_text: string | null;
  content_strokes: StrokeDocument | null;
  pen_color: string | null;
  paper_style: string | null;
  departed_at: string;
  duration_ms: number;
  landed_at: string | null;
  distance_miles: number | null;
  status: 'in_flight' | 'landed';
  created_at: string;
};

export class SendLimitExceededError extends Error {
  constructor() {
    super('Daily free-send limit reached');
    this.name = 'SendLimitExceededError';
  }
}

// departed_at/duration_ms are chosen server-side (public.send_message) --
// see 20260901140000_send_flow.sql -- so a client can't fabricate its own
// flight timing.
export async function sendMessage(params: {
  recipientId: string;
  contentType: 'typed' | 'handwritten';
  contentText?: string;
  contentStrokes?: StrokeDocument;
  penColor?: string;
  paperStyle?: string;
}): Promise<FlightMessage> {
  const { data, error } = await supabase.rpc('send_message', {
    p_recipient_id: params.recipientId,
    p_content_type: params.contentType,
    p_content_text: params.contentText ?? null,
    p_content_strokes: params.contentStrokes ?? null,
    p_pen_color: params.penColor ?? null,
    p_paper_style: params.paperStyle ?? null,
  });
  if (error) {
    if (error.message.includes('SEND_LIMIT_EXCEEDED')) throw new SendLimitExceededError();
    throw error;
  }
  return data as FlightMessage;
}

export async function fetchMessage(messageId: string): Promise<FlightMessage> {
  const { data, error } = await supabase.from('messages').select('*').eq('id', messageId).single();
  if (error) throw error;
  return data as FlightMessage;
}

// Re-checked server-side against departed_at + duration_ms before it
// actually writes landed_at -- see land_message in the same migration.
export async function landMessage(messageId: string): Promise<FlightMessage> {
  const { data, error } = await supabase.rpc('land_message', { p_message_id: messageId });
  if (error) throw error;
  return data as FlightMessage;
}

export type InboxEntry = {
  message: FlightMessage;
  direction: 'sent' | 'received';
  otherParty: { id: string; handle: string | null; displayName: string | null };
};

// Two-step fetch, same shape as Tracking's message-then-profile load: the
// messages RLS policy ("participants can view their messages") covers step
// one, and profiles is a view with no FK for PostgREST to embed through
// (see contacts.ts), so the other-party names are batched in a second query
// rather than joined.
export async function listInboxMessages(userId: string): Promise<InboxEntry[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('departed_at', { ascending: false });
  if (error) throw error;

  const messages = (data ?? []) as FlightMessage[];
  if (messages.length === 0) return [];

  const otherPartyId = (message: FlightMessage) =>
    message.sender_id === userId ? message.recipient_id : message.sender_id;

  const otherIds = Array.from(new Set(messages.map(otherPartyId)));
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, handle, display_name')
    .in('id', otherIds);
  if (profilesError) throw profilesError;

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return messages.map((message) => {
    const otherId = otherPartyId(message);
    const p = profileById.get(otherId);
    return {
      message,
      direction: message.sender_id === userId ? 'sent' : 'received',
      otherParty: { id: otherId, handle: p?.handle ?? null, displayName: p?.display_name ?? null },
    };
  });
}
