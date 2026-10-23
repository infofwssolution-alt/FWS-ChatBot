# Knowledge Base Seeding Guide

This guide explains how to format and seed knowledge files for any client or demo in the chatbot system.

## 1. File Format

Knowledge files live in `/knowledge/<client_id>.json` (or `/knowledge/<client_id>.md`).

### JSON Format (`/knowledge/<client_id>.json`):
```json
[
  { "text": "Product Categories: We offer notebooks, planners, pens, and accessories." },
  { "text": "Standard Pricing: Notebooks range from Rs. 400 to Rs. 900 depending on binding." },
  { "text": "Shipping: Orders are dispatched within 24 hours. Standard delivery takes 3-5 days." },
  { "text": "Returns: Exchanges are accepted within 7 days of delivery for unused items in original packaging." },
  { "text": "Custom & Bulk Orders: Bulk and corporate orders are priced individually per specification. Contact our team for quotes." }
]
```

### Markdown Format (`/knowledge/<client_id>.md`):
You can also use plain markdown files; paragraphs or sections separated by empty lines will be chunked and embedded automatically.

---

## 2. Seeding a Client Demo

Run the seed command with the target client ID and the `--clear` flag:

```bash
npm run seed -- --client=yourclient --clear
```

- `--client=<id>`: Associates the chunks with this client.
- `--clear`: Removes existing chunks for this specific client before inserting new ones.

---

## 3. Resetting a Client Demo

To clean up all knowledge chunks, conversation logs, and rate limit counters for a specific client:

```bash
npm run reset -- --client=yourclient
```