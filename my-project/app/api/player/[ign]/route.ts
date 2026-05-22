//gilar was here
import { NextResponse, type NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { redis } from '@/lib/redis';
import { Player } from '@/lib/models/Player';

type PlayerApi = {
  ign: string;
  team: string;
  agents: string[];
  historicalStats: {
    acs: number;
    kd: number;
    kdDiff: number;
  };
};

type CachedPlayer = {
  ign?: string;
  team?: string;
  agents?: string;
  acs?: string;
  kd?: string;
  kdDiff?: string;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ign: string }> }
) {
  const { ign } = await params;
  const cacheKey = `player:cache:${ign.toLowerCase()}`;

  try {
    const cached = await redis.hgetall<CachedPlayer>(cacheKey);
    if (cached?.ign && cached.team && cached.agents && cached.acs && cached.kd && cached.kdDiff) {
      return NextResponse.json({
        source: 'Redis In-Memory Cache',
        data: {
          ign: cached.ign,
          team: cached.team,
          agents: JSON.parse(cached.agents) as string[],
          historicalStats: {
            acs: parseFloat(cached.acs),
            kd: parseFloat(cached.kd),
            kdDiff: parseInt(cached.kdDiff, 10),
          },
        },
      });
    }

    await connectDB();
    const player = await Player.findOne({
      ign: { $regex: new RegExp(`^${escapeRegExp(ign)}$`, 'i') },
    }).lean<PlayerApi | null>();

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    await redis.hset(cacheKey, {
      ign: player.ign,
      team: player.team,
      agents: JSON.stringify(player.agents),
      acs: player.historicalStats.acs.toString(),
      kd: player.historicalStats.kd.toString(),
      kdDiff: player.historicalStats.kdDiff.toString(),
    });
    await redis.expire(cacheKey, 60);

    return NextResponse.json({ source: 'MongoDB Primary Store', data: player });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
