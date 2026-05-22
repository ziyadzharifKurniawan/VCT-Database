'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Stats = { acs: number; kd: number; kdDiff: number };

type PlayerDoc = {
  ign: string;
  team: string;
  agents: string[];
  historicalStats: Stats;
};

type MatchDoc = {
  ign: string;
  team: string;
  event: string;
  playedAt: string;
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

type QueryMeta = { source: string; latency: number };
type Tab = 'leaderboard' | 'search' | 'history';
type SortStat = keyof Stats;

type LeaderboardResponse = { source?: string; data?: PlayerDoc[] };
type PlayerResponse = { source?: string; data?: PlayerDoc };
type MatchResponse = { source?: string; data?: MatchDoc[] };

const statLabels: Record<SortStat, string> = {
  acs: 'ACS',
  kd: 'K/D',
  kdDiff: 'KD +/-',
};

const dateFormatter = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const trendDateFormatter = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
});

function getStatValue(player: PlayerDoc, stat: SortStat) {
  return player.historicalStats[stat];
}

function formatMatchDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatTrendDate(value: string) {
  return trendDateFormatter.format(new Date(value));
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('leaderboard');
  const [leaderboard, setLeaderboard] = useState<PlayerDoc[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [teamFilter, setTeamFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [sortStat, setSortStat] = useState<SortStat>('acs');
  const [query, setQuery] = useState('');
  const [player, setPlayer] = useState<PlayerDoc | null>(null);
  const [matches, setMatches] = useState<MatchDoc[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [searching, setSearching] = useState(false);
  const [meta, setMeta] = useState<QueryMeta | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');

  const loadLeaderboard = useCallback(async () => {
    setLoadingBoard(true);
    const t0 = performance.now();

    try {
      const res = await fetch('/api/leaderboard');
      const json = (await res.json()) as LeaderboardResponse;
      setLeaderboard(json.data ?? []);
      setMeta({
        source: json.source ?? 'Redis ZSET + MongoDB',
        latency: Math.round(performance.now() - t0),
      });
    } finally {
      setLoadingBoard(false);
    }
  }, []);

  const loadMatches = useCallback(async (ign: string) => {
    setLoadingMatches(true);
    const t0 = performance.now();

    try {
      const res = await fetch(`/api/player/${encodeURIComponent(ign)}/matches`);
      const json = (await res.json()) as MatchResponse;
      setMatches(json.data ?? []);
      setMeta({
        source: json.source ?? 'MongoDB Match Store',
        latency: Math.round(performance.now() - t0),
      });
    } finally {
      setLoadingMatches(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialLeaderboard() {
      const t0 = performance.now();

      try {
        const res = await fetch('/api/leaderboard');
        const json = (await res.json()) as LeaderboardResponse;

        if (!cancelled) {
          setLeaderboard(json.data ?? []);
          setMeta({
            source: json.source ?? 'Redis ZSET + MongoDB',
            latency: Math.round(performance.now() - t0),
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingBoard(false);
        }
      }
    }

    void loadInitialLeaderboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const teams = useMemo(
    () => Array.from(new Set(leaderboard.map((item) => item.team))).sort(),
    [leaderboard]
  );

  const agents = useMemo(
    () => Array.from(new Set(leaderboard.flatMap((item) => item.agents))).sort(),
    [leaderboard]
  );

  const filteredLeaderboard = useMemo(() => {
    return leaderboard
      .filter((item) => teamFilter === 'all' || item.team === teamFilter)
      .filter((item) => agentFilter === 'all' || item.agents.includes(agentFilter))
      .toSorted((a, b) => getStatValue(b, sortStat) - getStatValue(a, sortStat));
  }, [agentFilter, leaderboard, sortStat, teamFilter]);

  const rank = player
    ? filteredLeaderboard.findIndex((item) => item.ign.toLowerCase() === player.ign.toLowerCase()) + 1
    : 0;

  const matchRecord = useMemo(() => {
    const wins = matches.filter((match) => match.result === 'W').length;
    return { wins, losses: matches.length - wins };
  }, [matches]);

  const averageMatchAcs = matches.length
    ? matches.reduce((sum, match) => sum + match.stats.acs, 0) / matches.length
    : 0;

  const trendMatches = useMemo(() => [...matches].reverse(), [matches]);
  const trendValues = trendMatches.map((match) => match.stats.acs);
  const trendMin = trendValues.length ? Math.min(...trendValues) : 0;
  const trendMax = trendValues.length ? Math.max(...trendValues) : 1;
  const trendRange = Math.max(1, trendMax - trendMin);
  const trendPoints = trendMatches.map((match, index) => ({
    match,
    x: trendMatches.length === 1 ? 50 : 4 + (index / (trendMatches.length - 1)) * 92,
    y: 82 - ((match.stats.acs - trendMin) / trendRange) * 64,
  }));
  const trendLinePoints = trendPoints.map((point) => `${point.x},${point.y}`).join(' ');

  async function handleSearch() {
    const ign = query.trim();
    if (!ign) return;

    setSearching(true);
    setNotFound(false);
    setPlayer(null);
    setMatches([]);
    const t0 = performance.now();

    try {
      const res = await fetch(`/api/player/${encodeURIComponent(ign)}`);
      const json = (await res.json()) as PlayerResponse;
      const latency = Math.round(performance.now() - t0);

      if (res.ok && json.data) {
        setPlayer(json.data);
        setMeta({ source: json.source ?? 'MongoDB Primary Store', latency });
        await loadMatches(json.data.ign);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  }

  function pickPlayer(selectedPlayer: PlayerDoc, nextTab: Tab = 'search') {
    setPlayer(selectedPlayer);
    setQuery(selectedPlayer.ign);
    setNotFound(false);
    setTab(nextTab);
    void loadMatches(selectedPlayer.ign);
  }

  async function handleSeed() {
    setSeeding(true);
    setSeedMsg('');

    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const json = (await res.json()) as { success?: boolean; seeded?: number; matches?: number };
      setSeedMsg(
        json.success
          ? `Seeded ${json.seeded ?? 0} players / ${json.matches ?? 0} maps`
          : 'Seed failed'
      );

      if (json.success) {
        await loadLeaderboard();
        if (player) {
          await loadMatches(player.ign);
        }
      }
    } catch {
      setSeedMsg('Seed error');
    } finally {
      setSeeding(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0F1923] text-white">
      {meta && (
        <div className="fixed bottom-4 right-4 z-50 min-w-[150px] rounded-lg border border-white/10 bg-[#131e28] px-3 py-2 shadow-xl">
          <p className="mb-1 text-[9px] uppercase tracking-widest text-gray-600">Last Query</p>
          <p className="font-mono text-sm font-black text-white">{meta.latency}ms</p>
          <p className="mt-0.5 text-[9px] leading-tight text-gray-600">{meta.source}</p>
        </div>
      )}

      <header className="sticky top-0 z-10 border-b border-[#FF4655]/20 bg-[#0F1923]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[#FF4655] text-xs font-black">
              VCT
            </div>
            <div>
              <p className="text-sm font-black uppercase leading-none tracking-widest">Live Analytics</p>
              <p className="mt-0.5 text-[10px] uppercase leading-none tracking-widest text-gray-500">
                MongoDB + Redis Leaderboard
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {seedMsg && <span className="hidden text-[10px] text-green-400 sm:inline">{seedMsg}</span>}
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="rounded-lg border border-white/10 bg-[#131e28] px-3 py-1.5 text-[10px] uppercase tracking-widest text-gray-500 transition-all hover:border-[#FF4655]/40 hover:text-white disabled:opacity-40"
            >
              {seeding ? 'Seeding...' : 'Seed DB'}
            </button>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              <span className="text-[10px] uppercase tracking-widest text-gray-500">Live</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 flex w-fit gap-1 rounded-lg border border-white/5 bg-[#131e28] p-1">
          {(['leaderboard', 'search', 'history'] as Tab[]).map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`rounded-md px-4 py-2 text-xs font-black uppercase tracking-widest transition-all sm:px-5 ${
                tab === item
                  ? 'bg-[#FF4655] text-white shadow-lg shadow-[#FF4655]/20'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {item === 'leaderboard' ? 'Leaderboard' : item === 'search' ? 'Player Lookup' : 'Match History'}
            </button>
          ))}
        </div>

        {tab === 'leaderboard' && (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-3xl font-black uppercase tracking-widest">Leaderboard</h1>
                <p className="mt-1 text-xs uppercase tracking-widest text-gray-600">
                  Redis ZSET ranking with MongoDB player profiles
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <select
                  value={teamFilter}
                  onChange={(event) => setTeamFilter(event.target.value)}
                  className="rounded-lg border border-white/10 bg-[#131e28] px-3 py-2 text-xs font-bold text-gray-300 outline-none transition-colors focus:border-[#FF4655]"
                >
                  <option value="all">All teams</option>
                  {teams.map((team) => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
                <select
                  value={agentFilter}
                  onChange={(event) => setAgentFilter(event.target.value)}
                  className="rounded-lg border border-white/10 bg-[#131e28] px-3 py-2 text-xs font-bold text-gray-300 outline-none transition-colors focus:border-[#FF4655]"
                >
                  <option value="all">All agents</option>
                  {agents.map((agent) => (
                    <option key={agent} value={agent}>{agent}</option>
                  ))}
                </select>
                <select
                  value={sortStat}
                  onChange={(event) => setSortStat(event.target.value as SortStat)}
                  className="rounded-lg border border-white/10 bg-[#131e28] px-3 py-2 text-xs font-bold text-gray-300 outline-none transition-colors focus:border-[#FF4655]"
                >
                  <option value="acs">Sort by ACS</option>
                  <option value="kd">Sort by K/D</option>
                  <option value="kdDiff">Sort by KD +/-</option>
                </select>
                <button
                  onClick={loadLeaderboard}
                  className="rounded-lg border border-white/10 bg-[#131e28] px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-500 transition-colors hover:border-[#FF4655]/40 hover:text-white"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-white/5 bg-[#131e28] p-4">
                <p className="text-[10px] uppercase tracking-widest text-gray-600">Visible Players</p>
                <p className="mt-2 text-2xl font-black">{filteredLeaderboard.length}</p>
              </div>
              <div className="rounded-lg border border-white/5 bg-[#131e28] p-4">
                <p className="text-[10px] uppercase tracking-widest text-gray-600">Primary Sort</p>
                <p className="mt-2 text-2xl font-black text-[#FF4655]">{statLabels[sortStat]}</p>
              </div>
              <div className="rounded-lg border border-white/5 bg-[#131e28] p-4">
                <p className="text-[10px] uppercase tracking-widest text-gray-600">Teams Loaded</p>
                <p className="mt-2 text-2xl font-black">{teams.length}</p>
              </div>
            </div>

            {loadingBoard ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-[#131e28]" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/5">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="bg-[#131e28] text-[10px] uppercase tracking-widest text-gray-600">
                      <th className="w-10 px-5 py-3 text-left">#</th>
                      <th className="px-5 py-3 text-left">Player</th>
                      <th className="px-5 py-3 text-left">Team</th>
                      <th className="px-5 py-3 text-left">Agents</th>
                      <th className="px-5 py-3 text-right">ACS</th>
                      <th className="px-5 py-3 text-right">K/D</th>
                      <th className="px-5 py-3 text-right">KD +/-</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeaderboard.map((item, index) => (
                      <tr
                        key={item.ign}
                        onClick={() => pickPlayer(item)}
                        className="group cursor-pointer border-t border-white/5 transition-colors hover:bg-[#1a2632]"
                      >
                        <td className="px-5 py-3.5">
                          <span
                            className={`text-sm font-black ${
                              index === 0 ? 'text-yellow-400'
                              : index === 1 ? 'text-gray-400'
                              : index === 2 ? 'text-amber-700'
                              : 'text-gray-700'
                            }`}
                          >
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-white transition-colors group-hover:text-[#FF4655]">
                          {item.ign}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-500">{item.team}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {item.agents.map((agent, agentIndex) => (
                              <span
                                key={agent}
                                className={`rounded border px-2 py-0.5 text-[10px] ${
                                  agentIndex === 0
                                    ? 'border-[#FF4655]/30 bg-[#FF4655]/10 text-[#FF4655]'
                                    : 'border-white/10 bg-white/5 text-gray-500'
                                }`}
                              >
                                {agent}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right font-black text-[#FF4655]">
                          {item.historicalStats.acs.toFixed(1)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-gray-400">
                          {item.historicalStats.kd.toFixed(2)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span
                            className={`text-xs font-bold ${
                              item.historicalStats.kdDiff >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            {item.historicalStats.kdDiff >= 0 ? '+' : ''}
                            {item.historicalStats.kdDiff}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'search' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-widest">Player Lookup</h1>
              <p className="mt-1 text-xs uppercase tracking-widest text-gray-600">
                Cache-aside profile lookup with Redis TTL and MongoDB fallback
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
                placeholder="Enter IGN, e.g. TenZ, aspas, f0rsakeN"
                className="flex-1 rounded-lg border border-white/10 bg-[#131e28] px-4 py-3 font-mono text-sm text-white outline-none transition-colors placeholder:text-gray-700 focus:border-[#FF4655]"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="rounded-lg bg-[#FF4655] px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-[#FF4655]/20 transition-colors hover:bg-[#e03545] disabled:opacity-40"
              >
                {searching ? 'Querying...' : 'Query'}
              </button>
            </div>

            {searching && <div className="h-52 animate-pulse rounded-xl bg-[#131e28]" />}

            {notFound && !searching && (
              <div className="rounded-xl border border-red-500/20 bg-[#131e28] p-8 text-center">
                <p className="text-sm font-bold uppercase tracking-widest text-red-400">
                  Player signature not found
                </p>
                <p className="mt-2 text-xs text-gray-700">404 - profile target does not exist in dataset</p>
              </div>
            )}

            {player && !searching && (
              <div className="overflow-hidden rounded-xl border border-white/5 bg-[#131e28]">
                <div className="flex flex-col gap-4 border-b border-white/5 bg-gradient-to-r from-[#FF4655]/10 to-transparent px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-widest text-gray-600">Player Profile</p>
                    <h2 className="text-3xl font-black leading-none text-white">{player.ign}</h2>
                    <p className="mt-1 text-sm font-bold text-[#FF4655]">{player.team}</p>
                  </div>
                  <div className="space-y-2 text-left sm:text-right">
                    {meta && (
                      <span
                        className={`inline-block rounded-full border px-3 py-1 text-[10px] uppercase tracking-widest ${
                          meta.source.toLowerCase().includes('cache')
                            ? 'border-green-500/20 bg-green-500/10 text-green-400'
                            : 'border-blue-500/20 bg-blue-500/10 text-blue-400'
                        }`}
                      >
                        {meta.source.toLowerCase().includes('cache') ? 'Redis Cache Hit' : 'MongoDB Fetch'}
                      </span>
                    )}
                    {rank > 0 && (
                      <span className="block text-[10px] text-gray-700">
                        Filtered rank #{rank} by {statLabels[sortStat]}
                      </span>
                    )}
                    <button
                      onClick={() => setTab('history')}
                      className="block rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500 transition-colors hover:border-[#FF4655]/40 hover:text-white sm:ml-auto"
                    >
                      View Matches
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 p-6 sm:grid-cols-3">
                  {[
                    { label: 'ACS', value: player.historicalStats.acs.toFixed(1), color: 'text-[#FF4655]' },
                    { label: 'K/D Ratio', value: player.historicalStats.kd.toFixed(2), color: 'text-white' },
                    {
                      label: 'KD Diff',
                      value: `${player.historicalStats.kdDiff >= 0 ? '+' : ''}${player.historicalStats.kdDiff}`,
                      color: player.historicalStats.kdDiff >= 0 ? 'text-green-400' : 'text-red-400',
                    },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-white/5 bg-[#0F1923] p-4 text-center">
                      <p className="mb-2 text-[10px] uppercase tracking-widest text-gray-600">{stat.label}</p>
                      <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="px-6 pb-6">
                  <p className="mb-2 text-[10px] uppercase tracking-widest text-gray-600">Signature Agent Pool</p>
                  <div className="flex flex-wrap gap-2">
                    {player.agents.map((agent, index) => (
                      <div
                        key={agent}
                        className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold ${
                          index === 0
                            ? 'border-[#FF4655]/30 bg-[#FF4655]/15 text-[#FF4655]'
                            : 'border-white/10 bg-white/5 text-gray-400'
                        }`}
                      >
                        {agent}
                        {index === 0 && (
                          <span className="rounded bg-[#FF4655]/30 px-1.5 py-0.5 text-[9px] uppercase tracking-widest">
                            Main
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!player && !notFound && !searching && (
              <div className="py-12 text-center">
                <p className="mb-6 text-xs uppercase tracking-widest text-gray-700">Quick select a player</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {leaderboard.map((item) => (
                    <button
                      key={item.ign}
                      onClick={() => pickPlayer(item)}
                      className="rounded-lg border border-white/5 bg-[#131e28] px-3 py-1.5 font-mono text-xs text-gray-600 transition-all hover:border-[#FF4655]/40 hover:text-white"
                    >
                      {item.ign}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-3xl font-black uppercase tracking-widest">Match History</h1>
                <p className="mt-1 text-xs uppercase tracking-widest text-gray-600">
                  Recent maps stored in MongoDB and cached per player in Redis
                </p>
              </div>
              {player && (
                <button
                  onClick={() => loadMatches(player.ign)}
                  className="w-fit rounded-lg border border-white/10 bg-[#131e28] px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-500 transition-colors hover:border-[#FF4655]/40 hover:text-white"
                >
                  Refresh Matches
                </button>
              )}
            </div>

            {!player && (
              <div className="rounded-xl border border-white/5 bg-[#131e28] p-8 text-center">
                <p className="mb-6 text-xs uppercase tracking-widest text-gray-700">Select a player to view recent maps</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {leaderboard.map((item) => (
                    <button
                      key={item.ign}
                      onClick={() => pickPlayer(item, 'history')}
                      className="rounded-lg border border-white/5 bg-[#0F1923] px-3 py-1.5 font-mono text-xs text-gray-500 transition-all hover:border-[#FF4655]/40 hover:text-white"
                    >
                      {item.ign}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {player && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-white/5 bg-[#131e28] p-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-600">Player</p>
                    <p className="mt-2 text-2xl font-black text-white">{player.ign}</p>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-[#131e28] p-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-600">Record</p>
                    <p className="mt-2 text-2xl font-black">
                      <span className="text-green-400">{matchRecord.wins}</span>
                      <span className="text-gray-700"> / </span>
                      <span className="text-red-400">{matchRecord.losses}</span>
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-[#131e28] p-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-600">Average ACS</p>
                    <p className="mt-2 text-2xl font-black text-[#FF4655]">{averageMatchAcs.toFixed(1)}</p>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-[#131e28] p-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-600">Matches Loaded</p>
                    <p className="mt-2 text-2xl font-black text-white">{matches.length}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/5 bg-[#131e28] p-5">
                  <p className="mb-4 text-[10px] uppercase tracking-widest text-gray-600">ACS Trend</p>
                  {loadingMatches ? (
                    <div className="h-28 animate-pulse rounded-lg bg-[#0F1923]" />
                  ) : (
                    <div className="relative h-44 overflow-hidden rounded-lg bg-[#0F1923] px-4 pb-9 pt-4">
                      <div className="absolute bottom-9 left-4 right-4 top-4">
                        <div className="absolute inset-0 rounded border border-white/5" />
                        <div className="absolute left-0 right-0 top-1/3 border-t border-white/5" />
                        <div className="absolute left-0 right-0 top-2/3 border-t border-white/5" />
                        <svg
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                          className="absolute inset-0 h-full w-full overflow-visible"
                          aria-hidden="true"
                        >
                          <polyline
                            points={trendLinePoints}
                            fill="none"
                            stroke="#FF4655"
                            strokeWidth="2.5"
                            vectorEffect="non-scaling-stroke"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {trendPoints.map((point) => (
                          <div
                            key={`${point.match.playedAt}-${point.match.map}`}
                            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
                            style={{ left: `${point.x}%`, top: `${point.y}%` }}
                            title={`${formatTrendDate(point.match.playedAt)} vs ${point.match.opponent}: ${point.match.stats.acs.toFixed(1)} ACS`}
                          >
                            <span className="h-3 w-3 rounded-full border-2 border-[#0F1923] bg-[#FF4655] shadow-lg shadow-[#FF4655]/40" />
                            <span className="rounded bg-[#131e28] px-1.5 py-0.5 font-mono text-[10px] font-black text-white">
                              {point.match.stats.acs.toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div
                        className="absolute bottom-3 left-4 right-4 h-8"
                      >
                        {trendPoints.map((point) => (
                          <span
                            key={`${point.match.playedAt}-${point.match.map}-label`}
                            className="absolute flex w-28 -translate-x-1/2 flex-col text-center text-[9px] uppercase leading-tight text-gray-600"
                            style={{ left: `${point.x}%` }}
                            title={`${point.match.map} - ${formatTrendDate(point.match.playedAt)} vs ${point.match.opponent}`}
                          >
                            <span className="font-bold text-gray-500">{point.match.map}</span>
                            <span className="truncate text-gray-700">{formatTrendDate(point.match.playedAt)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/5">
                  <table className="w-full min-w-[840px] text-sm">
                    <thead>
                      <tr className="bg-[#131e28] text-[10px] uppercase tracking-widest text-gray-600">
                        <th className="px-5 py-3 text-left">Date</th>
                        <th className="px-5 py-3 text-left">Event</th>
                        <th className="px-5 py-3 text-left">Opponent</th>
                        <th className="px-5 py-3 text-left">Map</th>
                        <th className="px-5 py-3 text-left">Agent</th>
                        <th className="px-5 py-3 text-right">Result</th>
                        <th className="px-5 py-3 text-right">ACS</th>
                        <th className="px-5 py-3 text-right">K / D / A</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingMatches ? (
                        Array.from({ length: 4 }).map((_, index) => (
                          <tr key={index} className="border-t border-white/5">
                            <td colSpan={8} className="px-5 py-3">
                              <div className="h-6 animate-pulse rounded bg-[#0F1923]" />
                            </td>
                          </tr>
                        ))
                      ) : (
                        matches.map((match) => (
                          <tr key={`${match.playedAt}-${match.opponent}-${match.map}`} className="border-t border-white/5">
                            <td className="px-5 py-3.5 text-xs text-gray-500">{formatMatchDate(match.playedAt)}</td>
                            <td className="px-5 py-3.5 font-bold text-white">
                              {match.sourceUrl ? (
                                <a
                                  href={match.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="transition-colors hover:text-[#FF4655]"
                                >
                                  {match.event}
                                </a>
                              ) : (
                                match.event
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-gray-500">{match.opponent}</td>
                            <td className="px-5 py-3.5 text-gray-400">{match.map}</td>
                            <td className="px-5 py-3.5">
                              <span className="rounded border border-[#FF4655]/30 bg-[#FF4655]/10 px-2 py-0.5 text-[10px] text-[#FF4655]">
                                {match.agent}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <span
                                className={`rounded px-2 py-1 text-[10px] font-black ${
                                  match.result === 'W'
                                    ? 'bg-green-500/10 text-green-400'
                                    : 'bg-red-500/10 text-red-400'
                                }`}
                              >
                                {match.result} {match.score}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right font-black text-[#FF4655]">
                              {match.stats.acs.toFixed(1)}
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono text-xs text-gray-400">
                              {match.stats.kills} / {match.stats.deaths} / {match.stats.assists}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <footer className="mt-16 flex flex-col gap-3 border-t border-white/5 pb-6 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] uppercase tracking-widest text-gray-800">
            Cats for Codes · UI Indonesia · ENCE614016
          </p>
          <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-widest text-gray-800">
            <span>MongoDB Persistent Layer</span>
            <span>Redis Speed Layer</span>
            <span>Match History</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
