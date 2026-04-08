import mongoose from "mongoose";

declare global {
  // eslint-disable-next-line no-var
  var __unisphereMongoosePromise: Promise<typeof mongoose> | undefined;
}

export async function connectMongoose() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (!globalThis.__unisphereMongoosePromise) {
    globalThis.__unisphereMongoosePromise = mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB?.trim() || "unisphere",
    });
  }

  return globalThis.__unisphereMongoosePromise;
}
