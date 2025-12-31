```md
# Milestone 3 Implementation Steps (Simple + Detailed)

Goal: Build a RESTful API that uses **raw SQL** (no ORM), supports **JWT auth + roles**, provides **CRUD**, exposes **complex queries via API**, and includes **Swagger** docs.  
All data modifications (insert/update/delete) must happen **through the API**, not manual SQL.

---

## 0) Prerequisites

### Tools
- Node.js (LTS)
- PostgreSQL
- Postman (optional, but recommended)

### Environment variables (create a `.env`)
```

PORT=3000
DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/yemeksepeti_clone
JWT_SECRET=change_this_secret
JWT_EXPIRES_IN=7d

```

---

## 1) Project Setup (Node + Express + Raw SQL)

### 1.1 Create project
```

mkdir yemeksepeti-clone-api && cd yemeksepeti-clone-api
npm init -y

```

### 1.2 Install dependencies
```

npm i express pg dotenv jsonwebtoken bcrypt cors
npm i -D nodemon

```

### 1.3 Add Swagger dependencies
```

npm i swagger-ui-express swagger-jsdoc

````

### 1.4 Add scripts to `package.json`
```json
{
  "scripts": {
    "dev": "nodemon src/app.js",
    "start": "node src/app.js"
  }
}
````

---

## 2) Folder Structure (Keep it simple)

Create this structure:

```
src/
  app.js
  db.js
  routes/
    auth.routes.js
    restaurants.routes.js
    menu.routes.js
    orders.routes.js
    courier.routes.js
    payments.routes.js
    ratings.routes.js
    analytics.routes.js
  middleware/
    auth.js
    role.js
  swagger/
    swagger.js
```

---

## 3) Database: Create Schema (DDL only)

### 3.1 Create DB

Create a PostgreSQL database named `yemeksepeti_clone`.

### 3.2 Create tables

* Create a `schema.sql` file and put your CREATE TABLE statements there.
* Run it once (DDL is allowed).

**Important rule:** After tables exist, do NOT manually insert business rows. Insert/update/delete must happen via API.

### 3.3 Minimal seed

You need roles (`ADMIN`, `RESTAURANT`, `COURIER`, `CUSTOMER`).
Simplest compliant approach:

* Create an admin-only endpoint `/admin/seed-roles` and call it once.

(Alternative: seed roles in SQL once, but if your grader is strict about “no manual manipulation”, do it via API.)

---

## 4) Connect to PostgreSQL (Raw SQL via `pg`)

### 4.1 `src/db.js`

* Create a Pool using `DATABASE_URL`.
* Export a helper `query(text, params)`.

**Rules**

* Always use parameterized queries: `... WHERE email = $1`
* Never string-concatenate user inputs.

---

## 5) Build the Server Skeleton

### 5.1 `src/app.js`

* Load `.env`
* Create express app
* Middlewares: `express.json()`, `cors()`
* Add `GET /health` returns `{ ok: true }`
* Mount routes:

  * `/auth`
  * `/restaurants`
  * `/menu`
  * `/orders`
  * `/courier`
  * `/payments`
  * `/ratings`
  * `/analytics`
  * `/docs` (Swagger)

Run:

```
npm run dev
```

Test:

* `GET http://localhost:3000/health`

---

## 6) Authentication (JWT) + Roles

This should be implemented before CRUD.

### 6.1 Tables used

* `users`
* `roles`
* `user_roles`

### 6.2 Endpoints

#### `POST /auth/register`

* Input: full_name, email, password, phone
* Steps:

  1. Validate fields
  2. Hash password (bcrypt)
  3. Insert into `users`
  4. Assign default role = `CUSTOMER` into `user_roles`
  5. Return success

#### `POST /auth/login`

* Input: email, password
* Steps:

  1. Fetch user by email
  2. Compare password with bcrypt
  3. Fetch roles (join `user_roles` + `roles`)
  4. Create JWT with user_id + roles
  5. Return token

### 6.3 Middleware

#### `src/middleware/auth.js`

* `requireAuth`:

  * Read `Authorization: Bearer <token>`
  * Verify JWT
  * Attach `req.user = { user_id, roles }`

#### `src/middleware/role.js`

* `requireRole('ADMIN')` etc:

  * Check `req.user.roles` contains needed role

---

## 7) CRUD Endpoints (Implement in this order)

Implement minimal, demo-ready CRUD. Keep endpoints RESTful.

### 7.1 Restaurants

Routes: `src/routes/restaurants.routes.js`

* `POST /restaurants` (RESTAURANT or ADMIN)

  * Create restaurant owned by current user
