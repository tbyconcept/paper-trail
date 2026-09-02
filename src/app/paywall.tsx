import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function PaywallScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ThemedText type="title">Shop</ThemedText>
        <ThemedText themeColor="textSecondary">
          Extra sends and cosmetic packs (pen colors, paper textures, plane styles) are wired up in
          build step 8, alongside the daily free-send limit.
        </ThemedText>

        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <ThemedText type="smallBold">Close</ThemedText>
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  closeButton: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    marginBottom: Spacing.three,
  },
});
