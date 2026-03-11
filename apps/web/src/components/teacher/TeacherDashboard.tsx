'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

function ProgressBar({ value, max, color = 'bg-indigo-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-700 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-10 text-right">{pct}%</span>
    </div>
  );
}

function StudentRow({ student }: { student: any }) {
  const isAtRisk = student.isAtRisk;
  return (
    <Link href={`/teacher/students/${student.student.id}`}
      className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-700/50 transition-colors group"
    >
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
        {student.student.firstName[0]}{student.student.lastName[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">
          {student.student.firstName} {student.student.lastName}
          {isAtRisk && <span className="ml-2 text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">At risk</span>}
        </p>
        <ProgressBar value={student.lessonsCompleted} max={10} color={isAtRisk ? 'bg-red-500' : 'bg-indigo-500'} />
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-white text-sm font-semibold">{student.totalXp} XP</p>
        <p className="text-slate-400 text-xs">{student.gamesPlayed} games</p>
      </div>
      <svg className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

function WeakTopicBadge({ topic }: { topic: any }) {
  const color = topic.avgScore < 40 ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
  return (
    <div className={`border rounded-lg px-3 py-2 text-sm ${color}`}>
      <p className="font-medium capitalize">{topic.topic}</p>
      <p className="text-xs opacity-70">Avg: {topic.avgScore}% ({topic.attempts} attempts)</p>
    </div>
  );
}

export default function TeacherDashboard({ classroomId }: { classroomId: string }) {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['teacher-dashboard', classroomId],
    queryFn: () => fetch(`/api/proxy/analytics/classroom/${classroomId}`, { credentials: 'include' }).then((r) => r.json()),
    staleTime: 300_000,
  });

  const { data: students } = useQuery({
    queryKey: ['student-comparison', classroomId],
    queryFn: () => fetch(`/api/proxy/analytics/classroom/${classroomId}/students`, { credentials: 'include' }).then((r) => r.json()),
    staleTime: 300_000,
  });

  const { data: weakTopics } = useQuery({
    queryKey: ['class-weak-topics', classroomId],
    queryFn: () => fetch(`/api/proxy/analytics/classroom/${classroomId}/weak-topics`, { credentials: 'include' }).then((r) => r.json()),
    staleTime: 300_000,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 px-6 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Class Analytics</h1>
            <p className="text-slate-400 mt-0.5">{dashboard?.totalStudents ?? 0} students enrolled</p>
          </div>
          <div className="flex gap-3">
            <Link href={`/teacher/classrooms/${classroomId}/lessons`} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
              Assign Lesson
            </Link>
            <Link href={`/teacher/classrooms/${classroomId}/games`} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
              Assign Game
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Lesson Completion', value: `${dashboard?.lessonCompletion?.rate ?? 0}%`, icon: '📚', color: 'text-indigo-400' },
            { label: 'Game Completion', value: `${dashboard?.gameCompletion?.rate ?? 0}%`, icon: '🎮', color: 'text-purple-400' },
            { label: 'Practice Attempts', value: dashboard?.practiceStats?.totalAttempts ?? 0, icon: '✏️', color: 'text-green-400' },
            { label: 'At Risk Students', value: dashboard?.atRisk?.length ?? 0, icon: '⚠️', color: 'text-red-400' },
          ].map((card) => (
            <div key={card.label} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
              <p className="text-slate-400 text-sm">{card.label}</p>
              <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Student leaderboard */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Students</h2>
              <Link href={`/teacher/classrooms/${classroomId}/students`} className="text-indigo-400 text-sm hover:underline">See all →</Link>
            </div>
            <div className="space-y-1">
              {Array.isArray(students)
                ? students.slice(0, 6).map((s: any) => <StudentRow key={s.student.id} student={s} />)
                : <p className="text-slate-500 text-sm">No student data</p>
              }
            </div>
          </div>

          {/* Weak topics + Top performers */}
          <div className="space-y-6">
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
              <h2 className="font-bold text-lg mb-4">Class Weak Topics</h2>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(weakTopics) && weakTopics.length > 0
                  ? weakTopics.slice(0, 6).map((t: any) => <WeakTopicBadge key={t.topic} topic={t} />)
                  : <p className="text-slate-500 text-sm">No weak topics identified yet 🎉</p>
                }
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
              <h2 className="font-bold text-lg mb-4">Top Performers 🏆</h2>
              <div className="space-y-2">
                {dashboard?.topPerformers?.slice(0, 3).map((p: any, i: number) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="text-xl">{['🥇', '🥈', '🥉'][i]}</span>
                    <span className="text-white text-sm flex-1">{p.firstName} {p.lastName}</span>
                    <span className="text-yellow-400 text-sm font-semibold">{p.totalXp} XP</span>
                  </div>
                )) ?? <p className="text-slate-500 text-sm">No data yet</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
