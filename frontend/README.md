# AgainBuy Mobile

AgainBuy is a native Expo marketplace for buying and selling pre-owned products with one unified customer account.

**Brand message:** Give Good Things a Second Life.
**Tagline:** Buy · Sell · Give New Life

## Technology

- Expo SDK 54 and React Native 0.81
- TypeScript
- React Navigation native stack and bottom tabs
- React Context for local session, wishlist, and listing state
- React Hook Form and Zod validation
- React Native `StyleSheet`
- `react-native-svg` for the reusable AgainBuy vector logo

The implementation uses React Native primitives. Expo web is handy for quick previews in the browser; Android and iOS remain the primary application targets.

## Run

```bash
cd frontend
pnpm install
npx expo start
```

Then open with Expo Go or an Android/iOS emulator. Start the backend first (see `../backend/README.md`): all data comes from the AgainBuy API.

### API address

The app calls `http://localhost:5080` on web and the iOS simulator, and `http://10.0.2.2:5080` on the Android emulator (see `src/config/apiUrl.ts`). On a physical phone, set your computer's LAN IP before starting Expo, and make the API listen on it:

```powershell
$env:EXPO_PUBLIC_API_URL = "http://192.168.1.20:5080"   # your computer's IP
npx expo start --clear

# in backend/
dotnet run --project AgainBuy.Api --urls http://0.0.0.0:5080
```

Useful checks:

```bash
pnpm typecheck
pnpm test:roles          # signs in through the API; needs the backend running
pnpm test:fields         # checks category field rules (no backend needed)
pnpm exec expo export --platform android
pnpm exec expo export --platform ios
```

## Demo sign-in and roles

Expand **Demo Accounts** on the shared login screen. These accounts are seeded by the backend in development:

| Role | Email | Password |
|---|---|---|
| Customer | `customer@againbuy.demo` | `Customer123!` |
| Customer (second account) | `demo@againbuy.demo` | `Demo1234!` |
| Administrator | `admin@againbuy.demo` | `Admin123!` |

Sign-in goes through the API (`src/services/authService.ts`); the token is kept in memory, so reloading the app signs you out. Each account opens a separate protected navigator:

- Customer: Home, Explore, Sell, Messages, Profile
- Administrator: Overview, Users, Facilities, Moderation, Profile

Permissions are centralized in `src/config/permissions.ts`. The API enforces the same permissions server-side (`backend/AgainBuy.Api/Auth/Permissions.cs`); hiding routes in the app is only for navigation.

## Implemented flows

- Branded splash and three-page onboarding
- Login, registration, and password recovery
- Warm marketplace home with categories and product discovery
- Search and filtering by category and condition
- Product details with prices, usage, year, condition, defects, accessories, seller, and location
- Wishlist saved to your account
- Selling in three steps: listing details (up to 8 photos uploaded to Cloudinary, reason for selling, Delivery Available with PickMe or Domex, or Pickup Only) → category-specific details for the chosen category and subtype (e.g. Phones: storage and battery health; Furniture → Sofa: seats and dimensions), validated per category → review and publish. Buyers see the details under Specifications
- My Listings with deactivation and reactivation
- Messaging with sellers, unread counts, and new conversations from product pages
- Reserving instead of buying: a reserved item leaves browsing, and buyer and seller work through negotiation → deal agreed (both agree) → bank-transfer payment with an uploaded receipt that the seller verifies → shipped with tracking or ready for pickup → delivered (confirmed by the buyer) → completed
- Order dashboards: "My orders" for buyers and "Reserved by customers" for sellers, with a timeline, full history, chat, and a downloadable PDF delivery receipt
- In-app notifications for every order step, with an unread badge on the Profile tab
- Purchase and sales history
- Settings & Help: profile and photo, password change, notification preferences, bank transfer details (for sellers), saved pickup locations, buying and selling guides, and support requests
- API sign-in for Customer and Administrator
- Role-specific dashboards, navigation, profiles, and logout
- Platform user management, facility records, and listing moderation
- Confirmation-protected admin actions: role changes, account deactivation, moderation

## Brand assets

- Editable source: `assets/againbuy-logo.svg`
- Native component: `src/components/AgainBuyLogo.tsx`
- SVG XML source: `src/assets/againbuyLogo.ts`
- Expo app icons and splash: `assets/`

Brand colors are centralized in `src/theme/index.ts`.

## Current limitations

- Payment is a bank transfer between buyer and seller; AgainBuy never moves money and never confirms a payment automatically. PickMe and Domex are linked, not integrated: the seller books the courier and enters the tracking number.
- Seeded sample listings have no seller account, so they cannot be reserved. Try it with a listing posted by a demo customer.
- Photo upload needs Cloudinary credentials on the backend (see `../backend/README.md`). Without them, "Choose photos" shows an error and listings use a placeholder image.
- Sessions are not saved, so restarting the app signs you out.
- Seeded product images and marketplace data are samples.
