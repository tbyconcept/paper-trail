import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getMockContact } from '@/lib/mock-contacts';

// Stand-in flight timing until step 2 (Supabase) makes the server the timing
// authority for departedAt/durationMs. Skia/Reanimated path rendering and
// weather-driven events land in steps 4 and 6.
const STUB_DURATION_MS = 45_000;

export default function TrackingScreen() {
  const { contactId } = useLocalSearchParams<{
    messageId: string;
    contactId?: string;
  }>();
  const contact = contactId ? getMockContact(contactId) : undefined;
  const [departedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const progress = Math.min(1, (now - departedAt) / STUB_DURATION_MS);
  const landed = progress >= 1;
  const etaSeconds = Math.max(0, Math.ceil((STUB_DURATION_MS - (now - departedAt)) / 1000));

  const flightLog = useMemo(
    () => [{ label: 'Departed', at: departedAt }, ...(landed ? [{ label: 'Landed', at: now }] : [])],
    [departedAt, landed, now],
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ThemedView style={styles.header}>
          <ThemedText type="smallBold">
            {landed ? 'Delivered to' : 'In flight to'} {contact?.displayName ?? 'Unknown'}
          </ThemedText>
          <Pressable onPress={() => router.replace('/')} hitSlop={12}>
            <ThemedText type="link">Done</ThemedText>
          </Pressable>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.flightPathStub}>
          <ThemedText type="title">✈︎</ThemedText>
          <ThemedText themeColor="textSecondary">
            Skia flight path + animated plane arrives in build step 4.
          </ThemedText>
          <ThemedText type="subtitle">{Math.round(progress * 100)}%</ThemedText>
        </ThemedView>

        <ThemedText type="default">
          {landed ? 'Landed' : `ETA ${etaSeconds}s`}
        </ThemedText>

        <ThemedView style={styles.log}>
          <ThemedText type="smallBold">Flight log</ThemedText>
          {flightLog.map((entry) => (
            <ThemedText key={entry.label} type="small" themeColor="textSecondary">
              {new Date(entry.at).toLocaleTimeString()} — {entry.label}
            </ThemedText>
          ))}
        </ThemedView>
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
  flightPathStub: {
    flex: 1,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  log: {
    gap: Spacing.one,
    paddingBottom: Spacing.four,
  },
});
