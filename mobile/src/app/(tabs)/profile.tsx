import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Body, Button, Card, ErrorNote, Label, Loading, Screen, Title } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { api, API_URL } from '@/lib/api';
import { useDashboard } from '@/lib/dashboard';
import { health } from '@/lib/health';
import { useSession } from '@/lib/session';

const memberCode = (n: number) => `RC-${String(n).padStart(4, '0')}`;

export default function Profile() {
  const t = useTheme();
  const { token, signOut } = useSession();
  const { data, error, loading, reload, connectHealth } = useDashboard();
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  if (loading && !data) return <Loading />;
  if (!data) return <Screen><ErrorNote message={error ?? 'Couldn’t load your profile.'} onRetry={reload} /></Screen>;

  async function deleteAccount() {
    setBusy(true);
    setDeleteError(null);
    try {
      await api('account', { token, method: 'DELETE', body: { password } });
      Alert.alert('Account deleted', 'Your RepCount account and all your data have been deleted.');
      await signOut();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Couldn’t delete your account.');
      setBusy(false);
    }
  }

  const m = data.member;
  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Title sub={data.user.email}>{data.user.name}</Title>

      <Card>
        <Label>Membership</Label>
        {m ? (
          <View style={{ gap: 4 }}>
            <Row k="Member ID" v={memberCode(m.memberNo)} />
            <Row k="Goal" v={m.goal} />
            <Row k="Trainer" v={data.coach?.name ?? 'Not assigned yet'} />
            {m.joinedOn ? <Row k="Joined" v={new Date(`${m.joinedOn}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })} /> : null}
          </View>
        ) : <Body muted>Your membership is being set up.</Body>}
      </Card>

      <Card>
        <Label>Health data</Label>
        <Body>
          {data.health.lastSync
            ? `RepCount reads your daily totals from ${health.name}. You choose which types in its settings.`
            : `Not connected. Connect ${health.name} on the Today tab.`}
        </Body>
        {data.health.lastSync
          ? <Button kind="secondary" title={`Manage in ${health.name}`} onPress={() => health.openSettings()} />
          : <Button kind="secondary" title={`Connect ${health.name}`} onPress={connectHealth} />}
      </Card>

      <Card>
        <Button kind="secondary" title="Privacy policy" onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/privacy`)} />
        <Button kind="secondary" title="Sign out" onPress={signOut} />
      </Card>

      <Card>
        <Label>Delete account</Label>
        {!deleting ? (
          <>
            <Body muted>Permanently deletes your account, progress, messages and synced health data. This can’t be undone.</Body>
            <Button kind="secondary" title="Delete my account" onPress={() => setDeleting(true)} />
          </>
        ) : (
          <>
            <Text nativeID="confirm-label" style={{ color: t.text, fontWeight: '600' }}>Enter your password to confirm</Text>
            <TextInput accessibilityLabelledBy="confirm-label" secureTextEntry value={password} onChangeText={setPassword} autoComplete="current-password"
              style={[styles.input, { color: t.text, borderColor: t.line }]} />
            {deleteError ? <Text accessibilityRole="alert" style={{ color: t.brand }}>{deleteError}</Text> : null}
            <Button title="Delete everything" onPress={deleteAccount} busy={busy} disabled={!password} />
            <Button kind="secondary" title="Cancel" onPress={() => { setDeleting(false); setPassword(''); setDeleteError(null); }} />
          </>
        )}
      </Card>
    </Screen>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <Text style={{ color: t.muted, fontSize: 15 }}>{k}</Text>
      <Text style={{ color: t.text, fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md, paddingVertical: 4 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, fontSize: 16 },
});
