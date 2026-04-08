import { getMongoDatabase } from "@/lib/mongo";

function nowIso() {
  return new Date().toISOString();
}

export async function loadStore<T>(options: {
  collectionName: string;
  legacyFilePath: string;
  initialValue: T;
}): Promise<T> {
  const db = await getMongoDatabase();

  const collection = db.collection<{ key: string; data: T; updatedAt: string }>(options.collectionName);
  const document = await collection.findOne({ key: "store" });

  if (document?.data) {
    return document.data;
  }

  await collection.updateOne(
    { key: "store" },
    {
      $set: {
        key: "store",
        data: options.initialValue,
        updatedAt: nowIso(),
      },
    },
    { upsert: true }
  );

  return options.initialValue;
}

export async function saveStore<T>(options: {
  collectionName: string;
  legacyFilePath: string;
  value: T;
}) {
  const db = await getMongoDatabase();

  const collection = db.collection(options.collectionName);
  await collection.updateOne(
    { key: "store" },
    {
      $set: {
        key: "store",
        data: options.value,
        updatedAt: nowIso(),
      },
    },
    { upsert: true }
  );
}
