
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
# Showtime Ticketing Platform

Showtime is a full-stack movie ticketing platform. Customers browse published showtimes, select live seats, hold them for ten minutes, pay through Razorpay, and receive QR-ready tickets. Organizers and admins create showtimes, manage VIP inventory, configure dynamic pricing, control seats, review sales, and validate tickets at entry.

## Platform scope

Showtime is designed as an online ticketing platform for event executors and audiences across multiple event categories:

- Concerts, theaters, sporting events, movies, conferences, comedy, and other live events.
- Event executors can create events, define venues and ticket types, publish inventory, manage blocked seats, and configure pricing policies.
- Audience members can register, authenticate from different terminals and physical machines, browse events, reserve seats, pay securely, and access their tickets from any signed-in device.
- The interface is designed for fast scanning and clear decisions: responsive layouts, visual seat maps, status legends, pricing summaries, admin analytics, and QR-ready ticket presentation.

The current implementation has a movie-first experience, while the database event model already supports broader event types and the platform boundaries are intended to support that expansion.

## Architecture goals

The platform follows a microservice-friendly, event-driven architecture while keeping the current deployment simple as a Next.js application:

| Concern | Current boundary | Expansion path |
| --- | --- | --- |
| Identity and access | Authentication Route Handlers and signed HTTP-only sessions | Dedicated identity service or external identity provider |
| Event catalog | Movie and event Route Handlers backed by PostgreSQL | Event catalog service with search and discovery indexes |
| Inventory and reservations | Transactional seat inventory and ten-minute holds | Inventory service with partitioning by event or venue |
| Pricing | Server-side dynamic pricing engine and policy tables | Independent pricing service or rules engine |
| Payments | Razorpay order and confirmation handlers | Payment service with provider adapters and webhook processing |
| Notifications and integrations | `OutboxEvent` records published through RabbitMQ | Independent notification, analytics, and integration consumers |
| Analytics | Dashboard aggregates from orders, inventory, and price history | Read-optimized analytics store and streaming consumers |

The database remains the source of truth for reservations, payments, inventory, and ticket issuance. Domain events are written to the transactional outbox in the same database transaction as the business change. The outbox worker then publishes events to RabbitMQ, allowing downstream services to consume them without coupling the booking request to email, analytics, notifications, or external integrations.

### Multi-terminal authentication

Users may sign in from browsers on different terminals and physical machines. Each login creates a signed, HTTP-only session cookie for that browser. Protected requests re-read the user from PostgreSQL, so account blocking and role changes take effect on subsequent requests. Production deployments should use HTTPS, a strong `AUTH_SECRET`, secure cookie settings, and a shared PostgreSQL database so all application instances observe the same account and ticket state.

### Dynamic pricing

Pricing is calculated on the server from ticket-type base prices, inventory levels, demand, event timing, weekends, early-bird conditions, and last-minute conditions. Policies support minimum and maximum bounds, priorities, percentage adjustments, fixed amounts, multipliers, and optional ticket-type targeting. Price changes are stored in price history for auditability and analytics.

### Fault handling and resilience

The design separates user-facing transactions from asynchronous work:

- Serializable database transactions prevent two customers from claiming the same seat.
- Reservation expiration releases held inventory.
- Payment confirmation is idempotency-aware and records provider attempts.
- The transactional outbox prevents a successful booking from losing its integration event.
- The RabbitMQ worker retries unpublished events and records `retryCount` and `lastError`.
- Durable PostgreSQL and RabbitMQ storage preserve state across process restarts.
- Docker Compose restart policies keep local services and the worker running after crashes.
- Health checks, structured logs, metrics, dead-letter queues, and alerting should be added when operating the platform in production at scale.

### Analytics

The admin workspace currently exposes showtime counts, tickets sold, gross sales, occupancy, order history, current inventory, and price history. RabbitMQ events provide the foundation for additional analytics consumers such as:

- Sales and revenue trends by event, venue, ticket type, and channel.
- Occupancy and sell-through rates over time.
- VIP versus standard ticket demand.
- Price-rule effectiveness and conversion impact.
- Reservation abandonment, payment failures, and ticket validation throughput.

### Software interface design

