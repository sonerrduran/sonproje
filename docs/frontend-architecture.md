# 🖥️ Frontend Architecture

## Global SaaS Education Platform

**Version:** 1.0 | **Technology:** Next.js 14 + TypeScript + Tailwind CSS

---

## 1. Folder Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth group (login, register, reset)
│   │   ├── login/
│   │   ├── register/
│   │   └── reset-password/
│   ├── (dashboard)/              # Authenticated layouts
│   │   ├── layout.tsx            # Dashboard shell (sidebar, topbar)
│   │   ├── student/              # Student portal
│   │   │   ├── learn/            # Lesson browser + viewer
│   │   │   ├── practice/         # Practice interface
│   │   │   ├── games/            # Game library + player
│   │   │   ├── progress/         # Student progress dashboard
│   │   │   └── achievements/     # Badges, XP, leaderboards
│   │   ├── teacher/              # Teacher portal
│   │   │   ├── classrooms/       # Classroom management
│   │   │   ├── lessons/          # Lesson CRUD + AI generation
│   │   │   ├── assignments/      # Assignment management
│   │   │   └── analytics/        # Class analytics
│   │   ├── school-admin/         # School Admin portal
│   │   │   ├── dashboard/
│   │   │   ├── users/
│   │   │   ├── classrooms/
│   │   │   ├── settings/         # Branding + school config
│   │   │   └── analytics/
│   │   └── super-admin/          # Super Admin portal
│   │       ├── schools/
│   │       ├── games/
│   │       ├── platform/
│   │       └── billing/
│   ├── api/                      # Next.js API routes (BFF)
│   └── globals.css
│
├── components/                   # Shared UI components
│   ├── ui/                       # Base design system
│   │   ├── Button/
│   │   ├── Input/
│   │   ├── Modal/
│   │   ├── DataTable/
│   │   ├── Card/
│   │   └── Badge/
│   ├── layout/                   # Layout components
│   │   ├── Sidebar/
│   │   ├── TopBar/
│   │   └── PageHeader/
│   ├── lesson/                   # Lesson-specific components
│   │   ├── LessonViewer/
│   │   ├── LessonEditor/
│   │   └── LessonCard/
│   ├── game/                     # Game components
│   │   ├── GamePlayer/
│   │   ├── GameCard/
│   │   └── Leaderboard/
│   ├── practice/                 # Practice components
│   │   ├── QuestionRenderer/
│   │   ├── AnswerFeedback/
│   │   └── PracticeTimer/
│   └── analytics/                # Chart + dashboard components
│       ├── ProgressChart/
│       ├── HeatmapCalendar/
│       └── StatCard/
│
├── lib/                          # Utilities and config
│   ├── api/                      # API client (Axios instances)
│   │   ├── client.ts             # Base Axios config + interceptors
│   │   ├── auth.api.ts
│   │   ├── lessons.api.ts
│   │   ├── games.api.ts
│   │   └── analytics.api.ts
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useTenant.ts
│   │   └── useTranslation.ts
│   ├── utils/                    # Helper functions
│   └── constants/
│
├── store/                        # Zustand global state
│   ├── auth.store.ts
│   ├── tenant.store.ts
│   ├── ui.store.ts               # Sidebar open, dark mode
│   └── game.store.ts
│
├── i18n/                         # Internationalization
│   ├── config.ts
│   ├── locales/
│   │   ├── en/
│   │   │   ├── common.json
│   │   │   ├── lesson.json
│   │   │   └── game.json
│   │   └── tr/
│   │       ├── common.json
│   │       ├── lesson.json
│   │       └── game.json
│   └── server.ts
│
├── types/                        # Shared TypeScript types
│   ├── user.types.ts
│   ├── lesson.types.ts
│   ├── game.types.ts
│   └── api.types.ts
│
└── middleware.ts                  # Auth + tenant middleware
```

---

## 2. State Management Strategy

### Global State — Zustand

```typescript
// store/auth.store.ts
interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginDto) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

// store/tenant.store.ts
interface TenantState {
  school: School | null;
  branding: SchoolBranding | null;
  features: FeatureFlags;
  loadSchool: (schoolId: string) => Promise<void>;
}

// store/ui.store.ts
interface UIState {
  sidebarOpen: boolean;
  darkMode: boolean;
  language: string;
  toggleSidebar: () => void;
  setLanguage: (lang: string) => void;
}
```

### Server State — React Query (TanStack Query)

```typescript
// hooks/useLesson.ts
export const useLesson = (lessonId: string) =>
  useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: () => lessonsApi.getById(lessonId),
    staleTime: 5 * 60 * 1000,   // 5 minutes
    gcTime: 30 * 60 * 1000,     // 30 minutes
  });

// hooks/useGames.ts
export const useGames = (filters: GameFilters) =>
  useInfiniteQuery({
    queryKey: ['games', filters],
    queryFn: ({ pageParam = 1 }) => gamesApi.list({ ...filters, page: pageParam }),
    getNextPageParam: (last) => last.nextPage,
  });
