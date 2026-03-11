import { Injectable } from '@nestjs/common';

/**
 * Game Template Registry
 *
 * Each template defines:
 *  - id: unique key stored on the Game record
 *  - name / description: human-readable
 *  - contentSchema: structure expected inside GameLevel.content (JSON)
 *  - levelDefaults: pre-set values for newly created levels
 */

export type TemplateId =
  | 'QUIZ'
  | 'DRAG_DROP'
  | 'MEMORY_MATCH'
  | 'WORD_BUILDER'
  | 'PUZZLE'
  | 'RUNNER'
  | 'MATCHING';

export interface GameTemplate {
  id: TemplateId;
  name: string;
  description: string;
  contentSchema: Record<string, unknown>;
  levelDefaults: Record<string, unknown>;
  exampleLevel: Record<string, unknown>;
}

const TEMPLATES: GameTemplate[] = [
  {
    id: 'QUIZ',
    name: 'Quiz',
    description: 'Multiple-choice or true/false questions with a timer.',
    contentSchema: {
      type: 'object',
      required: ['questions'],
      properties: {
        questions: {
          type: 'array',
          items: {
            type: 'object',
            required: ['body', 'options', 'correct'],
            properties: {
              body: { type: 'string' },
              imageUrl: { type: 'string' },
              options: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } } } },
              correct: { type: 'string' },
              explanation: { type: 'string' },
            },
          },
        },
        timeLimitSeconds: { type: 'number' },
        pointsPerCorrect: { type: 'number' },
      },
    },
    levelDefaults: { timeLimitSeconds: 30, pointsPerCorrect: 10 },
    exampleLevel: {
      questions: [
        {
          body: 'What is 3/4 + 1/4?',
          options: [{ id: 'a', text: '1' }, { id: 'b', text: '1/2' }, { id: 'c', text: '2' }, { id: 'd', text: '3/8' }],
          correct: 'a',
          explanation: 'Adding fractions with the same denominator: 3+1=4, over 4 = 1',
        },
      ],
      timeLimitSeconds: 30,
      pointsPerCorrect: 10,
    },
  },
  {
    id: 'DRAG_DROP',
    name: 'Drag & Drop',
    description: 'Match draggable items to their correct drop zones.',
    contentSchema: {
      type: 'object',
      required: ['pairs'],
      properties: {
        pairs: {
          type: 'array',
          items: {
            type: 'object',
            required: ['source', 'target'],
            properties: {
              source: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' }, imageUrl: { type: 'string' } } },
              target: { type: 'object', properties: { id: { type: 'string' }, label: { type: 'string' } } },
            },
          },
        },
        shuffleSources: { type: 'boolean' },
        pointsPerPair: { type: 'number' },
      },
    },
    levelDefaults: { shuffleSources: true, pointsPerPair: 10 },
    exampleLevel: {
      pairs: [
        { source: { id: 's1', text: 'Dog' }, target: { id: 't1', label: 'Animal' } },
        { source: { id: 's2', text: 'Rose' }, target: { id: 't2', label: 'Plant' } },
      ],
      shuffleSources: true,
      pointsPerPair: 10,
    },
  },
  {
    id: 'MEMORY_MATCH',
    name: 'Memory Match',
    description: 'Flip cards to find matching pairs — classic concentration game.',
    contentSchema: {
      type: 'object',
      required: ['pairs'],
      properties: {
        pairs: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'cardA', 'cardB'],
            properties: {
              id: { type: 'string' },
              cardA: { type: 'object', properties: { text: { type: 'string' }, imageUrl: { type: 'string' } } },
              cardB: { type: 'object', properties: { text: { type: 'string' }, imageUrl: { type: 'string' } } },
            },
          },
        },
        gridSize: { type: 'string', enum: ['2x2', '3x4', '4x4', '4x6'] },
        flipDelay: { type: 'number', description: 'ms before unmatched cards flip back' },
      },
    },
    levelDefaults: { gridSize: '3x4', flipDelay: 1000 },
    exampleLevel: {
      pairs: [
        { id: 'p1', cardA: { text: 'Apple' }, cardB: { imageUrl: '/assets/apple.png' } },
        { id: 'p2', cardA: { text: 'Banana' }, cardB: { imageUrl: '/assets/banana.png' } },
      ],
      gridSize: '2x2',
      flipDelay: 1000,
    },
  },
  {
    id: 'WORD_BUILDER',
    name: 'Word Builder',
    description: 'Arrange scrambled letters to form the correct word or phrase.',
    contentSchema: {
      type: 'object',
      required: ['words'],
      properties: {
        words: {
          type: 'array',
          items: {
            type: 'object',
            required: ['word'],
            properties: {
              word: { type: 'string' },
              hint: { type: 'string' },
              imageUrl: { type: 'string' },
            },
          },
        },
        showHints: { type: 'boolean' },
        pointsPerWord: { type: 'number' },
      },
    },
    levelDefaults: { showHints: true, pointsPerWord: 15 },
    exampleLevel: {
      words: [
        { word: 'PHOTOSYNTHESIS', hint: 'How plants make food' },
        { word: 'CHLOROPHYLL', hint: 'Green pigment in leaves' },
      ],
      showHints: true,
      pointsPerWord: 15,
    },
  },
  {
    id: 'PUZZLE',
    name: 'Jigsaw Puzzle',
    description: 'Drag puzzle pieces to reconstruct an image or diagram.',
    contentSchema: {
      type: 'object',
      required: ['imageUrl', 'pieces'],
      properties: {
        imageUrl: { type: 'string' },
        pieces: { type: 'number', enum: [9, 16, 25] },
        hintOverlay: { type: 'boolean' },
      },
    },
    levelDefaults: { pieces: 9, hintOverlay: false },
    exampleLevel: { imageUrl: '/assets/world-map.jpg', pieces: 9, hintOverlay: true },
  },
  {
    id: 'RUNNER',
    name: 'Runner',
    description: 'Endless runner: jump or duck to answer questions mid-run.',
    contentSchema: {
      type: 'object',
      required: ['questions'],
      properties: {
        questions: { type: 'array', items: { type: 'object', properties: { body: { type: 'string' }, correct: { type: 'string' }, options: { type: 'array' } } } },
        speed: { type: 'number', description: 'Initial speed multiplier' },
        speedIncrement: { type: 'number', description: 'Speed increase per correct answer' },
      },
    },
    levelDefaults: { speed: 1.0, speedIncrement: 0.1 },
    exampleLevel: {
      questions: [{ body: '7 × 8 = ?', options: [{ id: 'a', text: '54' }, { id: 'b', text: '56' }, { id: 'c', text: '64' }], correct: 'b' }],
      speed: 1.0,
      speedIncrement: 0.1,
    },
  },
  {
    id: 'MATCHING',
    name: 'Matching',
    description: 'Draw lines to connect matching items on two columns.',
    contentSchema: {
      type: 'object',
      required: ['pairs'],
      properties: {
        pairs: {
          type: 'array',
          items: {
            type: 'object',
            required: ['left', 'right'],
            properties: {
              left: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } } },
              right: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } } },
            },
          },
        },
        pointsPerPair: { type: 'number' },
      },
    },
    levelDefaults: { pointsPerPair: 10 },
    exampleLevel: {
      pairs: [
        { left: { id: 'l1', text: 'H₂O' }, right: { id: 'r1', text: 'Water' } },
        { left: { id: 'l2', text: 'CO₂' }, right: { id: 'r2', text: 'Carbon Dioxide' } },
      ],
      pointsPerPair: 10,
    },
  },
];

@Injectable()
export class GameTemplatesService {
  private readonly registry = new Map<TemplateId, GameTemplate>(
    TEMPLATES.map((t) => [t.id, t]),
  );

  findAll(): GameTemplate[] {
    return TEMPLATES;
  }

  findById(id: TemplateId): GameTemplate | undefined {
    return this.registry.get(id);
  }

  getSchema(id: TemplateId): Record<string, unknown> {
    return this.registry.get(id)?.contentSchema ?? {};
  }

  getExampleLevel(id: TemplateId): Record<string, unknown> {
    return this.registry.get(id)?.exampleLevel ?? {};
  }

  getLevelDefaults(id: TemplateId): Record<string, unknown> {
    return this.registry.get(id)?.levelDefaults ?? {};
  }

  isValidTemplateId(id: string): id is TemplateId {
    return this.registry.has(id as TemplateId);
  }
}
