# Mobile Build (Capacitor + Next.js)

## Architecture

This Next.js app uses **API routes** and **dynamic server features** (auth, database). A full static export (`output: "export"`) is **not possible** without refactoring. Instead, the mobile app uses:

- **server.url**: Loads the live webapp (www.diaiway.com) in the WebView
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
| `capacitor.config.ts` | server.url | `https://www.diaiway.com` (edit for staging) |
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
