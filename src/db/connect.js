import { MongoClient } from 'mongodb';

let client = null;
let db = null;

/**
 * Initializes and returns the MongoDB database instance.
 * Reuses the existing client instance across requests to maintain a healthy connection pool.
 *
 * @returns {Promise<import('mongodb').Db>}
 */
export async function connectDB() {
  if (db) {
    return db;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('FATAL: MONGODB_URI is not defined in environment variables.');
  }

  try {
    client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
    });

    await client.connect();
    // Use the database specified in the URI connection string, or default to 'chatbot_db'
    db = client.db();
    console.log(`[Database] Successfully connected to MongoDB database: "${db.databaseName}"`);
    return db;
  } catch (error) {
    console.error('[Database] Failed to connect to MongoDB:', error.message);
    throw error;
  }
}

/**
 * Returns a reference to a specific collection.
 * 
 * @param {'knowledge_base' | 'conversations'} collectionName 
 * @returns {Promise<import('mongodb').Collection>}
 */
export async function getCollection(collectionName) {
  const database = await connectDB();
  return database.collection(collectionName);
}

/**
 * Gracefully closes the MongoDB client connection.
 */
export async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('[Database] MongoDB connection closed.');
  }
}
