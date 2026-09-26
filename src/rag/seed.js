import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCollection, closeDB } from '../db/connect.js';
import { generateEmbedding } from './embeddings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seed() {
  console.log('====================================================');
  console.log('Starting Knowledge Base Seed Process');
  console.log('====================================================');

  if (!process.env.MONGODB_URI) {
    console.error('ERROR: MONGODB_URI is not set in your environment variables.');
    process.exit(1);
  }

  const jsonFilePath = path.resolve(__dirname, 'data/notebloom-knowledge.json');

  try {
    console.log(`[Seed] Reading knowledge base from: ${jsonFilePath}`);
    const rawData = await fs.readFile(jsonFilePath, 'utf-8');
    // Strip single-line and multi-line comments so JSON with comments can be cleanly parsed
    const strippedJson = rawData.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const items = JSON.parse(strippedJson);

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('JSON file must contain a non-empty array of objects with a "text" field.');
    }

    const collection = await getCollection('knowledge_base');

    console.log(`[Seed] Generating embeddings for ${items.length} knowledge entries...`);

    const documents = [];
    for (let i = 0; i < items.length; i++) {
      const text = items[i]?.text;
      if (!text || typeof text !== 'string') {
        console.warn(`[Seed] Skipping item index ${i}: missing or invalid "text" property.`);
        continue;
      }

      console.log(`[Seed] (${i + 1}/${items.length}) Embedding: "${text.substring(0, 60)}..."`);
      const embedding = await generateEmbedding(text);
      documents.push({
        text,
        embedding,
        updatedAt: new Date(),
      });
    }

    if (documents.length === 0) {
      throw new Error('No valid documents to insert into database.');
    }

    console.log('[Seed] Clearing existing knowledge_base collection to prevent duplicate entries...');
    await collection.deleteMany({});

    console.log(`[Seed] Inserting ${documents.length} documents into MongoDB 'knowledge_base' collection...`);
    const result = await collection.insertMany(documents);
    console.log(`[Seed] Successfully inserted ${result.insertedCount} knowledge chunks!`);

    await collection.createIndex({ updatedAt: -1 });
    console.log('[Seed] Database index created.');

    console.log('====================================================');
    console.log('Seed completed successfully!');
    console.log('====================================================');
  } catch (error) {
    console.error('[Seed Error] Failed to complete seeding:', error.message);
    process.exit(1);
  } finally {
    await closeDB();
    process.exit(0);
  }
}

seed();
