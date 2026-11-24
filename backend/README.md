# AgainBuy API

ASP.NET Core Web API for the AgainBuy marketplace: authentication, listings, wishlist, messaging, purchases and platform administration.

- .NET 10, controllers, EF Core with **PostgreSQL** (Npgsql) and EF Core migrations
- JWT bearer auth; passwords hashed with ASP.NET Core Identity's `PasswordHasher` (PBKDF2)
- Permission-based authorization that mirrors `frontend/src/config/permissions.ts`
- JSON shapes and enum strings match `frontend/src/types/index.ts` (e.g. `"Like new"`, `"Meetup scheduled"`, `"customer"`)

## Run

Needs Docker Desktop running (for PostgreSQL) and the .NET 10 SDK.

```bash
cd backend
docker compose up -d                   # PostgreSQL 17 on localhost:5432
dotnet run --project AgainBuy.Api      # http://localhost:5080
dotnet test                            # integration tests (also need the database container)
```

On startup the API applies any pending migrations. In Development it then seeds the same demo data the app uses, but only if the database is empty. To reset everything, run `docker compose down -v` (this deletes the data volume) and then `docker compose up -d`. Each test creates its own temporary `againbuy_test_*` database and drops it afterwards; set `AGAINBUY_TEST_DB` to use a different server. The OpenAPI document is served at `/openapi/v1.json`, and `AgainBuy.Api/AgainBuy.Api.http` has sample requests.

To inspect the data: `docker exec -it againbuy-postgres psql -U againbuy -d againbuy`, or connect any PostgreSQL client (pgAdmin, DBeaver) to `localhost:5432`, database `againbuy`, user `againbuy`, password `againbuy_dev`.

### Changing the schema

After editing entities or `AppDbContext`, add a migration (the `dotnet-ef` tool is pinned in `dotnet-tools.json`):

```bash
cd backend
dotnet tool restore
dotnet ef migrations add <Name> --project AgainBuy.Api --output-dir Data/Migrations
```

It's applied automatically on the next start.

| Role | Email | Password |
|---|---|---|
| Customer | `customer@againbuy.demo` | `Customer123!` |
| Customer (second account) | `demo@againbuy.demo` | `Demo1234!` |
| Administrator | `admin@againbuy.demo` | `Admin123!` |

## Configuration

| Key | Purpose | Development default |
|---|---|---|
| `ConnectionStrings:Default` | PostgreSQL connection string. **Required outside Development.** | `Host=localhost;Port=5432;Database=againbuy;Username=againbuy;Password=againbuy_dev` |
| `Jwt:Key` | HMAC signing key, at least 32 characters. **Required outside Development**; the app refuses to start without it. | dev-only key |
| `Jwt:LifetimeMinutes` | Token lifetime | `480` |
| `Database:SeedDemoData` | Seed demo accounts and listings into an empty database | `true` (off in production) |
| `Cors:Origins` | Allowed browser origins (Expo web) | `localhost:8081`, `19006` |
| `RateLimiting:AuthPermitPerMinute` | Requests per IP per minute to `/api/auth/*` | `10` |
| `RateLimiting:UploadsPerMinute` | Photo uploads per user per minute | `30` |
| `Cloudinary:CloudName`, `Cloudinary:ApiKey`, `Cloudinary:ApiSecret` | Cloudinary credentials for listing photos. If any is missing, the API still runs but `/api/uploads/images` answers 503. **Never commit these.** | empty |
| `Cloudinary:Folder` | Cloudinary folder for listing photos | `againbuy/listings` |

Use environment variables in production, e.g. `Jwt__Key=...`, `ConnectionStrings__Default=...`, `Cloudinary__ApiSecret=...`.

### Setting up Cloudinary (photo uploads)

