import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HandwritingCanvas, type StrokeDocument } from '@/components/handwriting-canvas';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, PaperColors, Spacing } from '@/constants/theme';
import { SendLimitExceededError, sendMessage } from '@/lib/messages';
import { supabase } from '@/lib/supabase';

type ComposeMode = 'typed' | 'handwritten';
type RecipientProfile = { handle: string | null; display_name: string | null };

export default function ComposeScreen() {
  const { contactId } = useLocalSearchParams<{ contactId: string }>();
  const [recipient, setRecipient] = useState<RecipientProfile | null>(null);
  const [mode, setMode] = useState<ComposeMode>('typed');
  const [text, setText] = useState('');
  const [strokes, setStrokes] = useState<StrokeDocument | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('profiles')
      .select('handle, display_name')
      .eq('id', contactId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setRecipient(data);
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  async function handleSend() {
    setError(null);
    setSending(true);
    try {
      const message = await sendMessage({
        recipientId: contactId,
        contentType: mode,
        contentText: mode === 'typed' ? text.trim() : undefined,
        contentStrokes: mode === 'handwritten' ? (strokes ?? undefined) : undefined,
        penColor: mode === 'handwritten' ? PaperColors.ink : undefined,
      });
      router.replace({ pathname: '/tracking/[messageId]', params: { messageId: message.id } });
    } catch (err) {
      if (err instanceof SendLimitExceededError) {
        router.push('/paywall');
        return;
      }
      setError(err instanceof Error ? err.message : 'Could not send — try again.');
    } finally {
      setSending(false);
    }
  }

  const displayName = recipient?.display_name ?? recipient?.handle ?? 'Unknown';
  const isEmpty = mode === 'typed' ? text.trim().length === 0 : strokes === null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ThemedView style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText type="link">Cancel</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">To {displayName}</ThemedText>
          <ThemedView />
        </ThemedView>

        <ThemedView style={styles.modeToggle}>
          <ModeButton label="Type" active={mode === 'typed'} onPress={() => setMode('typed')} />
          <ModeButton
            label="Handwrite"
            active={mode === 'handwritten'}
            onPress={() => setMode('handwritten')}
          />
        </ThemedView>

        {mode === 'typed' ? (
          <TextInput
            style={styles.input}
            placeholder="Write your message…"
            placeholderTextColor={PaperColors.pencil}
            multiline
            value={text}
            onChangeText={setText}
          />
        ) : (
          <HandwritingCanvas onChangeStrokes={setStrokes} />
        )}

        {error ? (
          <ThemedText type="small" themeColor="accent">
            {error}
          </ThemedText>
        ) : null}

        <Pressable
          onPress={handleSend}
          disabled={sending || isEmpty}
          style={({ pressed }) => [
            styles.sendButton,
            (pressed || sending || isEmpty) && styles.sendButtonDisabled,
          ]}>
          <ThemedText type="smallBold" themeColor="background">
            {sending ? 'Sending…' : 'Send'}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

function ModeButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.modeButtonPressable}>
      <ThemedView
        type={active ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.modeButton}>
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
  modeToggle: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  modeButtonPressable: {
    flex: 1,
  },
  modeButton: {
    paddingVertical: Spacing.two,
    alignItems: 'center',
    borderRadius: Spacing.two,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 18,
    lineHeight: 26,
    textAlignVertical: 'top',
    paddingTop: Spacing.two,
  },
  sendButton: {
    backgroundColor: PaperColors.postalRed,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
