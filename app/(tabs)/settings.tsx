import { SafeAreaView, Text, StyleSheet } from 'react-native';
import { theme } from '../../src/ui/theme';

export default function Screen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Settings</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: 16 },
  title: { fontSize: 28, fontWeight: '700', color: theme.colors.text, marginTop: 8 },
});
