import path from 'path';
import { fileURLToPath } from 'url';

// Ensure Windows dynamic linker can resolve onnxruntime dependencies
if (process.platform === 'win32') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const onnxBin = path.resolve(__dirname, '../../node_modules/@xenova/transformers/node_modules/onnxruntime-node/bin/napi-v3/win32/x64');
  if (process.env.PATH && !process.env.PATH.includes(onnxBin)) {
    process.env.PATH = `${onnxBin};${process.env.PATH}`;
  }
}

import { pipeline } from '@xenova/transformers';

let extractor = null;

/**
 * Initializes and returns the feature-extraction pipeline singleton.
 * Uses 'Xenova/all-MiniLM-L6-v2', a fast, high-quality, 384-dimensional sentence embedding model.
 */
async function getExtractor() {
  if (!extractor) {
    console.log('[Embeddings] Loading local all-MiniLM-L6-v2 embedding model (first-time download will cache locally)...');
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('[Embeddings] Model successfully loaded.');
  }
  return extractor;
}

/**
 * Generates a normalized 384-dimensional vector embedding for a given text.
 * 
 * @param {string} text 
 * @returns {Promise<number[]>} Array of floating point numbers
 */
export async function generateEmbedding(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('generateEmbedding requires a valid non-empty string.');
  }

  const pipe = await getExtractor();
  const output = await pipe(text, { pooling: 'mean', normalize: true });
  // Convert Float32Array to standard JavaScript array of numbers
  return Array.from(output.data);
}

/**
 * Computes cosine similarity between two numeric vectors.
 * 
 * @param {number[]} vecA 
 * @param {number[]} vecB 
 * @returns {number} Score between -1 and 1 (typically 0 to 1 for normalized text embeddings)
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}
