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
| `RateLimiting:AssistantPerMinute` | Assistant questions per user per minute | `12` |
| `Cloudinary:CloudName`, `Cloudinary:ApiKey`, `Cloudinary:ApiSecret` | Cloudinary credentials for listing photos. If any is missing, the API still runs but `/api/uploads/images` answers 503. **Never commit these.** | empty |
| `Cloudinary:Folder` | Cloudinary folder for listing photos | `againbuy/listings` |
| `Groq:ApiKey` | Groq API key for the shopping assistant. If missing, the API still runs but `/api/assistant/chat` answers 503. **Never commit it.** | empty |
| `Groq:Model` | Groq model the assistant uses (see https://console.groq.com/docs/models) | `openai/gpt-oss-20b` |
| `Groq:ReasoningEffort`, `Groq:MaxCompletionTokens`, `Groq:MaxRetryWait` | Reasoning effort for gpt-oss models, reply length cap, and the longest rate-limit wait before answering "busy" | `low`, `800`, `00:00:12` |

Use environment variables in production, e.g. `Jwt__Key=...`, `ConnectionStrings__Default=...`, `Cloudinary__ApiSecret=...`, `Groq__ApiKey=...`.

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

### Setting up Groq (shopping assistant)

1. Create a key at https://console.groq.com under **API Keys** (the free plan is enough for development).
2. Store it in user-secrets from `backend/`, never in `appsettings.json`:
   ```
   dotnet user-secrets set "Groq:ApiKey" "gsk_..." --project AgainBuy.Api
   ```
3. Restart the API.

How it works: the app keeps the chat and sends it (latest 10 turns, each up to 1,000 characters) to `POST /api/assistant/chat`, with the product ID when asked from a product page. The API adds the app guide (`Assistant/AssistantPrompt.cs`), the category list and that listing's details, and offers the model a `search_listings` tool (`Assistant/ListingSearch.cs`). When someone asks what is for sale, the model calls it (keywords, category, price range, condition, sort); the API searches **Active** listings in PostgreSQL, the same ones people can browse, and sends back a compact summary. The model may search up to three times, then answers. The reply includes the listings it mentions as `products`, which the app shows as cards. Nothing is stored.

The free Groq plan allows about 8,000 tokens per minute for `openai/gpt-oss-20b`, and a product question uses roughly 3,000-5,000 (two model calls). When Groq asks to wait a few seconds, the API waits once (up to `Groq:MaxRetryWait`, 12 s) and retries; longer waits answer 503 "busy". For real traffic, upgrade the Groq plan. When the app's features or rules change, update the guide too.

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
| GET | `/transactions?type=purchase|sale`, `/transactions/{id}` | 🔒 `transaction.view_own`; purchase and sales history (completed orders add rows) |
| POST | `/transactions/{id}/complete`, `/transactions/{id}/cancel` | 🔒 `transaction.view_own`; older meetup-scheduled records only |

**Orders** (customers; only the order's buyer and seller can see or act on it)
| Method | Route | Who |
|---|---|---|
| POST | `/orders` `{ productId }` | buyer; reserves the listing (hidden from browsing), opens a chat, status *Negotiating* |
| GET | `/orders?as=buyer|seller` | your orders as buyer ("My reservations") or seller ("Reserved by customers") |
| GET | `/orders/{id}` | buyer or seller; includes history and `actions` (what you may do now) |
| POST | `/orders/{id}/price` `{ price }` | either, while negotiating; resets both agreements |
| POST | `/orders/{id}/agree` | either; once both agree → *Deal agreed* → *Payment pending* (seller needs bank details saved) |
| POST | `/orders/{id}/cancel` | buyer, before paying; the listing goes back on sale |
| POST | `/orders/{id}/payment-receipt` (multipart `file`, `reference`) | buyer; image or PDF ≤ 5 MB → *Payment verification pending* |
| POST | `/orders/{id}/confirm-payment` | seller only → *Payment confirmed* |
| POST | `/orders/{id}/reject-payment` `{ reason }` | seller only → back to *Payment pending* |
| POST | `/orders/{id}/ship` `{ courier?, trackingNumber, deliveryNotes? }` | seller, delivery orders → *Shipped*; generates the PDF receipt |
| POST | `/orders/{id}/ready-for-pickup` `{ pickupNotes? }` | seller, pickup orders → *Ready for pickup*; generates the PDF receipt |
| POST | `/orders/{id}/confirm-delivery` | buyer only → *Delivered* → *Completed*; listing marked sold |
| GET | `/orders/{id}/files/payment-receipt|delivery-receipt/link` | buyer or seller; a 5-minute signed link to `/files/{token}` |
| GET | `/files/{token}` | anyone holding a valid, unexpired link |

**Notifications** (any signed-in user)
| Method | Route | Access |
|---|---|---|
| GET | `/notifications`, `/notifications/unread-count` | 🔒 your latest 50, and the unread total |
| POST | `/notifications/{id}/read`, `/notifications/read-all` | 🔒 your own only ||sale`, `/transactions/{id}` | 🔒 `transaction.view_own` |
| POST | `/transactions` `{ productId }` | 🔒 `transaction.view_own`; reserves the item |
| POST | `/transactions/{id}/complete`, `/transactions/{id}/cancel` | 🔒 `transaction.view_own` |

**Support** (any signed-in user)
| Method | Route | Access |
|---|---|---|
| POST | `/support/tickets` `{ type: "problem" \| "contact", subject, message }` | 🔒 any role |
| GET | `/support/tickets` | 🔒 any role; your own requests only |

**Assistant**
| Method | Route | Access |
|---|---|---|
| POST | `/assistant/chat` `{ messages: [{ role, content }], productId? }` → `{ reply, products }` | 🔒 any role; 503 if Groq isn't set up or is busy, 502 if it fails |

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
- **Orders follow one workflow.** Negotiating → Deal agreed → Payment pending → Payment verification pending → Payment confirmed → Shipped (delivery) or Ready for pickup → Delivered → Completed, or Cancelled if the buyer drops the reservation before paying. Every change is stored with its time and who made it (`OrderEvents`). The API decides which actions each party may take (`Orders/OrderActions.cs`): buyers can't confirm payment, sellers can't confirm delivery, and nothing can skip a stage. A product can have only one non-cancelled order (a unique database index), so it can't be reserved twice or sold twice, and concurrent changes are caught by a row version.
- **No money moves through AgainBuy.** Buyers pay by bank transfer using the seller's saved bank details, which are shown only after both parties agree. Uploading a receipt never confirms payment; the seller confirms after checking their own account.
- **Couriers aren't integrated.** Delivery listings name PickMe or Domex; the seller books the courier on its website and enters the tracking number, which buyers use on the courier's site. AgainBuy doesn't track parcels itself.
- **Receipts are private.** Payment receipts and generated PDFs are stored in PostgreSQL (`OrderFiles`), never on Cloudinary, and are only served through short-lived signed links issued to the order's buyer or seller. Delivery receipts are rendered from the order's data with QuestPDF (free Community licence for businesses under USD 1M annual revenue).
- **Seeded demo listings can't be reserved**, because their sellers have no accounts to agree a deal or confirm payment. Listings from real accounts (such as `mine_1`) can.
- **Moderation removal is final for sellers.** A listing removed by a moderator can't be edited or reactivated by its owner.
- **Listings carry category-specific details.** `specifications` is an ordered list of `{ key, label, value }` (up to 40, each value up to 200 characters), e.g. `{ "key": "storage", "label": "Storage capacity", "value": "256 GB" }`. Blank values and repeated keys are dropped. Which fields each category has, and which are required, is defined by the app (`frontend/src/config/listingFields.ts`); the API stores what it is sent. Listings also have `reasonForSelling` and `delivery` (`"Delivery"` or `"Meet-up"`, shown as Delivery Available / Pickup Only; default Meet-up) and, for delivery, `courier` (`"PickMe"` or `"Domex"`, required). `brand` and `model` are optional, because not every category has them (books have neither).
- **Seeded sellers have no accounts.** The demo listings (`p1`–`p8`) belong to display-only sellers, so nobody can sign in to reply as them. Only the customer's own listing (`mine_1`) and new listings have a seller account behind them.
- **The assistant only knows what it is told.** It answers from the app guide, the listing being viewed and its own searches of active listings; it can't see orders or accounts. Seller-written listing text is fenced and marked as data in the prompt, so a description can't give the model instructions. Answers can still be wrong, which the app says on the chat screen.
- **Forgot password only logs the request.** No email provider is configured yet.
- **Unused photos aren't cleaned up.** A photo uploaded and then removed before publishing stays in Cloudinary (tagged `againbuy`). Deleting listings doesn't delete their photos either.

## The mobile app

The app in `frontend/` calls this API through `frontend/src/services/api.ts`, which has one typed function per endpoint. It sends the token as `Authorization: Bearer <token>` and signs the user out on a 401. The API address is set in `frontend/src/config/apiUrl.ts`; see the frontend README for physical phones. When you add or change an endpoint, update `api.ts` and the types in `frontend/src/types/index.ts` to match.

## Layout

```
AgainBuy.Api/
  Program.cs            service wiring, JWT validation, policies, rate limiting, DB init
  Auth/                 permissions map, JWT options and token issuing
  Assistant/            Groq chat client and the assistant's app guide
  Controllers/          Auth, Products, Orders, Notifications, Files, Uploads, Wishlist, Conversations, Transactions, Categories, Assistant, Admin
  Contracts/            request/response records and entity → DTO mapping
  Data/                 AppDbContext, demo seed data, Migrations/
  Domain/               entities and enums
  Images/               Cloudinary photo storage
  Orders/               order rules (OrderActions), notifications, signed file links, PDF receipts
  Infrastructure/       small helpers (ids, enum parsing, rate-limit names)
docker-compose.yml      local PostgreSQL
dotnet-tools.json       pinned dotnet-ef tool
AgainBuy.Api.Tests/     xUnit integration tests (WebApplicationFactory, throwaway PostgreSQL database per test)
```
