import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, PaperColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { addContact, searchProfilesByHandle, type ContactProfile } from '@/lib/contacts';

export default function AddContactScreen() {
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ContactProfile[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchProfilesByHandle(query, profile.id)
        .then((data) => {
          if (!cancelled) setResults(data);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Search failed.');
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, profile]);

  async function handleAdd(contact: ContactProfile) {
    if (!profile) return;
    try {
      await addContact(profile.id, contact.id);
      setAddedIds((prev) => new Set(prev).add(contact.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add contact.');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">Add contact</ThemedText>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText type="link">Done</ThemedText>
          </Pressable>
        </ThemedView>

        <TextInput
          style={styles.input}
          placeholder="Search by @handle"
          placeholderTextColor={PaperColors.pencil}
          autoCapitalize="none"
          autoCorrect={false}
          value={query}
          onChangeText={setQuery}
        />

        {error ? (
          <ThemedText type="small" themeColor="accent">
            {error}
          </ThemedText>
        ) : null}

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            query.trim().length > 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                No one found for “{query.trim()}”.
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={styles.row}>
              <ThemedView style={styles.rowText}>
                <ThemedText type="default">{item.displayName ?? item.handle}</ThemedText>
                {item.handle ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    @{item.handle}
                  </ThemedText>
                ) : null}
              </ThemedView>
              <Pressable onPress={() => handleAdd(item)} disabled={addedIds.has(item.id)} hitSlop={12}>
                <ThemedText type="link">{addedIds.has(item.id) ? 'Added' : 'Add'}</ThemedText>
              </Pressable>
            </ThemedView>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.two,
  },
  input: {
    fontFamily: Fonts.body,
    fontSize: 16,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: PaperColors.paperDark,
  },
  listContent: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  rowText: {
    gap: Spacing.half,
  },
});
