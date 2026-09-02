import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing, WebTopTabInset } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { listContacts, type ContactProfile } from '@/lib/contacts';

export default function ContactsScreen() {
  const { profile, signOut } = useAuth();
  const [contacts, setContacts] = useState<ContactProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      let cancelled = false;
      setLoading(true);
      listContacts(profile.id)
        .then((data) => {
          if (!cancelled) setContacts(data);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load contacts.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [profile]),
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedView style={styles.header}>
          <ThemedView>
            <ThemedText type="title">Contacts</ThemedText>
            {profile?.display_name ? (
              <ThemedText type="small" themeColor="textSecondary">
                Signed in as {profile.display_name}
              </ThemedText>
            ) : null}
          </ThemedView>
          <ThemedView style={styles.headerActions}>
            <Pressable onPress={() => router.push('/contacts/add')} hitSlop={12}>
              <ThemedText type="link">Add</ThemedText>
            </Pressable>
            <Pressable onPress={() => signOut()} hitSlop={12}>
              <ThemedText type="link">Sign out</ThemedText>
            </Pressable>
          </ThemedView>
        </ThemedView>

        {error ? (
          <ThemedText type="small" themeColor="accent">
            {error}
          </ThemedText>
        ) : null}

        {!loading && contacts.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
              No contacts yet. Add someone by their @handle to send them a flight.
            </ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            data={contacts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => <ContactRow contact={item} />}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function ContactRow({ contact }: { contact: ContactProfile }) {
  return (
    <Link href={{ pathname: '/compose/[contactId]', params: { contactId: contact.id } }} asChild>
      <Pressable style={({ pressed }) => [pressed && styles.pressed]}>
        <ThemedView type="backgroundElement" style={styles.row}>
          <ThemedText type="default">{contact.displayName ?? contact.handle}</ThemedText>
          {contact.handle ? (
            <ThemedText type="small" themeColor="textSecondary">
              @{contact.handle}
            </ThemedText>
          ) : null}
        </ThemedView>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: Spacing.three + WebTopTabInset,
    paddingBottom: Spacing.two,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  listContent: {
    gap: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  row: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: BottomTabInset + Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  centerText: {
    textAlign: 'center',
  },
});
