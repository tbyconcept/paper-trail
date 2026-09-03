import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FlightCanvas } from '@/components/flight-canvas';
import { ZONES, type FlightEvent } from '@/components/flight-zones';
import { MessageContent } from '@/components/message-content';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { fetchMessage, landMessage, type FlightMessage } from '@/lib/messages';
import { supabase } from '@/lib/supabase';

type OtherParty = { handle: string | null; displayName: string | null };
type TrackingView = 'message' | 'flight';

// Progress is derived purely from the server-chosen departed_at/duration_ms
// on the message row (build step 3) -- the server is the timing authority,
// so FlightCanvas's wind/rain/thermal/bird/tree zones are a client-side
// visual layer only: they never alter the real progress-to-time mapping.
// Persisting those events to flight_events / triggering push notifications
// is step 6.
export default function TrackingScreen() {
  const { messageId } = useLocalSearchParams<{ messageId: string }>();
  const { profile } = useAuth();
  const [message, setMessage] = useState<FlightMessage | null>(null);
  const [otherParty, setOtherParty] = useState<OtherParty | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [weatherEvents, setWeatherEvents] = useState<FlightEvent[]>([]);
  // Which of the two views ("open the letter" vs. the flight path/log) is
  // showing once landed -- message-first is the default, with a way back to
  // the flight side. Meaningless (and hidden) until landed.
  const [view, setView] = useState<TrackingView>('message');
  const landAttempted = useRef(false);
  // messageIds that were already 'landed' the moment they were first
  // fetched here (e.g. reopened from Inbox, as opposed to landing live
  // during this Tracking session) -- read (during render) by
  // displayedWeatherEvents below, so state rather than a ref.
  const [alreadyLandedIds, setAlreadyLandedIds] = useState<Set<string>>(new Set());

  const onFlightEvent = useCallback((event: FlightEvent) => {
    setWeatherEvents((events) => [...events, event]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMessage(messageId).then(
      (data) => {
        if (!cancelled) {
          setMessage(data);
          setWeatherEvents([]);
          setView('message');
          if (data.status === 'landed') {
            setAlreadyLandedIds((prev) => (prev.has(messageId) ? prev : new Set(prev).add(messageId)));
          }
        }
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
  const landed = message?.status === 'landed';
  const etaSeconds =
    departedAtMs !== null && durationMs !== null
      ? Math.max(0, Math.ceil((durationMs - (now - departedAtMs)) / 1000))
      : null;

  // Reopening an already-landed message (e.g. from Inbox) means the real
  // per-frame zone events in FlightCanvas never ran -- their progress
  // ranges already passed before this screen ever mounted, so `weatherEvents`
  // would otherwise stay empty. Synthesize the same zone entries FlightCanvas
  // would have reported live, timestamped proportionally through the actual
  // flight window, so the Flight tab's log reads the same either way. A
  // pure derived value, not state -- nothing here needs to persist once
  // computed, and it recomputes for free alongside everything else that
  // already depends on `message`.
  //
  // TODO(step 6): flight_events' event_type check constraint already
  // includes 'wind'/'rain'/'thermal'/'bird'/'tree' alongside
  // 'departed'/'landed', but nothing writes those rows yet -- only
  // send_message ('departed') and land_message/sweep_landed_messages
  // ('landed') insert today. Once step 6 actually persists real
  // diversion events, replace this synthesis with a query against the
  // real flight_events rows for the message instead of reconstructing a
  // guess from a fixed midpoint-of-range formula.
  const displayedWeatherEvents = useMemo(() => {
    if (
      weatherEvents.length > 0 ||
      !message ||
      !landed ||
      !alreadyLandedIds.has(message.id) ||
      departedAtMs === null ||
      durationMs === null
    ) {
      return weatherEvents;
    }
    return ZONES.map((zone) => ({
      type: zone.type,
      label: zone.label,
      at: departedAtMs + ((zone.range[0] + zone.range[1]) / 2) * durationMs,
    }));
  }, [weatherEvents, message, landed, alreadyLandedIds, departedAtMs, durationMs]);

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
    const entries = [
      { label: 'Departed', at: departedAtMs },
      ...displayedWeatherEvents.map((event) => ({ label: event.label, at: event.at })),
    ];
    if (message.landed_at) {
      entries.push({ label: 'Landed', at: new Date(message.landed_at).getTime() });
    }
    return entries.sort((a, b) => a.at - b.at);
  }, [message, departedAtMs, displayedWeatherEvents]);

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

        {landed ? (
          <ThemedView style={styles.viewToggle}>
            <ViewToggleButton label="Message" active={view === 'message'} onPress={() => setView('message')} />
            <ViewToggleButton label="Flight" active={view === 'flight'} onPress={() => setView('flight')} />
          </ThemedView>
        ) : null}

        <ThemedView type="backgroundElement" style={styles.flightCanvasCard}>
          {landed && view === 'message' ? (
            // "Message" is the default view once landed -- "open the
            // letter" in place of the (now static) flight animation, with
            // the toggle above as the way back to the flight side.
            <MessageContent message={message} />
          ) : departedAtMs !== null && durationMs !== null ? (
            <FlightCanvas
              departedAtMs={departedAtMs}
              durationMs={durationMs}
              landed={landed}
              onEvent={onFlightEvent}
            />
          ) : null}
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

function ViewToggleButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.viewToggleButtonPressable}>
      <ThemedView type={active ? 'backgroundSelected' : 'backgroundElement'} style={styles.viewToggleButton}>
        <ThemedText type="small">{label}</ThemedText>
      </ThemedView>
    </Pressable>
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
  viewToggle: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  viewToggleButtonPressable: {
    flex: 1,
  },
  viewToggleButton: {
    paddingVertical: Spacing.two,
    alignItems: 'center',
    borderRadius: Spacing.two,
  },
  flightCanvasCard: {
    flex: 1,
    borderRadius: Spacing.three,
    overflow: 'hidden',
    padding: Spacing.two,
  },
  log: {
    gap: Spacing.one,
    paddingBottom: Spacing.four,
  },
});
