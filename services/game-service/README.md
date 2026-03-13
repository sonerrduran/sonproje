# Game Service

NestJS tabanlı oyun yönetimi servisi.

## Özellikler

- ✅ Oyun kategorileri yönetimi
- ✅ Oyun listesi ve detayları
- ✅ Oyun içerik yönetimi
- ✅ Oyun oturumu (session) yönetimi
- ✅ Skor ve ilerleme takibi
- ✅ Global leaderboard
- ✅ Oyun bazlı leaderboard
- ✅ Günlük meydan okuma (daily challenge)
- ✅ Otomatik XP ve seviye hesaplama
- ✅ Prisma ORM

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

### Game Categories

#### GET /games/categories
Tüm oyun kategorilerini listele

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cat_1",
      "name": "Matematik",
      "code": "MATH",
      "icon": "🔢",
      "color": "#3B82F6",
      "description": "Matematik oyunları",
      "sortOrder": 0,
      "isActive": true,
      "_count": {
        "games": 15
      }
    }
  ]
}
```

#### GET /games/categories/:id
Kategori detayı ve oyunları

### Games

#### GET /games
Oyunları listele (filtreleme ile)

**Query Parameters:**
- `categoryId` (optional): Kategori ID
- `gradeLevel` (optional): Sınıf seviyesi
- `difficulty` (optional): Zorluk (EASY, MEDIUM, HARD)

#### GET /games/:id
Oyun detayı

#### GET /games/:id/content
Oyun içeriği

### Game Sessions

#### POST /games/sessions
Yeni oyun oturumu başlat

**Body:**
```json
{
  "userId": "user_123",
  "gameMode": "MATH_BASIC",
  "difficulty": "MEDIUM",
  "grade": 5,
  "subjectId": "subject_456",
  "topicId": "topic_789"
}
```

#### PUT /games/sessions/:id
Oyun oturumunu tamamla

**Body:**
```json
{
  "score": 850,
  "starsEarned": 3,
  "xpEarned": 30,
  "correctAnswers": 8,
  "totalQuestions": 10,
  "durationSec": 120
}
```

**Logic:**
- Session güncellenir
- User stats güncellenir (stars, xp, solvedProblems)
- Seviye otomatik hesaplanır (her 1000 XP = 1 level)

#### GET /games/sessions/user/:userId
Kullanıcının oyun geçmişi

### Leaderboard

#### GET /games/leaderboard/global?limit=10
Global sıralama (en yüksek yıldız)

#### GET /games/leaderboard/game/:gameCode?limit=10
Oyun bazlı sıralama (en yüksek skor)

### Daily Challenge

#### GET /games/daily-challenge
Günün meydan okuması

**Logic:**
- Her gün otomatik yeni challenge oluşturulur
- Random game mode, difficulty, grade

#### POST /games/daily-challenge/:id/complete
Günlük meydan okumasını tamamla

**Body:**
```json
{
  "userId": "user_123"
}
```

**Bonus:**
- 5 yıldız
- 20 XP

## Veritabanı Modelleri

### GameCategory
- Oyun kategorileri (Matematik, Türkçe, vb.)
- Kod, ikon, renk, sıralama

### Game
- Oyun bilgileri
- Kategori ilişkisi
- Sınıf aralığı (gradeMin, gradeMax)
- Zorluk seviyesi
- Component adı (frontend için)

### GameContent
- Oyun içerikleri
- Tip: STORY, LEVEL, QUESTION, TUTORIAL
- JSON data

### GameSession
- Oyun oturumları
- Skor, yıldız, XP
- Doğru/yanlış sayısı
- Süre

### DailyChallenge
- Günlük meydan okumalar
- Tarih bazlı (unique)
- Bonus ödüller

## Environment Variables

```env
PORT=3007
DATABASE_URL="postgresql://platform:platform_dev_pass@localhost:5432/platform"
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

## Oyun Kategorileri (Seed Data)

1. **Matematik** (MATH)
   - Toplama, Çıkarma, Çarpma, Bölme
   - Kesirler, Geometri

2. **Türkçe** (TURKISH)
   - Kelime Avı, Hece Eşleştirme
   - Cümle Kurma

3. **İngilizce** (ENGLISH)
   - Vocabulary, Grammar
   - Reading Comprehension

4. **Fen Bilimleri** (SCIENCE)
   - Deney Simülasyonları
   - Kavram Eşleştirme

5. **Hızlı Okuma** (FAST_READING)
   - Tachistoscope
   - Göz Egzersizleri

6. **Yaşam Becerileri** (LIFE_SKILLS)
   - Problem Çözme
   - Karar Verme

7. **Zeka Oyunları** (LOGIC)
   - Sudoku, Hafıza
   - Mantık Bulmacaları

## Seviye Sistemi

- **XP Kazanma:** Oyun tamamlama, doğru cevaplar
- **Seviye Hesaplama:** Level = floor(XP / 1000) + 1
- **Otomatik Güncelleme:** Session complete edildiğinde

## Migration Notları

Ana projeden bağımsız olarak geliştirildi:
- Tam NestJS mikroservis mimarisi
- Prisma ORM
- Oyun sistemi tam entegre
- Leaderboard ve challenge sistemi
