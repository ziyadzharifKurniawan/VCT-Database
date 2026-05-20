import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { redis } from '@/lib/redis';
import { Player } from '@/lib/models/Player';

const vctDataset = [
  { ign: 'TenZ',      team: 'Sentinels',    agents: ['Jett','Omen','Reyna'],             acs: 245.8, kd: 1.22, kdDiff: 142  },
  { ign: 'aspas',     team: 'Leviatán',     agents: ['Jett','Raze','Neon'],              acs: 262.1, kd: 1.38, kdDiff: 289  },
  { ign: 'Chronicle', team: 'Fnatic',       agents: ['Viper','Killjoy','Breach'],        acs: 218.4, kd: 1.15, kdDiff: 98   },
  { ign: 'Boaster',   team: 'Fnatic',       agents: ['Omen','Astra','Gekko'],            acs: 185.2, kd: 0.95, kdDiff: -22  },
  { ign: 'Derke',     team: 'Vitality',     agents: ['Jett','Raze','Yoru'],              acs: 251.0, kd: 1.24, kdDiff: 195  },
  { ign: 'Cryocells', team: '100 Thieves',  agents: ['Jett','Chamber','Brimstone'],     acs: 238.5, kd: 1.21, kdDiff: 110  },
  { ign: 'Asuna',     team: '100 Thieves',  agents: ['Raze','Gekko','KAY/O'],           acs: 222.9, kd: 1.08, kdDiff: 45   },
  { ign: 'something', team: 'Paper Rex',    agents: ['Jett','Reyna','Breach'],           acs: 255.3, kd: 1.28, kdDiff: 210  },
  { ign: 'f0rsakeN',  team: 'Paper Rex',    agents: ['Yoru','Breach','Cypher'],          acs: 231.7, kd: 1.14, kdDiff: 88   },
  { ign: 'cned',      team: 'FUT Esports',  agents: ['Jett','Chamber','Sage'],           acs: 240.1, kd: 1.19, kdDiff: 125  },
];

export async function POST() {
  try {
    await connectDB();
    await Player.deleteMany({});
    await redis.del('vct:leaderboard:acs');

    for (const p of vctDataset) {
      await Player.create({
        ign: p.ign,
        team: p.team,
        agents: p.agents,
        historicalStats: { acs: p.acs, kd: p.kd, kdDiff: p.kdDiff },
      });
      await redis.zadd('vct:leaderboard:acs', { score: p.acs, member: p.ign });
    }

    return NextResponse.json({ success: true, seeded: vctDataset.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}