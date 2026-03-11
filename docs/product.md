# 🌐 Global SaaS Education Platform — Product Definition

## 1. Product Overview

**Product Name:** EduGalaxy Platform (Working Title)

**Product Type:** Multi-tenant SaaS Education Platform

**Summary:**
A global, white-label education platform designed for private schools. Each school receives its own fully customizable instance with branded experiences, including AI-powered lessons, 10,000+ educational games, and comprehensive student progress tracking. The platform supports web, desktop (Windows/Linux), and mobile (iOS/Android).

---

## 2. Platform Goals

| # | Goal | Description |
|---|------|-------------|
| 1 | **Scale** | Support up to 100,000 concurrent users across all tenant schools |
| 2 | **Gamified Learning** | Provide ~10,000 educational games with 10+ expandable levels each |
| 3 | **AI-Powered Content** | Generate lessons, practice questions, and adaptive content using Gemini API |
| 4 | **Multi-Tenant Architecture** | Each school operates in an isolated environment with full customization |
| 5 | **Cross-Platform** | Native and web experiences across Web, Windows, Linux, macOS, iOS, Android |
| 6 | **Internationalization** | Full multi-language support (UI, content, AI-generated material) |
| 7 | **Teacher Empowerment** | Enable teachers to assign lessons, games, and track student performance |
| 8 | **Parental Visibility** | Give parents insight into their child's progress and activity |

---

## 3. Target Users

### Primary Market
- **Private K-12 schools** worldwide seeking digital learning solutions
- Schools with 100–5,000 students per institution

### User Demographics
- **Students:** Ages 5–18, varying tech literacy
- **Teachers:** Educators managing classes of 15–40 students
- **Parents:** Guardians monitoring children's learning progress
- **School Administrators:** IT staff and academic directors managing the platform
- **Platform Operator (Super Admin):** SaaS company managing all tenant schools

---

## 4. User Roles and Permissions (Summary)

### 4.1 Super Admin
- **Scope:** Full platform access across all schools
- **Responsibilities:**
  - Manage all school tenants (create, suspend, delete)
  - System-wide configuration and monitoring
  - Game and content library management
  - Billing and subscription management
  - Platform health monitoring and analytics

### 4.2 School Admin
- **Scope:** Full access within their school's tenant
- **Responsibilities:**
  - Manage school settings (logo, colors, branding)
  - Manage teachers, students, parents
  - Manage classrooms and academic structure
  - View school-wide analytics and reports
  - Configure school-specific settings (language, timezone)

### 4.3 Teacher
- **Scope:** Access to assigned classrooms
- **Responsibilities:**
  - Create and assign lessons to students
  - Assign games and practice activities
  - Track individual and class-wide progress
  - Generate AI-powered content for lessons
  - Grade and provide feedback

### 4.4 Student
- **Scope:** Personal learning environment
- **Responsibilities:**
  - Access assigned lessons in "Learn" section
  - Complete practice questions in "Practice" section
  - Play assigned educational games
  - Track personal progress, badges, and achievements
  - View leaderboards

### 4.5 Parent
- **Scope:** View-only access to their child's data
- **Responsibilities:**
  - Monitor child's progress and activity
  - View completed lessons, games, and scores
  - Receive notifications about assignments and achievements
  - Communicate with teachers (optional module)

---

## 5. Core Platform Features

### 5.1 Learning System

#### "Learn" Section
- Structured curriculum-based lessons
- AI-generated lesson content via Gemini API
- Rich media lessons (text, images, audio, video, interactive elements)
- Lesson sequencing and prerequisites
- Teacher-curated and AI-curated learning paths
- Progress tracking with completion percentages

#### "Practice" Section
- AI-generated practice questions (Gemini API)
- Multiple question types: MCQ, fill-in-the-blank, drag-and-drop, matching, true/false
- Adaptive difficulty levels
- Timed and untimed practice modes
- Instant feedback with AI-generated explanations
- Spaced repetition for review

