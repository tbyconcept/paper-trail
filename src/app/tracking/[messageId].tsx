import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { fetchMessage, landMessage, type FlightMessage } from '@/lib/messages';
import { supabase } from '@/lib/supabase';

type OtherParty = { handle: string | null; displayName: string | null };

// Skia path rendering + animated plane arrive in build step 4; weather
// events (wind/rain/thermal/etc.) in step 6. Progress here is derived
// purely from the server-chosen departed_at/duration_ms on the message row.
export default function TrackingScreen() {
  const { messageId } = useLocalSearchParams<{ messageId: string }>();
  const { profile } = useAuth();
  const [message, setMessage] = useState<FlightMessage | null>(null);
  const [otherParty, setOtherParty] = useState<OtherParty | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const landAttempted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetchMessage(messageId).then(
      (data) => {
        if (!cancelled) setMessage(data);
      },
      (err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load flight.');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [messageId]);

  useEffect(() => {
    if (!message || !profile) return;
    const otherId = message.sender_id === profile.id ? message.recipient_id : message.sender_id;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('handle, display_name')
      .eq('id', otherId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setOtherParty({ handle: data.handle, displayName: data.display_name });
      });
    return () => {
      cancelled = true;
    };
  }, [message, profile]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const departedAtMs = message ? new Date(message.departed_at).getTime() : null;
  const durationMs = message?.duration_ms ?? null;
  const progress =
    departedAtMs !== null && durationMs !== null
      ? Math.min(1, (now - departedAtMs) / durationMs)
      : 0;
  const landed = message?.status === 'landed';
  const etaSeconds =
    departedAtMs !== null && durationMs !== null
      ? Math.max(0, Math.ceil((durationMs - (now - departedAtMs)) / 1000))
      : null;

  // Small buffer past the server's own duration to avoid a NOT_YET_LANDED
  // round trip from client/server clock skew.
  useEffect(() => {
    if (!message || landed) return;
    if (departedAtMs === null || durationMs === null) return;
    if (now - departedAtMs < durationMs + 750) return;
    if (landAttempted.current) return;

    landAttempted.current = true;
    landMessage(message.id).then(
      (landedMessage) => setMessage(landedMessage),
      () => {
        landAttempted.current = false;
      },
    );
  }, [message, landed, now, departedAtMs, durationMs]);

  const flightLog = useMemo(() => {
    if (!message || departedAtMs === null) return [];
    const entries = [{ label: 'Departed', at: departedAtMs }];
    if (message.landed_at) {
      entries.push({ label: 'Landed', at: new Date(message.landed_at).getTime() });
    }
    return entries;
  }, [message, departedAtMs]);

  if (loadError) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          <ThemedText themeColor="accent">{loadError}</ThemedText>
          <Pressable onPress={() => router.replace('/')} hitSlop={12}>
            <ThemedText type="link">Done</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!message) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          <ThemedText themeColor="textSecondary">Loading flight…</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ThemedView style={styles.header}>
          <ThemedText type="smallBold">
            {landed ? 'Delivered to' : 'In flight to'}{' '}
            {otherParty?.displayName ?? otherParty?.handle ?? '…'}
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

        <ThemedText type="default">{landed ? 'Landed' : `ETA ${etaSeconds}s`}</ThemedText>

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
