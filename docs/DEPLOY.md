# Deploy (personal)

Neon stays the database you already use. The API runs on Render. The web app runs on Vercel. Load the Chrome extension unpacked and point it at the Render URL.

Do not commit `.env` or real connection strings. Set secrets in each host's dashboard.

## Render (API)

Create a **Web Service** from this GitHub repo. Runtime: **Python 3**.

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Build command | `pip install -r requirements.txt` |
| Start command | `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

`backend/.python-version` pins Python 3.12. Alembic uses `DIRECT_URL` (see `backend/alembic/env.py`).

Render only shows a separate **Pre-Deploy Command** (its name for a release command) on paid instances. On the free plan, leave that unset and keep `alembic upgrade head` in the start command. `upgrade head` is safe to run on every start, including after the free instance wakes up. On a paid instance you can move that command to **Settings → Pre-Deploy Command** and leave the start command as `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

Environment variable **names** (values stay in the dashboard):

| Name | Notes |
|---|---|
| `DATABASE_URL` | Neon pooled URL (hostname contains `-pooler`) |
| `DIRECT_URL` | Neon direct URL (no `-pooler`). Alembic only |
| `JWT_SECRET` | Long random string, at least 16 characters |
| `CORS_ORIGINS` | Exact Vercel origin, no trailing slash. Use `http://localhost:5173` until Vercel gives you a URL, then replace it and redeploy |
| `COOKIE_SECURE` | `true` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` (optional; this is the default) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` (optional; this is the default) |
| `ANILIST_TIMEOUT_SECONDS` | `10` (optional) |
| `ANILIST_SEARCH_CACHE_TTL_SECONDS` | `300` (optional) |
| `ANIME_SYNC_TTL_HOURS` | `24` (optional) |

After the first successful deploy, open `GET /health` on the service URL. It should return `{"status":"ok"}`.

`COOKIE_SECURE=true` sets the refresh cookie to `Secure` and `SameSite=None`, so the Vercel site can send it to this API. CORS allows credentials and only the origins in `CORS_ORIGINS`.

## Vercel (frontend)

Import the same GitHub repo.

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Framework | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node.js | 20 |

No Vercel environment variable is needed for the API. `vercel.json` proxies `/api/*`
to the Render service while keeping the browser URL on the Vercel origin. This makes
the refresh cookie first-party. For local development, Vite proxies `/api` to
`http://127.0.0.1:8000`.

## Wire the two origins

1. Copy the Vercel URL, for example `https://your-app.vercel.app` (no trailing slash).
2. Set Render `CORS_ORIGINS` to that exact origin.
3. Redeploy the Render service if it does not pick up the new variable on its own.

## Extension (unpacked)

The website Settings page links to `frontend/public/anime-tracker-extension.zip`. Rebuild that file from `extension/` with `npm run package` and commit the zip before deploying the frontend. That command bakes `https://anitracker-zvt8.onrender.com` into the popup as the default API. Vercel only publishes the `frontend` directory.

1. From `extension/`, run `npm run build`.
2. Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → `extension/dist`.
3. Open the popup. In **API**, enter the Render origin with no trailing slash: `https://your-api.onrender.com`.
4. On the live site, create an extension token, paste it into **Extension token**, and click **Save token**.
5. Chrome will ask for permission to call that API host. Allow it.

Local development can keep `http://127.0.0.1:8000`.
