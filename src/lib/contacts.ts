import { supabase } from '@/lib/supabase';

export type ContactProfile = {
  id: string;
  handle: string | null;
  displayName: string | null;
};

function toContactProfile(row: { id: string; handle: string | null; display_name: string | null }): ContactProfile {
  return { id: row.id, handle: row.handle, displayName: row.display_name };
}

export async function listContacts(userId: string): Promise<ContactProfile[]> {
  const { data: rows, error } = await supabase
    .from('contacts')
    .select('contact_user_id')
    .eq('user_id', userId);
  if (error) throw error;

  const ids = (rows ?? []).map((row) => row.contact_user_id);
  if (ids.length === 0) return [];

  // profiles is a view (no FK for PostgREST to embed through), so contacts
  // and their profile fields are fetched in two steps.
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, handle, display_name')
    .in('id', ids);
  if (profilesError) throw profilesError;

  return (profiles ?? []).map(toContactProfile);
}

export async function searchProfilesByHandle(
  query: string,
  excludeUserId: string,
): Promise<ContactProfile[]> {
  const trimmed = query.trim().replace(/^@/, '');
  if (trimmed.length === 0) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, handle, display_name')
    .ilike('handle', `%${trimmed}%`)
    .neq('id', excludeUserId)
    .limit(20);
  if (error) throw error;

  return (data ?? []).map(toContactProfile);
}

export async function addContact(userId: string, contactUserId: string): Promise<void> {
  const { error } = await supabase
    .from('contacts')
    .insert({ user_id: userId, contact_user_id: contactUserId, source: 'manual' });
  // 23505 = already a contact -- treat as success.
  if (error && error.code !== '23505') throw error;
}
