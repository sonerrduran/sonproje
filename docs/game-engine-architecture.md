# 🎮 Game Engine Architecture

## Global SaaS Education Platform — Educational Game System

**Version:** 1.0 | **Date:** March 2026

---

## 1. Overview

```
╔══════════════════════════════════════════════════════════╗
║               EDUCATIONAL GAME ENGINE                    ║
╠══════════════════════════════════════════════════════════╣
║  Game Library (10,000+ games)                           ║
║    └── Template System (game type blueprints)           ║
║         └── Level System (10+ expandable levels)        ║
║              └── Content Engine (static or dynamic)     ║
╠══════════════════════════════════════════════════════════╣
║  Game Player (Web / Mobile / Desktop)                   ║
║    └── Asset Loader (CDN-backed)                        ║
║         └── Progress Tracker (real-time save)           ║
║              └── Score + Rewards Manager                ║
╚══════════════════════════════════════════════════════════╝
```

---

## 2. Game Template System

Games are not individual fully custom apps. They follow **typed templates** — each template defines the interaction model. Content is data-driven and can be swapped per level.

### Template Types

| Template ID | Name | Description |
|-------------|------|-------------|
| `MATCH_PAIR` | Memory Match | Match pairs of cards (word-image, equation-answer) |
| `FILL_BLANK` | Fill the Blank | Complete sentence / equation with missing part |
| `SORTING` | Drag and Sort | Drag items into correct categories or sequences |
| `QUIZ_RACE` | Quiz Race | Time-pressured multiple choice quiz |
| `WORD_SEARCH` | Word Search | Find words in a letter grid |
| `BUILDER` | Builder | Arrange components to complete a challenge |
| `PUZZLE` | Puzzle Slide | Classic sliding puzzle with educational imagery |
| `SHOOTER` | Answer Shooter | Shoot the balloon with the correct answer |
| `MAZE` | Maze Runner | Navigate a maze by answering questions at junctions |
| `COLORING` | Creative Canvas | Color or label educational diagrams |

### Template Data Contract

```typescript
// Every game level is defined by this structure — content is swappable
interface GameLevel {
  id: string;
  gameId: string;
  levelNum: number;
  templateId: string;          // Which template engine to use
  config: LevelConfig;         // Template-specific config
  content: LevelContent;       // The actual educational content
  difficulty: 1 | 2 | 3;
  timeLimit?: number;          // seconds (null = untimed)
  passingScore: number;        // minimum to earn 1 star (0-100)
}

interface LevelContent {
  language: string;
  items: ContentItem[];        // Template-specific items (Q&A, pairs, words...)
  metadata: {
    subject: string;
    topic: string;
    gradeLevels: string[];
    learningObjectives: string[];
  };
}
```

### Example: MATCH_PAIR Level Config

```json
{
  "templateId": "MATCH_PAIR",
  "config": {
    "gridSize": "4x4",
    "flipDelay": 1000,
    "maxAttempts": null
  },
  "content": {
    "language": "tr",
    "items": [
      { "left": "Kare", "right": "4 kenar, 4 köşe" },
      { "left": "Üçgen", "right": "3 kenar, 3 köşe" },
      { "left": "Daire", "right": "Köşesi yok" }
    ]
  }
}
```

---

## 3. Level System

### Level Progression Model

```
Game: "Math Adventures" (10 base levels, expandable)
│
├── Level 1  — Difficulty 1 (5 items, untimed)      ⭐
├── Level 2  — Difficulty 1 (8 items, untimed)      ⭐⭐
├── Level 3  — Difficulty 2 (10 items, 120s timer)  ⭐⭐⭐
├── Level 4  — Difficulty 2 (12 items, 90s timer)
├── Level 5  — Difficulty 3 (15 items, 60s timer)
├── ...
└── Level 10 — Difficulty 3 (20 items, 45s timer)
    Level 11+ — DLC / Platform updates (no app update needed)
```

### Star Rating Calculation

```typescript
function calculateStars(score: number, timeUsed: number, timeLimit: number): 1 | 2 | 3 {
  const accuracy = score;                          // 0–100
  const timeBonus = timeLimit ? (1 - timeUsed / timeLimit) * 20 : 0;
  const total = accuracy + timeBonus;

  if (total >= 90) return 3;
  if (total >= 70) return 2;
  return 1;
}
```

### Level Unlock Rules

```typescript
// A level unlocks when previous level has been completed (1+ stars)
const isLevelUnlocked = (levelNum: number, progress: GameProgress): boolean => {
  if (levelNum === 1) return true;
  const prevLevel = progress.levels[levelNum - 1];
  return prevLevel?.completed === true;
};
```

---

## 4. Game Asset Management

### Asset Types and Storage

