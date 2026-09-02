/**
 * Placeholder contact list for wiring up navigation before Supabase (step 2)
 * and device contact matching (step 9) are in place.
 */
export type MockContact = {
  id: string;
  handle: string;
  displayName: string;
};

export const MOCK_CONTACTS: MockContact[] = [
  { id: 'c1', handle: '@maribel', displayName: 'Maribel Ortiz' },
  { id: 'c2', handle: '@theo', displayName: 'Theo Vance' },
  { id: 'c3', handle: '@junjie', displayName: 'Jun Jie Lim' },
  { id: 'c4', handle: '@priya', displayName: 'Priya Nair' },
];

export function getMockContact(id: string): MockContact | undefined {
  return MOCK_CONTACTS.find((contact) => contact.id === id);
}
