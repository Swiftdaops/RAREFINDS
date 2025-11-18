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

Server runs on `PORT` (default 5000) and exposes:
- `POST /api/admin/login` { username, password }
- `POST /api/admin/logout`
- `GET /api/admin/me` (auth)
- `GET /api/ebooks`
- `POST /api/ebooks` (auth + form-data with `coverImage`)
- `PUT /api/ebooks/:id` (auth + optional new `coverImage`)
- `DELETE /api/ebooks/:id` (auth)

## Notes
- Admin user is auto-seeded using `ADMIN_USERNAME`/`ADMIN_PASSWORD` on startup.
- JWT is set in an httpOnly cookie named `jwt`.
- For uploads, send `multipart/form-data` with `coverImage` file field.
