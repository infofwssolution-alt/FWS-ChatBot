I'm taking the chat widget project I already built and deploying it for 
real, for my own live e-commerce store, Notebloom (Next.js storefront on 
Vercel, backend for this bot going on Render/Railway). Do the following:

=== 1. SEED CONTENT STRUCTURE ===

Update /src/rag/seed.js so it reads from a plain JSON file, 
/src/rag/data/notebloom-knowledge.json, structured as an array like:

[
  { "text": "..." },
  { "text": "..." }
]

Create that JSON file with PLACEHOLDER entries in these categories so I 
can see the expected format and just replace the text:
- Product categories and what we sell (placeholder — I'll fill in real 
  Notebloom products)
- Standard/listed pricing for regular products (placeholder — NOT 
  custom-sourcing pricing, that stays out of the bot entirely)
- Shipping and delivery info (placeholder)
- Return/exchange policy (placeholder)
- How to place an order — website vs WhatsApp (placeholder)
- Common FAQ (placeholder)

Leave clear "REPLACE ME" markers in each placeholder so it's obvious 
what I still need to write myself.

=== 2. SYSTEM PROMPT — NOTEBLOOM-SPECIFIC GUARDRAILS ===

Update the system prompt in /src/rag/groq.js to explicitly instruct the 
model to:
- Only quote pricing that appears in the retrieved knowledge base chunks
- NEVER quote or estimate pricing for custom/bulk sourcing orders — 
  always respond that custom orders are priced individually and direct 
  the customer to contact the team directly
- NEVER claim to know current stock/inventory levels — say stock can 
  change and to check the product page or ask the team to confirm
- NEVER give an update on an existing order's status — say it can't 
  access order details and to reach out via [contact method] with their 
  order code
- Otherwise behave exactly as before: answer only from retrieved 
  content, say "let me get you in touch with the team" when unsure

Show me the complete, final system prompt text as its own section, 
separate from the code block.

=== 3. DEPLOYMENT CONFIG ===

Add whatever config file Render or Railway needs to deploy this 
Express app cleanly (e.g. a render.yaml or the equivalent for Railway — 
pick whichever this project doesn't already assume, and tell me which 
you chose and why). It should:
- Run `npm install` then `npm start` (add a "start" script to 
  package.json if there isn't one, distinct from the "dev" one using 
  nodemon)
- NOT hardcode the PORT — read it from the platform's own env var if 
  Render/Railway inject one, falling back to my .env value locally
- List every environment variable this project needs, in a clear 
  section of the README, so I know exactly what to paste into 
  Render/Railway's dashboard (MONGODB_URI, GROQ_API_KEY, 
  UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, ALLOWED_ORIGINS, 
  RATE_LIMIT_PER_HOUR)

=== 4. WIDGET INTEGRATION INTO THE NEXT.JS STOREFRONT ===

Write the exact snippet I need to add to Notebloom's root layout 
(app/layout.tsx, Next.js App Router) to load the widget site-wide, using 
Next.js's <Script> component with strategy="lazyOnload" (explain briefly 
why lazyOnload is the right choice here vs other strategies). Use 
placeholder values for data-api-url and data-client-id and mark them 
clearly as "REPLACE WITH REAL DEPLOYED URL" — I'll fill those in once 
the backend has a live domain.

=== 5. AFTER GENERATING EVERYTHING ===

1. List, as a checklist, every placeholder I still need to fill in 
   myself before this goes live (JSON content, ALLOWED_ORIGINS value, 
   widget script src/data attributes) — nothing should silently ship 
   with placeholder text.
2. Confirm: does the updated system prompt still say what happens when 
   a question falls outside all of these categories entirely? Show me 
   that fallback line specifically.