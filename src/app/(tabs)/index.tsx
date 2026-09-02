import { Link } from 'expo-router';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing, WebTopTabInset } from '@/constants/theme';
import { MOCK_CONTACTS, type MockContact } from '@/lib/mock-contacts';

export default function ContactsScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedText type="title" style={styles.title}>
          Contacts
        </ThemedText>
        <FlatList
          data={MOCK_CONTACTS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <ContactRow contact={item} />}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function ContactRow({ contact }: { contact: MockContact }) {
  return (
    <Link href={{ pathname: '/compose/[contactId]', params: { contactId: contact.id } }} asChild>
      <Pressable style={({ pressed }) => [pressed && styles.pressed]}>
        <ThemedView type="backgroundElement" style={styles.row}>
          <ThemedText type="default">{contact.displayName}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {contact.handle}
          </ThemedText>
        </ThemedView>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  title: {
    paddingTop: Spacing.three + WebTopTabInset,
    paddingBottom: Spacing.two,
  },
  listContent: {
    gap: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  row: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
});
