import mongoose, { type Mongoose } from 'mongoose';

const MONGO_URI = process.env.MONGO_URI;

type CachedMongoConnection = {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
};

declare global {
  var __mongo: CachedMongoConnection | undefined;
}

const cached = globalThis.__mongo ?? { conn: null, promise: null };
globalThis.__mongo = cached;

export async function connectDB() {
  if (!MONGO_URI) {
    throw new Error('MONGO_URI is not configured');
  }

  if (cached.conn) return cached.conn;
  cached.promise ??= mongoose.connect(MONGO_URI);
  cached.conn = await cached.promise;
  return cached.conn;
}
