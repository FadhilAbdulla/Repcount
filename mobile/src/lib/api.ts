import Constants from 'expo-constants';

/**
 * Base URL of the RepCount website. Set EXPO_PUBLIC_API_URL for local testing (e.g. http://192.168.1.20:3000 —
 * a phone can't reach "localhost" on your computer); otherwise app.json → expo.extra.apiUrl is used.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || (Constants.expoConfig?.extra?.apiUrl as string | undefined) || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Calls /api/mobile/<path> with the member's token. Throws ApiError with the server's message on failure. */
export async function api<T>(path: string, options: { token?: string | null; method?: string; body?: unknown } = {}): Promise<T> {
  if (!API_URL) throw new ApiError('The app has no server address. Set expo.extra.apiUrl in app.json.', 0);
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/mobile/${path}`, {
      method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
      headers: {
        accept: 'application/json',
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError('Can’t reach RepCount. Check your internet connection.', 0);
  }
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new ApiError(data.error ?? `Something went wrong (${response.status}).`, response.status);
  return data;
}
