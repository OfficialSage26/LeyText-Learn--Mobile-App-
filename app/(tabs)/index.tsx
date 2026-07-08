import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, TextInput } from 'react-native';
import { translate } from '../../src/engine/engine';
import type { Direction, TranslationResult } from '../../src/engine/types';
import { useDictionary } from '../../src/data/useDictionary';
import { DirectionToggle } from '../../src/ui/DirectionToggle';
import { ResultCard } from '../../src/ui/ResultCard';
import { theme } from '../../src/ui/theme';

export default function TranslateScreen() {
  const dict = useDictionary();
  const [direction, setDirection] = useState<Direction>('tl-ceb');
  const [text, setText] = useState('');
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      if (text.trim() === '') {
        setResult(null);
        setSuggestions([]);
        return;
      }
      const r = await translate(text, direction, dict);
      if (cancelled) return;
      setResult(r);
      // Offer near-matches only for a single unknown word.
      if (r.method === 'word-by-word' && r.tokens.length === 1 && r.hasMisses) {
        const s = await dict.findSuggestions(r.tokens[0].source.slice(0, 3), direction);
        if (!cancelled) setSuggestions(s);
      } else {
        setSuggestions([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [text, direction, dict]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Text style={styles.title}>Translate</Text>
        <DirectionToggle value={direction} onChange={setDirection} />
        <TextInput
          style={styles.input}
          multiline
          placeholder={direction === 'tl-ceb' ? 'Isulat ang Tagalog dito\u2026' : 'Isulat ang Bisaya dinhi\u2026'}
          placeholderTextColor={theme.colors.muted}
          value={text}
          onChangeText={setText}
          autoCorrect={false}
        />
        {result && <ResultCard result={result} suggestions={suggestions} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: 16 },
  title: { fontSize: 28, fontWeight: '700', color: theme.colors.text, marginTop: 8 },
  input: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 16,
    fontSize: 18,
    minHeight: 110,
    textAlignVertical: 'top',
    color: theme.colors.text,
  },
});
