# AgainBuy Figma Design and Developer Handoff

The React Native implementation is the runnable deliverable. Build the companion Figma file with the following pages:

1. Brand Identity and Logo
2. Colour and Typography Tokens
3. Reusable Components
4. Splash and Onboarding
5. Authentication
6. Home
7. Explore and Search
8. Product Details
9. Sell an Item
10. My Listings
11. Messaging
12. Wishlist
13. Profile
14. Purchases and Sales
15. Interactive Prototype and Developer Handoff
16. Role-Based Authentication
17. Administrator Experience

## Official identity

- Terracotta `#C66B4E`
- Cream `#FAF3E8`
- Secondary cream `#F4E9DC`
- Charcoal `#292929`
- Sustainability green `#2F7D55`
- White `#FFFFFF`
- Secondary text `#6B625B`
- Border `#E5D9CC`
- Warning `#D99024`
- Error `#C84040`

The production SVG is available at `assets/againbuy-logo.svg`. Logo variants should preserve the terracotta upper/left reuse arrow, charcoal lower-right arrow, and central green sprout.

## Component mapping

Create Auto Layout equivalents for the exports in:

- `src/components/core.tsx`
- `src/components/marketplace.tsx`
- `src/components/AgainBuyLogo.tsx`

Include pressed, focused, selected, disabled, loading, error, empty, active, reserved, sold, and inactive variants.

## Prototype flows

- Splash → Onboarding → Login → Home
- Home → Explore → Product details → Chat / simulated Buy Now
- Home → Sell → Validation → Preview → Publish → My Listings
- Product → Wishlist → Product details
- Messages → Conversation → Send local message
- Profile → Purchases / Sales / Listings / Settings
- Profile → Log Out confirmation → Login
- Login → Customer Dashboard / Administrator Dashboard
- Administrator → Users → Role confirmation / Account deactivation
- Administrator → Moderation → Remove-listing confirmation

Use 390 × 844 as the primary frame and add a compact 320–360 px variant. Keep all actions at least 44 pt where practical.

## Production notes

Copy describing purchases, publication, messages, role changes, moderation, and facility operations must retain the visible simulated-data disclosures from the React Native implementation. Real payments, identity checks, listing moderation, messaging, and authorization require secure backend services.
