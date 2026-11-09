# Chat — Private AI Technical Assistant

A lightweight, private, multimodal AI assistant designed specifically for fast, accurate technical answers across Python, SQL, Microsoft Excel, Cloud Infrastructure, and Data Engineering.

Inspired by the clean simplicity of ChatGPT, but tuned for deterministic engineering answers rather than verbose conversational tutorials.

---

## ⚡ Core Highlights

- **Targeted Technical Focus**: Specialized system prompts and persona fine-tuned for Python code, SQL query optimization, Excel formulas, AWS/Azure/GCP architectures, and debugging.
- **Multimodal Image Input**:
  - Upload screenshots or code images.
  - Drag-and-drop images directly into the chat area.
  - **Instant Clipboard Paste (<kbd>Ctrl+V</kbd>)** for immediate screenshot troubleshooting.
  - Automatic problem extraction: extracts tables, code, and questions without manual typing.
- **Three Response Modes**:
  - `Answer Only` *(Default)*: Returns strictly the solution, formula, query, or option letter. Zero conversational fluff.
  - `Short`: Direct answer followed by 1–3 concise sentences explaining the technical reasoning or root cause.
  - `Detailed`: Full breakdown, code walkthrough, and step-by-step trace.
- **Google Gemini Integration**: Powered by `@google/genai` with streaming responses (SSE), configurable models (default `gemini-3.5-flash`), temperature tuning for syntax precision, and exponential backoff retry.
- **Private & Secure**:
  - Server-side only Gemini API key (never transmitted to browser or client bundles).
  - Minimal access-key gateway with rate limiting against brute force attempts.
  - **Incorrect access key immediately redirects to `https://ugandhar.in`**.
  - Encrypted, HTTP-only, SameSite JWT session cookies.
- **Persistent Conversation Memory**: LibSQL / SQLite database supporting local files, `/tmp/chat.db`, or Turso cloud for zero-maintenance message retention, conversation management, and context awareness.
- **Modern Minimalist UI**:
  - Built with Next.js 15, React 19, and Tailwind CSS.
  - Syntax-highlighted code blocks with language labels and one-click copy buttons.
  - Markdown formatting with tables, lists, and KaTeX math formulas.
  - Persistent Light and Dark themes.
  - Fully mobile-responsive drawer sidebar.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Framework** | Next.js 15 (App Router, Server Actions, Standalone Build) |
| **Frontend** | React 19, Tailwind CSS, Lucide Icons |
| **AI SDK** | `@google/genai` (Official Google Gen AI SDK) |
| **Database** | LibSQL / SQLite via `@libsql/client` (Local WAL & Cloud Turso support) |
| **Authentication** | Edge-compatible HMAC / JWT (`jose`), Timing-safe comparisons |
| **Markdown & Code** | `react-markdown`, `remark-gfm`, `rehype-highlight`, `katex` |
| **Deployment** | Docker, Docker Compose, Nginx, Systemd |

---

## 📋 Environment Variables

Create a `.env` file in the project root based on `.env.example`:

```bash
cp .env.example .env
```

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Google Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) | *(Required)* |
| `GEMINI_MODEL` | Target Gemini model name | `gemini-2.5-flash` |
| `APP_ACCESS_KEY` | Secret access passphrase required on the login screen | *(Required)* |
| `SESSION_SECRET` | 32+ character random secret used to sign session cookies | *(Required in prod)* |
| `PORT` | Listening port | `3000` |
| `HOST` | Listening host | `0.0.0.0` |

> **Security Note:** Never commit `.env` to version control. The repository includes strict `.gitignore` rules and GitGuardian pre-commit hooks.

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- Node.js 22.x or later
- npm 10.x or later

### Installation

```bash
# Clone the repository
git clone https://github.com/uga961/chat.git
cd chat

# Install dependencies
npm install

# Set up local environment
cp .env.example .env.local
# Add your GEMINI_API_KEY and APP_ACCESS_KEY to .env.local

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Enter your configured `APP_ACCESS_KEY` to unlock the chat.

---

## 🧪 Testing

Run the automated unit, security, and end-to-end integration test suites:

```bash
npm test
```

The test suite validates:
1. System prompt generation and response mode constraints (`answer_only`, `short`, `detailed`).
2. Edge-compatible JWT session creation and verification.
3. Application access-key timing-safe comparison.
4. IP rate-limiting and 15-minute brute-force lockout.
5. SQLite conversation and message CRUD with cascading deletions.
6. Multimodal data preparation and image base64 normalization.
7. Database and API health reporting.
8. End-to-end server authentication, cookie issuance, and unauthorized redirection to `https://ugandhar.in`.

---

## 🚢 Production Deployment

The designated production domain is `https://tredence.ugandhar.in`.

### Option 1: Docker Compose (Recommended)

```bash
# Build and start container
docker compose up -d --build

# View logs
docker compose logs -f
```

### Option 2: Standalone Node.js

```bash
npm run build
node .next/standalone/server.js
```

### Nginx Reverse Proxy & SSL

An optimized Nginx configuration with SSE streaming support (`proxy_buffering off`) is provided in `nginx.conf.example`. Refer to [DEPLOYMENT.md](./DEPLOYMENT.md) for full instructions on DNS records and Certbot SSL setup.

---

## 🛡️ Response Rules Reference

- **Multiple-Choice Questions**: Returns option letter and answer text immediately. No explanation of incorrect choices unless requested.
- **Python**: Returns syntactically correct, modern code. No unnecessary preamble.
- **SQL**: Returns optimal query respecting the database dialect (Postgres, MySQL, Snowflake, BigQuery, etc.).
- **Excel**: Returns the exact functional formula (e.g., `=XLOOKUP(...)`).
- **Debugging**: Identifies the problem, provides the fix, and notes root cause concisely.
