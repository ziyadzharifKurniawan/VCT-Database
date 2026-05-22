import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { redis } from '@/lib/redis';
import { Player } from '@/lib/models/Player';

type LeaderboardPlayer = {
  ign: string;
  team: string;
  agents: string[];
  historicalStats: {
    acs: number;
    kd: number;
    kdDiff: number;
  };
};

export async function GET() {
  try {
    await connectDB();
    const rankedIgns = await redis.zrange<string[]>('vct:leaderboard:acs', 0, -1, { rev: true });
    const players = await Player.find({ ign: { $in: rankedIgns } }).lean<LeaderboardPlayer[]>();
    const playerByIgn = new Map(players.map((player) => [player.ign, player]));
    const sorted = rankedIgns
      .map((ign) => playerByIgn.get(ign))
      .filter(Boolean);
    return NextResponse.json({ source: 'Redis ZSET + MongoDB', data: sorted });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
