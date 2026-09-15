
# Showtime Ticketing Platform

Showtime is a full-stack movie-ticketing application built with Next.js, React, PostgreSQL, and Prisma. Moviegoers can browse showtimes, hold seats, complete a demo payment, and receive QR tickets. Organizers can publish events, manage inventory, configure pricing, and validate tickets.

## Technology

- Next.js 16 App Router and React 19
- PostgreSQL 16
- Prisma 7 with the PostgreSQL adapter
- Tailwind CSS, shadcn/Base UI, and Lucide icons
- Node.js 20.9 or newer

## Prerequisites

The commands below target Ubuntu or Debian. Docker is the recommended way to run PostgreSQL locally.

```bash
sudo apt update
sudo apt install -y ca-certificates curl git build-essential openssl libssl-dev postgresql-client docker.io docker-compose-v2
sudo usermod -aG docker "$USER"
```

Log out and back in after adding your user to the `docker` group. Verify the tools:

```bash
node --version       # v20.9 or newer
npm --version
docker --version
docker compose version
psql --version
```

If Node.js is not installed or is too old, install a current LTS release with `nvm`:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source "$HOME/.nvm/nvm.sh"
nvm install --lts
nvm use --lts
```

## Local Setup

Run all commands from the repository root.

### 1. Install dependencies

```bash
npm i
```

Use `npm install` instead when intentionally updating the lockfile.

### 2. Configure the environment

Create `.env` in the repository root:

```bash
cat > .env <<'EOF'
DATABASE_URL="postgresql://ticketing:ticketing_password@localhost:6000/ticketing_db?schema=public"
AUTH_SECRET="replace-this-with-a-long-random-development-secret"
EOF
```

`DATABASE_URL` is required by Prisma and authentication. `AUTH_SECRET` is required in production and is strongly recommended during development. Do not commit `.env` or production secrets.

### 3. Start PostgreSQL

```bash
docker compose up -d postgres
docker compose ps
```

The compose service creates:

| Setting | Value |
| --- | --- |
| Host | `localhost` |
| Port | `6000` |
| Database | `ticketing_db` |
| User | `ticketing` |
| Password | `ticketing_password` |

### 4. Apply the database schema

The repository contains the migration history in `prisma/migrations`:

```bash
npx prisma generate
npx prisma migrate deploy
```

For local schema development, use `npx prisma migrate dev --name describe-your-change` instead of manually editing the database.

### 5. Create an account and seed movie data

Start the application and register at least one account first. The seed script uses the first user as the movie organizer.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), register an account, then stop the dev server with `Ctrl+C` and run:

```bash
docker compose exec -T postgres psql \
	-U ticketing \
	-d ticketing_db \
	< prisma/seed-movies.sql
```

The seed creates the development movie **The Midnight Archive**, its venue, seats, ticket inventory, and pricing rules. It is safe to run more than once. Start the app again when the seed finishes:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to browse the seeded showtime.

## Available Commands

```bash
npm run dev       # Start the development server
npm run build     # Create a production build
npm run start     # Serve the production build
npm run lint      # Run ESLint
npx prisma studio # Open the Prisma database browser
```

## Production

Set a real, high-entropy `AUTH_SECRET` and a production PostgreSQL `DATABASE_URL`. Then install, generate the Prisma client, apply migrations, build, and start:

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
```bash
docker compose down -v
```

To inspect the database directly:

```bash
docker compose exec postgres psql -U ticketing -d ticketing_db
```

## Troubleshooting

- **Cannot connect to PostgreSQL:** Confirm `docker compose ps` shows `ticketing-postgres` running and that `.env` uses port `6000`.
- **Docker permission denied:** Log out and back in after running `sudo usermod -aG docker "$USER"`, or run Docker with the appropriate local permissions.
- **Prisma reports a missing `DATABASE_URL`:** Ensure `.env` is in the repository root and contains the `DATABASE_URL` shown above.
- **The seeded movie is missing:** Register an account before running `prisma/seed-movies.sql`, then rerun the seed command.
- **Port `3000` is busy:** Start Next.js on another port with `npm run dev -- --port 3001`.

## Project Documentation

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data model, authentication flow, booking lifecycle, API structure, and dynamic-pricing design.

## Docker

Build and run the application and PostgreSQL together:

```bash
docker compose up --build
```

The application is available at [http://localhost:3000](http://localhost:3000). Inside Compose, the app connects to PostgreSQL using the service name `postgres` and port `5432`; the host-side PostgreSQL port remains `6000`.

Before using the seeded movie with the containerized app, apply migrations and register an account through the app:

```bash
docker compose exec app npx prisma migrate deploy
```

Then register at [http://localhost:3000](http://localhost:3000) and seed the movie data:

```bash
docker compose exec -T postgres psql \
	-U ticketing \
	-d ticketing_db \
	< prisma/seed-movies.sql
```

Set a production secret before starting Compose:

```bash
AUTH_SECRET="replace-with-a-long-random-secret" docker compose up --build -d
```

Stop the containers without deleting database data with `docker compose down`. Add `-v` only when you also want to delete the local PostgreSQL volume.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
