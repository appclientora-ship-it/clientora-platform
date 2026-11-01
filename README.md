# Clientora — منصة إدارة الحجوزات

Clientora is a standalone booking and salon-management application built with React, Express, tRPC, Drizzle ORM, and MySQL.

## Commands

- `pnpm dev`: development server (default port 3000).
- `pnpm build` / `pnpm start`: build and serve the production application.
- `pnpm db:migrate`: apply checked-in database migrations.
- `pnpm check`: run TypeScript checks.
- `pnpm test`: run automated tests.

## Runtime configuration

Required:
- `DATABASE_URL`: MySQL connection URL.
- `AUTH_SESSION_SECRET`: unique random secret of at least 32 characters.

For image and file uploads:
- `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`.
- `S3_REGION` (defaults to `auto`).
- `S3_ENDPOINT` for S3-compatible providers; leave empty for AWS S3.
- `S3_FORCE_PATH_STYLE=true` only when required by the storage provider.

Optional:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`: outgoing email for password recovery.
- `APP_URL`: public application URL used in password-recovery links.

Authentication, sessions, and password recovery are implemented by Clientora. Object storage uses the S3 API directly. No Manus account, project ID, OAuth service, or Manus API key is required.
