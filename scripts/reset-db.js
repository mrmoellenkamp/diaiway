import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

async function resetDatabase() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected.");

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    for (const col of collections) {
      console.log(`Dropping collection: ${col.name}`);
      await db.dropCollection(col.name);
    }

    console.log(`Dropped ${collections.length} collections. Database is now empty.`);
    await mongoose.disconnect();
    console.log("Done.");
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

resetDatabase();
