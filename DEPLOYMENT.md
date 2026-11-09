# Production Deployment Guide: `https://tredence.ugandhar.in`

This guide provides step-by-step instructions to deploy **Chat — Private AI Technical Assistant** to production via **Vercel** or a self-hosted Docker / VPS setup.

---

## 🚀 1. Deploying via Vercel (Step-by-Step)

Vercel is the fastest way to deploy Next.js apps with automated HTTPS, global edge caching, and Git-driven continuous deployments.

### Step 1: Push your Code to GitHub
Ensure all your latest changes are pushed to your GitHub repository:
```bash
git push origin main
```

### Step 2: Import Project in Vercel
1. Go to [https://vercel.com](https://vercel.com) and log in.
2. Click **"Add New..."** > **"Project"**.
3. Select your private GitHub repository `uga961/chat` from the list and click **"Import"**.

### Step 3: Configure Environment Variables in Vercel
Under the **Environment Variables** section before deploying, add the following variables:

| Key | Value | Notes |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | *(Your Google AI Studio API Key)* | Required. Never exposed to browser. |
| `APP_ACCESS_KEY` | `admin123` *(or your custom passphrase)* | Required to unlock the chat on the website. |
| `GEMINI_MODEL` | `gemini-3.5-flash` | Optional (defaults to `gemini-3.5-flash`). |
| `SESSION_SECRET` | *(Leave empty)* | **Optional**. The app automatically derives a 256-bit secure secret from `APP_ACCESS_KEY`. |
| `TURSO_DATABASE_URL` | *(Optional - see below)* | For permanent conversation history on serverless. |
| `TURSO_AUTH_TOKEN` | *(Optional - see below)* | Paired with `TURSO_DATABASE_URL`. |

> **Note on Serverless Storage on Vercel**:
> Vercel functions run in an ephemeral serverless environment. Without an external database URL, the app will store active conversations in `/tmp/chat.db`.
>
> If you want **permanent conversation history across serverless cold starts on Vercel**:
> 1. Create a free database at [Turso](https://turso.tech) (free forever, 9GB storage, native SQLite).
> 2. Copy the Database URL (`libsql://...`) into `TURSO_DATABASE_URL` and your auth token into `TURSO_AUTH_TOKEN`.
> 3. That's it! `@libsql/client` connects directly to your cloud SQLite database with zero code changes.

### Step 4: Click "Deploy"
Click the **"Deploy"** button. Vercel will build the project in ~1 minute.

### Step 5: Connect Custom Domain (`tredence.ugandhar.in`)
1. In your Vercel project dashboard, go to **Settings** > **Domains**.
2. Enter `tredence.ugandhar.in` and click **Add**.
3. Vercel will display the DNS record to configure in your domain DNS manager:
   - **Type**: `CNAME`
   - **Name**: `tredence`
   - **Target**: `cname.vercel-dns.com`
4. Once DNS propagates, Vercel automatically generates and renews a free **SSL certificate** (HTTPS).

---

## 🌐 2. Whitelisted GitHub Domain: Running via GitHub Codespaces (`*.app.github.dev`)

If your company network, exam proctoring software, or corporate proxy blocks unknown/newly registered domains like `*.ugandhar.in` or `*.vercel.app`, **GitHub Codespaces** provides an official GitHub URL (`https://<codespace-id>-3000.app.github.dev`) that is automatically recognized, trusted, and whitelisted by corporate firewalls.

### Why GitHub Pages (`*.github.io`) Cannot Be Used:
- **GitHub Pages is strictly static file hosting** (HTML/JS/CSS).
- It cannot run Node.js backend servers, Server-Sent Events (SSE) streaming, or private server-side secrets.
- Putting an AI backend on GitHub Pages would force you to bundle your Gemini API Key into public frontend JS where any user or network proxy can intercept it.
- **GitHub Codespaces**, however, runs the full secure Next.js server inside GitHub's infrastructure and gives you a genuine `*.github.dev` domain with all backend capabilities, SQLite persistence, and complete security intact.

### Step 1: Add Codespace Secrets to your GitHub Repo
1. Open your repository on GitHub: `https://github.com/uga961/chat`.
2. Go to **Settings** > **Secrets and variables** > **Codespaces**.
3. Click **New repository secret** and add:
   - `GEMINI_API_KEY`: *(Your Google AI Studio API Key)*
   - `APP_ACCESS_KEY`: `admin123` *(or your custom unlock passphrase)*
   - `GEMINI_MODEL`: `gemini-3.5-flash`

### Step 2: Launch GitHub Codespace
1. On your repository page, click the green **<> Code** button.
2. Select the **Codespaces** tab.
3. Click **Create codespace on main**.
4. GitHub will build the container automatically using the included `.devcontainer`.

### Step 3: Run the Application
In the Codespace terminal:
```bash
npm run build && npm start
```
*(Or for fast startup: `npm run dev`)*

### Step 4: Make Port 3000 Public to Get your GitHub URL
1. In the bottom panel of VS Code in Codespaces, click the **Ports** tab.
2. You will see port `3000` (`Chat Application`).
3. Right-click port `3000` > **Port Visibility** > select **Public**.
4. Click the copy icon next to the **Forwarded Address** (or click the globe icon to open it).
5. The URL will look like:
   `https://<codespace-unique-name>-3000.app.github.dev`
6. This URL can now be opened directly in any browser on the company network! It is protected by your `APP_ACCESS_KEY` lock screen.

> **Tip for Exams (Preventing Idle Timeout)**:
> By default, Codespaces pauses after 30 minutes of idle time. To prevent it from stopping during an exam:
> 1. Go to [https://github.com/settings/codespaces](https://github.com/settings/codespaces).
> 2. Under **Default idle timeout**, change it to **120 minutes (2 hours)** or **240 minutes (4 hours)**.
> 3. Keep the Codespace browser tab open in the background.

---

## 🐳 3. Alternative: Self-Hosted Docker Compose

If you prefer self-hosting with local file SQLite on your own server or VPS:

```bash
# 1. Clone repository
git clone https://github.com/uga961/chat.git /opt/chat
cd /opt/chat

# 2. Configure .env
cp .env.example .env
nano .env

# 3. Start containers
docker compose up -d --build

# 4. View logs
docker compose logs -f
```

---

## 🔒 3. Verification Checklist

1. Navigate to `https://tredence.ugandhar.in`.
2. You will see the access key screen.
3. **Test wrong key**: enter `wrongkey` and click Unlock. You should be redirected immediately to `https://ugandhar.in`.
4. **Test correct key**: enter your `APP_ACCESS_KEY`. You will be authenticated and redirected to the chat interface.
5. **Test image upload**: paste any screenshot with <kbd>Ctrl+V</kbd> and ask a question.
6. **Test health check**: visit `https://tredence.ugandhar.in/api/health` to verify model status.
