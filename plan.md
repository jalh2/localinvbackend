# Local Inventory – Backend Plan

## Context
- **Product:** "Local Inventory" – an Expo (React Native) mobile app for local business owners in Liberia to track goods, expenditures, and profits.
- **Current Phase:** Backend only. Frontend (Expo app) and the admin dashboard come later.
- **Reference Project:** `actsfellowship/backend` – the same stack, folder layout, and conventions are reused here.
- **Stack:**
  - Node.js + Express
  - Firebase Admin SDK (Firestore as the database)
  - `express-session` for session-based auth
  - `cors`, `dotenv`, `nodemon`
  - Password hashing via Node `crypto` PBKDF2 (see `utils/encryption.js` pattern in actsfellowship)

## Architecture Conventions (mirroring actsfellowship/backend)
- `server.js` – express app bootstrap, CORS, sessions, route mounting, error middleware.
- `config.js` – Firebase Admin init + `db` export.
- `middleware/`
  - `auth.js` – `requireAuth`, `requireRole`
  - `errorMiddleware.js` – `notFound`, `errorHandler`
  - `ownership.js` – helper to ensure a non-admin user only touches their own data.
- `utils/`
  - `encryption.js` – PBKDF2 salt+hash helpers
  - `dateRange.js` – parse `from`/`to`/`year`/`month`/`day` query params into ISO bounds
  - `currency.js` – convert amounts between USD and LRD using a per-user rate
- `models/` – thin Firestore data-access modules (one collection each), exposing `findAll`, `findById`, `create`, `update`, `remove`, plus model-specific queries.
- `controllers/` – business logic + request/response shaping.
- `routes/` – Express routers, route-level auth/role guards.
- `seeds/` – one-off scripts (e.g. seed initial admin user).

## Roles
- `admin` – platform operator. Can list all users, view aggregate data, monitor stores/products/sales for any user (read-only monitoring; the dashboard UI comes later).
- `user` – regular seller. Can manage their own stores, products, purchases, sales, and settings only.

Ownership rule: every user-scoped resource carries a `userId`. Non-admin requests are filtered/guarded by `req.session.user.id`. Admin endpoints live under `/api/admin/...`.

## Currency Handling
- Two supported currencies: `USD` and `LRD`.
- Each user has a single `exchangeRateUsdToLrd` stored on the user document (default e.g. 180; settable via Settings endpoint).
- All monetary amounts are stored in their **native currency** (the currency they were entered in). Conversion is applied at read time so changing the rate immediately recalculates totals/profits without rewriting historical data.
- `utils/currency.js` exposes `convert(amount, from, to, rate)` and a `toBase(amount, currency, rate, base)` helper used by stats.

## Date Handling
- Every transactional document (`purchases`, `sales`) stores:
  - `occurredAt` – ISO string of when the event happened (user-provided or `now`).
  - `createdAt`, `updatedAt`.
- Stats endpoints accept `from`, `to`, `year`, `month`, `day`, `storeId` query params for flexible aggregation by day/month/year.

## Data Model

### `users`
- `username` (unique)
- `password` (PBKDF2 hash)
- `role` – `admin` | `user`
- `displayName`
- `phone` (optional)
- `isActive`
- `exchangeRateUsdToLrd` – per-user numeric rate (default 180)
- `baseCurrency` – preferred display currency (`USD` or `LRD`, default `LRD`)
- `createdAt`, `updatedAt`

### `stores`
- `userId` (owner)
- `name`
- `description`
- `location` (optional)
- `createdAt`, `updatedAt`

### `products` (the inventory)
- `userId`, `storeId`
- `name`
- `description`
- `image` (optional, Base64)
- `buyingPrice` – per-unit cost
- `buyingCurrency` – `USD` | `LRD`
- `sellingPrice` – per-unit selling price
- `sellingCurrency` – `USD` | `LRD`
- `currentQuantity`
- `lowStockThreshold` (optional)
- `createdAt`, `updatedAt`

When a product is created, the user can either:
1. Enter `buyingPrice` directly, or
2. Provide `bulkQuantity` + `bulkTotalCost` (+ currency) and the controller computes `buyingPrice = bulkTotalCost / bulkQuantity`.

The original bulk purchase is also recorded as a `purchases` document so it shows up in expenditure stats.

### `purchases` (restock / inbound goods)
- `userId`, `storeId`, `productId`
- `quantity`
- `unitCost`
- `totalCost` – `quantity * unitCost`
- `currency`
- `note`
- `occurredAt`
- `createdAt`, `updatedAt`

Side effect on create: `products.currentQuantity += quantity` and (optionally) refresh `buyingPrice` to the latest unit cost (configurable via `updateBuyingPrice` flag on the request).

### `sales`
- `userId`, `storeId`, `productId`
- `quantity`
- `unitSellingPrice` – snapshot at time of sale
- `unitBuyingPrice` – snapshot at time of sale (for accurate historical profit)
- `sellingCurrency`, `buyingCurrency`
- `note`
- `occurredAt`
- `createdAt`, `updatedAt`

