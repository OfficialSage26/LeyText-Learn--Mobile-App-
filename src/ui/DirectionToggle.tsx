import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Direction } from '../engine/types';
import { DIRECTION_LABELS } from './labels';
import { theme } from './theme';

export function DirectionToggle({
  value,
  onChange,
}: {
  value: Direction;
  onChange: (d: Direction) => void;
}) {
  const labels = DIRECTION_LABELS[value];
  return (
    <View style={styles.row}>
      <Text style={styles.lang}>{labels.from}</Text>
      <Pressable
        accessibilityLabel="Swap languages"
        onPress={() => onChange(value === 'tl-ceb' ? 'ceb-tl' : 'tl-ceb')}
        style={styles.swap}
      >
        <Ionicons name="swap-horizontal" size={20} color={theme.colors.accent} />
      </Pressable>
      <Text style={styles.lang}>{labels.to}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginVertical: 12 },
  lang: { fontSize: 16, fontWeight: '600', color: theme.colors.text, width: 90, textAlign: 'center' },
  swap: { backgroundColor: theme.colors.accentSoft, borderRadius: 20, padding: 8 },
});
