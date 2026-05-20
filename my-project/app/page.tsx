'use client';
import { useState, useEffect, useCallback } from 'react';

type Stats = { acs: number; kd: number; kdDiff: number };

type PlayerDoc = {
  ign: string;
  team: string;
  agents: string[];
  historicalStats: Stats;
};

type QueryMeta = { source: string; latency: number };
type Tab = 'leaderboard' | 'search';

export default function Home() {
  const [tab, setTab] = useState<Tab>('leaderboard');
  const [leaderboard, setLeaderboard] = useState<PlayerDoc[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [query, setQuery] = useState('');
  const [player, setPlayer] = useState<PlayerDoc | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [searching, setSearching] = useState(false);
  const [meta, setMeta] = useState<QueryMeta | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');

  const fetchLeaderboard = useCallback(async () => {
    setLoadingBoard(true);
    const t0 = performance.now();
    try {
      const res = await fetch('/api/leaderboard');
      const json = await res.json();
      setLeaderboard(json.data ?? []);
      setMeta({ source: json.source ?? 'Redis ZSET + MongoDB', latency: Math.round(performance.now() - t0) });
    } finally {
      setLoadingBoard(false);
    }
  }, []);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setNotFound(false);
    setPlayer(null);
    const t0 = performance.now();
    try {
      const res = await fetch(`/api/player/${encodeURIComponent(query.trim())}`);
      const json = await res.json();
      const latency = Math.round(performance.now() - t0);
      if (res.ok && json.data) {
        setPlayer(json.data as PlayerDoc);
        setMeta({ source: json.source, latency });
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  }

  function pickPlayer(p: PlayerDoc) {
    setPlayer(p);
    setQuery(p.ign);
    setNotFound(false);
    setTab('search');
  }

  async function handleSeed() {
    setSeeding(true);
    setSeedMsg('');
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const json = await res.json();
      setSeedMsg(json.success ? `✓ ${json.seeded} players seeded` : 'Failed');
      if (json.success) fetchLeaderboard();
    } catch {
      setSeedMsg('Error');
    } finally {
      setSeeding(false);
    }
  }

  const rank = player
    ? leaderboard.findIndex((p) => p.ign.toLowerCase() === player.ign.toLowerCase()) + 1
    : 0;

  return (
    <main className="min-h-screen bg-[#0F1923] text-white">
      {meta && (
        <div className="fixed bottom-4 right-4 z-50 bg-[#131e28] border border-white/10 rounded-lg px-3 py-2 shadow-xl min-w-[140px]">
          <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-1">Last Query</p>
          <p className="text-white font-mono font-black text-sm">{meta.latency}ms</p>
          <p className="text-[9px] text-gray-600 mt-0.5 leading-tight">{meta.source}</p>
        </div>
      )}

      <header className="border-b border-[#FF4655]/20 sticky top-0 z-10 bg-[#0F1923]/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#FF4655] rounded flex items-center justify-center text-xs font-black">
              VCT
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-widest leading-none">Live Analytics</p>
              <p className="text-[10px] text-gray-500 tracking-widest uppercase leading-none mt-0.5">
                Real-Time Leaderboard Engine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {seedMsg && <span className="text-[10px] text-green-400">{seedMsg}</span>}
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="text-[10px] bg-[#131e28] border border-white/10 hover:border-[#FF4655]/40 text-gray-500 hover:text-white px-3 py-1.5 rounded-lg transition-all uppercase tracking-widest disabled:opacity-40"
            >
              {seeding ? 'Seeding…' : 'Seed DB'}
            </button>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] text-gray-500 uppercase tracking-widest">Live</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex gap-1 bg-[#131e28] rounded-lg p-1 w-fit mb-8 border border-white/5">
          {(['leaderboard', 'search'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-md text-xs font-black uppercase tracking-widest transition-all ${
                tab === t
                  ? 'bg-[#FF4655] text-white shadow-lg shadow-[#FF4655]/20'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'leaderboard' ? 'Leaderboard' : 'Player Lookup'}
            </button>
          ))}
        </div>

        {tab === 'leaderboard' && (
          <div className="space-y-5">
            <div className="flex items-end justify-between">
              <div>
                <h1 className="text-3xl font-black uppercase tracking-widest">ACS Leaderboard</h1>
                <p className="text-gray-600 text-xs mt-1 uppercase tracking-widest">
                  Redis ZSET · O(log N) ranking · MongoDB persistent layer
                </p>
              </div>
              <button
                onClick={fetchLeaderboard}
                className="text-[10px] text-gray-700 hover:text-white transition-colors uppercase tracking-widest"
              >
                ↻ Refresh
              </button>
            </div>

            {loadingBoard ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="h-14 bg-[#131e28] rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden border border-white/5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#131e28] text-gray-600 text-[10px] uppercase tracking-widest">
                      <th className="px-5 py-3 text-left w-10">#</th>
                      <th className="px-5 py-3 text-left">Player</th>
                      <th className="px-5 py-3 text-left">Team</th>
                      <th className="px-5 py-3 text-left">Agents</th>
                      <th className="px-5 py-3 text-right">ACS</th>
                      <th className="px-5 py-3 text-right">K/D</th>
                      <th className="px-5 py-3 text-right">KD±</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((p, i) => (
                      <tr
                        key={p.ign}
                        onClick={() => pickPlayer(p)}
                        className="border-t border-white/5 hover:bg-[#1a2632] cursor-pointer transition-colors group"
                      >
                        <td className="px-5 py-3.5">
                          <span
                            className={`font-black text-sm ${
                              i === 0 ? 'text-yellow-400'
                              : i === 1 ? 'text-gray-400'
                              : i === 2 ? 'text-amber-700'
                              : 'text-gray-700'
                            }`}
                          >
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-white group-hover:text-[#FF4655] transition-colors">
                          {p.ign}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs">{p.team}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex gap-1 flex-wrap">
                            {p.agents.map((a, ai) => (
                              <span
                                key={a}
                                className={`text-[10px] px-2 py-0.5 rounded border ${
                                  ai === 0
                                    ? 'border-[#FF4655]/30 bg-[#FF4655]/10 text-[#FF4655]'
                                    : 'border-white/10 bg-white/5 text-gray-500'
                                }`}
                              >
                                {a}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right font-black text-[#FF4655]">
                          {p.historicalStats.acs.toFixed(1)}
                        </td>
                        <td className="px-5 py-3.5 text-right text-gray-400 font-mono">
                          {p.historicalStats.kd.toFixed(2)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span
                            className={`font-bold text-xs ${
                              p.historicalStats.kdDiff >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            {p.historicalStats.kdDiff >= 0 ? '+' : ''}
                            {p.historicalStats.kdDiff}
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
              <p className="text-gray-600 text-xs mt-1 uppercase tracking-widest">
                Cache-Aside · Redis HASH TTL 60s → MongoDB Fallback
              </p>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter IGN  e.g. TenZ, aspas, f0rsakeN…"
                className="flex-1 bg-[#131e28] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-[#FF4655] transition-colors text-sm font-mono"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="bg-[#FF4655] hover:bg-[#e03545] disabled:opacity-40 text-white px-6 py-3 rounded-lg font-black uppercase tracking-widest text-xs transition-colors shadow-lg shadow-[#FF4655]/20"
              >
                {searching ? '…' : 'Query'}
              </button>
            </div>

            {searching && <div className="h-52 bg-[#131e28] rounded-xl animate-pulse" />}

            {notFound && !searching && (
              <div className="bg-[#131e28] border border-red-500/20 rounded-xl p-8 text-center">
                <p className="text-red-400 font-bold text-sm uppercase tracking-widest">
                  Player signature not found
                </p>
                <p className="text-gray-700 text-xs mt-2">
                  404 · Profile target does not exist in dataset
                </p>
              </div>
            )}

            {player && !searching && (
              <div className="bg-[#131e28] border border-white/5 rounded-xl overflow-hidden">
                <div className="bg-gradient-to-r from-[#FF4655]/10 to-transparent border-b border-white/5 px-6 py-5 flex items-start justify-between">
                  <div>
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">
                      Player Profile
                    </p>
                    <h2 className="text-3xl font-black text-white leading-none">{player.ign}</h2>
                    <p className="text-[#FF4655] text-sm font-bold mt-1">{player.team}</p>
                  </div>
                  <div className="text-right space-y-1">
                    {meta && (
                      <span
                        className={`block text-[10px] px-3 py-1 rounded-full uppercase tracking-widest border ${
                          meta.source.toLowerCase().includes('cache')
                            ? 'bg-green-500/10 border-green-500/20 text-green-400'
                            : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                        }`}
                      >
                        {meta.source.toLowerCase().includes('cache')
                          ? 'Redis Cache Hit'
                          : 'MongoDB Fetch'}
                      </span>
                    )}
                    {rank > 0 && (
                      <span className="block text-[10px] text-gray-700">
                        Rank #{rank} by ACS
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-6 grid grid-cols-3 gap-3">
                  {[
                    { label: 'ACS', value: player.historicalStats.acs.toFixed(1), color: 'text-[#FF4655]' },
                    { label: 'K/D Ratio', value: player.historicalStats.kd.toFixed(2), color: 'text-white' },
                    {
                      label: 'KD Diff',
                      value: `${player.historicalStats.kdDiff >= 0 ? '+' : ''}${player.historicalStats.kdDiff}`,
                      color: player.historicalStats.kdDiff >= 0 ? 'text-green-400' : 'text-red-400',
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="bg-[#0F1923] border border-white/5 rounded-xl p-4 text-center"
                    >
                      <p className="text-gray-600 text-[10px] uppercase tracking-widest mb-2">
                        {s.label}
                      </p>
                      <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                <div className="px-6 pb-6">
                  <p className="text-gray-600 text-[10px] uppercase tracking-widest mb-2">
                    Signature Agent Pool
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {player.agents.map((agent, i) => (
                      <div
                        key={agent}
                        className={`px-4 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 ${
                          i === 0
                            ? 'bg-[#FF4655]/15 border-[#FF4655]/30 text-[#FF4655]'
                            : 'bg-white/5 border-white/10 text-gray-400'
                        }`}
                      >
                        {agent}
                        {i === 0 && (
                          <span className="text-[9px] bg-[#FF4655]/30 px-1.5 py-0.5 rounded uppercase tracking-widest">
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
              <div className="text-center py-12">
                <p className="text-gray-700 text-xs uppercase tracking-widest mb-6">
                  Quick select a player
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {leaderboard.map((p) => (
                    <button
                      key={p.ign}
                      onClick={() => pickPlayer(p)}
                      className="text-xs bg-[#131e28] border border-white/5 hover:border-[#FF4655]/40 hover:text-white text-gray-600 px-3 py-1.5 rounded-lg transition-all font-mono"
                    >
                      {p.ign}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <footer className="mt-16 pb-6 border-t border-white/5 pt-6 flex items-center justify-between">
          <p className="text-gray-800 text-[10px] uppercase tracking-widest">
            Cats for Codes · UI Indonesia · ENCE614016
          </p>
          <div className="flex gap-4 text-[10px] text-gray-800 uppercase tracking-widest">
            <span>MongoDB · Persistent Layer</span>
            <span>·</span>
            <span>Redis · Speed Layer</span>
          </div>
        </footer>
      </div>
    </main>
  );
}