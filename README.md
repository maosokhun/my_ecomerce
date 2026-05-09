# ShopHub E-Commerce

Full-stack e-commerce project with:
- `shop-frontend`: Next.js frontend
- `shop-backend`: Express + Prisma backend

## Tech Stack

- Frontend: Next.js, React, Tailwind, Zustand
- Backend: Node.js, Express, Prisma
- Database: PostgreSQL

## Project Structure

```text
.
├─ shop-frontend/
└─ shop-backend/
```

## Prerequisites

- Node.js 20+ (recommended)
- npm 10+
- PostgreSQL

## 1) Clone and Install

Install dependencies in both apps:

```bash
cd shop-backend
npm install
cd ../shop-frontend
npm install
```

## 2) Environment Variables

### Backend (`shop-backend/.env`)

Create `.env` in `shop-backend` (or update existing one):

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/shopdb?schema=public"
JWT_SECRET="your_jwt_secret"
JWT_EXPIRES_IN="7d"
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
BACKEND_PUBLIC_URL=http://localhost:5000
```

Optional integrations:
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_PHONE`
- Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_USER_BOT_TOKEN`, `TELEGRAM_USER_CHAT_ID`

### Frontend (`shop-frontend/.env.local`)

Create `.env.local` in `shop-frontend`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
INTERNAL_API_URL=http://127.0.0.1:5000/api
```

Optional:
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## 3) Database Setup (Backend)

From `shop-backend`:

```bash
npx prisma generate
npx prisma migrate deploy
```

For local development without existing migrations history, you may use:

```bash
npx prisma db push
```

## 4) Run in Development

Open 2 terminals:

Terminal 1 (backend):
```bash
cd shop-backend
npm run dev
```

Terminal 2 (frontend):
```bash
cd shop-frontend
npm run dev
```

Local URLs:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`
- Health check: `http://localhost:5000/health`

## 5) Production Build

### Backend build
```bash
cd shop-backend
npm run build
npm start
```

### Frontend build
```bash
cd shop-frontend
npm run build
npm start
```

## 6) Deploy Guide

### Frontend on Vercel

1. Import repository in Vercel.
2. Set **Root Directory** to `shop-frontend`.
3. In **Build & Output Settings**: **Framework Preset** = **Next.js**; leave **Output Directory** empty (do not set `public` — that causes “No Output Directory named public” on Vercel).
4. Set env vars:
   - `NEXT_PUBLIC_API_URL=https://<your-backend-domain>/api`
   - `INTERNAL_API_URL=https://<your-backend-domain>/api`
5. Deploy.

### Backend on Render (without `render.yaml`)

1. Render -> New Web Service -> select this repository.
2. Set **Root Directory** to `shop-backend`.
3. Commands:
   - Build: `npm install && npx prisma generate && npm run build`
   - Pre-Deploy: `npx prisma migrate deploy`
   - Start: `npm start`
4. Add environment variables (at least):
   - `DATABASE_URL` (from Render PostgreSQL)
   - `JWT_SECRET`
   - `NODE_ENV=production`
   - `FRONTEND_URL=https://<your-vercel-domain>`
   - `BACKEND_PUBLIC_URL=https://<your-render-domain>`
5. Deploy and test `https://<your-render-domain>/health`.

## Troubleshooting

- Prisma engine/file lock on Windows:
  - close running Node processes and rerun `npx prisma generate`
- CORS errors:
  - verify backend `FRONTEND_URL` matches your actual frontend domain
- API not reachable from frontend:
  - verify `NEXT_PUBLIC_API_URL` and `INTERNAL_API_URL` point to `/api` base URL

## Project Defense Notes (For Teacher Q&A)

This section is a ready-to-explain guide for presentation/defense.

## A) Why this project was built this way

- Goal: build a complete online shopping system (customer + admin) with real business flow.
- Chosen architecture: separate frontend and backend so each can scale and deploy independently.
- Reason:
  - frontend focuses on UI/UX and user interaction
  - backend focuses on business logic, security, and database consistency

## B) How the project was created (step-by-step story)

1. Requirement analysis
   - Defined two roles: customer and admin
   - Defined core modules: authentication, product catalog, cart, checkout, order tracking, admin management

