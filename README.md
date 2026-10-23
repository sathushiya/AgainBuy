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

The implementation uses React Native primitives. Expo web exists only to provide the supervised Figma Make preview; Android and iOS remain the primary application targets.

## Run

```bash
pnpm install
npx expo start
```

Then open with Expo Go or an Android/iOS emulator.

Useful checks:

```bash
pnpm typecheck
pnpm test:data
pnpm test:roles
pnpm exec expo export --platform android
pnpm exec expo export --platform ios
```

## Demo sign-in and roles

Expand **Demo Accounts** on the shared login screen. These credentials are local development fixtures:

| Role | Email | Password |
|---|---|---|
| Customer | `customer@againbuy.demo` | `Customer123!` |
| Administrator | `admin@againbuy.demo` | `Admin123!` |

Authentication is simulated by `src/services/authService.ts`. Each account opens a separate protected navigator:

- Customer: Home, Explore, Sell, Messages, Profile
- Administrator: Overview, Users, Facilities, Moderation, Profile

Permissions are centralized in `src/config/permissions.ts`. Production authentication and authorization must be enforced by a secure backend.

## Implemented flows

- Branded splash and three-page onboarding
- Login, registration, and password recovery
- Warm marketplace home with categories and product discovery
- Search and filtering by category and condition
- Product details with prices, usage, year, condition, defects, accessories, seller, and location
- Wishlist updates
- Sell-an-item form with Zod validation, preview, and local publication
- My Listings with local deactivation
- Product messaging and local message sending
- Purchases and sales history
- Settings, help, safety guidance, and logout confirmation
- Exact mock login for Customer and Administrator
- Role-specific dashboards, navigation, profiles, and logout
- Platform user management, facility records, and listing moderation
- Confirmation-protected simulated administrative operations

## Brand assets

- Editable source: `assets/againbuy-logo.svg`
- Native component: `src/components/AgainBuyLogo.tsx`
- SVG XML source: `src/assets/againbuyLogo.ts`
- Expo app icons and splash: `assets/`

Brand colors are centralized in `src/theme/index.ts`.

## Demonstration limitations

- Purchases do not process money or create real orders.
- Listings and messages remain in local application state.
- Product images and marketplace data are samples.
- A production service must authenticate users, moderate listings, store images, secure messaging, and validate transactions server-side.
- Hiding mobile routes is not sufficient authorization; the backend must validate every protected operation.
