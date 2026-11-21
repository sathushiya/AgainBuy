# AgainBuy

Monorepo with an Expo / React Native app in `frontend/` and an ASP.NET Core API in `backend/`, running inside Figma Make.

## Development Server

The Figma Make preview runs the **frontend** with `expo start --web` on `$PORT` (default 8443). It is **already running**, so you don't need to start it. The scripts in `.figma/make/` `cd` into `frontend/` first.

- Preview URL: The user can access the running app through the preview panel
- Hot reload: Changes to source files are reflected immediately
- The backend is not part of the preview. Start PostgreSQL with `docker compose -f backend/docker-compose.yml up -d`, then run `dotnet run --project backend/AgainBuy.Api` (http://localhost:5080).

## Project Structure

Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

Frontend (`frontend/`):
- `index.ts` / `App.tsx` - Expo entrypoint and root component (navigation, providers)
- `src/screens/` - Screens grouped by feature; `src/navigation/` - customer and admin navigators
- `src/components/` - Shared UI; `src/theme/index.ts` - brand colours and typography
- `src/context/AppContext.tsx` - Session, wishlist and listing state
- `src/data/` - Mock data; `src/services/authService.ts` - simulated sign-in
- `src/config/permissions.ts` - Role permissions (mirrored by `backend/AgainBuy.Api/Auth/Permissions.cs`)
- `src/types/index.ts` - Shared types
- `package.json`, `app.json`, `tsconfig.json` - Dependencies, Expo config, TypeScript config

Backend (`backend/`): see `backend/README.md`.
- `AgainBuy.Api/Program.cs` - Service wiring, JWT, authorization policies
- `AgainBuy.Api/Controllers/` - HTTP endpoints; `Contracts/` - DTOs; `Data/` - EF Core context and seed data
- `AgainBuy.Api.Tests/` - Integration tests (`dotnet test` from `backend/`)

Root: `.mise.toml` - Node.js and pnpm versions; `.figma/make/` - Figma Make scripts.

## Dependencies

- Frontend: Expo SDK 54, React Native 0.81, React 19, React Navigation, React Hook Form + Zod, `react-native-svg`. Styling uses React Native `StyleSheet`, not Tailwind.
- Backend: .NET 10, ASP.NET Core, EF Core + PostgreSQL (Npgsql, migrations in `Data/Migrations`), JWT bearer auth, xUnit. PostgreSQL runs from `backend/docker-compose.yml`.

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings. An unescaped apostrophe in a single-quoted string breaks the build.
- Ensure JSX tags are closed and braces are balanced.
- When changing a type in `frontend/src/types` or a permission, update the matching backend DTO, enum or `Permissions.cs` too.
