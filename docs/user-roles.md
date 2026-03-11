# 👥 User Roles and Permissions

## Global SaaS Education Platform

---

## Role Hierarchy

```
Super Admin
    └── School Admin
            ├── Teacher
            │       └── Student
            └── Parent ←───── (linked to Student)
```

---

## 1. Super Admin

**Description:** Platform-wide administrator with unrestricted access. Manages the entire SaaS infrastructure, all school tenants, and the global content library.

### Responsibilities
- Manage the entire platform infrastructure
- Onboard and offboard school tenants
- Maintain the global game library (~10,000 games)
- Monitor platform health, performance, and usage
- Manage billing, subscriptions, and licensing
- Enforce platform-wide policies and compliance

### Permissions

| Module | Permissions |
|--------|------------|
| **School Management** | Create, read, update, suspend, delete school tenants |
| **User Management** | CRUD all users across all schools; impersonate any user |
| **Game Library** | Upload, publish, unpublish, update, delete games globally |
| **Content Library** | Manage global lesson templates and AI prompt configurations |
| **AI System** | Configure Gemini API settings, manage rate limits per school |
| **Billing** | Manage subscription plans, invoices, payment settings |
| **Analytics** | View platform-wide dashboards and KPIs |
| **System Config** | Server settings, feature flags, maintenance mode |
| **Audit Logs** | View all system audit logs across all tenants |
| **Notifications** | Send platform-wide announcements |

### System Module Access
| Module | Access Level |
|--------|-------------|
| Authentication | Full |
| School Management | Full |
| User Management | Full (all schools) |
| Classroom Management | Full (all schools) |
| Lesson System | Full (global library) |
| Practice System | Full (configuration) |
| Game System | Full (global library) |
| AI Content System | Full (configuration + monitoring) |
| Gamification | Full (configuration) |
| Analytics | Full (platform-wide) |
| Admin Panel | Full |
| Payment System | Full |

---

## 2. School Admin

**Description:** Administrator of a single school tenant. Full control over their school's setup, users, and academic configuration.

### Responsibilities
- Set up and customize the school's platform instance
- Manage all users within the school (teachers, students, parents)
- Configure academic structure (grades, classes, subjects)
- Monitor school-wide performance and engagement
- Manage school settings and branding

### Permissions

| Module | Permissions |
|--------|------------|
| **School Settings** | Edit school branding (logo, colors, favicon), timezone, language |
| **User Management** | CRUD teachers, students, parents within their school |
| **Bulk Operations** | Import/export users via CSV/Excel |
| **Classroom Management** | Create, edit, delete classrooms; assign teachers |
| **Subject Management** | Configure subjects and curriculum structure |
| **Content** | View all lessons and games; manage school-specific content |
| **AI System** | Use AI content generation within school quota |
| **Analytics** | View school-wide dashboards, teacher reports, student reports |
| **Notifications** | Send school-wide announcements |
| **Data Export** | Export school data for compliance (GDPR/KVKK) |

### Allowed Actions
- ✅ Create and manage teachers, students, parents
- ✅ Create classrooms and assign teachers
- ✅ Customize school branding and settings
- ✅ View all school analytics and reports
- ✅ Export school data
- ✅ Send school-wide notifications
- ❌ Access other schools' data
- ❌ Modify platform-wide settings
- ❌ Manage billing/subscriptions
- ❌ Upload games to global library

### System Module Access
| Module | Access Level |
|--------|-------------|
| Authentication | School-scoped |
| School Management | Own school only |
| User Management | Own school only |
| Classroom Management | Full (own school) |
| Lesson System | View + school content |
| Practice System | View + assign |
| Game System | View + assign |
| AI Content System | Use (within quota) |
| Gamification | View + configure (school-level) |
| Analytics | Full (school-wide) |
| Admin Panel | School admin panel |
| Payment System | View subscription info |

---

## 3. Teacher

**Description:** Educator who manages classrooms, creates/assigns content, and monitors student progress within their assigned classes.

### Responsibilities
- Manage assigned classrooms
- Create lessons and practice content (manually or AI-generated)
- Assign lessons, games, and practice activities to students
- Track and evaluate student performance
- Provide feedback and support to students

### Permissions

| Module | Permissions |
|--------|------------|
| **Classroom** | View assigned classrooms and student roster |
| **Lessons** | Create, edit, delete own lessons; assign to students |
| **Practice** | Create practice sets; assign to students |
| **Games** | Browse game library; assign games to students |
| **AI Content** | Generate lessons and questions via AI (within school quota) |
| **Assignments** | Create, edit, delete assignments; set due dates |
| **Student Progress** | View progress for students in assigned classes |
| **Grading** | Grade assignments and provide feedback |
| **Reports** | Generate class-level and student-level reports |

### Allowed Actions
- ✅ Create and manage lessons
- ✅ Generate AI content (lessons, questions)
- ✅ Assign lessons, games, and practice to students
- ✅ View student progress in own classrooms
- ✅ Grade and give feedback on assignments
- ✅ Generate class reports
- ❌ Access students outside assigned classrooms
- ❌ Manage other teachers' content
- ❌ Modify school settings or branding
- ❌ Manage users (create/delete students)
- ❌ Access school-wide analytics

