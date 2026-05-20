import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI as string;

let cached = (global as any).__mongo ?? { conn: null, promise: null };
(global as any).__mongo = cached;

export async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) cached.promise = mongoose.connect(MONGO_URI);
  cached.conn = await cached.promise;
  return cached.conn;
}