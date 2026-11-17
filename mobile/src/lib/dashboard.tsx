import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { api, ApiError } from './api';
import { health } from './health';
import { SYNC_DAYS, dayKey } from './health/common';
import { useSession } from './session';
import { TRACKER_STEPS_MAX, type Dashboard, type MemberState, type Message } from './types';

type HealthStatus = 'idle' | 'syncing' | 'synced' | 'unavailable' | 'needs-update' | 'error';

type DashboardContext = {
  data: Dashboard | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
  /** Changes the member's state locally at once and saves it a moment later (like the website's autosave). */
  update: (change: (state: MemberState) => MemberState) => void;
  sendQuestion: (body: string) => Promise<void>;
  healthStatus: HealthStatus;
  /** Asks for health permissions (first time) and syncs the last two weeks. */
  connectHealth: () => Promise<void>;
  syncHealth: () => Promise<void>;
};

const Context = createContext<DashboardContext | null>(null);
const SAVE_DELAY_MS = 800;

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { token, signOut } = useSession();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The newest data, for the delayed autosave and health sync (which run outside render). */
  const latest = useRef<Dashboard | null>(null);
  useEffect(() => { latest.current = data; }, [data]);

  /** A 401 means the token was revoked (password changed, account removed): go back to sign-in. */
  const handle = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) { signOut(); return; }
    setError(e instanceof Error ? e.message : 'Something went wrong.');
  }, [signOut]);

  const reload = useCallback(async () => {
    try {
      setData(await api<Dashboard>('me', { token }));
      setError(null);
    } catch (e) { handle(e); } finally { setLoading(false); }
  }, [token, handle]);

  const save = useCallback(async () => {
    const current = latest.current;
    if (!current) return;
    try {
      await api('progress', { token, method: 'PUT', body: { state: current.state, revision: current.revision } });
    } catch (e) {
      // 409: the trainer corrected the log since we loaded; take theirs.
      if (e instanceof ApiError && e.status === 409) await reload(); else handle(e);
    }
  }, [token, reload, handle]);

  const update = useCallback((change: (state: MemberState) => MemberState) => {
    setData(d => (d ? { ...d, state: change(d.state) } : d));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, SAVE_DELAY_MS);
  }, [save]);

  const sendQuestion = useCallback(async (body: string) => {
    const { messages } = await api<{ messages: Message[] }>('messages', { token, body: { body } });
    setData(d => (d ? { ...d, messages } : d));
  }, [token]);

  const syncHealth = useCallback(async () => {
    if (!health.platform) { setHealthStatus('unavailable'); return; }
    const availability = await health.availability();
    if (availability !== 'available') { setHealthStatus(availability); return; }
    setHealthStatus('syncing');
    try {
      const reading = await health.readDays(SYNC_DAYS);
      await api('health', { token, body: { platform: health.platform, days: reading.days, sources: reading.sources } });
      const synced = await api<Dashboard['health']>('health', { token });
      setData(d => (d ? { ...d, health: synced } : d));
      // Fill today's step count in the tracker from the phone when it's higher than what the member typed.
      const steps = reading.days.find(d => d.day === dayKey(new Date()))?.steps;
      if (steps && latest.current && steps > latest.current.state.tracker.steps) {
        update(s => ({ ...s, tracker: { ...s.tracker, steps: Math.min(TRACKER_STEPS_MAX, steps) } }));
      }
      setHealthStatus('synced');
    } catch (e) {
      setHealthStatus('error');
      handle(e);
    }
  }, [token, update, handle]);

  const connectHealth = useCallback(async () => {
    if (!health.platform) { setHealthStatus('unavailable'); return; }
    const availability = await health.availability();
    if (availability !== 'available') { setHealthStatus(availability); return; }
    if (await health.requestAccess()) await syncHealth();
  }, [syncHealth]);

  // Load on sign-in, then refresh and re-sync each time the app comes back to the foreground.
  useEffect(() => {
    let live = true;
    api<Dashboard>('me', { token })
      .then(d => { if (live) { setData(d); setError(null); } }, e => { if (live) handle(e); })
      .finally(() => { if (live) setLoading(false); });
    const sub = AppState.addEventListener('change', s => {
      if (s !== 'active') return;
      reload();
      if (latest.current?.health.lastSync) syncHealth();
    });
    return () => { live = false; sub.remove(); };
  }, [token, handle, reload, syncHealth]);

  // Members who connected health before get a quiet sync on launch.
  const autoSynced = useRef(false);
  useEffect(() => {
    if (data?.health.lastSync && !autoSynced.current) { autoSynced.current = true; syncHealth(); }
  }, [data?.health.lastSync, syncHealth]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const value = useMemo(() => ({ data, error, loading, reload, update, sendQuestion, healthStatus, connectHealth, syncHealth }),
    [data, error, loading, reload, update, sendQuestion, healthStatus, connectHealth, syncHealth]);
  return <Context value={value}>{children}</Context>;
}

export function useDashboard() {
  const value = use(Context);
  if (!value) throw new Error('useDashboard must be used inside DashboardProvider');
  return value;
}

/** Monday = 0 … Sunday = 6, for the server's "today" (India time). */
export const weekdayIndex = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
