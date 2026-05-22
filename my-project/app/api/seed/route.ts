import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { redis } from '@/lib/redis';
import { Player } from '@/lib/models/Player';
import { MatchHistory } from '@/lib/models/MatchHistory';

type Region = 'americas' | 'emea' | 'pacific';

type PlayerSeed = {
  ign: string;
  team: string;
  region: Region;
  agents: string[];
  acs: number;
  kd: number;
  kdDiff: number;
  vlrUrl: string;
};

type MatchTemplate = {
  event: string;
  playedAt: string;
  opponent: string;
  map: string;
  score: string;
  sourceUrl: string;
};

const vctDataset: PlayerSeed[] = [
  {
    ign: 'TenZ',
    team: 'Sentinels',
    region: 'americas',
    agents: ['Jett', 'Omen', 'Reyna'],
    acs: 245.8,
    kd: 1.22,
    kdDiff: 142,
    vlrUrl: 'https://www.vlr.gg/player/9/tenz',
  },
  {
    ign: 'aspas',
    team: 'MIBR',
    region: 'americas',
    agents: ['Jett', 'Raze', 'Neon'],
    acs: 262.1,
    kd: 1.38,
    kdDiff: 289,
    vlrUrl: 'https://www.vlr.gg/player/8480/aspas',
  },
  {
    ign: 'Chronicle',
    team: 'Team Vitality',
    region: 'emea',
    agents: ['Viper', 'Killjoy', 'Breach'],
    acs: 218.4,
    kd: 1.15,
    kdDiff: 98,
    vlrUrl: 'https://www.vlr.gg/player/458/chronicle',
  },
  {
    ign: 'Boaster',
    team: 'Fnatic',
    region: 'emea',
    agents: ['Omen', 'Astra', 'Gekko'],
    acs: 185.2,
    kd: 0.95,
    kdDiff: -22,
    vlrUrl: 'https://www.vlr.gg/player/438/boaster',
  },
  {
    ign: 'Derke',
    team: 'Team Vitality',
    region: 'emea',
    agents: ['Jett', 'Raze', 'Yoru'],
    acs: 251.0,
    kd: 1.24,
    kdDiff: 195,
    vlrUrl: 'https://www.vlr.gg/player/5022/derke',
  },
  {
    ign: 'Cryocells',
    team: '100 Thieves',
    region: 'americas',
    agents: ['Viper', 'Cypher', 'Chamber'],
    acs: 238.5,
    kd: 1.21,
    kdDiff: 110,
    vlrUrl: 'https://www.vlr.gg/player/4147/cryocells',
  },
  {
    ign: 'Asuna',
    team: '100 Thieves',
    region: 'americas',
    agents: ['Raze', 'Gekko', 'KAY/O'],
    acs: 222.9,
    kd: 1.08,
    kdDiff: 45,
    vlrUrl: 'https://www.vlr.gg/player/601/asuna',
  },
  {
    ign: 'something',
    team: 'Paper Rex',
    region: 'pacific',
    agents: ['Jett', 'Reyna', 'Brimstone'],
    acs: 255.3,
    kd: 1.28,
    kdDiff: 210,
    vlrUrl: 'https://www.vlr.gg/player/16053/something',
  },
  {
    ign: 'f0rsakeN',
    team: 'Paper Rex',
    region: 'pacific',
    agents: ['Astra', 'Omen', 'Neon'],
    acs: 231.7,
    kd: 1.14,
    kdDiff: 88,
    vlrUrl: 'https://www.vlr.gg/player/9801/f0rsaken',
  },
  {
    ign: 'cned',
    team: 'PCIFIC Esports',
    region: 'emea',
    agents: ['Neon', 'Jett', 'Chamber'],
    acs: 240.1,
    kd: 1.19,
    kdDiff: 125,
    vlrUrl: 'https://www.vlr.gg/player/573/cned',
  },
];

const americasMatches: MatchTemplate[] = [
  {
    event: 'VCT 26: AMER Stage 1 Group Stage - W4',
    playedAt: '2026-05-02T17:00:00.000Z',
    opponent: 'KRU Esports',
    map: 'Bind',
    score: '2-1',
    sourceUrl: 'https://www.vlr.gg/player/601/asuna',
  },
  {
    event: 'VCT 26: AMER Stage 1 Group Stage - W3',
    playedAt: '2026-04-25T19:05:00.000Z',
    opponent: 'NRG',
    map: 'Lotus',
    score: '1-2',
    sourceUrl: 'https://www.vlr.gg/player/4147/cryocells',
  },
  {
    event: 'VCT 26: AMER Stage 1 Group Stage - W2',
    playedAt: '2026-04-19T19:20:00.000Z',
    opponent: 'Sentinels',
    map: 'Haven',
    score: '0-2',
    sourceUrl: 'https://www.vlr.gg/player/4147/cryocells',
  },
  {
    event: 'VCT 26: AMER Stage 1 Group Stage - W1',
    playedAt: '2026-04-11T17:00:00.000Z',
    opponent: 'Evil Geniuses',
    map: 'Ascent',
    score: '2-0',
    sourceUrl: 'https://www.vlr.gg/player/601/asuna',
  },
];