Side effect on create: `products.currentQuantity -= quantity` (rejected if it would go negative).

## API Surface

### Auth / Users `/api/users`
- `POST /register` – self-service signup for regular users (role forced to `user`).
- `POST /login`
- `POST /logout`
- `GET /me`
- `PUT /me` – update own profile (displayName, phone, password, baseCurrency).

### Settings `/api/settings`
- `GET /` – returns `exchangeRateUsdToLrd`, `baseCurrency` for the logged-in user.
- `PUT /` – update them. Changing the rate has no DB-rewrite cost; stats recompute on next read.

### Stores `/api/stores`
- `GET /` – list current user's stores.
- `POST /` – create.
- `GET /:id`
- `PUT /:id`
- `DELETE /:id`

### Products / Inventory `/api/products`
- `GET /?storeId=` – list products (optionally filtered by store).
- `POST /` – create. Body supports either `buyingPrice` directly or `bulkQuantity` + `bulkTotalCost`.
- `GET /:id`
- `PUT /:id`
- `DELETE /:id`

### Purchases (restock) `/api/purchases`
- `GET /?storeId=&productId=&from=&to=`
- `POST /`
- `GET /:id`
- `PUT /:id`
- `DELETE /:id` (reverses quantity)

### Sales `/api/sales`
- `GET /?storeId=&productId=&from=&to=`
- `POST /`
- `GET /:id`
- `PUT /:id`
- `DELETE /:id` (reverses quantity)

