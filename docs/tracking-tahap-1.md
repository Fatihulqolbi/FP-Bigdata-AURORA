# Tracking Tahap 1 — Waste Exchange Marketplace

## Development

### Backend API (`backend/api/`)
- [x] Inisialisasi project Express + TypeScript + Prisma
- [x] Setup database & koneksi Prisma (MongoDB)
- [x] Setup environment (`.env`, `.env.example`)
- [x] Auth module — register/login/JWT
- [x] RBAC middleware
- [x] Rate limit middleware
- [x] Admin verification flow
- [x] Material category module
- [x] Listing module (CRUD + search/filter)
- [x] Demand module (CRUD)
- [x] Matching engine
- [x] Order module (create, multi-seller, partial)
- [x] Payment simulation flow
- [x] Logistik flow (pickup/delivery option)
- [x] Register marketplace routes di `backend/api/src/index.ts`

### Frontend Dashboard (`dashboard/src/features/marketplace/`)
- [x] Setup routing (internal state-based)
- [x] Setup TanStack Query
- [x] Marketplace API client
- [x] `MarketplaceBrowse` page
- [x] `ListingDetail` page
- [x] `InventoryManage` page
- [x] `DemandForm` page
- [x] `MatchSuggestion` page
- [x] `BuyerDashboard` page
- [x] `OrderDetail` page
- [x] `AdminVerification` page
- [x] Komponen reusables (ListingCard, MatchSuggestionCard, OrderItemList, PriceRangeBadge, VerificationStatusBadge)
- [x] Integrasi route & menu ke `App.tsx`
- [x] Mobile responsive (styling fleksibel)
- [x] `tsc --noEmit` + `vite build` lulus

## Vulnerability Check
- [ ] `npm audit` backend/api — 5 findings (3 moderate, 1 high, 1 critical di devDeps esbuild/vite/vitest)
- [x] `npm audit` dashboard — 0 vulnerabilities
- [ ] Fix High/Critical vulnerabilities (esbuild perlu vitest breaking upgrade)
- [x] RBAC middleware implemented
- [x] Input validation with Zod on all endpoints
- [x] Rate limiting active
- [x] `.env.example` tersedia, `.env` di-.gitignore
- [ ] Security plugin ESLint aktif

## Testing
- [x] Haversine distance unit test written (tests/matching.spec.ts)
- [ ] Run unit tests (perlu MongoDB running)
- [ ] Integration test: listing → match → order
- [ ] E2E B2B happy path (manual)
- [ ] E2E B2C happy path (manual)
- [ ] RBAC forbidden access test (manual)
- [ ] Regression: Kafka/Spark/HDFS pipeline

## Documentation
- [x] Update `docs/PRD-Tahap-1-Marketplace.md`
- [x] Update `docs/tracking-tahap-1.md`
