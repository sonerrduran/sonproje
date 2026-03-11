# Mobile App Architecture — Expo + React Native

## Stack
- **Framework**: Expo SDK 51+ (managed workflow)
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based, same as Next.js App Router)
- **State**: Zustand (shared with web via copy)
- **Data Fetching**: @tanstack/react-query
- **Storage**: expo-secure-store (tokens) + MMKV (cache)
- **Offline**: expo-sqlite + expo-background-fetch

## Folder Structure
```
apps/mobile/
├── app/
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── forgot-password.tsx
│   ├── (student)/
│   │   ├── _layout.tsx          ← Bottom tab nav
│   │   ├── dashboard.tsx        ← Student home
│   │   ├── lessons/
│   │   │   ├── index.tsx        ← Lesson list
│   │   │   └── [id].tsx         ← Lesson viewer
│   │   ├── games/
│   │   │   ├── index.tsx        ← Game library
│   │   │   └── [id].tsx         ← Game player
│   │   ├── practice/
│   │   │   └── [id].tsx         ← Practice set
│   │   └── profile.tsx          ← XP, badges, streak
│   └── _layout.tsx              ← Root (auth check)
├── src/
│   ├── store/
│   │   ├── auth.store.ts        ← Mirror of web store
│   │   └── offline.store.ts     ← Offline data cache
│   ├── components/
│   │   ├── game/
│   │   │   ├── QuizGame.tsx     ← Mobile quiz renderer
│   │   │   └── MatchingGame.tsx
│   │   ├── lesson/
│   │   │   └── LessonViewer.tsx
│   │   └── ui/
│   │       ├── XpBar.tsx
│   │       └── BadgeCard.tsx
│   ├── hooks/
│   │   ├── useOfflineSync.ts    ← Background sync
│   │   └── usePushNotifications.ts
│   └── services/
│       ├── notifications.ts     ← Expo Notifications + FCM
│       └── offline.ts           ← SQLite offline store
├── app.json
└── package.json
```

## Offline Mode Strategy
```
App Launch
    ↓
Check connectivity (NetInfo)
    ↓ offline                    ↓ online
Load from SQLite             Fetch API + cache to SQLite
    ↓
Show cached lessons/games
Present in read-only mode
    ↓
Background: queue progress events
    ↓ reconnected
Sync progress via /api/v1/sync
```

## Offline Cached Resources
- ✅ Lesson content blocks (text + images pre-downloaded)
- ✅ Practice questions
- ✅ Game content (per level JSON)
- ✅ Student progress state
- ❌ Videos (too large — link only)

## Push Notifications (Expo + FCM)
```typescript
// On app start
const token = await Notifications.getExpoPushTokenAsync();
await api.push.register(token); // POST /notifications/push/register

// Notification types:
// - new_lesson_assigned  → deep link: /lessons/{id}
// - new_game_assigned    → deep link: /games/{id}
// - achievement_unlocked → deep link: /profile/badges
// - streak_reminder      → "You have a 5-day streak! Keep it going!"
```

## Key Packages
```bash
npx create-expo-app mobile --template
pnpm add expo-router expo-secure-store @tanstack/react-query zustand
pnpm add expo-sqlite expo-notifications expo-background-fetch
pnpm add @react-native-community/netinfo react-native-mmkv
```
