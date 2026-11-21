# AgainBuy

A second-hand marketplace for buying and selling pre-owned products.

**Brand message:** Give Good Things a Second Life.

| Folder | What it is | Docs |
|---|---|---|
| [`frontend/`](frontend) | Expo / React Native mobile app (Android, iOS, web preview) | [frontend/README.md](frontend/README.md) |
| [`backend/`](backend) | ASP.NET Core Web API (.NET 10, EF Core, PostgreSQL, JWT) | [backend/README.md](backend/README.md) |

## Quick start

```bash
# API on http://localhost:5080 (needs a PostgreSQL server, see backend/README.md)
cd backend
dotnet run --project AgainBuy.Api

# Mobile app
cd frontend
pnpm install
npx expo start
```

The mobile app still runs on its local mock data. The API serves the same demo data and accounts.