const emeaMatches: MatchTemplate[] = [
  {
    event: 'VCT 26: EMEA Stage 1 Playoffs - UBSF',
    playedAt: '2026-05-08T13:55:00.000Z',
    opponent: 'FNATIC',
    map: 'Lotus',
    score: '2-0',
    sourceUrl: 'https://www.vlr.gg/player/5022/derke',
  },
  {
    event: 'VCT 26: EMEA Stage 1 Playoffs - UR1',
    playedAt: '2026-05-07T13:55:00.000Z',
    opponent: 'Team Liquid',
    map: 'Split',
    score: '2-1',
    sourceUrl: 'https://www.vlr.gg/player/458/chronicle',
  },
  {
    event: 'VCT 26: EMEA Stage 1 Group Stage - W5',
    playedAt: '2026-04-29T13:10:00.000Z',
    opponent: 'PCIFIC Esports',
    map: 'Haven',
    score: '2-0',
    sourceUrl: 'https://www.vlr.gg/player/5022/derke',
  },
  {
    event: 'VCT 26: EMEA Stage 1 Group Stage - W4',
    playedAt: '2026-04-24T13:10:00.000Z',
    opponent: 'BBL Esports',
    map: 'Sunset',
    score: '1-2',
    sourceUrl: 'https://www.vlr.gg/player/5022/derke',
  },
];

const pacificMatches: MatchTemplate[] = [
  {
    event: 'VCT 26: PAC Stage 1 Playoffs - GF',
    playedAt: '2026-05-17T19:00:00.000Z',
    opponent: 'FULL SENSE',
    map: 'Pearl',
    score: '3-0',
    sourceUrl: 'https://www.vlr.gg/666493/full-sense-vs-paper-rex-vct-2026-pacific-stage-1-gf',
  },
  {
    event: 'VCT 26: PAC Stage 1 Playoffs - LBF',
    playedAt: '2026-05-16T19:00:00.000Z',
    opponent: 'Global Esports',
    map: 'Lotus',
    score: '3-0',
    sourceUrl: 'https://www.vlr.gg/666499/global-esports-vs-paper-rex-vct-2026-pacific-stage-1-lbf',
  },
  {
    event: 'VCT 26: PAC Stage 1 Playoffs - LR3',
    playedAt: '2026-05-15T21:20:00.000Z',
    opponent: 'T1',
    map: 'Split',
    score: '2-1',
    sourceUrl: 'https://www.vlr.gg/666498/t1-vs-paper-rex-vct-2026-pacific-stage-1-lr3',
  },
  {
    event: 'VCT 26: PAC Stage 1 Playoffs - LR2',
    playedAt: '2026-05-10T20:30:00.000Z',
    opponent: 'Kiwoom DRX',
    map: 'Haven',
    score: '2-1',
    sourceUrl: 'https://www.vlr.gg/666497/paper-rex-vs-kiwoom-drx-vct-2026-pacific-stage-1-lr2',
  },
];

const matchTemplatesByRegion: Record<Region, MatchTemplate[]> = {
  americas: americasMatches,
  emea: emeaMatches,
  pacific: pacificMatches,
};

const acsOffsets = [-6.7, 14.4, -11.2, 8.1];

function isSeriesWin(score: string) {
  const [ownScore, opponentScore] = score.split('-').map(Number);
  return ownScore > opponentScore;
}

function buildMatchHistory(player: PlayerSeed) {
  return matchTemplatesByRegion[player.region].map((match, matchIndex) => {
    const deaths = 14 + ((player.ign.length + matchIndex) % 6);
    const kdShift = (matchIndex - 1) * 0.04;
    const kills = Math.max(8, Math.round(deaths * (player.kd + kdShift)));
    const assists = 4 + ((player.team.length + matchIndex * 2) % 9);
    const acs = Number((player.acs + acsOffsets[matchIndex]).toFixed(1));

    return {
      ign: player.ign,
      team: player.team,
      event: match.event,
      playedAt: new Date(match.playedAt),
      opponent: match.opponent,
      map: match.map,
      agent: player.agents[matchIndex % player.agents.length],
      result: isSeriesWin(match.score) ? 'W' : 'L',
      score: match.score,
      sourceUrl: match.sourceUrl,
      stats: {
        acs,
        kills,
        deaths,
        assists,
        kd: Number((kills / deaths).toFixed(2)),
      },
    };
  });
}

export async function POST() {
  try {
    await connectDB();
    await Player.deleteMany({});
    await MatchHistory.deleteMany({});
    await redis.del('vct:leaderboard:acs');

    const matches = vctDataset.flatMap(buildMatchHistory);

    for (const p of vctDataset) {
      await Player.create({
        ign: p.ign,
        team: p.team,
        agents: p.agents,
        historicalStats: { acs: p.acs, kd: p.kd, kdDiff: p.kdDiff },
      });
      await redis.zadd('vct:leaderboard:acs', { score: p.acs, member: p.ign });
      await redis.del(`player:cache:${p.ign.toLowerCase()}`);
      await redis.del(`player:matches:${p.ign.toLowerCase()}`);
    }

    await MatchHistory.insertMany(matches);

    return NextResponse.json({
      success: true,
      seeded: vctDataset.length,
      matches: matches.length,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
