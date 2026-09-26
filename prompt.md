I'm building the backend AND embeddable frontend widget for an AI 
chat/FAQ bot that businesses can drop into their websites. Build this 
as a complete, working project in one pass.

=== TECH STACK ===
- Node.js + Express, ES modules
- MongoDB (official `mongodb` driver, not mongoose) for storing 
  conversations and a knowledge base collection
- Groq API for the LLM (use the `groq-sdk` npm package)
- Upstash Redis (via `@upstash/redis`, REST-based, no persistent socket) 
  for rate limiting
- Vanilla JS for the embeddable widget — no framework, no build step, 
  must run as a single <script> tag on any client site

=== PROJECT STRUCTURE ===
/src/index.js               - entry point
/src/routes/chat.js          - main chat endpoint
/src/db/connect.js           - MongoDB connection
/src/rag/retrieve.js         - knowledge base loading + retrieval
/src/rag/groq.js             - Groq API call + system prompt
/src/middleware/rateLimit.js - Redis-based rate limiter
/src/middleware/originCheck.js - origin allowlist validation
/widget/widget.js            - the embeddable frontend script
/widget/demo.html            - a throwaway test page to embed the widget
.env.example
.gitignore (.env, node_modules)
package.json (with "dev" script using nodemon)
README.md (setup instructions)

=== ENV VARS (.env.example with placeholders only, never real values) ===
PORT
MONGODB_URI
GROQ_API_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
ALLOWED_ORIGINS   (comma-separated, no wildcard support)
RATE_LIMIT_PER_HOUR   (default 20)

=== BACKEND REQUIREMENTS ===

1. POST /chat — accepts { message: string, session_id: string }, 
   streams the reply back using Server-Sent Events (Content-Type: 
   text/event-stream), token by token from Groq's streaming response.

2. Origin validation middleware: reject any request whose Origin header 
   isn't in ALLOWED_ORIGINS with a 403, BEFORE it reaches the rate 
   limiter or the LLM call. Explain in a code comment why this check 
   must run first.

3. Rate limiting middleware: key by session_id, cap at 
   RATE_LIMIT_PER_HOUR requests per session per rolling hour using 
   Upstash Redis. When the cap is hit, return a 429 with a friendly 
   JSON message like "You've reached the message limit, please try 
   again later" — not a raw error.

4. RAG setup:
   - /src/rag/retrieve.js loads a knowledge base from a MongoDB 
     `knowledge_base` collection (documents shaped like { text: string, 
     embedding: number[] }), computes cosine similarity against the 
     incoming message's embedding (use Groq or a free embedding option 
     — tell me which you're using and why), and returns the top 3 
     matching chunks.
   - Include a small seed script (/src/rag/seed.js) that takes a plain 
     array of FAQ/product strings (I'll paste my own later), generates 
     embeddings, and inserts them into MongoDB — I need to be able to 
     re-run this whenever a client's content changes.
   - Write the system prompt so the model: only answers from the 
     retrieved chunks, explicitly says "I'm not sure, let me get you in 
     touch with the team" when the answer isn't in the retrieved 
     content, and never invents pricing, stock, or policy details. Show 
     me the full exact system prompt text as its own section in your 
     response, not buried in code, so I can edit the wording myself.

5. Log every conversation (session_id, message, reply, timestamp) to 
   the `conversations` MongoDB collection — no PII beyond what the 
   client's own visitor typed.

6. GET /health returning { status: "ok" }.

7. Zero hardcoded credentials anywhere — everything from process.env, 
   validated on startup (crash with a clear error message if any 
   required env var is missing, don't fail silently later).

=== WIDGET REQUIREMENTS (/widget/widget.js) ===

- A floating chat bubble, bottom-right, that expands into a chat panel 
  on click
- Rendered inside a Shadow DOM so the host site's CSS can never bleed in 
  or be affected by the widget's styles
- Reads the backend URL and a client identifier from data attributes on 
  its own <script> tag, e.g.:
  <script src=".../widget.js" data-api-url="..." data-client-id="..." defer></script>
- Generates a session_id on first load and stores it in sessionStorage 
  (not localStorage — explain the difference in a comment)
- Calls POST /chat via fetch, reads the SSE stream, and renders tokens 
  as they arrive with a visible "typing" indicator before the first 
  token lands
- Handles the 403 (bad origin) and 429 (rate limited) responses with 
  a plain, non-technical message shown in the chat panel, not a console 
  error the visitor never sees
- No external dependencies, no CDN scripts — fully self-contained in 
  one file

/widget/demo.html should embed the widget pointing at localhost so I 
can test the whole flow end to end before deploying anything.

=== AFTER GENERATING EVERYTHING, ANSWER THESE FOR ME EXPLICITLY ===

1. Walk through what happens, in order, when a visitor types a message 
   in the widget — every middleware/function it passes through before 
   a reply streams back.
2. Show me the full system prompt text on its own, separately from the 
   code block it lives in.
3. Confirm: is there any code path where a message could reach Groq 
   without first passing the origin check AND the rate limiter? If so, 
   fix it before finishing.
4. Exact terminal commands to install dependencies, run the seed 
   script, and start the dev server.
5. Deployment note: this should NOT be deployed to Vercel's Hobby tier 
   once a real client is using it (their ToS prohibits commercial use 
   on that tier) — confirm nothing in this project assumes 
   Vercel-specific serverless behavior that would break on Render or 
   Railway instead.