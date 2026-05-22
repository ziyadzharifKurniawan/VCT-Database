import { NextResponse, type NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { redis } from '@/lib/redis';
import { MatchHistory } from '@/lib/models/MatchHistory';

type MatchApi = {
  ign: string;
  team: string;
  event: string;
  playedAt: Date;
  opponent: string;
  map: string;
  agent: string;
  result: 'W' | 'L';
  score: string;
  sourceUrl?: string;
  stats: {
    acs: number;
    kills: number;
    deaths: number;
    assists: number;
    kd: number;
  };
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ign: string }> }
) {
  const { ign } = await params;
  const cacheKey = `player:matches:${ign.toLowerCase()}`;

  try {
    const cached = await redis.get<MatchApi[]>(cacheKey);
    if (cached) {
      return NextResponse.json({
        source: 'Redis Match Cache',
        data: cached,
      });
    }

    await connectDB();
    const matches = await MatchHistory.find({
      ign: { $regex: new RegExp(`^${escapeRegExp(ign)}$`, 'i') },
    })
      .sort({ playedAt: -1 })
      .limit(8)
      .lean<MatchApi[]>();

    await redis.set(cacheKey, matches, { ex: 60 });

    return NextResponse.json({
      source: 'MongoDB Match Store',
      data: matches,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
