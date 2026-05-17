Phola — deploy to Cloudflare Pages

Setup
1. Push this repository to GitHub (remote already set to https://github.com/jackyphuti/Phola.git).
2. In the GitHub repo settings, add the following Secrets:
   - `CLOUDFLARE_API_TOKEN` — a Pages or account token that can deploy Pages sites.
   - `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID.
   - `CLOUDFLARE_PROJECT_NAME` — the Pages project name (as shown in Cloudflare Pages dashboard).

Cloudflare Pages
- In the Cloudflare dashboard, create a new Pages site and connect your GitHub repo, or allow the GitHub Action to deploy using the above secrets.
- Build command: `npm run build`
- Build output directory: `.next` (if using Next.js on Pages) or `public` for a static export. See Cloudflare docs for Next.js compatibility (`next-on-pages`).

Next.js on Cloudflare Pages
- This repo uses the Cloudflare Pages adapter in the GitHub Action to make Next.js work on Pages.
- The action runs `npm run build` and then `npx @cloudflare/next-on-pages --output-dir=.next` before publishing.
- Ensure your Pages project is configured to use `.next` as the build output directory in the Cloudflare Pages settings.

Native APK
- After deploy, set the `CAPACITOR_SERVER_URL` environment variable to your deployed origin, then run:
  ```bash
  export CAPACITOR_SERVER_URL="https://your-site.pages.dev"
  npx cap sync android
  cd android
  ./gradlew assembleRelease
  adb install -r app/build/outputs/apk/release/app-release.apk
  ```

Notes
- If your app requires server-side functionality (auth callbacks, Supabase), follow Cloudflare's Next.js on Pages guide or deploy to a platform that supports SSR.
