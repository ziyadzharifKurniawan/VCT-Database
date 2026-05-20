import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { redis } from '@/lib/redis';
import { Player } from '@/lib/models/Player';

export async function GET() {
  try {
    await connectDB();
    const rankedIgns = await redis.zrange<string[]>('vct:leaderboard:acs', 0, -1, { rev: true });
    const players = await Player.find({ ign: { $in: rankedIgns } }).lean();
    const sorted = rankedIgns
      .map((ign) => players.find((p: any) => p.ign === ign))
      .filter(Boolean);
    return NextResponse.json({ source: 'Redis ZSET + MongoDB', data: sorted });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}