'use client';

import { useQuery } from '@tanstack/react-query';
import { getApiClient } from '@/store/auth.store';
import Link from 'next/link';

// ─── XP Progress Ring ─────────────────────────────────────────
function XpRing({ pct, level }: { pct: number; level: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="96" height="96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={r} fill="none"
          stroke="url(#xpGrad)" strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="xpGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      <div className="text-center">
        <p className="text-xs text-slate-400">Level</p>
        <p className="text-2xl font-bold text-white">{level}</p>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────
function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${color}`}>{icon}</div>
      <div>
        <p className="text-slate-400 text-sm">{label}</p>
        <p className="text-white text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

// ─── Recommendation Card ──────────────────────────────────────
function RecommendationCard({ rec }: { rec: { type: string; id: string; title: string; reason: string; urgency: string } }) {
  const urgencyStyles: Record<string, string> = {
    high: 'border-red-500/40 bg-red-950/20',
    medium: 'border-yellow-500/40 bg-yellow-950/20',
    low: 'border-slate-600 bg-slate-800/40',
  };
  const typeIcon: Record<string, string> = { lesson: '📚', game: '🎮', practice: '✏️' };
  const href = rec.type === 'lesson' ? `/lessons/${rec.id}` : rec.type === 'game' ? `/games/${rec.id}` : `/practice/${rec.id}`;

  return (
    <Link href={href} className={`block border rounded-xl p-4 hover:scale-[1.01] transition-transform ${urgencyStyles[rec.urgency]}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{typeIcon[rec.type]}</span>
        <div>
          <p className="text-white font-semibold">{rec.title}</p>
          <p className="text-slate-400 text-sm mt-0.5">{rec.reason}</p>
        </div>
        {rec.urgency === 'high' && (
          <span className="ml-auto text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">Due soon</span>
        )}
      </div>
    </Link>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────
export default function StudentDashboard({ userId, schoolId }: { userId: string; schoolId: string }) {
  const api = getApiClient();

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['student-dashboard', userId],
    queryFn: () => fetch('/api/proxy/analytics/me', { credentials: 'include' }).then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: recommendations } = useQuery({
    queryKey: ['recommendations', userId],
    queryFn: () => fetch('/api/proxy/analytics/me/recommendations', { credentials: 'include' }).then((r) => r.json()),
    staleTime: 120_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const xp = dashboard?.xp ?? { totalXp: 0, level: 1, progressPct: 0 };
  const lessons = dashboard?.lessons ?? { completed: 0, inProgress: 0, assigned: 0 };
  const games = dashboard?.games ?? { gamesPlayed: 0, levelsCompleted: 0, bestScore: 0 };
  const streak = dashboard?.streak ?? { currentStreak: 0 };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Welcome back! 👋</h1>
            <p className="text-indigo-200 mt-1">Keep up the great work on your learning journey</p>
          </div>
          <XpRing pct={xp.progressPct} level={xp.level} />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total XP" value={xp.totalXp.toLocaleString()} icon="⭐" color="bg-yellow-500/20 text-yellow-400" />
          <StatCard label="Lessons Done" value={lessons.completed} icon="📚" color="bg-indigo-500/20 text-indigo-400" />
          <StatCard label="Games Played" value={games.gamesPlayed} icon="🎮" color="bg-purple-500/20 text-purple-400" />
          <StatCard label="Day Streak 🔥" value={streak.currentStreak} icon="🔥" color="bg-orange-500/20 text-orange-400" />
        </div>

        {/* In-progress lessons */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Continue Learning</h2>
            <Link href="/lessons" className="text-indigo-400 text-sm hover:underline">View all →</Link>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {lessons.inProgress > 0 ? (
              <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
                <p className="text-slate-400 text-sm">You have {lessons.inProgress} lessons in progress</p>
                <Link href="/lessons?filter=in-progress" className="mt-3 block text-center bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2 text-sm font-medium transition-colors">
                  Continue →
                </Link>
              </div>
            ) : (
              <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 text-slate-400">
                No lessons in progress. Start one! 🚀
              </div>
            )}
          </div>
        </section>

        {/* Recommendations */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Recommended for You</h2>
          </div>
          <div className="space-y-3">
            {Array.isArray(recommendations)
              ? recommendations.slice(0, 4).map((rec: any) => (
                  <RecommendationCard key={rec.id} rec={rec} />
                ))
              : <p className="text-slate-500">Loading recommendations…</p>
            }
          </div>
        </section>

        {/* Badges */}
        {dashboard?.badges?.count > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4">Recent Badges 🏅</h2>
            <div className="flex gap-3 flex-wrap">
              {dashboard.badges.recent?.map((b: any) => (
                <div key={b.title} className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 flex items-center gap-2">
                  <span className="text-2xl">{b.icon}</span>
                  <span className="text-sm font-medium">{b.title}</span>
                </div>
              ))}
              <Link href="/achievements" className="bg-slate-800/40 border border-dashed border-slate-600 rounded-xl px-4 py-3 text-slate-400 text-sm flex items-center">
                View all {dashboard.badges.count} badges →
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
