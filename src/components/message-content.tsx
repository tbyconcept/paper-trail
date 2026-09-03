import { ScrollView, StyleSheet } from 'react-native';

import { HandwritingReader } from '@/components/handwriting-reader';
import { ThemedText } from '@/components/themed-text';
import { PaperColors, Spacing } from '@/constants/theme';
import type { FlightMessage } from '@/lib/messages';

// The "open the letter" view -- shown in Tracking's flight-canvas slot once
// a message has landed, in place of the (now static) flight animation.
export function MessageContent({ message }: { message: FlightMessage }) {
  if (message.content_type === 'handwritten' && message.content_strokes) {
    return (
      <HandwritingReader
        document={message.content_strokes}
        penColor={message.pen_color ?? PaperColors.ink}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.textContent}>
      <ThemedText type="default" style={styles.text}>
        {message.content_text}
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  textContent: {
    padding: Spacing.three,
  },
  text: {
    fontSize: 20,
    lineHeight: 30,
  },
});
