'use client';

import { useState, useCallback } from 'react';
import { getApiClient } from '@/store/auth.store';

// ─── Template Renderers ───────────────────────────────────────

interface Question {
  body: string;
  options: Array<{ id: string; text: string }>;
  correct: string;
  explanation: string;
  pointValue: number;
}

function QuizGame({ content, levelNum, onComplete }: {
  content: { questions: Question[]; timeLimitSeconds: number };
  levelNum: number;
  onComplete: (score: number, maxScore: number) => void;
}) {
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const question = content.questions[current];
  const maxScore = content.questions.reduce((s, q) => s + q.pointValue, 0);

  const handleAnswer = useCallback((optionId: string) => {
    if (selected) return;
    setSelected(optionId);
    setShowResult(true);
    if (optionId === question.correct) {
      setScore((s) => s + question.pointValue);
    }
  }, [selected, question]);

  const handleNext = useCallback(() => {
    if (current + 1 >= content.questions.length) {
      onComplete(score + (selected === question.correct ? 0 : 0), maxScore);
    } else {
      setCurrent((c) => c + 1);
      setSelected(null);
      setShowResult(false);
    }
  }, [current, score, selected, content.questions.length, onComplete, maxScore, question]);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>Question {current + 1} of {content.questions.length}</span>
        <span className="text-yellow-400 font-semibold">{score} pts</span>
      </div>
      <div className="bg-slate-700 rounded-full h-2">
        <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${((current) / content.questions.length) * 100}%` }} />
      </div>

      {/* Question */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
        <p className="text-white text-lg font-medium leading-relaxed">{question.body}</p>
      </div>

      {/* Options */}
      <div className="space-y-3">
        {question.options.map((opt) => {
          let style = 'bg-slate-800 border-slate-700 text-white hover:border-indigo-500 hover:bg-slate-700';
          if (showResult) {
            if (opt.id === question.correct) style = 'bg-green-500/20 border-green-500 text-green-300';
            else if (opt.id === selected) style = 'bg-red-500/20 border-red-500 text-red-300';
            else style = 'bg-slate-800 border-slate-700 text-slate-500';
          }
          return (
            <button
              key={opt.id}
              onClick={() => handleAnswer(opt.id)}
              className={`w-full text-left border rounded-xl px-5 py-4 transition-all ${style} ${!selected && 'cursor-pointer'}`}
            >
              <span className="font-medium mr-3 uppercase">{opt.id}.</span>{opt.text}
            </button>
          );
        })}
      </div>

      {/* Explanation + Next */}
      {showResult && (
        <div className="bg-slate-800/60 border border-slate-600 rounded-xl p-4 space-y-3">
          <p className="text-slate-300 text-sm">{question.explanation}</p>
          <button onClick={handleNext} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 font-semibold transition-colors">
            {current + 1 >= content.questions.length ? 'Finish! 🎉' : 'Next Question →'}
          </button>
        </div>
      )}
    </div>
  );
}

function MatchingGame({ content, onComplete }: {
  content: { pairs: Array<{ left: { id: string; text: string }; right: { id: string; text: string } }> };
  onComplete: (score: number, maxScore: number) => void;
}) {
  const [selected, setSelected] = useState<{ side: 'left' | 'right'; id: string } | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<string | null>(null);

  const handleSelect = (side: 'left' | 'right', id: string) => {
    if (matched.has(id)) return;
    if (!selected) { setSelected({ side, id }); return; }
    if (selected.side === side) { setSelected({ side, id }); return; }

    // Check if left+right form a valid pair
    const leftId = side === 'right' ? selected.id : id;
    const rightId = side === 'right' ? id : selected.id;
    const isMatch = content.pairs.some((p) => p.left.id === leftId && p.right.id === rightId);

    if (isMatch) {
      const newMatched = new Set(matched).add(leftId).add(rightId);
      setMatched(newMatched);
      setSelected(null);
      if (newMatched.size >= content.pairs.length * 2) {
        onComplete(content.pairs.length, content.pairs.length);
      }
    } else {
      setWrong(`${leftId}-${rightId}`);
      setTimeout(() => { setWrong(null); setSelected(null); }, 800);
    }
  };

  const getStyle = (id: string, side: 'left' | 'right') => {
    if (matched.has(id)) return 'bg-green-500/20 border-green-500 text-green-300';
    if (selected?.id === id) return 'bg-indigo-500/30 border-indigo-400 text-white';
    return 'bg-slate-800 border-slate-700 text-white hover:border-indigo-500 cursor-pointer';
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <p className="text-slate-400 text-center mb-6 text-sm">Match the items on both sides</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          {content.pairs.map((p) => (
            <button key={p.left.id} onClick={() => handleSelect('left', p.left.id)}
              className={`w-full text-left border rounded-xl px-4 py-3 text-sm font-medium transition-all ${getStyle(p.left.id, 'left')}`}>
              {p.left.text}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {[...content.pairs].sort(() => Math.random() - 0.5).map((p) => (
            <button key={p.right.id} onClick={() => handleSelect('right', p.right.id)}
              className={`w-full text-left border rounded-xl px-4 py-3 text-sm font-medium transition-all ${getStyle(p.right.id, 'right')}`}>
              {p.right.text}
            </button>
          ))}
        </div>
      </div>
      <p className="text-center text-slate-400 mt-4 text-sm">{matched.size / 2} / {content.pairs.length} matched</p>
    </div>
  );
}

// ─── Game Level Loader + Router ────────────────────────────────

interface GameRendererProps {
  gameId: string;
  templateId: string;
  levels: Array<{ levelNum: number; content: Record<string, unknown>; xpReward: number }>;
  startLevel?: number;
  onLevelComplete?: (levelNum: number, score: number, xpEarned: number) => void;
  onGameComplete?: () => void;
}

export default function GameRenderer({
  gameId, templateId, levels, startLevel = 1,
  onLevelComplete, onGameComplete,
}: GameRendererProps) {
  const [currentLevel, setCurrentLevel] = useState(startLevel);
  const [showXpBanner, setShowXpBanner] = useState<number | null>(null);

  const level = levels.find((l) => l.levelNum === currentLevel);

  const handleLevelComplete = async (score: number, maxScore: number) => {
    if (!level) return;

    const xpEarned = score >= maxScore * 0.6 ? level.xpReward : Math.round(level.xpReward * 0.3);
    setShowXpBanner(xpEarned);

    // Save progress
    try {
      await getApiClient().games.saveProgress(gameId, currentLevel, { score, maxScore, xpEarned });
    } catch { /* ignore */ }

    onLevelComplete?.(currentLevel, score, xpEarned);
    setTimeout(() => {
      setShowXpBanner(null);
      if (currentLevel < levels.length) {
        setCurrentLevel((l) => l + 1);
      } else {
        onGameComplete?.();
      }
    }, 2000);
  };

  if (!level) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <p className="text-slate-400">Level not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Level header */}
      <div className="bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-sm">Level {currentLevel}</span>
          <span className="text-slate-600">·</span>
          <span className="text-yellow-400 text-sm">+{level.xpReward} XP</span>
        </div>
        <div className="flex gap-1">
          {levels.map((l) => (
            <div key={l.levelNum} className={`w-2 h-2 rounded-full ${l.levelNum < currentLevel ? 'bg-green-500' : l.levelNum === currentLevel ? 'bg-indigo-500' : 'bg-slate-700'}`} />
          ))}
        </div>
      </div>

      {/* XP Banner */}
      {showXpBanner !== null && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-yellow-500 text-black font-bold px-6 py-3 rounded-2xl text-lg shadow-2xl animate-bounce">
          +{showXpBanner} XP ⭐
        </div>
      )}

      {/* Game content */}
      <div className="py-6">
        {templateId === 'QUIZ' && (
          <QuizGame
            content={level.content as any}
            levelNum={currentLevel}
            onComplete={handleLevelComplete}
          />
        )}
        {templateId === 'MATCHING' && (
          <MatchingGame
            content={level.content as any}
            onComplete={handleLevelComplete}
          />
        )}
        {!['QUIZ', 'MATCHING'].includes(templateId) && (
          <div className="text-center text-slate-400 py-12">
            <p className="text-4xl mb-4">🎮</p>
            <p>Game type: <strong className="text-white">{templateId}</strong></p>
            <p className="text-sm mt-2">Renderer coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}
