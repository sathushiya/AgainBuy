# AgainBuy

Monorepo with an Expo / React Native app in `frontend/` and an ASP.NET Core API in `backend/`.

## Development Server

- Backend: start PostgreSQL with `docker compose -f backend/docker-compose.yml up -d`, then run `dotnet run --project backend/AgainBuy.Api` (http://localhost:5080). The app needs it running.
- Frontend: run `npx expo start` in `frontend/`; press `w` for the web version (http://localhost:8081), or open it in Expo Go or an emulator.
- Hot reload: changes to frontend source files are reflected immediately.

## Project Structure

Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

Frontend (`frontend/`):
- `index.ts` / `App.tsx` - Expo entrypoint and root component (navigation, providers)
- `src/screens/` - Screens grouped by feature; `src/screens/orders/` - order dashboards and order detail (negotiation, payment, delivery); `src/screens/notifications/` - in-app notifications; `src/navigation/` - customer and admin navigators
- `src/components/` - Shared UI; `src/theme/index.ts` - brand colours and typography
- `src/context/AppContext.tsx` - Session and wishlist state, unread message and notification counts
- `src/services/api.ts` - Typed client for every API endpoint; `src/services/authService.ts` - sign-in; `src/config/apiUrl.ts` - API address
- `src/services/photos.ts` - Picks, resizes and uploads listing photos
- `src/config/listingFields.ts` - Category-specific Sell fields: one config per category (and subtype) drives the details step, its validation and the saved specifications; `pnpm test:fields` checks it
- `src/utils/orders.ts` - Order steps, dashboard sections and next-step hints; `src/components/orders.tsx` - order timeline; `src/config/couriers.ts` - PickMe and Domex links
- `src/hooks/useApiData.ts` - Loads API data per screen and refreshes on focus; `src/data/demoUsers.ts` - demo credentials shown on the login screen
- `src/config/permissions.ts` - Role permissions (mirrored by `backend/AgainBuy.Api/Auth/Permissions.cs`)
- `src/types/index.ts` - Shared types (the API's JSON matches these)
- `package.json`, `app.json`, `tsconfig.json` - Dependencies, Expo config, TypeScript config

Backend (`backend/`): see `backend/README.md`.
- `AgainBuy.Api/Program.cs` - Service wiring, JWT, authorization policies
- `AgainBuy.Api/Controllers/` - HTTP endpoints; `Contracts/` - DTOs; `Data/` - EF Core context and seed data; `Images/` - Cloudinary photo storage
- `AgainBuy.Api.Tests/` - Integration tests (`dotnet test` from `backend/`)

Root: `.mise.toml` - Node.js and pnpm versions.

## Dependencies

- Frontend: Expo SDK 54, React Native 0.81, React 19, React Navigation, React Hook Form + Zod, `react-native-svg`. Styling uses React Native `StyleSheet`, not Tailwind.
- Backend: .NET 10, ASP.NET Core, EF Core + PostgreSQL (Npgsql, migrations in `Data/Migrations`), JWT bearer auth, xUnit. PostgreSQL runs from `backend/docker-compose.yml`.

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings. An unescaped apostrophe in a single-quoted string breaks the build.
- Ensure JSX tags are closed and braces are balanced.
- When changing a type in `frontend/src/types` or a permission, update the matching backend DTO, enum or `Permissions.cs` too.
