import { Injectable } from '@nestjs/common';

export type ContentType =
  | 'lesson'
  | 'questions'
  | 'game-quiz'
  | 'game-drag-drop'
  | 'game-matching'
  | 'game-word-builder'
  | 'game-memory'
  | 'explanation'
  | 'summary';

export interface PromptContext {
  subject: string;
  topic: string;
  gradeLevel: string;
  language?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  questionCount?: number;
  objectives?: string[];
  pairCount?: number;
  levelNum?: number;
  speedMultiplier?: number;
}

@Injectable()
export class PromptBuilderService {
  private readonly langNote = (lang?: string) =>
    lang && lang !== 'en' ? `\nIMPORTANT: Write ALL content in ${lang.toUpperCase()}.` : '';

  private readonly jsonOnly = 'Respond with ONLY valid JSON. No markdown, no explanation, no code fences.';

  build(type: ContentType, ctx: PromptContext): string {
    switch (type) {
      case 'lesson':        return this.lessonPrompt(ctx);
      case 'questions':     return this.questionsPrompt(ctx);
      case 'explanation':   return this.explanationPrompt(ctx);
      case 'summary':       return this.summaryPrompt(ctx);
      case 'game-quiz':     return this.gameQuizPrompt(ctx);
      case 'game-drag-drop':return this.gameDragDropPrompt(ctx);
      case 'game-matching': return this.gameMatchingPrompt(ctx);
      case 'game-word-builder': return this.gameWordBuilderPrompt(ctx);
      case 'game-memory':   return this.gameMemoryPrompt(ctx);
      default:              throw new Error(`Unknown prompt type: ${type}`);
    }
  }

  // ─── Lesson ───────────────────────────────────────────────

  private lessonPrompt(ctx: PromptContext): string {
    const objectives = ctx.objectives?.length
      ? `Key objectives:\n${ctx.objectives.map((o) => `• ${o}`).join('\n')}\n`
      : '';
    return `You are a master educational content creator.
Generate a complete, engaging lesson for:
- Subject: ${ctx.subject}
- Topic: ${ctx.topic}
- Grade Level: ${ctx.gradeLevel}
- Difficulty: ${ctx.difficulty ?? 'medium'}
${objectives}${this.langNote(ctx.language)}

${this.jsonOnly}
Schema:
{
  "title": "string",
  "introduction": "string (2-3 sentences, hook the student)",
  "contentBlocks": [
    { "type": "HEADING|TEXT|EXAMPLE|DEFINITION|NOTE", "content": "string" }
  ],
  "summary": "string (3-4 bullet points as plain text)",
  "questions": [
    {
      "type": "MCQ|TRUE_FALSE|FILL_BLANK",
      "body": "string",
      "options": [{"id":"a","text":"string"},{"id":"b","text":"string"},{"id":"c","text":"string"},{"id":"d","text":"string"}],
      "answer": {"correct": "string_or_array", "explanation": "string"},
      "difficulty": "EASY|MEDIUM|HARD"
    }
  ],
  "tags": ["string"]
}
Requirements:
- contentBlocks: at least 5 blocks (1 HEADING, 2 TEXT, 1 EXAMPLE, 1 NOTE)
- questions: exactly ${ctx.questionCount ?? 5}
- Use age-appropriate, culturally-neutral language
- Include real-world examples`;
  }

  // ─── Questions ────────────────────────────────────────────

  private questionsPrompt(ctx: PromptContext): string {
    return `You are an expert educator. Create ${ctx.questionCount ?? 10} practice questions.
Subject: ${ctx.subject} | Topic: ${ctx.topic} | Grade: ${ctx.gradeLevel} | Difficulty: ${ctx.difficulty ?? 'medium'}
${this.langNote(ctx.language)}

${this.jsonOnly}
Schema: array of:
{
  "type": "MCQ|TRUE_FALSE|FILL_BLANK|MATCHING",
  "body": "string",
  "options": [{"id":"a","text":"string"}],
  "answer": {"correct": "string_or_array", "explanation": "string"},
  "difficulty": "EASY|MEDIUM|HARD",
  "tags": ["string"]
}
Mix question types. TRUE_FALSE options: [{"id":"true","text":"True"},{"id":"false","text":"False"}].
FILL_BLANK: omit options, answer.correct is the word/phrase.
MATCHING: answer.correct is array of "sourceId:targetId" pairs.`;
  }

  // ─── Explanation ──────────────────────────────────────────

