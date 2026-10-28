# TH Portfolio

Independent personal home, CV and portfolio for https://th.io.vn. Repository: https://github.com/TuanPham0411/TH-Portfolio. Split from Thien-Ha at `66aa6e527d496679e3941eae02587e17660940ff`; no MES frontend or API is required.

## Included

Public/owner content views, complete content editor, proportional winding timeline with draggable/resizable cinematic callouts, twelve inset connector anchors and adjustable connector lengths, skill editing, activities/family/interests media rails, rich photo/video/GIF descriptions, introduction video, optional soundtrack, HEIC uploads, visitor history, personal styling, mobile diagram mode, avatar preload, Google/email login, contact inquiries and private publication controls. All current source features are preserved. Production content/files are not embedded.

## Local build

Use Node.js 22.12+ and PostgreSQL 17. Run `npm ci`, `npm test`, `npm run build`. Development frontend: `npm run dev`; production web/API: `npm start` after configuring `DATABASE_URL`, `PORTFOLIO_ORIGIN` and `FILES_ROOT`. The runtime database role is `th_api`; run `npm run migrate` with an operator connection first. `TEST_DATABASE_URL` must point to a disposable database ending in `_test`; then `npm run test:integration` verifies migration, login, content publication, timeline layout and host isolation.

## Docker

Copy `.env.example` to a private `.env`, set two distinct random hexadecimal passwords, your owner email and any required OAuth/SMTP credentials. Run `docker compose up -d --build` only when the replacement server is ready. Alternatively use published `ghcr.io/tuanpham0411/th-portfolio-app:latest` or an immutable commit tag. Frontend/API is available on loopback **8080**; database and files use separate named volumes. Both AMD64 and ARM64 images are built by GitHub Actions.

Google callback: `https://th.io.vn/api/oauth/callback`. The configured verified `OWNER_EMAIL` becomes the owner via Google; existing accounts/content can be restored from the prior server. SMTP is required for email registration, verification and reset. No credentials are bundled and no default password is installed.

## Release and later deployment

Every main push runs tests/build, creates a checksummed source archive and a Linux ARM64 release containing Node.js 22, and publishes a multi-architecture Docker image. Download the release artifact from the successful **Build, test and package** Actions run. Artifact retention is 30 days; image commit tags identify durable build revisions. No job runs on a self-hosted production runner or deploys automatically.

See [replacement-server and data restore guide](docs/REINSTALL.md) and [release usage](RELEASE-README.md). Source archives, images and build bundles contain no live database/media, secret configuration or runner tokens.

## Existing RPI update (authorized separately)

The current Portfolio frontend is synchronized with Thien-Ha `feat/mes-quick-access` at commit `66aa6e527d496679e3941eae02587e17660940ff`. Legacy `main` is older. `/build-info.json` identifies the compiled repository/revision and frontend hash. Admin edits are database/media content, not source files.

For the existing RPI only, `deploy/install.sh` installs a dedicated `th-portfolio` service at loopback 3001 using the existing private `/etc/th-app/runtime.env`, database and media broker. It backs up the Portfolio schema, does not run migrations or replace content, removes only the legacy Portfolio Nginx block, preserves the MES block, and restores prior routing/service on failure. Fresh-server migration remains a separate operation. A one-off bridge workflow in Thien-Ha uses its existing registered runner; no registration token or secret is copied to this project. The default project workflow still packages without automatic production rollout.
