# RepCount mobile app

The members' app for iPhone and Android: sign in, today's workout, the daily check (water, mood, steps), questions to the trainer, and **health data from the phone** (Health Connect on Android, Apple Health on iPhone). Trainers and admins keep using the website.

It talks to the website's JSON API in `../app/api/mobile/*`, using a 30-day bearer token kept in the Keychain / Keystore. Expo SDK 58, Expo Router, TypeScript.

| Path | What it is |
|---|---|
| `src/app/login.tsx` | Sign in (members only) |
| `src/app/(tabs)/` | Today · Workout · Coach · Profile |
| `src/lib/dashboard.tsx` | Loads `/api/mobile/me`, autosaves progress, syncs health |
| `src/lib/health/` | `index.android.ts` (Health Connect), `index.ios.ts` (HealthKit), one shared interface |

## Health data and fitness bands

The app reads **daily totals** (steps, sleep, resting heart rate, active energy, workouts, weight) for the last 14 days. It syncs when the app opens and when it comes back to the foreground, and sends the totals to `POST /api/mobile/health` (table `health_daily`).

Bands work through the phone's health store. Their companion apps write there: Mi Fitness, Samsung Health, Zepp (Amazfit), Fitbit, Garmin Connect, and Apple Watch on iPhone. Some cheaper bands (Noise, boAt) only sync to Health Connect or Apple Health in some app versions, so test the bands your members own. The app uses the platform's own de-duplicated totals, so phone and band steps aren't added together. For sleep, when two apps record the same night, the app with the most sleep wins.

## Run it on a phone

Health Connect and HealthKit are native modules, so **Expo Go won't work**. You need a development build.

```bash
cd mobile
npm install
# The phone must reach the website; "localhost" means the phone itself.
# Use your computer's LAN IP while `npm run dev` runs in the web project:
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000 npx expo run:android   # Android phone over USB, or an emulator
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000 npx expo run:ios       # iPhone (needs Xcode); the simulator has little Health data
```

Or build in the cloud with no Xcode or Android Studio: `npx eas-cli@latest build --profile development --platform android` (or `ios`).

Checks: `npm run typecheck`, `npm run lint`, `npm run doctor`.

## Before the first store build

1. **Server address.** `expo.extra.apiUrl` in `app.json` is the live site, `https://www.tryrepcount.com`. Use the `www` host: the bare domain redirects there, and a redirect can drop the app's `Authorization` header.
2. **App IDs.** `com.tryrepcount.app` (`ios.bundleIdentifier`, `android.package` in `app.json`), based on the tryrepcount.com domain. **They can't be changed after the first store upload.**
3. **Icons and splash.** Done: the red RepCount R on cream, matching the website. `assets/images/icon.png` (1024, iOS and stores), the Android adaptive foreground/background/monochrome images, and `splash-icon.png`. To change them, edit `public/repcount-mark.svg` and re-render.
4. **Expo account.** `npx eas-cli@latest login`, then `npx eas-cli@latest init` (adds the project ID to `app.json`).

## Google Play

1. Create a Play Console developer account ($25 one-time; identity checks take a few days). New *personal* accounts must run a **closed test with at least 12 testers for 14 days** before production. Organisation accounts (D-U-N-S number) skip this.
2. `npx eas-cli@latest build --profile production --platform android` creates an `.aab`.
3. `npx eas-cli@latest submit --platform android` uploads it to the internal track. The first upload may have to be done by hand in the Play Console.
4. In the Play Console, fill in:
   - **Health apps declaration:** Health Connect data types and why each is needed. Approval takes up to about 7 days, and access then propagates over another 5–7 business days.
   - **Data safety** (health and fitness data, collected, not shared, encrypted in transit, can be deleted).
   - **Privacy policy URL** (`/privacy`) and **account deletion URL**. The app deletes accounts in Profile → Delete account; Play also wants a web link or instructions.
5. Move to closed testing (12+ testers, 14 days), then apply for production.

## Apple App Store

1. Join the Apple Developer Program ($99 a year, as an individual or an organisation).
2. `npx eas-cli@latest build --profile production --platform ios`. EAS creates the certificates and turns on the HealthKit capability from the config plugin.
3. `npx eas-cli@latest submit --platform ios` sends it to App Store Connect, then to **TestFlight**. Internal testers need no review.
4. In App Store Connect, add the privacy "nutrition label" (Health & Fitness, linked to the user, not used for tracking), the privacy policy URL, and a **reviewer demo member account** with a trainer and a planned week, so the screens aren't empty.
5. Rules that matter here:
   - HealthKit data is never used for ads and never stored in iCloud (we don't).
   - Members can delete their account in the app (done).
   - **No purchases or payment links in the iOS app** while membership is sold outside it. Read guideline 3.1 before turning on `PAYMENTS_ENABLED`.

## Known gaps (next steps)

- No push notifications yet. Emails still go out as before.
- Onboarding, nutrition, check-in and the leaderboard are still website-only. The app links to onboarding.
- Health data syncs only while the app is open. Background sync needs extra permissions and review.
