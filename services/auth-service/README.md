# auth-service

**NestJS** micro-service handling authentication for the platform.

## Port
`3001`

## Responsibilities
- Email/password + Google SSO login
- JWT access token issuance (15m TTL) + refresh token rotation (7d)
- MFA (TOTP) setup and verification
- Password reset via email
- Session listing and revocation
- Account lockout after 5 failed attempts

## Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Email/password login |
| POST | `/auth/register` | New user registration |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Revoke session |
| POST | `/auth/forgot-password` | Password reset request |
| GET  | `/auth/google` | Google OAuth flow |

## Environment Variables
```env
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/platform
REDIS_URL=redis://localhost:6379
JWT_SECRET=<secret>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3100
```

## Development
```bash
pnpm dev        # Watch mode
pnpm build      # Compile
pnpm test       # Jest tests
```
