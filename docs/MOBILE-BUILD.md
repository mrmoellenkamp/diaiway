# Mobile Build (Capacitor + Next.js)

## Architecture

This Next.js app uses **API routes** and **dynamic server features** (auth, database). A full static export (`output: "export"`) is **not possible** without refactoring. Instead, the mobile app uses:

- **server.url**: Loads the live webapp (`https://diaiway.com`) in the WebView
- **webDir: "out"**: Minimal placeholder created by `scripts/prepare-mobile-webdir.mjs` for `cap sync`

## Workflow

```bash
# Prepare out/ and sync to ios + android
npm run mobile:sync
```

This runs:
1. `node scripts/prepare-mobile-webdir.mjs` – creates minimal `out/index.html` + `out/error.html`
2. `npx cap sync` – copies `out/` to `ios/App/App/public` and `android/app/src/main/assets/public`

## Config

| File | Key | Value |
|------|-----|-------|
| `capacitor.config.ts` | webDir | `"out"` |
| `capacitor.config.ts` | server.url | `https://diaiway.com` (edit for staging) |
| `capacitor.config.ts` | appId | `com.diaiway.app` |
| `capacitor.config.ts` | appName | `diaiway` |

## Optional: Full Static Export (Not Supported)

To use `output: "export"` you would need to:
- Remove or externalize all API routes (move to separate backend)
- Add `generateStaticParams` to every dynamic route (`[id]`, etc.)
- Add `export const dynamic = "force-static"` to any route handlers
- Set `images: { unoptimized: true }` for Image optimization

## Integrity: window/document

All `window`/`document` usage is inside client components or guarded with `typeof window !== "undefined"`. The `use-mobile` hooks may run during SSR pre-render – ensure they handle `window` being undefined (e.g. return default, then update in useEffect).

## Android release signing

Release builds **must not** store keystore passwords in Git.

1. Copy `android/keystore.properties.example` → `android/keystore.properties` (gitignored).
2. Put your upload keystore in `android/app/` (e.g. `release.keystore`) and set `storeFile`, passwords, and `keyAlias` in `keystore.properties`.

**CI (e.g. GitHub Actions):** set env vars `ANDROID_KEYSTORE_PATH`, `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS` instead of committing `keystore.properties`.

If you ever had default passwords in `build.gradle` in the repo, **rotate** the signing key in Play Console and treat the old key as compromised.

## Android App Links

`AndroidManifest.xml` declares `https` App Links for `diaiway.com` / `www.diaiway.com`. For **autoVerify** to succeed, host **Digital Asset Links** at:

`https://diaiway.com/.well-known/assetlinks.json`

(Play Console → App integrity → App signing helps with the correct certificate fingerprint.)
