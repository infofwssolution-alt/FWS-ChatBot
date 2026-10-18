import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCollection } from '../db/connect.js';
import { generateEmbedding, cosineSimilarity } from './embeddings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function retrieveRelevantChunks(query, topK = 3) {
  if (!query || typeof query !== 'string') {
    return [];
  }

  const queryEmbedding = await generateEmbedding(query);
  let documents = [];

  try {
    const collection = await getCollection('knowledge_base');
    documents = await collection.find({}, { projection: { text: 1, embedding: 1 } }).toArray();
  } catch (dbErr) {
    // If MongoDB is offline or unauthenticated, smoothly use local precomputed vector cache
  }

  if (!documents || documents.length === 0) {
    const cachePath = path.resolve(__dirname, 'data/kelvyn-embeddings-cache.json');
    const raw = await fs.readFile(cachePath, 'utf8');
    documents = JSON.parse(raw);
  }

  const scoredChunks = documents
    .filter((doc) => Array.isArray(doc.embedding) && doc.embedding.length > 0)
    .map((doc) => ({
      text: doc.text,
      score: cosineSimilarity(queryEmbedding, doc.embedding),
    }));

  scoredChunks.sort((a, b) => b.score - a.score);
  return scoredChunks.slice(0, topK);
}
