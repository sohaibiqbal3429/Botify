# 5GBOTIFY Mobile (Expo)

This folder contains the full Expo/React Native client for 5GBOTIFY. It mirrors the production web app feature set: authentication, dashboard, wallet (deposit/withdraw), referrals, activity, profile, tasks, support, and admin controls. All network calls target the existing 5GBOTIFY backend API; no mock data is used.

## Prerequisites
- Node.js 18+ and pnpm/npm/yarn installed
- Java 17+ and Android SDK (for `expo run:android` / Play Store builds)
- Watchman (macOS) recommended
- Android device/emulator with USB debugging enabled for runtime validation

## Environment
Create `mobile/.env` using the template below:
```
cp .env.example .env
```
Set values:
- `EXPO_PUBLIC_API_BASE_URL` (or `API_BASE_URL`): the backend root including `/api`, e.g. `https://mintminepro.com/api`
- `AUTH_TOKEN_KEY` / `REFRESH_TOKEN_KEY`: storage keys for persisted auth/session tokens
- `APP_ENV`: `development`, `staging`, or `production`
- `ENABLE_DEV_OTP_FALLBACK`: `true` only in non-production environments to surface OTP codes when mail/SMS is unavailable
- `SENTRY_DSN`: optional crash reporting endpoint

## Install dependencies
```bash
pnpm install      # or npm install / yarn install
```

## Run the app
```bash
pnpm start        # starts Expo + Metro
pnpm android      # builds & runs on a connected Android device/emulator
pnpm web          # optional web preview
```

## Quality gates
```bash
pnpm typecheck    # TypeScript validation
pnpm lint         # Lint via Expo/ESLint
pnpm test         # Jest/unit tests
pnpm expo-doctor  # (optional) ensure environment correctness
```

## End-to-end and production validation
1. **Auth**: login, register, forgot/reset password, OTP verification, logout, and session restore after app restart.
2. **Navigation**: open/close the drawer repeatedly; verify role-based routes (admin panel visible only for admin users).
3. **Dashboard**: load KPIs; verify loading, error, and empty states; pull-to-refresh.
4. **Wallet**: balances, deposit address/QR + copy, withdraw submission, history, and double-submit protection.
5. **Referrals**: counts, hierarchy, rewards, and pagination.
6. **Activity**: chronological transactions/history with pagination.
7. **Tasks**: list + claim rewards; verify completed states.
8. **Profile**: view/update profile, change password via OTP, logout, and token cleanup.
9. **Support**: fetch FAQs, list tickets, and create tickets via API.
10. **Admin**: protected stats, users, and transactions access; ensure normal users are denied.
11. **Resilience**: offline/slow network states, expired/invalid tokens, background/foreground, and app restarts.

## Android build (Play Store ready)
```bash
pnpm start -- --no-dev --minify   # smoke-test production mode
pnpm expo export --platform android --dev-client --output-dir dist
pnpm expo run:android --variant release
```
Configure signing (keystore) through Expo EAS or Gradle as appropriate for your release workflow.
