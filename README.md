# Local Inventory – Backend

Express + Firestore backend for the **Local Inventory** Expo app: a mobile inventory, sales, and profit tracker for local business owners in Liberia (USD/LRD).

See `plan.md` for the full architectural plan.

## Stack
- Node.js + Express
- Firebase Admin SDK (Firestore)
- Session-based auth (`express-session`) with PBKDF2 password hashing
- `cors`, `dotenv`, `nodemon`

## Setup

1. Install dependencies (already done):
   ```cmd
   npm install
   ```

2. Place your Firebase service-account JSON in this folder, e.g. `localinventory-service-account.json`.

3. Copy `.env.example` to `.env` and edit values:
   ```cmd
   copy .env.example .env
   ```

4. Seed an admin user:
   ```cmd
   npm run seed:admin
   ```
   Default credentials: `admin` / `admin123` (override via `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`).

5. Start the dev server:
   ```cmd
   npm run dev
   ```

## API Surface

| Area | Base path |
|------|-----------|
| Auth/Users | `/api/users` |
| Settings (rate, base currency) | `/api/settings` |
| Stores | `/api/stores` |
| Products / Inventory | `/api/products` |
| Purchases (restock) | `/api/purchases` |
| Sales | `/api/sales` |
| Stats | `/api/stats` |
| Admin (role: admin) | `/api/admin` |

### Key endpoints
- `POST /api/users/register` – signup as a regular user
- `POST /api/users/login`, `POST /api/users/logout`, `GET /api/users/me`, `PUT /api/users/me`
- `GET/PUT /api/settings` – `exchangeRateUsdToLrd`, `baseCurrency`
- CRUD: `/api/stores`, `/api/products`, `/api/purchases`, `/api/sales`
- `GET /api/stats/overview?storeId=&from=&to=&year=&month=&day=&currency=`
- `GET /api/stats/timeseries?bucket=day|month|year&...`
- `GET /api/stats/by-product?...`
- Admin: `GET /api/admin/users`, `GET /api/admin/users/:id`, `PUT /api/admin/users/:id`, `GET /api/admin/users/:id/stats`, `GET /api/admin/overview`

## Domain Notes
- Two currencies: `USD`, `LRD`. Each user has their own `exchangeRateUsdToLrd` (default 180).
- Money is stored in its native currency. Stats convert at read time using the user's current rate, so updating the rate immediately recalculates totals/profits.
- Products store `currentQuantity`. Purchases increment it; sales decrement it.
- Sales snapshot `unitBuyingPrice` and `unitSellingPrice` at the time of sale, so historical profit is preserved if prices later change.
- When creating a product you can either pass `buyingPrice` directly, or `bulkQuantity` + `bulkTotalCost` and the unit cost will be computed and a matching `purchases` record will be created.
- All transactional records (`purchases`, `sales`) carry `occurredAt` and are filterable by `from`/`to` or `year`/`month`/`day`.

## Folder Layout
```
backend/
  config.js            Firebase Admin init
  server.js            Express bootstrap
  middleware/          auth, errorMiddleware
  utils/               encryption, currency, dateRange
  models/              user, store, product, purchase, sale
  controllers/         user, settings, store, product, purchase, sale, stats, admin
  routes/              one router per resource
  seeds/               seedAdmin.js
```
