# Auth Service

NestJS tabanlı kimlik doğrulama servisi.

## Özellikler

- ✅ Kullanıcı kaydı (register)
- ✅ Giriş (login)
- ✅ Token yenileme (refresh)
- ✅ Çıkış (logout)
- ✅ Token doğrulama (verify)
- ✅ Profil bilgisi (me)
- ✅ Şifre sıfırlama (password reset)
- ✅ JWT authentication
- ✅ Bcrypt password hashing
- ✅ Prisma ORM
- ✅ Input validation (class-validator)

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

### POST /auth/register
Yeni kullanıcı kaydı

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "role": "STUDENT"
}
```

### POST /auth/login
Kullanıcı girişi

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

### POST /auth/refresh
Token yenileme

**Body:**
```json
{
  "refreshToken": "your-refresh-token"
}
```

### POST /auth/logout
Çıkış (JWT required)

**Headers:**
```
Authorization: Bearer <access-token>
```

### POST /auth/verify
Token doğrulama (JWT required)

**Headers:**
```
Authorization: Bearer <access-token>
```

### GET /auth/me
Profil bilgisi (JWT required)

**Headers:**
```
Authorization: Bearer <access-token>
```

### POST /auth/password/reset-request
Şifre sıfırlama talebi

**Body:**
```json
{
  "email": "user@example.com"
}
```

### POST /auth/password/reset
Şifre sıfırlama

**Body:**
```json
{
  "token": "reset-token",
  "newPassword": "NewSecurePass123!"
}
```

## Environment Variables

```env
PORT=3001
DATABASE_URL="postgresql://platform:platform_dev_pass@localhost:5432/platform"
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_REFRESH_EXPIRES_IN=30d
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

## Şifre Gereksinimleri

- En az 8 karakter
- En az 1 büyük harf
- En az 1 küçük harf
- En az 1 rakam
- En az 1 özel karakter (!@#$%^&*)

## Migration Notları

Bu servis, ana projeden (Express tabanlı) NestJS'e migrate edilmiştir:
- Express controller → NestJS controller
- Express middleware → NestJS guards
- JWT service → @nestjs/jwt
- Bcrypt → bcryptjs
- Prisma entegrasyonu eklendi
