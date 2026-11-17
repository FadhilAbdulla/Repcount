import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Body, Button, Card, ErrorNote, Loading, Screen, Title } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useDashboard } from '@/lib/dashboard';

export default function Coach() {
  const t = useTheme();
  const { data, error, loading, reload, sendQuestion } = useDashboard();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (loading && !data) return <Loading />;
  if (!data) return <Screen><ErrorNote message={error ?? 'Couldn’t load your messages.'} onRetry={reload} /></Screen>;

  async function send() {
    setBusy(true);
    setNote(null);
    try {
      await sendQuestion(text.trim());
      setText('');
      setNote('Sent. You’ll get an email when your trainer replies.');
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Couldn’t send.');
    } finally { setBusy(false); }
  }

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Title sub={data.coach ? `Questions go to ${data.coach.name}` : 'Questions go to the RepCount team'}>Coach</Title>

      <View style={{ gap: Spacing.sm }}>
        {data.messages.length === 0 ? <Body muted>No messages yet. Ask about an exercise, your plan or your food.</Body> : null}
        {data.messages.map(m => (
          <View key={m.id} style={[styles.bubble, m.fromMember
            ? { alignSelf: 'flex-end', backgroundColor: t.brand }
            : { alignSelf: 'flex-start', backgroundColor: t.card, borderColor: t.line, borderWidth: StyleSheet.hairlineWidth }]}>
            {!m.fromMember ? <Text style={{ color: t.muted, fontSize: 12, fontWeight: '600' }}>{m.author}</Text> : null}
            <Text style={{ color: m.fromMember ? t.onBrand : t.text, fontSize: 16, lineHeight: 22 }}>{m.body}</Text>
          </View>
        ))}
      </View>

      <Card>
        <Text nativeID="question-label" style={{ color: t.text, fontWeight: '600' }}>Ask your trainer</Text>
        <TextInput accessibilityLabelledBy="question-label" multiline maxLength={1000} value={text} onChangeText={setText}
          placeholder="Type your question" placeholderTextColor={t.muted}
          style={[styles.input, { color: t.text, borderColor: t.line }]} />
        {note ? <Text accessibilityRole="alert" style={{ color: t.muted }}>{note}</Text> : null}
        <Button title="Send" onPress={send} busy={busy} disabled={text.trim().length < 3} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '85%', padding: 12, borderRadius: Radius.lg, gap: 2 },
  input: { minHeight: 96, borderWidth: 1, borderRadius: Radius.md, padding: 12, fontSize: 16, textAlignVertical: 'top' },
});