1. Create a free account at [cloudinary.com](https://cloudinary.com). On the dashboard, under **API Keys**, copy the **Cloud name**, **API Key** and **API Secret**.
2. Store them as .NET user secrets. These are kept in your Windows user profile, outside the repo:

   ```bash
   cd backend
   dotnet user-secrets set "Cloudinary:CloudName" "your-cloud-name" --project AgainBuy.Api
   dotnet user-secrets set "Cloudinary:ApiKey" "your-api-key" --project AgainBuy.Api
   dotnet user-secrets set "Cloudinary:ApiSecret" "your-api-secret" --project AgainBuy.Api
   ```
3. Restart the API.

How it works: the app shrinks each photo to 1600px JPEG and sends it to `POST /api/uploads/images`. The API checks that it's a real image (by its bytes), limits it to 10 MB, and uploads it to Cloudinary. Cloudinary caps the size again and strips metadata such as GPS location. The API returns the photo's URL, and the listing stores only that URL in PostgreSQL. With Cloudinary configured, listings only accept photos from your own Cloudinary account.

## Endpoints

All routes are under `/api`. A 🔒 means a bearer token is required; the policy is the permission checked.

**Auth**
| Method | Route | Access |
|---|---|---|
| POST | `/auth/login` | public → `{ token, expiresAt, user }` |
| POST | `/auth/register` | public; always creates a customer |
| POST | `/auth/forgot-password` | public; always 202 (doesn't reveal accounts) |
| GET | `/auth/me` | 🔒 any role |
| PUT | `/auth/me` | 🔒 `profile.manage_own` |
| POST | `/auth/change-password` | 🔒 `profile.manage_own` |
| GET / PUT | `/account/settings` → `{ notifyMessages, notifyOrders, notifyNews, savedLocations }` | 🔒 `profile.manage_own`; up to 10 saved locations |

**Marketplace** (customer)
| Method | Route | Access |
|---|---|---|
| GET | `/categories` | public |
| GET | `/products?search=&category=&condition=&status=&minPrice=&maxPrice=&sort=newest\|price_asc\|price_desc&page=&pageSize=` | 🔒 `marketplace.browse` |
| GET | `/products/{id}` | 🔒 `marketplace.browse` |
| POST | `/products/{id}/report` | 🔒 `marketplace.browse` |
| GET | `/products/mine` | 🔒 `listing.manage_own` |
| POST | `/products` | 🔒 `listing.create` |
| POST | `/uploads/images` (multipart field `file`) → `{ url, width, height }` | 🔒 `listing.create`; JPEG/PNG/WebP/HEIC, max 10 MB |
| PUT | `/products/{id}` | 🔒 `listing.manage_own`, own listing only |
| POST | `/products/{id}/deactivate`, `/products/{id}/activate` | 🔒 `listing.manage_own`, own listing only |
| GET | `/wishlist`, `/wishlist/ids` | 🔒 `marketplace.browse` |
| PUT / DELETE | `/wishlist/{productId}` | 🔒 `marketplace.browse` |
| GET | `/conversations`, `/conversations/{id}` (marks as read) | 🔒 `marketplace.browse`, participants only |
| GET | `/conversations/unread-count` → `{ count }` | 🔒 `marketplace.browse`; total unread messages, for badges |
| POST | `/conversations` `{ productId, message?, imageUrl? }` (text, a photo, or both) | 🔒 `marketplace.browse` |
| POST | `/conversations/{id}/messages` `{ body?, imageUrl? }` (text, a photo, or both) | 🔒 `marketplace.browse`, participants only |
| GET | `/transactions?type=purchase\|sale`, `/transactions/{id}` | 🔒 `transaction.view_own` |
| POST | `/transactions` `{ productId }` | 🔒 `transaction.view_own`; reserves the item |
| POST | `/transactions/{id}/complete`, `/transactions/{id}/cancel` | 🔒 `transaction.view_own` |

**Support** (any signed-in user)
| Method | Route | Access |
|---|---|---|
| POST | `/support/tickets` `{ type: "problem" \| "contact", subject, message }` | 🔒 any role |
| GET | `/support/tickets` | 🔒 any role; your own requests only |

**Administration** (admin)
| Method | Route | Access |
|---|---|---|
| GET | `/admin/stats` | 🔒 `platform.analytics` |
| GET | `/admin/users?search=` | 🔒 `platform.user_manage` |
| PATCH | `/admin/users/{id}/status`, `/admin/users/{id}/role` | 🔒 `platform.user_manage`; not on yourself |
| GET / POST | `/admin/facilities` | 🔒 `platform.facility_manage` |
| PUT / DELETE | `/admin/facilities/{id}` | 🔒 `platform.facility_manage` |
| POST | `/admin/categories` | 🔒 `platform.category_manage` |
| DELETE | `/admin/categories/{id}` | 🔒 `platform.category_manage`; refused while listings use it |
| GET | `/admin/moderation?includeResolved=` | 🔒 `platform.listing_moderate` |
| POST | `/admin/moderation/{id}/request-evidence`, `/dismiss`, `/remove-listing` | 🔒 `platform.listing_moderate` |

Errors use RFC 7807 problem details; validation errors list messages per field, using the same wording as the app's forms.

## Behaviour notes

- **Accounts are re-checked on every request.** A deactivated user, or one whose role changed, is rejected immediately even with an unexpired token.
- **Purchases move no money.** Buying reserves the listing and records a "Meetup scheduled" transaction for the buyer (and a sale for the seller when the seller has an account). Completing marks the listing Sold; cancelling puts it back on the market. Two buyers can't reserve the same item at once.
- **Moderation removal is final for sellers.** A listing removed by a moderator can't be edited or reactivated by its owner.
- **Seeded sellers have no accounts.** The demo listings (`p1`–`p8`) belong to display-only sellers, so nobody can sign in to reply as them. Only the customer's own listing (`mine_1`) and new listings have a seller account behind them.
- **Forgot password only logs the request.** No email provider is configured yet.
- **Unused photos aren't cleaned up.** A photo uploaded and then removed before publishing stays in Cloudinary (tagged `againbuy`). Deleting listings doesn't delete their photos either.

## The mobile app

The app in `frontend/` calls this API through `frontend/src/services/api.ts`, which has one typed function per endpoint. It sends the token as `Authorization: Bearer <token>` and signs the user out on a 401. The API address is set in `frontend/src/config/apiUrl.ts`; see the frontend README for physical phones. When you add or change an endpoint, update `api.ts` and the types in `frontend/src/types/index.ts` to match.

## Layout

```
AgainBuy.Api/
  Program.cs            service wiring, JWT validation, policies, rate limiting, DB init
  Auth/                 permissions map, JWT options and token issuing
  Controllers/          Auth, Products, Uploads, Wishlist, Conversations, Transactions, Categories, Admin
  Contracts/            request/response records and entity → DTO mapping
  Data/                 AppDbContext, demo seed data, Migrations/
  Domain/               entities and enums
  Images/               Cloudinary photo storage
  Infrastructure/       small helpers (ids, enum parsing, rate-limit names)
docker-compose.yml      local PostgreSQL
dotnet-tools.json       pinned dotnet-ef tool
AgainBuy.Api.Tests/     xUnit integration tests (WebApplicationFactory, throwaway PostgreSQL database per test)
```
