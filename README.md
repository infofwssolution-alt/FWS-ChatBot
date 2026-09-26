# AI Chat & FAQ Bot Backend + Embeddable Widget

A production-ready, full-stack AI customer support solution featuring a high-performance **Node.js/Express** streaming backend and a zero-dependency **Vanilla JS** widget that embeds on any website via a single `<script>` tag.

---

## 🚀 Features

- **⚡ Real-Time SSE Token Streaming**: Streams Groq LLM responses token-by-token directly to the user's browser using Server-Sent Events (`text/event-stream`).
- **🛡️ Shadow DOM Widget**: The embeddable widget is rendered entirely inside a Shadow DOM tree, completely isolating styles and ensuring client host CSS can never distort or conflict with the widget.
- **🔒 Origin Allowlist Validation**: Strict CORS and Origin verification middleware that rejects unauthorized third parties with HTTP `403` **before** touching Redis or the LLM.
- **⏱️ Upstash Redis Rate Limiting**: Rolling 1-hour session window cap via Upstash Redis REST API (`@upstash/redis`), returning friendly non-technical notifications upon hitting limits (HTTP `429`).
- **🧠 Vector RAG Retrieval**: Computes cosine similarity between queries and indexed MongoDB knowledge chunks using local 384-dimensional dense embeddings (`@xenova/transformers` with `all-MiniLM-L6-v2`), costing $0 for embeddings.
- **🎯 Hallucination Prevention System Prompt**: Constrains the LLM to only answer from retrieved knowledge; triggers an explicit escalation handoff (*"I'm not sure, let me get you in touch with the team."*) when knowledge is absent.
- **📝 Audit & Conversation Logging**: Persists `session_id`, `message`, `reply`, and `timestamp` into MongoDB for continuous analytics and support escalation.
- **🩺 Health Check Endpoint**: `GET /health` returns `{ "status": "ok" }`.

---

## 📁 Project Structure

```
├── .env.example               # Environment variable template
├── .gitignore                  # Git ignore rules (node_modules, .env)
├── package.json               # Scripts & dependencies (ES modules)
├── README.md                  # Setup & architecture guide
├── src/
│   ├── index.js               # Express entry point & startup validation
│   ├── db/
│   │   └── connect.js         # MongoDB connection & pool management
│   ├── middleware/
│   │   ├── originCheck.js     # Strict Origin header validation (runs 1st)
│   │   └── rateLimit.js       # Upstash Redis rolling rate limiter (runs 2nd)
│   ├── rag/
│   │   ├── embeddings.js      # Local sentence transformer & cosine similarity
│   │   ├── groq.js            # Groq streaming completion & system prompt
│   │   ├── retrieve.js        # Knowledge base query retrieval (Top 3)
│   │   └── seed.js            # Seed script to vectorize and index FAQs
│   └── routes/
│       └── chat.js            # Main POST /chat SSE endpoint & DB logger
└── widget/
    ├── widget.js              # Standalone embeddable frontend widget
    └── demo.html              # Local demo test harness
```

---

## 🛠️ Quick Start & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your credentials:
```ini
PORT=3000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/chatbot_db?retryWrites=true&w=majority
GROQ_API_KEY=gsk_your_groq_api_key_here
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://yourclientdomain.com
RATE_LIMIT_PER_HOUR=20
```

### 3. Seed Knowledge Base
Vectorize and index the knowledge base into MongoDB:
```bash
npm run seed
```

### 4. Start Development Server
```bash
npm run dev
```

### 5. Open the Demo Page
Navigate to:
```
http://localhost:3000/widget/demo.html
```
Click the floating chat bubble in the bottom right corner to test the widget.

---

## 📋 Environment Variables Reference for Render / Railway

Paste these directly into your Render or Railway Service Settings under **Environment Variables**:

| Variable Name | Description | Example / Note |
| :--- | :--- | :--- |
| `MONGODB_URI` | Full MongoDB connection string | `mongodb://user:pass@shard1,shard2/chatbot_db?ssl=true...` |
| `GROQ_API_KEY` | API key from console.groq.com | `gsk_...` |
| `UPSTASH_REDIS_REST_URL` | REST endpoint from console.upstash.com | `https://...upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | REST token from console.upstash.com | `gQAAAA...` |
| `ALLOWED_ORIGINS` | Comma-separated allowed frontend origins | `https://notebloom.shop,https://www.notebloom.shop` |
| `RATE_LIMIT_PER_HOUR` | Max allowed messages per session per hour | `20` |
| `GROQ_MODEL` | (Optional) LLM Model on Groq | `openai/gpt-oss-120b` |

*(Note: Render and Railway automatically inject the `PORT` variable into the runtime environment. The application dynamically reads `process.env.PORT` on boot, so you do NOT need to set PORT manually in their dashboards).*

---

## 🌐 Embedding in Next.js Storefront (e.g. Notebloom)

In your Next.js App Router storefront (`app/layout.tsx`), load the widget site-wide:

```tsx
import Script from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* Notebloom AI Chat Widget */}
        <Script
          src="https://REPLACE_WITH_REAL_DEPLOYED_URL/widget/widget.js"
          data-api-url="https://REPLACE_WITH_REAL_DEPLOYED_URL"
          data-client-id="notebloom"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
```

---

## 🔒 Security & Architecture Decisions

### Why Origin Validation Runs Before Rate Limiting
1. **Financial & Quota Protection**: Upstash Redis commands and Groq tokens cost credits. If an unapproved origin spams requests, checking origin first drops the request immediately without consuming Redis credits or invoking embeddings/LLMs.
2. **DDoS Protection**: An attacker can easily spoof session IDs to bypass rate limits. Rejecting unauthorized origins at the gateway level protects database connections and computational resources.
3. **Multi-Tenant Isolation**: Ensures only authorized domains can utilize the service.

### Why `sessionStorage` instead of `localStorage`
- **Session Lifecycle**: `sessionStorage` clears when the browser tab/window closes, ensuring that temporary visitor sessions do not linger indefinitely across months.
- **Device Privacy**: Prevents subsequent users on shared/public computers from inheriting conversation history or rate limit states.
- **Clean Rate Limit Boundaries**: Prevents visitors from being permanently locked out by a stale ID.

---

## 🚢 Deployment Notes (Render, Railway, VPS)
This backend is designed as a persistent, long-running Node.js process using native Server-Sent Events (`text/event-stream`). It does **not** rely on any Vercel-specific serverless abstractions or Edge runtimes. It is 100% compatible with:
- **Render** (Web Service)
- **Railway** (Node.js Service)
- **Fly.io** / **DigitalOcean App Platform** / **AWS ECS** / **Docker**
