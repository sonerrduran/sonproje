import type { GameLevelResult } from '@platform/types';

// ─── Game Message Protocol ────────────────────────────────────

export type GameMessageType =
  | 'INIT'
  | 'LEVEL_START'
  | 'LEVEL_COMPLETE'
  | 'LEVEL_FAILED'
  | 'PROGRESS_UPDATE'
  | 'PAUSE'
  | 'RESUME'
  | 'ERROR';

export interface GameInitPayload {
  levelNum: number;
  levelConfig: Record<string, unknown>;
  language: string;
  studentName?: string;
  theme?: {
    primaryColor: string;
    secondaryColor?: string;
  };
}

export interface LevelCompletePayload {
  levelNum: number;
  score: number;
  maxScore: number;
  timeUsedSeconds: number;
  stars: 0 | 1 | 2 | 3;
}

export interface ProgressUpdatePayload {
  levelNum: number;
  progressPercent: number; // 0–100
}

export type GameMessagePayload =
  | ({ type: 'INIT' } & { payload: GameInitPayload })
  | ({ type: 'LEVEL_COMPLETE' } & { payload: LevelCompletePayload })
  | ({ type: 'LEVEL_FAILED' } & { payload: { levelNum: number } })
  | ({ type: 'PROGRESS_UPDATE' } & { payload: ProgressUpdatePayload })
  | ({ type: 'ERROR' } & { payload: { message: string } })
  | ({ type: 'PAUSE' | 'RESUME' | 'LEVEL_START' } & { payload?: undefined });

// ─── Star Rating Calculator ───────────────────────────────────

export function calculateStars(
  scorePercent: number,
  timeUsedSeconds: number,
  timeLimitSeconds: number | null,
): 0 | 1 | 2 | 3 {
  if (scorePercent < 50) return 0;
  const timeBonus = timeLimitSeconds
    ? Math.max(0, (1 - timeUsedSeconds / timeLimitSeconds) * 20)
    : 0;
  const total = scorePercent + timeBonus;
  if (total >= 90) return 3;
  if (total >= 70) return 2;
  return 1;
}

// ─── Level Unlock Logic ───────────────────────────────────────

export function isLevelUnlocked(
  levelNum: number,
  levelsData: Record<number, GameLevelResult>,
): boolean {
  if (levelNum === 1) return true;
  const prev = levelsData[levelNum - 1];
  return prev?.completed === true;
}

// ─── Progress Merger (never overwrite best scores) ────────────

export function mergeGameLevelResult(
  existing: GameLevelResult | undefined,
  incoming: Omit<GameLevelResult, 'attempts'>,
): GameLevelResult {
  return {
    completed: incoming.completed || (existing?.completed ?? false),
    stars: Math.max(existing?.stars ?? 0, incoming.stars) as 0 | 1 | 2 | 3,
    highScore: Math.max(existing?.highScore ?? 0, incoming.highScore),
    bestTimeSeconds:
      incoming.bestTimeSeconds != null
        ? existing?.bestTimeSeconds != null
          ? Math.min(existing.bestTimeSeconds, incoming.bestTimeSeconds)
          : incoming.bestTimeSeconds
        : existing?.bestTimeSeconds,
    attempts: (existing?.attempts ?? 0) + 1,
    lastPlayedAt: new Date().toISOString(),
  };
}

// ─── PostMessage Bridge (Platform → Game) ────────────────────

export class GameBridge {
  private iframeRef: HTMLIFrameElement | null = null;
  private listeners: Map<GameMessageType, ((payload: unknown) => void)[]> = new Map();

  attach(iframe: HTMLIFrameElement) {
    this.iframeRef = iframe;
    window.addEventListener('message', this.handleIncoming);
  }

  detach() {
    window.removeEventListener('message', this.handleIncoming);
    this.iframeRef = null;
  }

  send(message: GameMessagePayload) {
    this.iframeRef?.contentWindow?.postMessage(message, '*');
  }

  on<T = unknown>(type: GameMessageType, handler: (payload: T) => void) {
    const existing = this.listeners.get(type) ?? [];
    this.listeners.set(type, [...existing, handler as (payload: unknown) => void]);
  }

  off(type: GameMessageType) {
    this.listeners.delete(type);
  }

  private handleIncoming = (event: MessageEvent<GameMessagePayload>) => {
    const { type, payload } = event.data ?? {};
    const handlers = this.listeners.get(type) ?? [];
    handlers.forEach((h) => h(payload));
  };

  init(payload: GameInitPayload) {
    this.send({ type: 'INIT', payload });
  }
}

export default GameBridge;

// ─── Engine Registry (Migrated from main project) ────────────

export * from './registry';
