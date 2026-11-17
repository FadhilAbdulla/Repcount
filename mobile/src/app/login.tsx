import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Button } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { API_URL } from '@/lib/api';
import { useSession } from '@/lib/session';

export default function Login() {
  const t = useTheme();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed.');
      setBusy(false);
    }
  }

  const input = [styles.input, { color: t.text, borderColor: t.line, backgroundColor: t.card }];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={{ gap: Spacing.xs }}>
          <Text style={[styles.brand, { color: t.brand }]}>RepCount</Text>
          <Text accessibilityRole="header" style={[styles.heading, { color: t.text }]}>Sign in to your plan</Text>
          <Body muted>Use the email and password you use on the RepCount website.</Body>
        </View>

        <View style={{ gap: Spacing.sm }}>
          <Text nativeID="email-label" style={{ color: t.text, fontWeight: '600' }}>Email</Text>
          <TextInput accessibilityLabelledBy="email-label" style={input} value={email} onChangeText={setEmail}
            autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="username" returnKeyType="next" />
          <Text nativeID="password-label" style={{ color: t.text, fontWeight: '600', marginTop: Spacing.sm }}>Password</Text>
          <View>
            <TextInput accessibilityLabelledBy="password-label" style={[input, { paddingRight: 72 }]} value={password} onChangeText={setPassword}
              secureTextEntry={!shown} autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
            <Pressable accessibilityRole="button" accessibilityLabel={shown ? 'Hide password' : 'Show password'} onPress={() => setShown(s => !s)} style={styles.show}>
              <Text style={{ color: t.brand, fontWeight: '600' }}>{shown ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
        </View>

        {error ? <Text accessibilityRole="alert" style={{ color: t.brand }}>{error}</Text> : null}
        <Button title="Sign in" onPress={submit} busy={busy} disabled={!email || !password} />

        <View style={styles.links}>
          <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/forgot-password`)}>
            <Text style={{ color: t.brand }}>Forgot password?</Text>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/register`)}>
            <Text style={{ color: t.brand }}>New here? Join on the website</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: Spacing.lg, gap: Spacing.lg, justifyContent: 'center' },
  brand: { fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  heading: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, fontSize: 16 },
  show: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 16 },
  links: { gap: Spacing.md, alignItems: 'center' },
});
