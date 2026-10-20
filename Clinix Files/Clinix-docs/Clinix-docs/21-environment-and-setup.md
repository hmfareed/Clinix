# 21 — Environment and Local Setup (new)

## Environment variables

```
# Core
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_SECRET=<long random string>
MONGODB_URI=mongodb+srv://...

# AI
NVIDIA_API_KEY=<server only>
NVIDIA_MODEL=<model id>
AI_TIMEOUT_MS=30000
AI_MAX_ATTEMPTS=2

# Maps (choose one)
GOOGLE_MAPS_API_KEY=<server only>
MAPBOX_ACCESS_TOKEN=<server only>
NEXT_PUBLIC_MAPS_PUBLIC_KEY=<restricted browser key, if a map is rendered client side>

# Email
RESEND_API_KEY=<server only>
EMAIL_FROM=no-reply@example.com

# Emergency defaults
DEFAULT_COUNTRY=GH

# Safety / ops
FEATURE_FLAGS_SOURCE=db
LOG_LEVEL=info
```

Only variables that must reach the browser start with `NEXT_PUBLIC_`. API keys for NVIDIA, Resend and server-side maps **never** do.

## Local setup

```bash
npx create-next-app@latest ai-healthcare-assistant --typescript --tailwind --app --src-dir
cd ai-healthcare-assistant
npm install mongoose zod openai react-hook-form @hookform/resolvers next-auth
npx shadcn@latest init
cp .env.example .env.local
npm run dev
```

## Repository hygiene

- `.env.local` in `.gitignore`; commit `.env.example` with placeholders only
- Commit the lockfile
- Secret scanning pre-commit hook
- Conventional commits; protected main branch

## Suggested scripts

| Script | Purpose |
|---|---|
| `dev` | Run the app locally |
| `test` | Unit tests |
| `test:safety` | Rule-engine and safety suite |
| `test:eval` | AI golden-case evaluation |
| `seed:emergency` | Seed `emergencyConfigurations` |
| `db:indexes` | Create indexes and validators |
| `lint`, `typecheck` | Static checks |
