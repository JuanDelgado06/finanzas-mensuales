import { MongoClient } from 'mongodb';

let cachedClient;
let cachedDb;

export async function getMongoDb() {
  if (cachedDb) return cachedDb;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Missing MONGODB_URI environment variable.');
  }

  const dbName = process.env.MONGODB_DB_NAME || 'finanzas_mensuales';

  if (!cachedClient) {
    cachedClient = new MongoClient(uri);
  }

  await cachedClient.connect();
  cachedDb = cachedClient.db(dbName);
  return cachedDb;
}
