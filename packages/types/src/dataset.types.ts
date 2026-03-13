// Dataset types for each engine

// QuizEngine
export interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'fill-blank';
  question: string;
  options?: string[];
  correctAnswer: number | string;
  explanation?: string;
  points?: number;
  hint?: string;
  image?: string;
}

export interface QuizDataset {
  questions: QuizQuestion[];
  config: {
    questionCount?: number;
    timePerQuestion?: number;
    showHints?: boolean;
    randomizeQuestions?: boolean;
    randomizeOptions?: boolean;
  };
}

// MemoryEngine
export interface MemoryPair {
  id: string;
  image1: string;
  image2: string;
  label?: string;
}

export interface MemoryDataset {
  pairs: MemoryPair[];
  config: {
    gridSize: '4x4' | '4x6' | '6x6';
    timeLimit?: number;
    maxMoves?: number;
  };
}

// DragDropEngine
export interface DragDropItem {
  id: string;
  content: string;
  image?: string;
  targetId: string;
}

export interface DragDropTarget {
  id: string;
  label: string;
  acceptsIds: string[];
}

export interface DragDropDataset {
  items: DragDropItem[];
  targets: DragDropTarget[];
  config: {
    allowMultiple?: boolean;
    showFeedback?: boolean;
  };
}

// SortingEngine
export interface SortingItem {
  id: string;
  content: string;
  order: number;
  image?: string;
}

export interface SortingDataset {
  items: SortingItem[];
  config: {
    sortType: 'numeric' | 'alphabetic' | 'chronological' | 'custom';
    direction: 'asc' | 'desc';
  };
}

// MatchingEngine
export interface MatchingPair {
  id: string;
  left: string;
  right: string;
  leftImage?: string;
  rightImage?: string;
}

export interface MatchingDataset {
  pairs: MatchingPair[];
  config: {
    randomize?: boolean;
    showImages?: boolean;
  };
}

// ComparisonEngine
export interface ComparisonItem {
  id: string;
  value: number;
  display: string;
  image?: string;
}

export interface ComparisonDataset {
  items: ComparisonItem[];
  config: {
    comparisonType: 'greater' | 'less' | 'equal';
    showValues?: boolean;
  };
}
