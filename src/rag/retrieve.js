import { getCollection } from '../db/connect.js';
import { generateEmbedding, cosineSimilarity } from './embeddings.js';

/**
 * Retrieves the top N most relevant knowledge base chunks for an incoming query.
 * 
 * 1. Generates the vector embedding for the query.
 * 2. Fetches all documents from the `knowledge_base` collection in MongoDB.
 * 3. Computes the cosine similarity between the query embedding and each chunk's embedding.
 * 4. Sorts by similarity in descending order and returns the top matches.
 * 
 * @param {string} query The user's input message
 * @param {number} topK Number of chunks to retrieve (default: 3)
 * @returns {Promise<Array<{ text: string, score: number }>>}
 */
export async function retrieveRelevantChunks(query, topK = 3) {
  if (!query || typeof query !== 'string') {
    return [];
  }

  // 1. Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // 2. Fetch all knowledge base documents from MongoDB
  const collection = await getCollection('knowledge_base');
  const documents = await collection.find({}, { projection: { text: 1, embedding: 1 } }).toArray();

  if (!documents || documents.length === 0) {
    console.warn('[RAG] Knowledge base is empty. Please run `npm run seed`.');
    return [];
  }

  // 3. Compute cosine similarity for each document
  const scoredChunks = documents
    .filter((doc) => Array.isArray(doc.embedding) && doc.embedding.length > 0)
    .map((doc) => ({
      text: doc.text,
      score: cosineSimilarity(queryEmbedding, doc.embedding),
    }));

  // 4. Sort descending by score
  scoredChunks.sort((a, b) => b.score - a.score);

  // 5. Return top K results
  const topResults = scoredChunks.slice(0, topK);
  console.log(`[RAG] Retrieved ${topResults.length} chunks. Highest similarity score: ${topResults[0]?.score?.toFixed(4) || 0}`);

  return topResults;
}
