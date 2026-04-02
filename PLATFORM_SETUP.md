# Platform Developer Account Setup — Instagram & TikTok

## About PopsDrops

PopsDrops is a cross-border influencer marketing platform connecting brands with vetted micro-creators. Creators connect their social accounts via OAuth so brands can see verified follower counts and campaign performance metrics.

Legal entity: **Tengri Vertex, LLC** — Delaware LLC, principal office San Francisco, California. D/b/a PopsDrops.

Website: **https://popsdrops.com**
Privacy Policy: **https://popsdrops.com/privacy**
Terms of Service: **https://popsdrops.com/terms**

---

## 1. INSTAGRAM (Meta)

### Portal
https://developers.facebook.com/apps

### What to create
A Meta app using the **Instagram API with Instagram Login** path (NOT the legacy Facebook Login path).

### Step-by-step

1. Go to https://developers.facebook.com/apps → Click **"Create App"**
2. Select use case: **"Other"**
3. Select app type: **"Business"**
4. Enter app details:
   - **App name:** `PopsDrops`
   - **App contact email:** (your email)
   - **Business portfolio:** Connect to the Tengri Vertex business account, or create one
5. In the App Dashboard, scroll down to **"Instagram"** and click **"Set up"**
6. Choose **"Instagram API with Instagram Login"** — this is the newer, simpler path
7. Go to **App Settings > Basic** and configure:
   - **App Icon:** Upload a 1024x1024px PNG (PopsDrops logo, no Meta branding)
   - **Privacy Policy URL:** `https://popsdrops.com/privacy`
   - **Terms of Service URL:** `https://popsdrops.com/terms`
   - **App Domains:** `popsdrops.com`, `localhost`
   - **App Category:** Choose the closest match (Business/Marketing)
8. Under **Instagram > API setup with Instagram Login**, add these **Redirect URIs:**
   - `http://localhost:3000/auth/social/callback/instagram` (development)
   - `https://popsdrops.com/auth/social/callback/instagram` (production)
9. Under **App Roles > Instagram Testers**, add your personal Instagram account as a tester. Then go to your Instagram app → Settings → Website Permissions → Tester Invitations → Accept.

### Scopes we need
- `instagram_business_basic` — Read creator profile data (username, follower count, media)
- `instagram_business_manage_insights` — Read post-level metrics (views, reach, likes, comments, shares, saves) and audience demographics (age, gender, location)

### Values to retrieve
From **App Settings > Basic**, copy these two values:
- **Instagram App ID** (numeric string)
- **Instagram App Secret** (hex string — click "Show" to reveal)

### For app review submission (later, not now)
When ready to go live (move from Development to Live mode), Meta requires:
- One screencast per permission (2 total) showing: logged-out state → login flow → permission grant → app using that data
- Screencasts: 1080p, no audio, English UI, max 1440px width
- Written justification per permission explaining exactly what the app does with the data
- At least 1 successful API call per permission within 30 days before submission
- Business verification: Upload official document (LLC filing, utility bill) to Business Manager
- Reviewers will try to access and test your app — it must be reachable

### Environment variables to set
```
INSTAGRAM_APP_ID=<the App ID from step 9>
INSTAGRAM_APP_SECRET=<the App Secret from step 9>
```

---

## 2. TIKTOK

### Portal
https://developers.tiktok.com

### What to create
A TikTok developer app with Login Kit and TikTok API (Display API) products.

### Step-by-step

1. Go to https://developers.tiktok.com → **Sign up** or log in
2. If prompted, **create an organization:**
   - Organization name: `Tengri Vertex LLC`
   - Type: Company/Business
3. Click **"Manage Apps"** → **"Connect an app"**
4. Select owner: your organization
5. Enter app details:
   - **App name:** `PopsDrops`
   - **App icon:** 600x600px PNG/JPEG (no watermarks, no QR codes, no rounded corners)
   - **Description:** `Cross-border influencer marketing platform. Creators connect their TikTok accounts to verify their profile and enable brands to see real campaign performance metrics.`
   - **Category:** Choose the closest match (Marketing/Business Tools)
6. **Add products:**
   - Click **"Login Kit"** → Add
   - Click **"TikTok API"** → Add (this enables Display API for reading user info and videos)
7. Configure **Login Kit > Web:**
   - **Website URL:** `https://popsdrops.com`
   - **Redirect URI:** `https://localhost:3000/auth/social/callback/tiktok` (for development — TikTok requires HTTPS)
   - Add production URI too: `https://popsdrops.com/auth/social/callback/tiktok`
8. **Configure scopes** (under the TikTok API product settings):
   - `user.info.basic` — Basic identity (display name, avatar)
   - `user.info.profile` — Profile details (username, bio, verified status)
   - `user.info.stats` — Follower count, following count, likes count, video count
   - `video.list` — List and query the creator's videos with view/like/comment/share counts
9. **Set up Sandbox** (required for first-time app review):
   - Go to Sandbox section → Create a sandbox
   - Add up to 10 TikTok accounts as test users
   - Test users must log in and accept the Developer Terms of Service
10. Grab credentials from the app settings:
    - **Client Key** (this is the app identifier — TikTok calls it `client_key`, not `client_id`)
    - **Client Secret**

### Important requirements for the website
TikTok reviewers specifically check these:
- **Privacy Policy link must be visible on popsdrops.com homepage** — not hidden behind a hamburger menu or buried in the footer. Must be clickable without opening any menus.
- **Terms of Service link must be visible on popsdrops.com homepage** — same rule.
- The website must be fully developed and externally accessible (not just a login/landing page).

### Scopes we need
- `user.info.basic` — open_id, union_id, avatar_url, display_name
- `user.info.profile` — username, bio_description, is_verified, profile_deep_link
- `user.info.stats` — follower_count, following_count, likes_count, video_count
- `video.list` — video id, cover image, title, embed link, view/like/comment/share counts

### Values to retrieve
From the app settings page:
- **Client Key** (alphanumeric string)
- **Client Secret** (alphanumeric string)

### For app review submission (later, not now)
When ready to submit for production access:
- 1-5 demo videos (max 50MB each) showing end-to-end integration using the Sandbox environment
- Domain shown in the demo video must match the website URL in app config
- Detailed written explanation of how each scope is used
- App must be fully functional (not in beta/test state)
- Privacy Policy + ToS must be prominently linked on homepage
- Post-approval: 600 requests/minute rate limit per endpoint, active user cap (can request increases), access tokens expire every 24 hours (our code handles automatic refresh)

### TikTok HTTPS requirement for development
TikTok requires HTTPS redirect URIs even for local development. Options:
- Use their Sandbox with test users (recommended for testing)
- Set up a local HTTPS proxy (e.g., `mkcert` + reverse proxy)
- Use a tunneling service like ngrok

### Environment variables to set
```
TIKTOK_CLIENT_KEY=<the Client Key from step 10>
TIKTOK_CLIENT_SECRET=<the Client Secret from step 10>
```

---

## Summary — What I need back

After completing both setups, provide these 4 values:

```
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
```

Both platforms will be in Development/Sandbox mode, which is fine — we can test OAuth flows with test users before submitting for full app review.