### System Module Access
| Module | Access Level |
|--------|-------------|
| Authentication | Own account |
| School Management | None |
| User Management | View own students |
| Classroom Management | Assigned classrooms |
| Lesson System | Full (own content) |
| Practice System | Full (own content) |
| Game System | Browse + assign |
| AI Content System | Generate (within quota) |
| Gamification | View (own students) |
| Analytics | Own classrooms only |
| Admin Panel | None |
| Payment System | None |

---

## 4. Student

**Description:** Primary learner who accesses lessons, completes practice activities, plays educational games, and earns rewards.

### Responsibilities
- Complete assigned lessons and practice activities
- Play educational games to reinforce learning
- Track personal progress and achievements
- Participate in gamification activities

### Permissions

| Module | Permissions |
|--------|------------|
| **Learn** | Access assigned and available lessons; mark as complete |
| **Practice** | Complete assigned and self-initiated practice; view results |
| **Games** | Play assigned and available games; track scores |
| **Profile** | Edit own profile, avatar, preferences |
| **Progress** | View own progress dashboard, badges, XP |
| **Leaderboard** | View class and school leaderboards |
| **Notifications** | Receive and view notifications |
| **Bookmarks** | Bookmark lessons and games for later |

### Allowed Actions
- ✅ Access and complete lessons
- ✅ Complete practice questions and view feedback
- ✅ Play educational games
- ✅ View own progress and analytics
- ✅ Earn XP, badges, and rewards
- ✅ Customize profile and avatar
- ✅ View leaderboards
- ❌ Create or edit content
- ❌ Access other students' data
- ❌ Assign content to others
- ❌ Access teacher or admin features
- ❌ Modify school or platform settings

### System Module Access
| Module | Access Level |
|--------|-------------|
| Authentication | Own account |
| School Management | None |
| User Management | Own profile |
| Classroom Management | View own classroom |
| Lesson System | Consume (learn) |
| Practice System | Consume (practice) |
| Game System | Play |
| AI Content System | Indirect (via generated content) |
| Gamification | Participate |
| Analytics | Own progress only |
| Admin Panel | None |
| Payment System | None |

---

## 5. Parent

**Description:** Guardian with read-only access to monitor their linked child's (or children's) academic progress and engagement.

### Responsibilities
- Monitor child's learning progress and engagement
- Stay informed about assignments and achievements
- (Optional) Communicate with teachers

### Permissions

| Module | Permissions |
|--------|------------|
| **Child Progress** | View linked child's lesson progress, game scores, practice results |
| **Assignments** | View child's assigned and completed work |
| **Achievements** | View child's badges, XP, and streaks |
| **Reports** | View and download child's progress reports |
| **Notifications** | Receive notifications about child's milestones and assignments |
| **Profile** | Edit own profile and notification preferences |
| **Messaging** | Send messages to child's teachers (if enabled) |

### Allowed Actions
- ✅ View child's progress dashboard
- ✅ View child's completed lessons, games, and practices
- ✅ View child's achievements and leaderboard position
- ✅ Download progress reports
- ✅ Receive and configure notifications
- ✅ Contact teachers (if messaging enabled)
- ❌ Modify child's assignments or progress
- ❌ Access other students' data
- ❌ Create or edit educational content
- ❌ Access teacher or admin features
- ❌ Play games or complete lessons (not a learner role)

### System Module Access
| Module | Access Level |
|--------|-------------|
| Authentication | Own account |
| School Management | None |
| User Management | Own profile |
| Classroom Management | None |
| Lesson System | View child's progress |
| Practice System | View child's results |
| Game System | View child's scores |
| AI Content System | None |
| Gamification | View child's achievements |
| Analytics | Child's progress only |
| Admin Panel | None |
| Payment System | None |

---

## Permission Matrix Summary

| Feature | Super Admin | School Admin | Teacher | Student | Parent |
|---------|:-----------:|:------------:|:-------:|:-------:|:------:|
| Manage Schools | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage School Settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Users (all schools) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage Users (own school) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create Classrooms | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create Lessons | ✅ | ❌ | ✅ | ❌ | ❌ |
| Generate AI Content | ✅ | ✅ | ✅ | ❌ | ❌ |
| Assign Content | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage Game Library | ✅ | ❌ | ❌ | ❌ | ❌ |
| Play Games | ❌ | ❌ | ❌ | ✅ | ❌ |
| Complete Lessons | ❌ | ❌ | ❌ | ✅ | ❌ |
| View Own Progress | ❌ | ❌ | ❌ | ✅ | ❌ |
| View Child's Progress | ❌ | ❌ | ❌ | ❌ | ✅ |
| View Class Analytics | ✅ | ✅ | ✅ | ❌ | ❌ |
| View School Analytics | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Platform Analytics | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage Billing | ✅ | ❌ | ❌ | ❌ | ❌ |
| Customize Branding | ✅ | ✅ | ❌ | ❌ | ❌ |

---

*Document Version: 1.0*
*Created: March 2026*
*Status: Phase 1 — Product Definition*