| Asset Type | Format | Storage | Delivery |
|-----------|--------|---------|---------|
| Game bundle | `.zip` (HTML5) | S3/MinIO | CDN URL |
| Level config | `.json` | PostgreSQL | API JSON |
| Thumbnails | `.webp` | S3/MinIO | CDN URL |
| Audio effects | `.ogg` / `.mp3` | S3/MinIO | CDN URL |
| Sprite sheets | `.webp` | S3/MinIO | CDN URL |

### Asset Upload Flow (Super Admin)

```
Super Admin uploads game bundle (.zip)
    │
    ▼
Media Service: validate + extract bundle
    │
    ▼
Upload to Object Storage (S3)
    │
    ▼
Register CDN URL in PostgreSQL (game_levels.asset_url)
    │
    ▼
Game immediately available to all schools
```

### Adding New Levels Without App Updates

```
Platform Admin → POST /games/:id/levels
    body: { levelNum: 11, asset_url: "https://cdn.platform/games/math/lvl11.html", config: {...} }
    │
    ▼
PostgreSQL: INSERT INTO game_levels (...)
    │
    ▼
Game Service: invalidate Redis cache for game
    │
    ▼
Next time student opens game → Level 11 appears automatically
```

---

## 5. Game Progress Tracking

### Data Structure

```typescript
// Stored as JSONB in game_progress.levels_data
interface GameLevelResult {
  completed: boolean;
  stars: 0 | 1 | 2 | 3;
  highScore: number;
  attempts: number;
  bestTime?: number;           // seconds
  lastPlayedAt: string;        // ISO timestamp
}

interface GameProgressData {
  [levelNum: number]: GameLevelResult;
}
```

### Progress Save Strategy

```typescript
// Client-side: debounced auto-save every 10 seconds during gameplay
// Server-side: merge with existing best scores (never overwrite with lower)
async function saveProgress(
  studentId: string,
  gameId: string,
  levelNum: number,
  result: LevelResult
) {
  const existing = await getProgress(studentId, gameId);
  const current = existing?.levelsData?.[levelNum];

  const merged = {
    ...result,
    highScore: Math.max(current?.highScore ?? 0, result.score),
    stars: Math.max(current?.stars ?? 0, result.stars),
    attempts: (current?.attempts ?? 0) + 1,
  };

  await prisma.gameProgress.upsert({
    where: { studentId_gameId: { studentId, gameId } },
    create: { studentId, gameId, schoolId, levelsData: { [levelNum]: merged } },
    update: { levelsData: { ...existing.levelsData, [levelNum]: merged } },
  });

  // Emit analytics event
  await queue.add('game.level.complete', { studentId, gameId, levelNum, result });
}
```

---

## 6. Integration with the Lesson System

### Game ↔ Lesson Linking

```typescript
// A game can be tagged with lesson topics
// Teachers can assign games as lesson reinforcement activities

interface GameAssignment {
  id: string;
  gameId: string;
  classroomId: string;
  teacherId: string;
  relatedLessonId?: string;   // Optional: link to a specific lesson
  minLevelToComplete: number; // Students must reach this level
  dueDate?: Date;
}
```

### Student Learning Flow

```
Teacher assigns Lesson → Teacher assigns related Game
    │
    ▼
Student: Learn section → completes lesson
    │
    ▼
Student: Games section → plays assigned game (reinforcement)
    │
    ▼
Analytics: tracks lesson completion + game performance correlation
```

---

## 7. Cross-Platform Delivery

| Platform | Game Delivery Method |
|----------|---------------------|
| **Web (Browser)** | Loaded in sandboxed `<iframe>` |
| **iOS / Android** | Loaded in WKWebView / WebView via React Native |
| **Windows / Linux Desktop** | Loaded in Electron BrowserView |

### PostMessage Communication API

```typescript
// Game → Platform: standard message format
interface GameMessage {
  type: 'LEVEL_COMPLETE' | 'LEVEL_FAILED' | 'PROGRESS_UPDATE' | 'PAUSE' | 'ERROR';
  payload: {
    levelNum: number;
    score?: number;
    stars?: number;
    timeUsed?: number;
    progress?: number;  // 0-100
  };
}

// Platform → Game: inject config + locale
window.postMessage({
  type: 'INIT',
  payload: {
    levelConfig: {...},
    language: 'tr',
    studentName: 'Ali',
    theme: { primaryColor: '#1E40AF' }
  }
}, '*');
```

---

## 8. Performance Considerations

| Challenge | Solution |
|-----------|---------|
| 10,000 game catalog rendering | Virtual scrolling (`react-virtual`), cursor-based pagination |
| Large game bundles loading | CDN delivery, progressive loading, skeleton screens |
| Asset caching on mobile | Service Worker cache for recently played game assets |
| Simultaneous players (100k) | Stateless game delivery — no server-side game state during play |
| Leaderboard updates | Redis sorted sets + 60-second TTL frontend polling |
| Level config cold load | Pre-cache next 3 levels while student plays current level |

---

*Document Version: 1.0 | Created: March 2026 | Status: Phase 2 — System Architecture*
