// Game Engine Types

export type EngineType = 
  | 'QuizEngine'
  | 'MemoryEngine'
  | 'DragDropEngine'
  | 'SortingEngine'
  | 'PuzzleEngine'
  | 'SimulationEngine'
  | 'SpeedQuizEngine'
  | 'DiagramEngine'
  | 'MatchingEngine'
  | 'ComparisonEngine'
  | 'LogicPuzzleEngine';

export interface GameMetadata {
  id: string;
  name: string;
  category: string;
  grade: number;
  difficulty: 'easy' | 'medium' | 'hard';
  duration?: number;
  tags: string[];
  description?: string;
  icon?: string;
}

export interface EngineConfig {
  timeLimit?: number;
  showHints?: boolean;
  randomize?: boolean;
  maxAttempts?: number;
  pointsPerCorrect?: number;
  [key: string]: any;
}

export interface Dataset {
  id: string;
  engine: EngineType;
  metadata: GameMetadata;
  config: EngineConfig;
  data: any; // Engine-specific data
}

export interface GameResults {
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  duration: number;
  attempts: number;
  hints: number;
}

export interface GameEngineProps {
  dataset: Dataset;
  onComplete: (results: GameResults) => void;
  onExit: () => void;
}

export interface GameEngine {
  type: EngineType;
  name: string;
  description: string;
  render: (props: GameEngineProps) => JSX.Element;
  validate: (dataset: Dataset) => boolean;
  calculateScore: (results: Partial<GameResults>) => number;
}
