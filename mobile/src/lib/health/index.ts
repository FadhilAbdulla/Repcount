import type { HealthSource } from './common';

/* Fallback for platforms without a health store (web preview). Metro picks index.android.ts / index.ios.ts on phones. */
export const health: HealthSource = {
  platform: null,
  name: 'Health data',
  availability: async () => 'unavailable',
  requestAccess: async () => false,
  readDays: async () => ({ days: [], sources: [] }),
  openSettings: () => {},
};
