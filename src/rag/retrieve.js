import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCollection } from '../db/connect.js';
import { generateEmbedding, cosineSimilarity } from './embeddings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

export async function retrieveRelevantChunks(query, topK = 3, clientId = 'default') {
  if (!query || typeof query !== 'string') {
    return [];
  }

  const queryEmbedding = await generateEmbedding(query);
  let documents = [];

  try {
    const collection = await getCollection('knowledge_base');
    // Scope retrieval strictly by client_id. Backwards compatibility for docs without client_id if querying default.
    const filter = (clientId === 'default')
      ? { $or: [{ client_id: 'default' }, { client_id: { $exists: false } }] }
      : { client_id: clientId };

    documents = await collection.find(filter, { projection: { text: 1, embedding: 1 } }).toArray();
  } catch (dbErr) {
    // If MongoDB is offline, fallback smoothly
  }

  // If MongoDB yielded no documents for this client, check fallback files
  if (!documents || documents.length === 0) {
    try {
      const cachePath = path.resolve(__dirname, `data/${clientId}-embeddings-cache.json`);
      const raw = await fs.readFile(cachePath, 'utf8');
      documents = JSON.parse(raw);
    } catch {
      // If client cache doesn't exist, try reading default JSON as plain fallback
      try {
        const fallbackPath = path.resolve(projectRoot, `knowledge/${clientId}.json`);
        const raw = await fs.readFile(fallbackPath, 'utf8');
        const items = JSON.parse(raw);
        documents = items.map((it) => ({ text: typeof it === 'string' ? it : it.text, embedding: [] }));
      } catch {
        documents = [];
      }
    }
  }

  // Filter chunks with valid embeddings and score them
  const scoredChunks = documents
    .filter((doc) => Array.isArray(doc.embedding) && doc.embedding.length > 0)
    .map((doc) => ({
      text: doc.text,
      score: cosineSimilarity(queryEmbedding, doc.embedding),
    }));

  if (scoredChunks.length > 0) {
    scoredChunks.sort((a, b) => b.score - a.score);
    return scoredChunks.slice(0, topK);
  }

  // If documents had no embeddings (e.g. unseeded plain fallback), return top items as context
  return documents.slice(0, topK).map((doc) => ({ text: doc.text, score: 0.5 }));
}