2. System design
   - Frontend: Next.js app (`shop-frontend`)
   - Backend: Express API (`shop-backend`)
   - Database: PostgreSQL with Prisma ORM
   - Integration: payment options, notification channels, image upload

3. Backend foundation
   - Initialized Express + TypeScript
   - Added middleware: CORS, error handling, auth middleware
   - Added route/controller structure by module (auth, orders, admin, leads, upload, payments)
   - Added Prisma schema and database connection

4. Frontend foundation
   - Initialized Next.js + TypeScript + Tailwind
   - Built reusable layout components (Navbar, Footer, Dashboard layout)
   - Added API client layer to centralize backend calls
   - Added state management for auth and language handling

5. Feature implementation
   - Auth: register/login (phone-first + optional email), forgot password flows
   - Product: listing, filter, cart, checkout
   - Order: place order, payment selection, order detail page, cancel flow
   - Admin: manage orders/users/products, support inbox, subscriber leads, realtime unread badges
   - Notification: Telegram alerts for important events

6. Quality and recovery work
   - Fixed UI regressions and missing features after Git issues
   - Added field-specific validation feedback
   - Improved i18n coverage and Khmer labels
   - Refined admin and customer experience based on testing feedback

7. Deployment strategy
   - Backend deployed to Render
   - Frontend deployed to Vercel
   - Connected both through environment variables and CORS policy

## C) Folder explanation (what each place is for)

- `shop-frontend/`
  - `src/app/`: pages and route-based UI
  - `src/components/`: reusable UI components
  - `src/lib/`: API utilities and shared helpers
  - `src/store/`: global client state (auth/language/etc.)

- `shop-backend/`
  - `src/controllers/`: request handlers and business logic
  - `src/routes/`: API endpoint definitions
  - `src/middleware/`: auth/error/validation middleware
  - `src/lib/`: integrations and helper services (invoice, notifier, cloud uploads)
  - `prisma/`: schema and migration-related files

## D) Request flow (easy to explain)

1. User interacts with frontend page.
2. Frontend sends HTTP request to backend API.
3. Backend validates input and permissions.
4. Backend reads/writes PostgreSQL via Prisma.
5. Backend returns JSON response.
6. Frontend updates UI and shows success/error message.

## E) Security choices you can explain

- JWT-based authentication for protected APIs
- Role checks for admin-only endpoints
- Input validation at backend to avoid invalid data
- Environment variables for secrets (not hardcoded in source)
- Password hashing before storing in database
- CORS restriction using configured frontend domain

## F) Database design logic (high-level)

- `users`: account, role, profile, auth identity
- `products` + related variant data: catalog and display logic
- `orders` + order items: transactional purchase records
- `addresses`: customer shipping information
- `newsletter/support/leads`: customer engagement and admin follow-up

Why relational DB:
- strong consistency for orders/payments/users
- easier reporting and admin queries

## G) Build/deploy decisions (why split platforms)

- Vercel is optimized for Next.js frontend hosting
- Render is practical for Node.js API + PostgreSQL
- Split deployment improves maintainability:
  - frontend updates can ship without backend restart
  - backend scaling/config can be managed independently

## H) Common teacher questions and ready answers

1) Why did you use Next.js instead of plain React?
- Next.js gives production-ready routing, optimization, and strong ecosystem support for larger projects.

2) Why Prisma?
- Prisma gives type-safe DB access, cleaner queries, and easier schema evolution.

3) How do you protect admin features?
- By JWT auth + role middleware (`requireAdmin`) on sensitive routes.

4) How do you handle wrong user input?
- Validation on both frontend and backend, with field-level messages for clear correction.

5) How do you make this production ready?
- Separate deploy for frontend/backend, env-based config, database migrations, health checks, and error handling.

## I) Short presentation script (you can speak this)

"This project is a full-stack e-commerce system built with Next.js on frontend and Express/Prisma on backend.  
I separated the architecture into two apps to keep UI and business logic clean and scalable.  
The backend provides secured APIs with JWT and role-based authorization, while PostgreSQL stores transactional data like users, products, and orders.  
The frontend consumes those APIs, supports multilingual UI, and provides both customer and admin dashboards.  
For deployment, I used Vercel for frontend and Render for backend, connected with environment variables and CORS.  
This structure makes the system maintainable, testable, and ready for real business workflows." 

