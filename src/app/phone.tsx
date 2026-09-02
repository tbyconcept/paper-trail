import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, PaperColors, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

function isPlausiblePhone(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value.trim());
}

export default function PhoneScreen() {
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    const trimmed = phone.trim();
    if (!isPlausiblePhone(trimmed)) {
      setError('Enter a full phone number with country code, e.g. +15551234567');
      return;
    }
    setError(null);
    setSending(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone: trimmed });
    setSending(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    router.push({ pathname: '/verify', params: { phone: trimmed } });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ThemedText type="title">Paper Trail</ThemedText>
        <ThemedText themeColor="textSecondary">
          Enter your phone number. We&rsquo;ll text you a code to sign in.
        </ThemedText>

        <TextInput
          style={styles.input}
          placeholder="+1 555 123 4567"
          placeholderTextColor={PaperColors.pencil}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoFocus
          value={phone}
          onChangeText={setPhone}
        />

        {error ? (
          <ThemedText type="small" themeColor="accent">
            {error}
          </ThemedText>
        ) : null}

        <Pressable
          onPress={handleContinue}
          disabled={sending}
          style={({ pressed }) => [styles.button, (pressed || sending) && styles.buttonDisabled]}>
          <ThemedText type="smallBold" themeColor="background">
            {sending ? 'Sending code…' : 'Send code'}
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
    gap: Spacing.three,
  },
  input: {
    fontFamily: Fonts.body,
    fontSize: 18,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    backgroundColor: PaperColors.paperDark,
  },
  button: {
    backgroundColor: PaperColors.postalRed,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