The user interface is organized around clear workflows rather than internal services. Customer screens emphasize discovery, seat selection, reservation time remaining, checkout, and ticket retrieval. Admin screens emphasize event control, pricing rules, seat-state visualization, sales history, and ticket validation. The API uses resource-oriented Route Handlers with JSON responses, role-based authorization, consistent error statuses, and server-side validation at every write boundary.

## Stack

- Next.js 16 App Router and React 19
- PostgreSQL 16
- Prisma 7 with `@prisma/adapter-pg`
- RabbitMQ 3.13 for event delivery
- Tailwind CSS, Base UI/shadcn components, and Lucide icons
- Razorpay payment integration
- Node.js 20+

## Features

### Customer experience

- Browse published future movie events.
- View venue, showtime, ticket types, prices, and live seat status.
- Select up to six available seats.
- Create a ten-minute reservation.
- Complete payment and receive ticket codes and QR tickets.
- View confirmed tickets and booking history.

### Admin and organizer experience

- Create movie showtimes with Classic, Prime, and VIP/Recliner seating.
- Publish, cancel, and edit showtimes.
- View occupancy, revenue, orders, and price history.
- Configure dynamic pricing rules and minimum/maximum bounds.
- Edit VIP and other ticket-type base prices.
- View the customer-style seat map with Available, Held, Sold, and Blocked states.
- Block or reopen available seats without booking them.
- Validate ticket codes at the cinema entrance.

`ORGANIZER` accounts manage their own events. `ADMIN` accounts can manage all events. Public registration only creates `USER` or `ORGANIZER` accounts; promote an existing user directly in the database when an admin account is required.

## Architecture

The browser uses Next.js pages and client components. Next.js Route Handlers perform authentication, pricing, reservations, payments, and admin operations. PostgreSQL is the source of truth for inventory and transactions.

```mermaid
flowchart LR
	Browser[Customer or admin browser] --> Next[Next.js app]
	Next --> API[Route Handlers]
	API --> DB[(PostgreSQL)]
	API --> Pricing[Dynamic pricing engine]
	API --> Outbox[OutboxEvent table]
	Worker[Outbox worker] --> Outbox
	Worker --> Rabbit[RabbitMQ]
```

### Booking lifecycle

1. A customer requests available inventory IDs.
2. The reservation transaction changes those seats from `AVAILABLE` to `HELD`.
3. The customer pays against the reservation.
4. Payment confirmation changes the order to `CONFIRMED`, the reservation to `COMPLETED`, seats to `SOLD`, and creates tickets.
5. The same transaction writes a `booking.confirmed` row to `OutboxEvent`.
6. The outbox worker publishes that event to RabbitMQ and records success or retry information.

The database transaction remains authoritative. RabbitMQ delivery is asynchronous and retryable.

## Repository layout

```text
src/app/                         Pages and API Route Handlers
src/app/admin/                   Admin dashboard route
src/app/api/admin/               Admin event, pricing, seat, and ticket APIs
src/app/api/reservations/        Seat reservation APIs
src/app/api/payments/            Razorpay order and confirmation APIs
src/components/admin/            Admin dashboard and event manager
src/components/movie-booking/    Seat map and booking UI
src/components/checkout/         Checkout and payment UI
src/components/tickets/          QR ticket list
src/lib/auth.ts                  Password hashing and signed sessions
src/lib/current-user.ts          Database-backed authorization helpers
src/lib/pricing.ts               Dynamic price calculation
src/lib/rabbitmq.ts              RabbitMQ exchange and publisher
src/lib/prisma.ts                Prisma client singleton
scripts/outbox-worker.ts         Outbox polling and RabbitMQ publisher
prisma/schema.prisma             Database schema
prisma/migrations/               Migration history
prisma/seed-movies.sql           Development movie seed
docs/ARCHITECTURE.md             Extended architecture notes
```

## Environment variables

Create a root `.env` for local development. Never commit it.

```env
DATABASE_URL="postgresql://ticketing:ticketing_password@localhost:6000/ticketing_db?schema=public"
AUTH_SECRET="use-a-long-random-secret"
RABBITMQ_URL="amqp://ticketing:ticketing_password@localhost:5672"
RAZORPAY_KEY_ID="your-razorpay-key"
RAZORPAY_KEY_SECRET="your-razorpay-secret"
```

Production must use a strong unique `AUTH_SECRET`, managed PostgreSQL credentials, managed RabbitMQ credentials, and Razorpay production keys. Do not use the development credentials from `docker-compose.yml` in a public deployment.

