# Multi-Demo AI Chatbot Backend & Embeddable Widget

A production-hardened AI customer support backend and zero-dependency Vanilla JS embeddable widget designed for client demos and live deployments.

Features **Node.js/Express** with Server-Sent Events (SSE) streaming, **Groq** LLM inference, local dense vector embeddings via **@xenova/transformers** ($0 embedding cost), **Upstash Redis** rate limiting and daily caps, and **MongoDB** for knowledge and conversation logging.

---

## 🏗️ Architecture & Request Lifecycle

```
[Visitor / Browser]
       │
       ▼
[Shadow DOM Widget] ─── (Sends message, session_id, client_id)
       │
       ▼
[1. Origin Validation Middleware]  (403 if origin not in ALLOWED_ORIGINS)
       │
       ▼
[2. Server-side Input Validation] (400 if message > 500 chars or missing session_id)
       │
       ▼
[3. Multi-Tier Rate Limiting]     (429 if session cap, IP limit, or daily client cap reached)
       │
       ▼
[4. RAG Retrieval]                (Vector cosine similarity scoped strictly by client_id)
       │
       ▼
[5. Dynamic System Prompt]        (Loaded from /prompts/<client_id>.md with default fallback)
       │
       ▼
[6. Context & History Assembly]   (Appends last 6 turns of session history)
       │
       ▼
[7. Groq Token Streaming]         (Streams SSE tokens chunk-by-chunk to widget)
       │
       ▼
[8. Audit & Analytics Logging]    (Stores session_id, client_id, message, reply in MongoDB)
```

### Client ID Scoping
Every knowledge chunk and conversation log document contains a `client_id` field. During retrieval, queries are strictly filtered by `{ client_id: clientId }`, ensuring that multiple client demos sharing the same MongoDB database never cross-contaminate or return each other's content.

### Demo Workflow (Seed -> Record -> Reset)
1. **Seed demo data**:
   ```bash
   npm run seed -- --client=demo-brand --clear
   ```
2. **Present or record demo**: Open `http://localhost:3000/widget/demo.html` with `data-client-id="demo-brand"`.
3. **Reset after demo**:
   ```bash
   npm run reset -- --client=demo-brand
   ```
   This clears the client's knowledge base, deletes their conversation history, and resets their Redis rate limits.

---

## 🛠️ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure all required variables are set:
- `PORT`
- `MONGODB_URI`
- `GROQ_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `ALLOWED_ORIGINS`
- `RATE_LIMIT_PER_HOUR`
- `RATE_LIMIT_PER_IP_HOUR`
- `DAILY_CAP_PER_CLIENT`
- `ADMIN_TOKEN`

### 3. Run Tests
Verify origin checking, message length validation, rate limiter, and client isolation:
```bash
npm test
```

### 4. Start Server
```bash
# Production
npm start

# Development (with nodemon)
npm run dev
```

---

## 📋 Embeddable Widget Customization

Embed the widget into any site using a single `<script>` tag:

```html
<script 
  src="https://your-chatbot-url.com/widget/widget.js"
  data-api-url="https://your-chatbot-url.com"
  data-client-id="yourclient"
  data-title="Customer Support"
  data-greeting="Hi there! How can I help you today?"
  data-color="#2563eb"
  data-position="bottom-right"
  defer>
</script>
```

### Supported Data Attributes
- `data-api-url`: Base URL of the deployed chatbot backend.
- `data-client-id`: Client demo identifier (default: `"default"`).
- `data-title`: Chat panel header title (default: `"Support Assistant"`).
- `data-greeting`: Initial greeting bubble text.
- `data-color`: Primary brand hex color for launcher, buttons, and user bubble.
- `data-avatar-url`: Optional image URL for bot avatar.
- `data-position`: `"bottom-right"` (default) or `"bottom-left"`.

---

## 🔒 Automated vs. Non-Automated Capabilities

| Capability | Status | Implementation Details |
| :--- | :--- | :--- |
| **FAQ & Knowledge Retrieval** | ✅ Fully Automated | Semantic search via 384-dimensional dense vectors against client's knowledge base. |
| **Product Recommendations** | ✅ Fully Automated | Answers strictly from indexed catalog chunks. Will never invent unlisted items. |
| **Escalation / Lead Capture** | ✅ Semi-Automated | When the bot cannot answer or the user asks for a human, an in-chat form captures name and contact info, saves to MongoDB `leads`, and optionally posts to `LEAD_WEBHOOK_URL`. |
| **Appointment Booking** | ℹ️ Assisted Request | The widget collects appointment details and saves to MongoDB `bookings` with status `pending_confirmation` and forwards to `LEAD_WEBHOOK_URL`. The bot **does not** automatically confirm live calendar slots; team confirmation is required. |
| **Order Modification / Stock** | ❌ Manual Escalation | Guardrails prevent the bot from fabricating live stock or accessing customer order databases. Visitors are instructed to contact support directly. |

---

## 🛡️ Protected Admin Endpoint

Inspect conversations securely across any client:

```bash
# Retrieve recent conversations as JSON
curl -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:3000/admin/conversations?client_id=demo-brand&limit=50"

# Export conversations as CSV
curl -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:3000/admin/conversations?client_id=demo-brand&format=csv" -o conversations.csv
```
