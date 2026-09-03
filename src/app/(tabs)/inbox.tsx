import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing, WebTopTabInset } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { listInboxMessages, type InboxEntry } from '@/lib/messages';

export default function InboxScreen() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<InboxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Re-fetches on every focus (same as Contacts) rather than subscribing to
  // live updates -- landing itself only happens when someone has Tracking
  // open, so a stale-until-refocus snapshot here is already consistent with
  // how the rest of the app surfaces flight status.
  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      let cancelled = false;
      setLoading(true);
      listInboxMessages(profile.id)
        .then(
          (data) => {
            if (!cancelled) {
              setEntries(data);
              setError(null);
            }
          },
          (err) => {
            if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load inbox.');
          },
        )
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
        <ThemedText type="title" style={styles.title}>
          Inbox
        </ThemedText>

        {error ? (
          <ThemedText type="small" themeColor="accent">
            {error}
          </ThemedText>
        ) : null}

        {!loading && entries.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
              Nothing in the air yet. Sent and received flights will show up here — in flight and
              landed.
            </ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(entry) => entry.message.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => <InboxRow entry={item} />}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function InboxRow({ entry }: { entry: InboxEntry }) {
  const { message, direction, otherParty } = entry;
  const landed = message.status === 'landed';
  const label = otherParty.displayName ?? otherParty.handle ?? '…';
  const timestamp = landed && message.landed_at ? message.landed_at : message.departed_at;
  const preview = message.content_type === 'typed' ? message.content_text : 'Handwritten note';

  return (
    <Link href={{ pathname: '/tracking/[messageId]', params: { messageId: message.id } }} asChild>
      <Pressable style={({ pressed }) => [pressed && styles.pressed]}>
        <ThemedView type="backgroundElement" style={styles.row}>
          <ThemedView style={styles.rowHeader}>
            <ThemedText type="default">
              {direction === 'sent' ? 'To ' : 'From '}
              {label}
            </ThemedText>
            <ThemedText type="smallBold" themeColor={landed ? 'textSecondary' : 'accent'}>
              {landed ? 'Landed' : 'In flight'}
            </ThemedText>
          </ThemedView>
          {preview ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {preview}
            </ThemedText>
          ) : null}
          <ThemedText type="small" themeColor="textSecondary">
            {new Date(timestamp).toLocaleString()}
          </ThemedText>
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
  title: {
    paddingTop: Spacing.three + WebTopTabInset,
    paddingBottom: Spacing.two,
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
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
