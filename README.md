# AgainBuy

A second-hand marketplace for buying and selling pre-owned products.

**Brand message:** Give Good Things a Second Life.

| Folder | What it is | Docs |
|---|---|---|
| [`frontend/`](frontend) | Expo / React Native mobile app (Android, iOS, web preview) | [frontend/README.md](frontend/README.md) |
| [`backend/`](backend) | ASP.NET Core Web API (.NET 10, EF Core, PostgreSQL, JWT) | [backend/README.md](backend/README.md) |

## Quick start

```bash
# API on http://localhost:5080 (needs Docker Desktop running)
cd backend
docker compose up -d
dotnet run --project AgainBuy.Api

# Mobile app
cd frontend
pnpm install
npx expo start
```

The mobile app gets all its data from the API, so start the backend (and its database) before the app. To use a physical phone, see [API address](frontend/README.md#api-address).