```

---

## 3. API Communication

### API Client Setup

```typescript
// lib/api/client.ts
import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 10000,
});

// Request interceptor — attach JWT
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — handle 401 + refresh
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await useAuthStore.getState().refreshToken();
      return apiClient.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

### API Layer Pattern

```typescript
// lib/api/lessons.api.ts
export const lessonsApi = {
  list: (params: LessonFilters) =>
    apiClient.get<PaginatedResponse<Lesson>>('/lessons', { params }),
  getById: (id: string) =>
    apiClient.get<Lesson>(`/lessons/${id}`),
  create: (data: CreateLessonDto) =>
    apiClient.post<Lesson>('/lessons', data),
  assign: (id: string, data: AssignLessonDto) =>
    apiClient.post(`/lessons/${id}/assign`, data),
  markComplete: (id: string) =>
    apiClient.post(`/lessons/${id}/complete`),
};
```

---

## 4. Internationalization Strategy

### Setup (next-intl)

```typescript
// i18n/config.ts
export const locales = ['en', 'tr', 'ar', 'de', 'fr'] as const;
export const defaultLocale = 'en';

// middleware.ts — locale detection
export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
});
```

### Usage in Components

```typescript
// components/lesson/LessonCard.tsx
import { useTranslations } from 'next-intl';

export function LessonCard({ lesson }: { lesson: Lesson }) {
  const t = useTranslations('lesson');
  return (
    <div>
      <h3>{lesson.title}</h3>
      <p>{t('subject')}: {lesson.subject}</p>
      <button>{t('startLesson')}</button>
    </div>
  );
}
```

### RTL Support (Arabic, Hebrew)

```typescript
// app/[locale]/layout.tsx
export default function LocaleLayout({ children, params: { locale } }) {
  const dir = ['ar', 'he'].includes(locale) ? 'rtl' : 'ltr';
  return <html lang={locale} dir={dir}>{children}</html>;
}
```

---

## 5. Game Rendering System

### Architecture

```
GamePlayer Component
    │
    ├── GameLoader (fetch level config + assets from CDN)
    │
    ├── GameRenderer
    │   ├── HTML5 Canvas (for canvas-based games)
    │   ├── WebGL (for 3D games)
    │   └── iFrame sandbox (for HTML5 bundle games)
    │
    ├── GameProgressTracker
    │   └── Debounced API calls to Game Service
    │
    └── GameScoreManager
        └── Post score + stars on level complete
```

### Game Player Component

```typescript
// components/game/GamePlayer/index.tsx
interface GamePlayerProps {
  gameId: string;
  levelNum: number;
  onComplete: (result: LevelResult) => void;
}

export function GamePlayer({ gameId, levelNum, onComplete }: GamePlayerProps) {
  const { data: level } = useGameLevel(gameId, levelNum);
  const { saveProgress } = useGameProgress(gameId);

  // Games delivered as isolated HTML bundles
  // Communicate via postMessage API
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data.type === 'LEVEL_COMPLETE') {
        onComplete(event.data.result);
        saveProgress(levelNum, event.data.result);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [levelNum]);

  return (
    <iframe
      src={level?.asset_url}
      sandbox="allow-scripts allow-same-origin"
      className="w-full h-full border-0"
    />
  );
}
```

---

## 6. Component Architecture

### Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Atomic Design** | atoms → molecules → organisms → pages |
| **Co-location** | Component styles + tests live with component |
| **Composability** | Compound components for complex UI |
| **Accessibility** | Radix UI primitives for accessible base components |

### Example Component Structure

```
components/lesson/LessonViewer/
├── index.tsx              # Public export
├── LessonViewer.tsx       # Main component
├── LessonContent.tsx      # Content blocks renderer
├── LessonProgress.tsx     # Progress bar
├── LessonActions.tsx      # Complete, bookmark actions
├── LessonViewer.test.tsx  # Unit tests
└── types.ts               # Local types
```

---

## 7. Authentication Middleware

```typescript
// middleware.ts
export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Role-based route protection
    if (pathname.startsWith('/teacher') && token?.role !== 'teacher') {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }
    if (pathname.startsWith('/super-admin') && token?.role !== 'super_admin') {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }
  },
  { pages: { signIn: '/login' } }
);
```

---

## 8. Performance Optimizations

| Technique | Implementation |
|-----------|---------------|
| **Code Splitting** | Dynamic imports for game player, charts, heavy components |
| **Image Optimization** | `next/image` with WebP conversion |
| **Data Prefetching** | React Query prefetch on hover |
| **Virtual Lists** | `react-virtual` for 10,000+ game lists |
| **Bundle Analysis** | `@next/bundle-analyzer` for size checks |
| **CDN Assets** | All static assets via Cloudflare CDN |

---

*Document Version: 1.0 | Created: March 2026 | Status: Phase 2 — System Architecture*