  private explanationPrompt(ctx: PromptContext): string {
    return `Explain "${ctx.topic}" in ${ctx.subject} for a ${ctx.gradeLevel} student.
${this.langNote(ctx.language)}

${this.jsonOnly}
Schema:
{
  "simpleExplanation": "string (1-2 sentences like explaining to a friend)",
  "detailedExplanation": "string (3-5 paragraphs)",
  "realWorldExamples": ["string", "string", "string"],
  "commonMistakes": ["string", "string"],
  "keyTerms": [{"term": "string", "definition": "string"}]
}`;
  }

  // ─── Summary ──────────────────────────────────────────────

  private summaryPrompt(ctx: PromptContext): string {
    return `Create a concise study summary for "${ctx.topic}" in ${ctx.subject}, Grade ${ctx.gradeLevel}.
${this.langNote(ctx.language)}

${this.jsonOnly}
Schema:
{
  "title": "string",
  "keyPoints": ["string"],
  "formulasOrRules": ["string"],
  "quickReview": [{"question": "string", "answer": "string"}],
  "studyTips": ["string"]
}`;
  }

  // ─── Game Content ─────────────────────────────────────────

  private gameQuizPrompt(ctx: PromptContext): string {
    const count = ctx.questionCount ?? 5;
    const lvl = ctx.levelNum ?? 1;
    return `Create ${count} quiz questions for a ${ctx.subject} educational game.
Topic: ${ctx.topic} | Grade: ${ctx.gradeLevel} | Level: ${lvl} | Difficulty: ${ctx.difficulty ?? 'medium'}
${this.langNote(ctx.language)}
Note: Level ${lvl} questions should be ${lvl <= 3 ? 'straightforward' : lvl <= 7 ? 'moderately challenging' : 'complex and multi-step'}.

${this.jsonOnly}
Schema:
{
  "questions": [
    {
      "body": "string",
      "options": [{"id":"a","text":"string"},{"id":"b","text":"string"},{"id":"c","text":"string"},{"id":"d","text":"string"}],
      "correct": "string (option id)",
      "explanation": "string",
      "pointValue": number
    }
  ],
  "timeLimitSeconds": number,
  "bonusTimeSeconds": number
}`;
  }

  private gameDragDropPrompt(ctx: PromptContext): string {
    const count = ctx.pairCount ?? 6;
    return `Create ${count} drag-and-drop pairs for a ${ctx.subject} game.
Topic: ${ctx.topic} | Grade: ${ctx.gradeLevel}
${this.langNote(ctx.language)}

${this.jsonOnly}
Schema:
{
  "pairs": [
    {
      "source": {"id": "s1", "text": "string", "imageHint": "string (optional emoji or icon name)"},
      "target": {"id": "t1", "label": "string"}
    }
  ],
  "instructions": "string"
}
Make pairs educational, clearly related, not tricky. Each source must match exactly one target.`;
  }

  private gameMatchingPrompt(ctx: PromptContext): string {
    const count = ctx.pairCount ?? 6;
    return `Create ${count} matching pairs for a ${ctx.subject} game.
Topic: ${ctx.topic} | Grade: ${ctx.gradeLevel}
${this.langNote(ctx.language)}

${this.jsonOnly}
Schema:
{
  "pairs": [
    {
      "left": {"id": "l1", "text": "string"},
      "right": {"id": "r1", "text": "string"}
    }
  ],
  "instructions": "string"
}
Examples of pairs: term↔definition, question↔answer, word↔translation, formula↔name.`;
  }

  private gameWordBuilderPrompt(ctx: PromptContext): string {
    const count = ctx.questionCount ?? 5;
    return `Create ${count} words/terms from ${ctx.subject} on the topic "${ctx.topic}" for a word-building game.
Grade Level: ${ctx.gradeLevel}
${this.langNote(ctx.language)}

${this.jsonOnly}
Schema:
{
  "words": [
    {
      "word": "UPPERCASE_WORD",
      "hint": "string (one-sentence clue)",
      "category": "string",
      "difficulty": "EASY|MEDIUM|HARD"
    }
  ]
}
Choose meaningful vocabulary words. Longer words = harder. Avoid proper nouns.`;
  }

  private gameMemoryPrompt(ctx: PromptContext): string {
    const count = ctx.pairCount ?? 6;
    return `Create ${count} memory-match card pairs for a ${ctx.subject} game.
Topic: ${ctx.topic} | Grade: ${ctx.gradeLevel}
${this.langNote(ctx.language)}

${this.jsonOnly}
Schema:
{
  "pairs": [
    {
      "id": "p1",
      "cardA": {"text": "string", "emojiHint": "string (single emoji)"},
      "cardB": {"text": "string (matching concept)"}
    }
  ]
}
Pairs should relate educationally: term↔image description, question↔answer, word↔translation.`;
  }
}
