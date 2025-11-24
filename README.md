Owner Backend

Setup

1. Copy `.env.example` to `.env` and fill values (MONGO_URI, JWT_SECRET, Cloudinary keys).

2. Install dependencies:

```bash
cd owner-backend
npm install
```

3. Run dev server:

```bash
npm run dev
```

4. Run owner flow test script (makes signups, updates statuses via DB, tests login and upload):

```bash
npm run test-owner-flow
```

Notes
- The `Owner` model is configured to use the `admins` collection (to be compatible with your Admin backend). This allows sharing that collection if desired.
- The test script writes a small `dummy.jpg` file to `scripts/` and uploads it to Cloudinary; make sure Cloudinary credentials are set.
