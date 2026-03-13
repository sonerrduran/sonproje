# Infrastructure Setup

Bu klasör, Galactic Ionosphere Education Platform'un altyapı yapılandırmasını içerir.

## 📁 Klasör Yapısı

```
infrastructure/
├── docker/                    # Docker yapılandırmaları
│   ├── docker-compose.yml    # Development ortamı
│   ├── docker-compose.prod.yml # Production ortamı
│   ├── init-scripts/         # PostgreSQL init scripts
│   └── nginx/                # Nginx yapılandırması
├── k8s/                      # Kubernetes manifests
├── monitoring/               # Prometheus, Grafana, Loki
└── redis/                    # Redis yapılandırması
```

## 🚀 Hızlı Başlangıç

### 1. Environment Variables

`.env` dosyasını oluşturun (root dizinde):

```bash
cp .env.example .env
```

Gerekli değişkenleri düzenleyin:
- `GEMINI_API_KEY` - Google Gemini API anahtarı
- `DATABASE_URL` - PostgreSQL bağlantı string'i
- `REDIS_URL` - Redis bağlantı string'i

### 2. Docker Compose ile Başlatma

Tüm servisleri başlat:

```bash
cd infrastructure/docker
docker-compose up -d
```

Sadece altyapı servislerini başlat (PostgreSQL, Redis, MinIO):

```bash
docker-compose up -d postgres redis minio
```

### 3. Servislerin Durumunu Kontrol Et

```bash
docker-compose ps
```

### 4. Logları İzle

```bash
# Tüm servislerin logları
docker-compose logs -f

# Belirli bir servisin logları
docker-compose logs -f postgres
docker-compose logs -f redis
```

## 🗄️ Veritabanı

### PostgreSQL

- **Port:** 5432
- **User:** platform
- **Password:** platform_dev_pass
- **Database:** platform

### PgBouncer (Connection Pooler)

- **Port:** 5433
- **Pool Mode:** transaction
- **Max Connections:** 1000

### Veritabanı Bağlantısı

```bash
# Doğrudan PostgreSQL
psql postgresql://platform:platform_dev_pass@localhost:5432/platform

# PgBouncer üzerinden
psql postgresql://platform:platform_dev_pass@localhost:5433/platform
```

### Migrations

```bash
# Prisma migrations
cd backend/libs/database
pnpm prisma migrate dev
pnpm prisma generate
```

## 🔴 Redis

- **Port:** 6379
- **Password:** redis_dev_pass

### Redis Bağlantısı

```bash
redis-cli -h localhost -p 6379 -a redis_dev_pass
```

## 📦 MinIO (Object Storage)

- **API Port:** 9000
- **Console Port:** 9001
- **User:** platform_admin
- **Password:** platform_minio_pass

Console: http://localhost:9001

## 📊 Monitoring

### Prometheus

- **Port:** 9090
- **URL:** http://localhost:9090

### Grafana

- **Port:** 3030
- **URL:** http://localhost:3030
- **User:** admin
- **Password:** platform_grafana_pass

### Loki (Logs)

- **Port:** 3100
- **URL:** http://localhost:3100

## 🔧 Servisler

### Backend Services

| Service | Port | URL |
|---------|------|-----|
| Auth Service | 3001 | http://localhost:3001 |
| School Service | 3002 | http://localhost:3002 |
| User Service | 3003 | http://localhost:3003 |
| Lesson Service | 3005 | http://localhost:3005 |
| Game Service | 3007 | http://localhost:3007 |
| AI Service | 3008 | http://localhost:3008 |
| Analytics Service | 3009 | http://localhost:3009 |

### Frontend

| App | Port | URL |
|-----|------|-----|
| Web (Next.js) | 3000 | http://localhost:3000 |

### Nginx (API Gateway)

- **HTTP Port:** 80
- **HTTPS Port:** 443

## 🛠️ Yararlı Komutlar

### Docker Compose

```bash
# Servisleri başlat
docker-compose up -d

# Servisleri durdur
docker-compose down

# Servisleri yeniden başlat
docker-compose restart

# Belirli bir servisi yeniden başlat
docker-compose restart postgres

# Volume'ları da sil
docker-compose down -v

# Tüm servisleri yeniden build et
docker-compose up -d --build

# Belirli bir servisi build et
docker-compose build auth-service
```

### Database

```bash
# PostgreSQL shell
docker exec -it platform-postgres psql -U platform -d platform

# Database backup
docker exec platform-postgres pg_dump -U platform platform > backup.sql

# Database restore
docker exec -i platform-postgres psql -U platform platform < backup.sql
```

### Redis

```bash
# Redis CLI
docker exec -it platform-redis redis-cli -a redis_dev_pass

# Redis flush all
docker exec -it platform-redis redis-cli -a redis_dev_pass FLUSHALL
```

## 🐛 Troubleshooting

### Port zaten kullanımda

```bash
# Port'u kullanan process'i bul
lsof -i :5432
netstat -ano | findstr :5432  # Windows

# Process'i durdur
kill -9 <PID>
```

### Container başlamıyor

```bash
# Logları kontrol et
docker-compose logs <service-name>

# Container'ı yeniden oluştur
docker-compose up -d --force-recreate <service-name>
```

### Veritabanı bağlantı hatası

```bash
# PostgreSQL'in hazır olup olmadığını kontrol et
docker exec platform-postgres pg_isready -U platform

# PostgreSQL loglarını kontrol et
docker-compose logs postgres
```

## 📝 Notlar

- Development ortamında tüm şifreler basit tutulmuştur
- Production'da mutlaka güçlü şifreler kullanın
- `.env` dosyasını asla git'e commit etmeyin
- Monitoring stack opsiyoneldir, gerekirse kapatabilirsiniz

## 🔒 Production

Production ortamı için:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

Production checklist:
- [ ] Tüm şifreleri değiştir
- [ ] SSL sertifikalarını yapılandır
- [ ] Firewall kurallarını ayarla
- [ ] Backup stratejisi oluştur
- [ ] Monitoring ve alerting kur
- [ ] Log rotation yapılandır