### Stats `/api/stats`
All accept `storeId`, `from`, `to`, `year`, `month`, `day`, `currency` (display currency, defaults to user's `baseCurrency`).
- `GET /overview` – totals: inventoryUnits, inventoryCostValue, inventoryRetailValue, totalSpent, totalRevenue, totalProfit.
- `GET /timeseries?bucket=day|month|year` – time-bucketed spend / revenue / profit.
- `GET /by-product` – per-product totals (units sold, revenue, profit, on-hand value).

### Admin `/api/admin` (role `admin` only; full UI deferred)
- `GET /users`
- `GET /users/:id`
- `GET /users/:id/stats` – user-scoped stats overview.
- `PUT /users/:id` – activate/deactivate, change role.
- `GET /overview` – platform-wide totals.

## Constraints / Notes
- Firestore document size cap: 1 MB. Product images are optional Base64; consumers should compress on the client.
- All monetary fields are numbers, never strings. Validation rejects negative prices/quantities.
- All list endpoints are scoped server-side to `req.session.user.id` for non-admins regardless of query params.
- `occurredAt` is always stored as ISO string for sortability and date-range filtering.

## Frontend (Expo App – `localinventory/localinv`)

The Expo app mirrors the architectural patterns of `villagesavingsmainoffice/mainofficeapp` but is written in **JavaScript (.js / .jsx), not TypeScript**.

### Stack
- Expo SDK 54 + `expo-router` (file-based routing, already installed).
- React Native + `react-native-web` for cross-platform.
- `@react-native-community/netinfo` for online/offline detection.
- `localforage` for **web** offline storage (IndexedDB, much larger than localStorage).
- `@react-native-async-storage/async-storage` for **native** offline storage.
- A single `lib/storage.js` shim hides the platform difference behind one async key/value API.

### Folder Layout (mirrors mainofficeapp; JS only)
```
localinv/
  app/                     expo-router routes
    _layout.jsx            providers + Stack + connectivity bar
    index.jsx              redirects to /login or /(tabs)/dashboard
    login.jsx
    register.jsx
    (tabs)/
      _layout.jsx          bottom tabs
      dashboard.jsx        stats overview
      inventory.jsx        product list
      sales.jsx            sales list
      settings.jsx         rate, base currency, stores, sync, account
    products/
      new.jsx              add product (direct or bulk-cost)
      [id].jsx             edit product / restock
    sales/
      new.jsx              record a sale
    stores/
      new.jsx              create a store
      [id].jsx             edit a store
  components/              ConnectivityBar, SyncButton, StatTile, Money, FormField, Button, etc.
  context/                 AuthContext, OfflineSyncContext
  lib/
    storage.js             localforage (web) / AsyncStorage (native) shim
    http.js                fetch wrapper, sends x-user-id / x-user-role
    money.js               currency conversion + formatting (mirrors backend utils/currency.js)
    dates.js               date-range + bucketing helpers (mirrors backend utils/dateRange.js)
    offline.js             remote cache + offline-create queue + sync + offline stats compute
  constants/               theme.js (colors, spacing)
  hooks/                   small helpers
```

### Auth Model (frontend trust)
- Backend middleware is relaxed; frontend is the source of truth.
- After login/register, the user object is persisted via `lib/storage.js`.
- `lib/http.js` reads the cached user and sets `x-user-id` / `x-user-role` headers on every request so backend ownership scoping continues to work.

### Offline-First Behavior
1. **All reads cache to local storage** (`localforage` on web, `AsyncStorage` on native) keyed by resource type and userId.
2. **All writes go through `lib/offline.js`**:
   - When online: write to API → update local cache → mark `synced`.
   - When offline: append to a per-resource pending queue with a generated `localId`, applied to the cache so the UI sees the change immediately.
3. **Sync** (`lib/offline.js → syncOfflineData`):
   - Replays each queued create/update/delete in order.
   - On product creates, maps `localId → real id` so dependent purchases/sales reference the right product after sync.
   - Refreshes remote caches afterward.
   - Triggered automatically when NetInfo flips to online, and manually via the **Sync Now** button.
4. **Calculations work fully offline.** `lib/offline.js` exposes `computeStatsLocally()` that mirrors `backend/controllers/statsController.js` formulas using the cached products/purchases/sales and the cached `exchangeRateUsdToLrd`. Updating the rate in Settings recomputes immediately on the same data.
5. **Online/Offline indicator** is a top bar in `app/_layout.jsx` (green = online, red = offline) with a small sync status / last-sync timestamp and a manual sync button.

### Local Storage Keys (per logged-in userId)
- `cache:user:<userId>` – the user profile & settings (rate, baseCurrency).
- `cache:stores:<userId>`
- `cache:products:<userId>`
- `cache:purchases:<userId>`
- `cache:sales:<userId>`
- `queue:<resource>:<userId>` – pending create/update/delete ops.
- `meta:lastSyncAt:<userId>`

### Frontend Implementation Phases

#### Phase F1 – Foundation
- [ ] Replace Expo template files in `app/` with our JS structure.
- [ ] `lib/storage.js`, `lib/http.js`, `lib/money.js`, `lib/dates.js`, `lib/offline.js`.
- [ ] `context/AuthContext.jsx`, `context/OfflineSyncContext.jsx`.
- [ ] `components/ConnectivityBar.jsx`, `components/SyncButton.jsx`.
- [ ] `app/_layout.jsx`, `app/index.jsx`.

#### Phase F2 – Auth
- [ ] `app/login.jsx`, `app/register.jsx`.
- [ ] On first login, ensure user has at least one store (auto-create "My Store" if none).

#### Phase F3 – Core Screens (offline-aware)
- [ ] `app/(tabs)/_layout.jsx` – bottom tabs.
- [ ] `app/(tabs)/dashboard.jsx` – uses `computeStatsLocally()` so it works offline.
- [ ] `app/(tabs)/inventory.jsx` – product list + low-stock badges.
- [ ] `app/(tabs)/sales.jsx` – sales list with filter by date.
- [ ] `app/(tabs)/settings.jsx` – exchange rate input, base currency, store list, manual sync, logout.
- [ ] `app/products/new.jsx` – supports direct buying price OR bulk (qty + total) calculation, USD or LRD.
- [ ] `app/products/[id].jsx` – edit product + restock.
- [ ] `app/sales/new.jsx` – record a sale (selling price prefilled from product).
- [ ] `app/stores/new.jsx`, `app/stores/[id].jsx`.

#### Phase F4 – Polish
- [ ] Date filters (day / month / year) on dashboard, inventory stats, sales list.
- [ ] Pending-sync badges on records waiting to be synced.
- [ ] Manual sync error UI (per-record retry).

## Implementation Phases

### Phase 1 – Foundation (current)
- [x] Initialize `package.json`, install deps.
- [ ] `.gitignore`, `.env.example`, README.
- [ ] `config.js`, `server.js`, `middleware/`, `utils/`.

### Phase 2 – Auth & Users
- [ ] `userModel`, `userController`, `userRoutes` (register, login, logout, me, update me).
- [ ] `seeds/seedAdmin.js`.

### Phase 3 – Core Domain
- [ ] Stores CRUD.
- [ ] Products CRUD with bulk-cost computation.
- [ ] Purchases CRUD with quantity side effects.
- [ ] Sales CRUD with quantity + profit snapshot side effects.

### Phase 4 – Settings & Stats
- [ ] Settings endpoint (exchange rate, base currency).
- [ ] Stats overview / timeseries / by-product with on-the-fly currency conversion.

### Phase 5 – Admin Monitoring (read-mostly)
- [ ] `/api/admin/users`, `/api/admin/users/:id`, `/api/admin/users/:id/stats`, `/api/admin/overview`.

### Phase 6 – Validation & Hardening
- [ ] Manual endpoint verification.
- [ ] Confirm Firebase service account is in place locally.
- [ ] Confirm CORS/session config works with Expo dev clients.

## Immediate Next Build Priority
1. Foundation files (config, server, middleware, utils, .gitignore, .env.example).
2. Users + auth + admin seed.
3. Stores → Products → Purchases → Sales.
4. Settings + Stats.
5. Admin monitoring endpoints.
