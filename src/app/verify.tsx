import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, PaperColors, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function VerifyScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify() {
    if (code.trim().length < 6) {
      setError('Enter the 6-digit code we texted you.');
      return;
    }
    setError(null);
    setVerifying(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: code.trim(),
      type: 'sms',
    });
    setVerifying(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    // On success, the root layout's Stack.Protected guards pick up the new
    // session and redirect automatically (to /handle for first-time users).
  }

  async function handleResend() {
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone });
    if (otpError) setError(otpError.message);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ThemedText type="title">Enter code</ThemedText>
        <ThemedText themeColor="textSecondary">Sent to {phone}</ThemedText>

        <TextInput
          style={styles.input}
          placeholder="123456"
          placeholderTextColor={PaperColors.pencil}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          maxLength={6}
          autoFocus
          value={code}
          onChangeText={setCode}
        />

        {error ? (
          <ThemedText type="small" themeColor="accent">
            {error}
          </ThemedText>
        ) : null}

        <Pressable
          onPress={handleVerify}
          disabled={verifying}
          style={({ pressed }) => [
            styles.button,
            (pressed || verifying) && styles.buttonDisabled,
          ]}>
          <ThemedText type="smallBold" themeColor="background">
            {verifying ? 'Verifying…' : 'Verify'}
          </ThemedText>
        </Pressable>

        <Pressable onPress={handleResend} style={styles.linkRow}>
          <ThemedText type="link">Resend code</ThemedText>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.linkRow}>
          <ThemedText type="link">Change number</ThemedText>
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
    fontSize: 24,
    letterSpacing: 4,
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
  linkRow: {
    alignItems: 'center',
  },
});
