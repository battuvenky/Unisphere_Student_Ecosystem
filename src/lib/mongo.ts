import { MongoClient } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var __unisphereMongoClient: MongoClient | undefined;
}

function getMongoUri() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  return uri;
}

function getMongoDbName() {
  return process.env.MONGODB_DB?.trim() || "unisphere";
}

export async function getMongoClient() {
  const uri = getMongoUri();

  if (!globalThis.__unisphereMongoClient) {
    globalThis.__unisphereMongoClient = new MongoClient(uri, {
      maxPoolSize: 10,
    });
  }

  await globalThis.__unisphereMongoClient.connect();

  return globalThis.__unisphereMongoClient;
}

export async function getMongoDatabase() {
  const client = await getMongoClient();

  return client.db(getMongoDbName());
}
