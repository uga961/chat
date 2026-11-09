# Production Deployment Guide: `https://tredence.ugandhar.in`

This guide explains how to deploy **Chat — Private AI Technical Assistant** to production at `https://tredence.ugandhar.in`.

---

## 1. Domain & DNS Configuration

In your DNS provider (e.g., Cloudflare, Route53, Namecheap):

1. **Add a DNS Record**:
   - **Type**: `A` record (or `CNAME` if using a reverse proxy / tunnel)
   - **Name / Host**: `tredence` (for subdomain `tredence.ugandhar.in`)
   - **Value / Target**: The public IPv4 address of your production server (or server hostname).
   - **TTL**: Auto or 300 seconds.

---

## 2. Server Prerequisites

On your Ubuntu/Debian/Fedora production server:
- Node.js 22+ (or Docker & Docker Compose)
- Nginx or Caddy (for SSL termination)
- Certbot (for free automated Let's Encrypt SSL certificates)

---

## 3. Deployment Method A: Docker Compose (Recommended)

Docker isolates the Next.js runtime and guarantees that dependencies, Node versions, and SQLite compile cleanly.

### Step 1: Clone Repository & Create `.env`

```bash
git clone https://github.com/uga961/chat.git /opt/chat
cd /opt/chat

cp .env.example .env
nano .env
```

Populate the production values:
```env
GEMINI_API_KEY=your_actual_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
APP_ACCESS_KEY=your_strong_private_passphrase
SESSION_SECRET=generate_with_openssl_rand_base64_32
PORT=3000
HOST=0.0.0.0
```

> **Tip**: Generate a strong `SESSION_SECRET` with:
> `openssl rand -base64 32`

### Step 2: Build & Start Container

```bash
docker compose up -d --build
```

Verify container health:
```bash
docker compose ps
curl http://localhost:3000/api/health
```

---

## 4. Deployment Method B: Systemd & Standalone Node.js

If running directly on the host with Node.js 22:

### Step 1: Build the Project

```bash
cd /opt/chat
npm ci
npm run build
```

### Step 2: Configure Systemd Service

Create `/etc/systemd/system/chat.service`:

```ini
[Unit]
Description=Chat - Private AI Technical Assistant
After=network.target

[Service]
Type=simple
User=uga961
WorkingDirectory=/opt/chat
EnvironmentFile=/opt/chat/.env
ExecStart=/usr/bin/node /opt/chat/.next/standalone/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now chat
sudo systemctl status chat
```

---

## 5. Reverse Proxy & SSL Setup (Nginx + Certbot)

### Step 1: Configure Nginx

Copy the provided Nginx configuration:
```bash
sudo cp /opt/chat/nginx.conf.example /etc/nginx/sites-available/tredence.ugandhar.in
sudo ln -s /etc/nginx/sites-available/tredence.ugandhar.in /etc/nginx/sites-enabled/
```

### Step 2: Obtain SSL Certificate

```bash
sudo certbot --nginx -d tredence.ugandhar.in
```

### Step 3: Test and Reload Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. Verification and Health Check

1. Open `https://tredence.ugandhar.in/api/health` in your browser or curl:
   ```bash
   curl -i https://tredence.ugandhar.in/api/health
   ```
2. Navigate to `https://tredence.ugandhar.in`:
   - You should see the minimal access-key screen.
   - Enter an incorrect key: verify you are redirected to `https://ugandhar.in`.
   - Enter the valid `APP_ACCESS_KEY`: verify you are authenticated and redirected into the chat.
   - Test text queries and paste a screenshot with <kbd>Ctrl+V</kbd>.
