import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, PaperColors, Spacing } from '@/constants/theme';
import { getMockContact } from '@/lib/mock-contacts';

type ComposeMode = 'typed' | 'handwritten';

export default function ComposeScreen() {
  const { contactId } = useLocalSearchParams<{ contactId: string }>();
  const contact = getMockContact(contactId);
  const [mode, setMode] = useState<ComposeMode>('typed');
  const [text, setText] = useState('');

  function handleSend() {
    // Stub: flight timing/duration/weather land in build steps 2-6.
    // Server will own departedAt + durationMs once Supabase is wired up.
    const messageId = `pending-${Date.now()}`;
    router.replace({ pathname: '/tracking/[messageId]', params: { messageId, contactId } });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ThemedView style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText type="link">Cancel</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">To {contact?.displayName ?? 'Unknown'}</ThemedText>
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
          <ThemedView type="backgroundElement" style={styles.handwriteStub}>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              Handwriting canvas (Skia stroke capture) arrives in build step 5.
            </ThemedText>
          </ThemedView>
        )}

        <Pressable
          onPress={handleSend}
          disabled={mode === 'typed' && text.trim().length === 0}
          style={({ pressed }) => [
            styles.sendButton,
            (pressed || (mode === 'typed' && text.trim().length === 0)) && styles.sendButtonDisabled,
          ]}>
          <ThemedText type="smallBold" themeColor="background">
            Send
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
  handwriteStub: {
    flex: 1,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  centerText: {
    textAlign: 'center',
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
