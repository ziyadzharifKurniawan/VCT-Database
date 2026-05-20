import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { redis } from '@/lib/redis';
import { Player } from '@/lib/models/Player';

export async function GET(
  _req: Request,
  { params }: { params: { ign: string } }
) {
  const { ign } = params;
  const cacheKey = `player:cache:${ign.toLowerCase()}`;

  try {
    const cached = await redis.hgetall(cacheKey);
    if (cached && (cached as any).ign) {
      const c = cached as any;
      return NextResponse.json({
        source: 'Redis In-Memory Cache',
        data: {
          ign: c.ign,
          team: c.team,
          agents: JSON.parse(c.agents),
          historicalStats: {
            acs: parseFloat(c.acs),
            kd: parseFloat(c.kd),
            kdDiff: parseInt(c.kdDiff),
          },
        },
      });
    }

    await connectDB();
    const player = await Player.findOne({
      ign: { $regex: new RegExp(`^${ign}$`, 'i') },
    }).lean();

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const p = player as any;
    await redis.hset(cacheKey, {
      ign: p.ign,
      team: p.team,
      agents: JSON.stringify(p.agents),
      acs: p.historicalStats.acs.toString(),
      kd: p.historicalStats.kd.toString(),
      kdDiff: p.historicalStats.kdDiff.toString(),
    });
    await redis.expire(cacheKey, 60);

    return NextResponse.json({ source: 'MongoDB Primary Store', data: player });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}