## Local development

Prerequisites: Node.js 20+, npm, and Docker Desktop with Docker Compose.

Install dependencies:

```bash
npm install
```

Start PostgreSQL and RabbitMQ:

```bash
docker compose up -d postgres rabbitmq
docker compose ps
```

Generate Prisma Client and apply migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

Start Next.js:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). RabbitMQ management is available at [http://localhost:15672](http://localhost:15672) with the local Compose credentials.

Run the outbox worker in a second terminal:

```bash
npm run worker:outbox
```

## Seed development data

Register an account at `http://localhost:3000` first. The seed uses the first user as the event organizer.

```bash
docker compose exec -T postgres psql \
	-U ticketing \
	-d ticketing_db < prisma/seed-movies.sql
```

The seed creates **The Midnight Archive**, its venue, seats, inventory, and pricing policy.

Promote an existing account to admin when needed:

```sql
UPDATE "User"
SET role = 'ADMIN'
WHERE email = 'admin@example.com';
```

Sign out and sign in again after changing a role.

## Commands

```bash
npm run dev              # Development server
npm run build            # Production Next.js build
npm run start            # Serve the production build
npm run lint             # ESLint
npm run worker:outbox    # Publish unpublished outbox events
npx tsc --noEmit         # Type-check
npx prisma generate      # Generate Prisma Client
npx prisma migrate deploy # Apply committed migrations
npx prisma studio       # Open Prisma Studio
```

## Docker deployment

The Compose stack contains PostgreSQL, RabbitMQ, the Next.js app, and the outbox worker. The app and worker reuse one production image.

1. Set production values in the deployment environment, especially `AUTH_SECRET`, database credentials, RabbitMQ URL, and Razorpay keys.
2. Build and start the stack:

```bash
docker compose build app
docker compose up -d postgres rabbitmq app outbox-worker
```

3. Apply migrations from the deployment host. With the included local Compose PostgreSQL port:

```bash
DATABASE_URL="postgresql://ticketing:ticketing_password@localhost:6000/ticketing_db?schema=public" npx prisma migrate deploy
```

4. Verify services:

```bash
docker compose ps
docker compose logs -f app
docker compose logs -f outbox-worker
```

The web app is exposed on port `3000`. RabbitMQ uses port `5672`; its management UI uses port `15672`. For a public deployment, place the app behind HTTPS and do not expose PostgreSQL or RabbitMQ management publicly.

Stop services without deleting data:

```bash
docker compose down
```

`docker compose down -v` also deletes local database and RabbitMQ volumes and should only be used when intentionally removing development data.

## API overview

| Area | Routes | Purpose |
| --- | --- | --- |
| Authentication | `/api/auth/register`, `/api/auth/login`, `/api/auth/session` | Account and session management |
| Movies | `/api/movies`, `/api/movies/[eventId]` | Published showtimes and live inventory |
| Reservations | `/api/reservations`, `/api/reservations/[reservationId]` | Hold and inspect seats |
| Payments | `/api/payments/create-order`, `/api/payments/confirm` | Razorpay order and confirmation |
| Customer tickets | `/api/orders/me` | Confirmed orders for the signed-in customer |
| Admin events | `/api/admin/events` and nested routes | Create and manage showtimes |
| Admin dashboard | `/api/admin/dashboard` | Events, sales, inventory, and pricing summary |
| Admin validation | `/api/admin/tickets/validate` | Check in a ticket |

## Troubleshooting

- **Missing `DATABASE_URL`:** ensure `.env` is in the repository root when running commands outside Docker.
- **PostgreSQL unavailable:** run `docker compose up -d postgres` and check `docker compose ps`.
- **RabbitMQ unavailable:** run `docker compose up -d rabbitmq`; check `docker compose logs rabbitmq`.
- **Events remain unpublished:** run `npm run worker:outbox` and inspect `OutboxEvent.lastError`.
- **Admin redirects home:** verify the account role is `ORGANIZER` or `ADMIN`, then sign out and sign in again.
- **Port 3000 is busy:** run `npm run dev -- --port 3001`.
- **Seed cannot find an organizer:** register an account before running `prisma/seed-movies.sql`.

## Further documentation

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the detailed data model, authentication flow, booking lifecycle, pricing design, and API architecture.
