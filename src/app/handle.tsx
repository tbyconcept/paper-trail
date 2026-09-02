import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, PaperColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

function isValidHandle(value: string) {
  return /^[a-z0-9_]{3,20}$/.test(value);
}

export default function HandleScreen() {
  const { session, refreshProfile } = useAuth();
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const normalizedHandle = handle.trim().toLowerCase();
    const trimmedName = displayName.trim();
    if (!isValidHandle(normalizedHandle)) {
      setError('Handles are 3-20 characters: lowercase letters, numbers, underscore.');
      return;
    }
    if (trimmedName.length === 0) {
      setError('Add a display name so people can recognize you.');
      return;
    }
    if (!session) return;

    setError(null);
    setSaving(true);
    const { error: updateError } = await supabase
      .from('users')
      .update({ handle: normalizedHandle, display_name: trimmedName })
      .eq('id', session.user.id);
    setSaving(false);

    if (updateError) {
      setError(
        updateError.code === '23505' ? 'That handle is taken — try another.' : updateError.message,
      );
      return;
    }
    // Guard in the root layout re-checks the profile and redirects into
    // the app once handle is set.
    await refreshProfile();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ThemedText type="title">Choose a handle</ThemedText>
        <ThemedText themeColor="textSecondary">
          This is how contacts will find and recognize you.
        </ThemedText>

        <ThemedText type="smallBold">Handle</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="paperplane_pilot"
          placeholderTextColor={PaperColors.pencil}
          autoCapitalize="none"
          autoCorrect={false}
          value={handle}
          onChangeText={setHandle}
        />

        <ThemedText type="smallBold">Display name</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="Ada Lovelace"
          placeholderTextColor={PaperColors.pencil}
          value={displayName}
          onChangeText={setDisplayName}
        />

        {error ? (
          <ThemedText type="small" themeColor="accent">
            {error}
          </ThemedText>
        ) : null}

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [styles.button, (pressed || saving) && styles.buttonDisabled]}>
          <ThemedText type="smallBold" themeColor="background">
            {saving ? 'Saving…' : 'Continue'}
          </ThemedText>
        </Pressable>
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
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  input: {
    fontFamily: Fonts.body,
    fontSize: 18,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    backgroundColor: PaperColors.paperDark,
    marginBottom: Spacing.two,
  },
  button: {
    backgroundColor: PaperColors.postalRed,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