* `GET /restaurants` (public)
* `GET /restaurants/:id` (public)
* `PUT /restaurants/:id` (owner or ADMIN)
* `DELETE /restaurants/:id` (owner or ADMIN)

  * Soft-delete recommended (or delete if you prefer)

Also: Restaurant Address

* `POST /restaurants/:id/address` (owner/admin)

  * Create restaurant address (1 restaurant = 1 address)
* `GET /restaurants/:id/address`

### 7.2 Menu Items + Categories

Routes: `src/routes/menu.routes.js`

* `POST /categories` (ADMIN)

* `GET /categories` (public)

* `POST /restaurants/:id/menu-items` (owner/admin)

* `GET /restaurants/:id/menu-items` (public)

* `PUT /menu-items/:id` (owner/admin)

* `DELETE /menu-items/:id` (owner/admin)

Many-to-many mapping:

* `POST /menu-items/:id/categories` (owner/admin) body: `{ category_id }`
* `DELETE /menu-items/:id/categories/:categoryId`

### 7.3 Orders + Order Items (transaction!)

Routes: `src/routes/orders.routes.js`

* `POST /orders` (CUSTOMER)

  * Body: restaurant_id, address_id, items:[{menu_item_id, quantity}]
  * Steps:

    1. Begin transaction
    2. Insert into `orders` (status=CREATED)
    3. Insert order_items (with unit_price from menu_items)
    4. Compute total_amount and update orders.total_amount
    5. Commit
* `GET /orders/me` (CUSTOMER)
* `GET /restaurants/:id/orders` (owner/admin)
* `PUT /orders/:id/status` (owner/admin)

### 7.4 Courier Assignment

Routes: `src/routes/courier.routes.js`

* `POST /orders/:id/assign-courier` (RESTAURANT owner or ADMIN)

  * Body: courier_user_id
  * Insert into `courier_assignments` (unique order_id)
* `GET /courier/assignments` (COURIER)
* `PUT /courier/assignments/:id/status` (COURIER)

  * Update status + timestamps (picked_at, delivered_at)

### 7.5 Payments

Routes: `src/routes/payments.routes.js`

* `POST /orders/:id/payments` (CUSTOMER)

  * Body: method
  * Insert payment with amount = orders.total_amount
  * Update payment status (simulate paid/failed if needed)
* `GET /orders/:id/payments` (customer/owner/admin)

### 7.6 Ratings

Routes: `src/routes/ratings.routes.js`

* `POST /orders/:id/rating` (CUSTOMER)

  * Only if order status = DELIVERED
  * Insert rating (score 1–5, comment)
* `GET /restaurants/:id/ratings` (public)

---

## 8) Complex Queries (Add 3 endpoints)

Routes: `src/routes/analytics.routes.js`

Implement at least 3:

### 8.1 Top restaurants by average rating (with min count)

`GET /analytics/top-restaurants?minRatings=3&limit=10`

### 8.2 Customer order history with totals and item counts

`GET /analytics/me/order-history`

### 8.3 Most popular menu items for a restaurant

`GET /analytics/restaurants/:id/popular-items?limit=5`

**Guideline note:** At least one should be a nested query (subquery).

---

## 9) Swagger Documentation

### 9.1 Setup

* `src/swagger/swagger.js` creates swagger spec (OpenAPI 3)
* Mount: `GET /docs`

### 9.2 Minimum docs

Document:

* `/auth/register`, `/auth/login`
* One entity CRUD set (restaurants)
* `/orders` create
* At least one analytics endpoint
  Include:
* JWT bearer security scheme
* Example request/response bodies

---

## 10) Testing Checklist (What to demo)

Use Postman or curl.

1. Register a customer -> Login -> get JWT
2. Create restaurant (restaurant role) -> add address
3. Add categories (admin) -> add menu items -> link categories
4. Customer creates order (transaction inserts order + items)
5. Assign courier -> courier updates delivered
6. Customer pays -> customer rates
7. Run analytics endpoints (complex queries)
8. Open Swagger `/docs` and show endpoints

---

## 11) Implementation Order (Do not skip)

1. DB schema + connection
2. Auth (register/login) + middleware
3. Restaurants
4. Menu + categories
5. Orders (transaction)
6. Courier assignments
7. Payments
8. Ratings
9. Analytics (complex queries)
10. Swagger

---

## Notes (Rules to respect)

* Raw SQL only, no ORM.
* Parameterized queries only.
* No manual INSERT/UPDATE/DELETE after schema creation—use API routes.
* Protect routes with JWT; enforce roles where needed.

