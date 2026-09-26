Fill in /src/rag/data/notebloom-knowledge.json with realistic placeholder 
content for a stationery brand called Notebloom. Use these real facts 
about the business to make your assumptions grounded rather than 
generic:

- Notebloom is a stationery brand with its own e-commerce storefront 
  (website + cart + checkout)
- It also sells through TikTok Shop and takes orders via WhatsApp
- It has done in-person sales at a Habitt stall/pop-up before
- It offers custom/bulk sourcing orders in addition to standard 
  ready-to-buy products, priced individually per order (not fixed 
  pricing)
- Products are sourced from local wholesale markets, so pricing should 
  read as PKR (Pakistani Rupee), not USD

Generate 15-20 entries in the JSON array format ({ "text": "..." }), 
covering these categories, clearly realistic for a small stationery 
brand but marked as assumptions:

1. Product categories (assume common stationery items: notebooks, 
   planners, pens, sticky notes, desk organizers, gift sets — pick 
   specifics that fit a stationery brand's typical catalog)
2. Standard pricing ranges for those categories (invent plausible PKR 
   price ranges, not exact numbers — e.g. "Notebooks typically range 
   from Rs. X to Rs. Y depending on size and cover type")
3. How to order: mention the website, TikTok Shop, and WhatsApp as 
   channels
4. Shipping/delivery: assume standard Pakistani courier delivery 
   timelines (e.g. 3-5 business days within Karachi, longer 
   nationwide) — mark this as an assumption to verify
5. Returns/exchange: draft a reasonable, standard small-business policy 
   (e.g. exchange within X days if unused/unopened) — mark as assumed
6. Custom/bulk orders: explicitly state these are priced individually 
   based on quantity and requirements, and direct customers to contact 
   the team directly — do NOT invent specific bulk pricing
7. General FAQ: payment methods commonly used in Pakistan (COD, bank 
   transfer, EasyPaisa/JazzCash if relevant), whether they sell 
   internationally or just within Pakistan

For every single entry that is an assumption rather than a stated fact 
about the real business, prefix it in a code comment (not inside the 
"text" string itself) with:
// ASSUMED — VERIFY: [what needs checking]

Then output a separate summary list at the end: every assumed fact, 
grouped by category, in plain language, so I can quickly scan and tell 
you what's wrong or needs changing — rather than having to re-read the 
whole JSON file line by line.