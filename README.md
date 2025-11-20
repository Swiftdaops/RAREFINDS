# Ebook Backend

Express + MongoDB backend with Cloudinary image uploads, JWT auth via httpOnly cookies, and security best practices.

## Stack
- Express, Mongoose, JWT, Cookie-Parser
- Multer + multer-storage-cloudinary
- Helmet, CORS, express-rate-limit
- Joi validation

## Setup
1. Copy `.env.example` to `.env` and fill values.
2. Install dependencies.

```bash
npm install
```

## Run
Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

Server runs on `PORT` (default 5000).

## Roles
### APPADMIN
Seeded via `ADMIN_USERNAME`/`ADMIN_PASSWORD`. Full access.

### OWNER (Bookstore Owner / Author)
Registers publicly, starts `status=pending`, must be approved before login & ebook management.

## API Endpoints (Summary)

### Admin (APPADMIN only)
- `POST /api/admin/login` { username, password }
- `POST /api/admin/logout`
- `GET /api/admin/me`
- `GET /api/admin/owners?status=pending|approved|rejected`
- `PATCH /api/admin/owners/:id/approve`
- `PATCH /api/admin/owners/:id/reject`
- `GET /api/ebooks?ownerId=`
- `POST /api/ebooks` (multipart cover image optional)
- `PUT /api/ebooks/:id`
- `DELETE /api/ebooks/:id`

### Owner (Approved only – needs `owner_jwt` cookie)
- `POST /api/owners/signup`
- `POST /api/owners/login`
- `GET /api/owners/me`
- `GET /api/owner/ebooks`
- `POST /api/owner/ebooks`
- `PUT /api/owner/ebooks/:id`
- `DELETE /api/owner/ebooks/:id`

### Public
- `GET /api/public/ebooks?search=&ownerId=`

## Models
### Ebook
Adds `ownerId` (nullable ref) and `isPublished` (default true).

### Owner
```
name, storeName, email, whatsappNumber, phone?, bio?, website?,
status ('pending'|'approved'|'rejected'), isActive, passwordHash,
approvedAt?, approvedBy?
```

## Auth & Cookies
- Admin cookie: `jwt` with `{ userId }`.
- Owner cookie: `owner_jwt` with `{ ownerId, role:'owner', storeName }`.
- Both httpOnly, `sameSite` adjusted by environment.

## Public Purchase Link
Frontend builds `https://wa.me/<whatsappNumber>?text=Hi%20I%20want%20to%20order%20this%20book...`.

## Workflow
1. Owner signup (pending).
2. Admin lists pending owners.
3. Admin approves.
4. Owner logs in.
5. Owner creates ebooks.
6. Public lists approved owner ebooks.

## Security Notes
- Bcrypt password hashing.
- Owner routes blocked unless approved.
- Owner CRUD scoped by `ownerId` server-side.
- Admin routes require seeded admin auth.

## CORS
Configure `CLIENT_ORIGIN` or `CORS_ALLOWED_ORIGINS` (comma-separated). `credentials: true` enabled.

## MongoDB
Use `MONGO_URI` (SRV) and optional `MONGO_DB_NAME`; connection appends DB name if missing.

## Next Steps / Ideas
- Pagination & search improvements.
- Unpublish / soft delete ebooks.
- Email notification on approval.

## Notes
- Admin user is auto-seeded using `ADMIN_USERNAME`/`ADMIN_PASSWORD` on startup.
- JWT is set in an httpOnly cookie named `jwt`.
- For uploads, send `multipart/form-data` with `coverImage` file field.
