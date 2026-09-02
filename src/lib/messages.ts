import { supabase } from '@/lib/supabase';

export type FlightMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content_type: 'typed' | 'handwritten';
  content_text: string | null;
  content_strokes: unknown | null;
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
  contentStrokes?: unknown;
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