## J) Defense Q&A: Checkout, Bot, Cart, Total

Use this section when teacher asks technical flow details.

### 1) "Checkout page បង្កើតធ្វើមិច?"

Short answer:
- Checkout page is built in frontend as a dedicated route.
- It reads user cart data, shipping address, shipping carrier, coupon, and payment method.
- Then it sends one order payload to backend for order creation.

Explain flow:
1. User opens checkout page.
2. Frontend loads cart items from API/state.
3. User selects shipping + payment and can input coupon.
4. Frontend calculates preview total.
5. On "Place order", frontend calls backend order API.
6. Backend validates stock, prices, coupon, shipping fee, and writes order in DB.
7. Backend returns order number/details for confirmation page.

### 2) "Add to cart ដំណើរការយ៉ាងម៉េច?"

Short answer:
- Add to cart starts from product page.
- Frontend sends `productId`, quantity, and selected options (like color/variant) to backend cart API.
- Backend stores cart item linked to current user.

Important points to say:
- If user clicks add same product/variant again, quantity is updated (not duplicated blindly).
- Cart is tied to account, so data remains after refresh/login.

### 3) "Total គណនាយ៉ាងម៉េច?"

Formula you can speak:

`Total = Subtotal - Discount + ShippingFee`

Where:
- `Subtotal` = sum of each item `(price * quantity)`
- `Discount` = coupon percent/fixed value (validated by backend)
- `ShippingFee` = based on selected carrier (e.g., VET/J&T setting)

Best-practice explanation:
- Frontend shows instant preview.
- Backend recalculates again before save (single source of truth) to prevent tampering.

### 4) "Coupon connect ធ្វើមិច?"

Short answer:
- User enters coupon code on checkout.
- Frontend sends code + cart context to backend coupon validation endpoint.
- Backend checks:
  - code exists
  - active date range
  - usage rules/minimum amount
- If valid: returns discount amount/percent.
- If invalid: returns clear error message.

### 5) "Payment option ដាក់ធ្វើមិច?"

Short answer:
- Payment methods are presented on checkout (example: Visa/Card, KHQR/Bakong).
- User chooses one method before confirming order.

Flow:
- Frontend includes selected payment type in order payload.
- Backend stores payment type and status.
- If KHQR is chosen, backend can provide QR/payment reference.
- After payment callback/success, backend updates payment status.

### 6) "Telegram bot connect ធ្វើមិច?"

Short answer:
- Bot integration is implemented on backend side.
- Important business events trigger message sending to Telegram chat.

Setup steps:
1. Create bot with BotFather.
2. Get bot token.
3. Get chat ID (group/user).
4. Put token/chat ID in backend env:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - and optional user-auth bot vars
5. Backend notifier utility sends HTTP request to Telegram Bot API.

When it sends alerts (examples):
- new order
- payment success
- user register/login
- order cancel/status change (based on implemented handlers)

### 7) "Order after checkout ត្រូវរក្សាទុកអ្វីខ្លះ?"

Typical fields to mention:
- order number
- user ID
- list of order items (product, qty, price snapshot)
- subtotal/discount/shipping/total
- payment type + payment status
- order status
- shipping address snapshot
- created time

Reason:
- Keeping snapshot data ensures invoice/history remains correct even if product data changes later.

### 8) "មានការពារកំហុស user input ទេ?"

Yes, both layers:
- Frontend: required fields + user-friendly field-level messages.
- Backend: strict validation and returns clear error messages.

Example you can say:
- Wrong phone/email/password on login now shows which field is incorrect.
- Invalid coupon returns explicit invalid message.

### 9) "ពេល internet ឬ API មានបញ្ហា គេដោះស្រាយម៉េច?"

- Frontend handles API errors with toast + inline messages.
- Backend has centralized error handler and proper HTTP status codes.
- Health endpoint is used to verify backend uptime.

### 10) 20-second answer (if teacher asks quickly)

"Checkout flow starts from cart, then user selects shipping/payment and optional coupon.  
Frontend previews total, but backend recalculates final amount for security before saving order.  
Cart and order data are stored in PostgreSQL via Prisma.  
Telegram bot is connected in backend using bot token and chat ID from environment variables, so key events like new order or payment success can alert admin automatically."
