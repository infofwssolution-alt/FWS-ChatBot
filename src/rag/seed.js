import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCollection, closeDB } from '../db/connect.js';
import { generateEmbedding } from './embeddings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

function parseArgs() {
  const args = process.argv.slice(2);
  let clientId = 'default';
  let clear = false;
  let fileArg = null;

  for (const arg of args) {
    if (arg.startsWith('--client=')) {
      clientId = arg.split('=')[1].trim();
    } else if (arg === '--clear') {
      clear = true;
    } else if (arg.startsWith('--file=')) {
      fileArg = arg.split('=')[1].trim();
    }
  }

  return { clientId, clear, fileArg };
}

async function findKnowledgeFile(clientId, fileArg) {
  if (fileArg) {
    return path.resolve(process.cwd(), fileArg);
  }

  // Check /knowledge/<client_id>.json or /knowledge/<client_id>.md
  const candidates = [
    path.join(projectRoot, 'knowledge', `${clientId}.json`),
    path.join(projectRoot, 'knowledge', `${clientId}.md`),
    path.join(projectRoot, 'src/rag/data', `${clientId}-knowledge.json`),
    path.join(projectRoot, 'knowledge', 'default.json'),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Continue to next candidate
    }
  }

  throw new Error(`Could not find knowledge file for client "${clientId}". Searched in /knowledge/${clientId}.json and .md.`);
}

async function parseKnowledgeFile(filePath) {
  const rawData = await fs.readFile(filePath, 'utf-8');

  if (filePath.endsWith('.json')) {
    const stripped = rawData.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const items = JSON.parse(stripped);
    if (!Array.isArray(items)) {
      throw new Error('Knowledge JSON must contain an array of objects.');
    }
    return items.map((item) => (typeof item === 'string' ? item : item.text)).filter(Boolean);
  }

  // Markdown parsing: split on blank lines into coherent chunks, ignoring standalone title headings
  const paragraphs = rawData
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20 && !/^#\s+[^#\n]+$/.test(p));

  return paragraphs;
}

async function seed() {
  const { clientId, clear, fileArg } = parseArgs();

  console.log('====================================================');
  console.log(`Starting Knowledge Base Seed Process for Client: [${clientId}]`);
  console.log(`Flag --clear: ${clear}`);
  console.log('====================================================');

  if (!process.env.MONGODB_URI) {
    console.error('ERROR: MONGODB_URI is not set in your environment variables.');
    process.exit(1);
  }

  try {
    const filePath = await findKnowledgeFile(clientId, fileArg);
    console.log(`[Seed] Reading knowledge base from: ${filePath}`);

    const textChunks = await parseKnowledgeFile(filePath);
    if (textChunks.length === 0) {
      throw new Error(`No valid text chunks found in ${filePath}`);
    }

    const collection = await getCollection('knowledge_base');

    if (clear) {
      console.log(`[Seed] --clear specified. Deleting existing chunks for client: "${clientId}"...`);
      const deleteResult = await collection.deleteMany({ client_id: clientId });
      console.log(`[Seed] Removed ${deleteResult.deletedCount} existing documents.`);
    }

    console.log(`[Seed] Generating embeddings for ${textChunks.length} chunks...`);
    const documents = [];
    for (let i = 0; i < textChunks.length; i++) {
      const text = textChunks[i];
      console.log(`[Seed] (${i + 1}/${textChunks.length}) Embedding: "${text.substring(0, 60).replace(/\n/g, ' ')}..."`);
      const embedding = await generateEmbedding(text);
      documents.push({
        client_id: clientId,
        text,
        embedding,
        updatedAt: new Date(),
      });
    }

    console.log(`[Seed] Inserting ${documents.length} documents into MongoDB 'knowledge_base' collection...`);
    const insertResult = await collection.insertMany(documents);
    console.log(`[Seed] Successfully inserted ${insertResult.insertedCount} knowledge chunks for client "${clientId}"!`);

    await collection.createIndex({ client_id: 1, updatedAt: -1 });
    console.log('[Seed] Database index { client_id: 1, updatedAt: -1 } ensured.');

    console.log('====================================================');
    console.log(`Seed for client "${clientId}" completed successfully!`);
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