### 5.2 Game System
- **Library:** ~10,000 educational games
- **Structure:** Each game has 10 base levels (expandable)
- **Categories:** Math, science, language, logic, arts, coding, etc.
- **Features:**
  - Progress saving and resume
  - Star ratings and scoring per level
  - Game assignments by teachers
  - Difficulty adaptation
  - Multiplayer/competitive modes (future)
  - New games and levels deployable without app updates

### 5.3 AI Content Generation (Gemini API)
- **Lesson Generation:** Create lessons from curriculum topics
- **Question Generation:** Auto-generate practice questions with solutions
- **Adaptive Learning:** Adjust difficulty based on student performance
- **Content Translation:** Generate content in multiple languages
- **Explanation Engine:** Provide step-by-step explanations for incorrect answers
- **Summary Generation:** Create lesson summaries and study notes

### 5.4 Multi-Tenant School System
- **Tenant Isolation:** Each school has logically separated data
- **White-Label Customization:**
  - Custom logo and favicon
  - Custom color scheme and themes
  - Custom domain support (optional)
  - Custom landing pages
- **School Configuration:**
  - Academic year structure
  - Grading systems
  - Class/section management
  - Subject configuration
  - Language preferences

### 5.5 Gamification & Engagement
- XP points and leveling system
- Achievement badges and trophies
- Daily streaks and login rewards
- Leaderboards (class, school, global)
- Avatar customization
- Reward store (virtual items)

### 5.6 Analytics & Reporting
- **Student:** Personal dashboard with progress charts
- **Teacher:** Class performance heatmaps, individual student reports
- **School Admin:** School-wide metrics, teacher effectiveness
- **Super Admin:** Platform-wide KPIs, usage analytics, revenue dashboards

---

## 6. Supported Platforms

| Platform | Technology | Distribution |
|----------|-----------|--------------|
| **Web** | React / Next.js (responsive) | Any modern browser |
| **Windows Desktop** | Electron or Tauri | Direct download / Microsoft Store |
| **Linux Desktop** | Electron or Tauri | AppImage / Snap / Flatpak |
| **macOS Desktop** | Electron or Tauri | Direct download / Mac App Store |
| **iOS** | React Native or Flutter | Apple App Store |
| **Android** | React Native or Flutter | Google Play Store |

> **Strategy:** A shared core codebase with platform-specific shells to maximize code reuse while delivering native experiences.

---

## 7. High-Level Architecture

```
┌─────────────────────────────────────────────┐
│               Client Apps                    │
│  Web │ Windows │ Linux │ iOS │ Android       │
└──────────────┬──────────────────────────────┘
               │ HTTPS / WebSocket
┌──────────────▼──────────────────────────────┐
│           API Gateway / Load Balancer        │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│          Application Server (Node.js)        │
│  ┌──────┐ ┌──────┐ ┌────────┐ ┌──────────┐  │
│  │ Auth │ │ Game │ │Learning│ │ AI Engine│  │
│  │Module│ │Engine│ │ Module │ │(Gemini)  │  │
│  └──────┘ └──────┘ └────────┘ └──────────┘  │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│            Data Layer                        │
│  ┌────────┐ ┌─────┐ ┌──────┐ ┌──────────┐   │
│  │PostgreSQL│Redis │ │Queue │ │  Object  │   │
│  │  (DB)  │ │Cache│ │(Bull)│ │ Storage  │   │
│  └────────┘ └─────┘ └──────┘ └──────────┘   │
└─────────────────────────────────────────────┘
```

---

## 8. Key Differentiators

1. **AI-First Approach** — Gemini API powers content generation, making every school's content unique and adaptive
2. **Scale of Games** — 10,000 games with expandable levels is unmatched in the education SaaS market
3. **True Multi-Tenancy** — Each school feels like their own platform with full white-label support
4. **Cross-Platform Parity** — Consistent experience across all devices and operating systems
5. **Scalability** — Architecture designed for 100,000+ users from day one

---

*Document Version: 1.0*
*Created: March 2026*
*Status: Phase 1 — Product Definition*
