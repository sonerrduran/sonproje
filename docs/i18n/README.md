# Aşama 16 — Global Multi-Language System

## Genel Bakış

Platform **10 dilden** fazlasını destekler. Dil sistemi üç katmandan oluşur:

| Katman | Teknoloji | Açıklama |
|---|---|---|
| **UI Çevirisi** | `next-intl` | Arayüz metinleri (butonlar, başlıklar) |
| **İçerik Çevirisi** | PostgreSQL + Redis | Ders, oyun, soru içeriği |
| **AI Çevirisi** | Gemini API | Otomatik çeviri pipeline |

---

## Desteklenen Diller (Başlangıç)

| Kod | Dil | Yerli Ad | Yön |
|---|---|---|---|
| `en` | English | English | LTR ✅ |
| `tr` | Turkish | Türkçe | LTR ✅ |
| `es` | Spanish | Español | LTR ✅ |
| `fr` | French | Français | LTR ✅ |
| `de` | German | Deutsch | LTR ✅ |
| `ar` | Arabic | العربية | **RTL** ✅ |
| `zh` | Chinese | 中文 | LTR ✅ |
| `pt` | Portuguese | Português | LTR ✅ |
| `ru` | Russian | Русский | LTR ✅ |
| `hi` | Hindi | हिन्दी | LTR ✅ |

---

## Backend API Endpoints

| Method | Path | Açıklama |
|---|---|---|
| `GET` | `/i18n/languages` | Tüm diller |
| `PUT` | `/i18n/languages/:code/default` | Varsayılan dil |
| `GET` | `/i18n/translations/:lang?namespace=` | UI çevirileri |
| `PUT` | `/i18n/translations/:lang` | Tek key güncelle |
| `POST` | `/i18n/translations/:lang/bulk` | Bulk JSON upload |
| `GET` | `/i18n/content/:type/:id/:lang` | İçerik çevirisi |
| `GET` | `/i18n/jobs/:type/:id` | Çeviri job durumu |
| `POST` | `/i18n/translate` | AI çeviri kuyruğuna ekle |

### AI Çeviri Örneği

```bash
# Bir dersi Türkçe'ye çevir
POST /i18n/translate
{
  "type": "lesson",
  "entityId": "lesson-uuid-here",
  "targetLanguage": "tr"
}

# Response
{
  "accepted": true,
  "jobId": "bull-job-id",
  "type": "lesson",
  "targetLanguage": "tr"
}
```

---

## Frontend Kullanımı

### 1. next-intl kurulumu
```bash
npm install next-intl
```

### 2. Çeviriyi kullanmak

```tsx
import { useTranslations } from 'next-intl';

export default function Dashboard() {
  const t = useTranslations('dashboard');
  return <h1>{t('welcome', { name: 'Ali' })}</h1>;
  // → "Hoş geldin, Ali!" (tr) / "Welcome, Ali!" (en)
}
```

### 3. Language Switcher
```tsx
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

// Tam genişlik dropdown (settings sayfası)
<LanguageSwitcher variant="dropdown" />

// Kompakt (navbar)
<LanguageSwitcher variant="compact" />
```

### 4. Yeni dil dosyası eklemek
```bash
# 1. JSON dosyasını oluştur
cp apps/web/messages/en.json apps/web/messages/ja.json
# Değerleri Japonca'ya çevir...

# 2. middleware.ts ve i18n.ts içine "ja" ekle
# locales: [..., 'ja']

# 3. Database'e dil kaydı ekle (otomatik seed edilir)
# Language model'ine yeni kod ekle → LanguageService.DEFAULT_LANGUAGES

# 4. AI ile otomatik çevir
POST /i18n/translate
{ "type": "ui", "namespace": "common", "messages": {...enMessages}, "targetLanguage": "ja" }
```

---

## Çeviri Pipeline Akışı

```
1. İçerik oluşturulur (lesson/game/question) [İngilizce]
        ↓
2. POST /i18n/translate → BullMQ kuyruğuna eklenir
        ↓
3. TranslationProcessor çalışır → AiTranslationService
        ↓
4. Gemini API → toplu çeviri (batch)
        ↓
5. LocalizedContent tablosuna kaydedilir
        ↓
6. Redis cache → TTL: 1 saat
        ↓
7. Frontend locale'e göre çeviriyi yükler
```

---

## Dil Tespiti Öncelik Sırası

```
1. ?lang=tr           query param
2. /tr/lessons        URL prefix
3. X-User-Language    header (login sonrası)
4. Accept-Language    tarayıcı header
5. 'en'              varsayılan fallback
```
