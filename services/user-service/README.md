# User Service

NestJS tabanlı kullanıcı profil yönetimi servisi.

## Özellikler

- ✅ Kullanıcı profil yönetimi (CRUD)
- ✅ Öğrenci profil yönetimi
- ✅ Yıldız (stars) ekleme
- ✅ XP (experience points) ekleme
- ✅ Streak (günlük aktivite) takibi
- ✅ Leaderboard (sıralama tablosu)
- ✅ Okul bazlı leaderboard
- ✅ Kullanıcı istatistikleri
- ✅ Seviye (level) sistemi
- ✅ Prisma ORM
- ✅ Input validation

## Kurulum

```bash
# Bağımlılıkları yükle
pnpm install

# Prisma client generate
pnpm prisma generate

# Build
pnpm build
```

## Çalıştırma

```bash
# Development mode
pnpm dev

# Production mode
pnpm start
```

## Endpoints

### User Profile Management

#### POST /users/profiles
Yeni kullanıcı profili oluştur

**Body:**
```json
{
  "userId": "user_123",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "STUDENT",
  "gradeLevel": 5,
  "avatar": "👨‍🎓"
}
```

#### GET /users/profiles/:userId
Kullanıcı profilini getir

#### PUT /users/profiles/:userId
Kullanıcı profilini güncelle

**Body:**
```json
{
  "name": "John Updated",
  "avatar": "🚀",
  "gradeLevel": 6
}
```

#### DELETE /users/profiles/:userId
Kullanıcı profilini sil

### Student Profile Management

#### POST /users/students
Öğrenci profili oluştur

**Body:**
```json
{
  "userId": "student_123",
  "name": "Jane Student",
  "gradeLevel": 4,
  "schoolId": "school_456"
}
```

#### GET /users/students/:userId
Öğrenci profilini getir

#### PUT /users/students/:userId
Öğrenci profilini güncelle

**Body:**
```json
{
  "gradeLevel": 5,
  "schoolId": "school_789"
}
```

### Student Actions

#### POST /users/students/:userId/stars
Öğrenciye yıldız ekle

**Body:**
```json
{
  "stars": 10
}
```

**Response:**
- Yıldız eklenir
- XP otomatik hesaplanır (stars * 10)
- Seviye otomatik güncellenir (her 1000 XP = 1 level)

#### POST /users/students/:userId/xp
Öğrenciye XP ekle

**Body:**
```json
{
  "xp": 50
}
```

#### POST /users/students/:userId/streak
Öğrencinin streak'ini güncelle

**Logic:**
- Bugün ilk aktivite ise streak güncellenir
- Dün aktivite varsa streak +1
- Dün aktivite yoksa streak 1'e sıfırlanır

### Leaderboard

#### GET /users/leaderboard?limit=10
Global leaderboard (en yüksek yıldıza sahip öğrenciler)

**Query Parameters:**
- `limit` (optional): Kaç öğrenci gösterileceği (default: 10)

#### GET /users/leaderboard/school/:schoolId?limit=10
Okul bazlı leaderboard

### Stats

#### GET /users/stats/:userId
Kullanıcı istatistikleri

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "name": "John Doe",
    "avatar": "👨‍🎓",
    "stars": 150,
    "xp": 1500,
    "level": 2,
    "solvedProblems": 45,
    "streakDays": 7,
    "gradeLevel": 5,
    "rank": 12,
    "createdAt": "2026-03-01T00:00:00.000Z"
  }
}
```

## Seviye Sistemi

- **XP Kazanma:** Her yıldız = 10 XP
- **Seviye Hesaplama:** Level = floor(XP / 1000) + 1
- **Örnekler:**
  - 0-999 XP = Level 1
  - 1000-1999 XP = Level 2
  - 2000-2999 XP = Level 3

## Streak Sistemi

- Her gün ilk aktivitede streak güncellenir
- Ardışık günlerde aktivite varsa streak artar
- 1 gün ara verilirse streak sıfırlanır
- `lastActiveDate` YYYY-MM-DD formatında saklanır

## Environment Variables

```env
PORT=3003
DATABASE_URL="postgresql://platform:platform_dev_pass@localhost:5432/platform"
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

## Migration Notları

Bu servis, ana projeden (Express tabanlı) NestJS'e migrate edilmiştir:
- Express controller → NestJS controller
- Mock database → Prisma ORM
- User profile + Student profile → Unified User model
- Leaderboard logic eklendi
- Stats endpoint eklendi
- School-based leaderboard eklendi
