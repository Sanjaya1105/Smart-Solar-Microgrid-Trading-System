# Smart Solar Microgrid Trading System - Web API + MongoDB

This package contains the complete central **C# ASP.NET Core 8 Web API** and **MongoDB** layer for the SE4040 assignment. It follows the FAT Service pattern: business rules stay in the API, while the React web client calls REST endpoints only. The native Android client remains a separate, unfinished deliverable.

## Included

- JWT login and role-based access: `Backoffice`, `GridOperator`, `Prosumer`
- Prosumer registration with NIC as a unique business key and pending activation
- Backoffice staff creation, account filtering, activation/deactivation/reactivation
- Microgrid node CRUD-style management, GPS coordinates, kWh capacity and battery storage slots
- Node deactivation blocked while active future reservations exist
- Schedule/energy slot create, update, delete and availability control
- Reservation create/update/cancel with the 7-day and 12-hour rules enforced in the API
- Approval/rejection, signed QR creation, server-side QR verification and completion
- Current/pending/history/search endpoints and live operational dashboard counts
- Nearby active station endpoint for Android Google Maps markers
- Exactly the four required MongoDB collections: `Users`, `SolarStationInfo`, `EnergyBookingSlots`, `EnergyReservations`
- Unique/indexed fields, sample data, Swagger and a Postman collection
- Consistent JSON problem responses and password hashing (PBKDF2)

## Prerequisites

1. .NET 8 SDK
2. MongoDB 7 locally, in Docker, or MongoDB Atlas
3. Visual Studio 2022 / Rider / VS Code

## Quick start

Start MongoDB with Docker:

```bash
docker compose up -d
```

Restore and run the API:

```bash
dotnet restore SolarMicrogrid.Api/SolarMicrogrid.Api.csproj
dotnet run --project SolarMicrogrid.Api/SolarMicrogrid.Api.csproj
```

Open `https://localhost:7180/swagger` or use `SolarMicrogrid.Api/SolarMicrogrid.Api.http`.

## React web client

The creative React control room lives in `web/`. It connects to the API at `https://localhost:7180` through the Vite development proxy. API errors are displayed; there is no demo fallback.

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:5173/`. Keep the API running in a separate terminal for live station and reservation data. The web client includes role-aware navigation for Backoffice, Grid Operator and Prosumer workflows, plus staff/prosumer account management, station and slot management, filtered reservation views, staff-assisted booking, approval/cancellation, real QR tokens, token-based operator completion and account password changes.

The first development run creates indexes, all four collections through sample documents, and these accounts:

| Role | Login | Password |
| --- | --- | --- |
| Backoffice | `backoffice@solar.local` | `ChangeMe123!` |
| Grid Operator | `operator@solar.local` | `ChangeMe123!` |
| Prosumer | `prosumer@solar.local` | `ChangeMe123!` |

Change or disable seed credentials before deployment.

## Configuration

Development values are in `SolarMicrogrid.Api/appsettings.json`. For production, set environment variables rather than committing secrets:

```text
MongoDb__ConnectionString=mongodb://server:27017
MongoDb__DatabaseName=SolarMicrogridDb
Jwt__Key=<random-secret-at-least-32-characters>
Jwt__QrSigningKey=<different-random-secret-at-least-32-characters>
SeedData__Enabled=false
```

For MongoDB Atlas, use the Atlas connection string and allow the IIS server IP. Add the web application's real origin to `AllowedClientOrigins`.

## Authentication flow

1. Call `POST /api/auth/login`.
2. Copy the returned token.
3. Send `Authorization: Bearer <token>` on protected requests.
4. Web and Android clients route users using the returned `role`; authorization is still independently enforced by the API.

## Main endpoint groups

| Area | Endpoint examples | Roles |
| --- | --- | --- |
| Authentication | `POST /api/auth/register-prosumer`, `POST /api/auth/login` | Public |
| Account self-service | `GET/PUT /api/users/me`, `POST /api/users/me/request-deactivation` | Prosumer |
| User administration | `GET /api/users`, `POST /api/users/staff`, `PATCH /api/users/{id}/status` | Backoffice |
| Nodes/maps | `GET /api/stations`, `GET /api/stations/nearby` | Authenticated |
| Node administration | `POST/PUT /api/stations`, activate/deactivate | Backoffice; selected updates also Grid Operator |
| Booking slots | `GET/POST/PUT/DELETE /api/stations/slots...` | Authenticated read; staff write |
| Prosumer reservations | `POST/PUT /api/reservations`, cancel, `GET /mine`, `POST /{id}/qr` | Prosumer |
| Operations | `GET /operations`, decision, dashboard | Backoffice/Grid Operator |
| QR completion | `POST /api/reservations/complete-by-qr` | Grid Operator |

See [API_ENDPOINTS.md](docs/API_ENDPOINTS.md) for the full list and example workflow.

## Key business rules

- New bookings are accepted only for active station slots starting after now and no later than seven days from now.
- Booking updates and cancellations are rejected when less than twelve hours remain before the slot starts.
- Node deactivation is rejected when pending or approved future bookings exist.
- A prosumer registers as `Pending`; only Backoffice can change the account to `Active`.
- Deactivation is requested by a prosumer and resolved by Backoffice. Only Backoffice can reactivate an inactive account.
- Slot capacity is reserved/released centrally. An unavailable or full slot cannot be booked.
- QR payloads are signed, stored only as hashes, can be replaced, are validated against server state, and become unusable after completion.

## IIS deployment

1. Install the **.NET 8 Hosting Bundle** on Windows Server and restart IIS.
2. Publish: `dotnet publish SolarMicrogrid.Api/SolarMicrogrid.Api.csproj -c Release -o publish`.
3. In IIS, create an application pool with **No Managed Code** and a site pointing to the `publish` folder.
4. Grant the application pool identity read/execute permission on the folder.
5. Set production environment variables in IIS (MongoDB connection, JWT keys, seed disabled).
6. Bind HTTPS, start the site, and verify `https://your-host/api/health`.
7. Use that HTTPS base URL in both client apps. Never connect either client directly to MongoDB.

## Submission/viva reminders

- Replace demo secrets and credentials.
- Keep the comment header in every `.cs` file and method-level comments; the brief states missing comments are not marked.
- Add your IT-number zip name, Git repository link, contribution table, unique UI screenshots, report, diagrams, challenges, references and <=5-minute video link.
- Read and test every part before submission. This is an unofficial AI-support brief, so confirm wording against the official lecturer-issued document.

## AI/source disclosure

This starter backend was produced with AI development assistance and must be reviewed, tested, adapted and understood by the student team. Disclose material AI assistance in the report according to the assignment guidance. MongoDB and Microsoft API usage is based on their official product documentation.


## Current web implementation

- People: search by name/NIC/email; filter role/status; create staff/prosumers; edit profiles; activate, deactivate and reactivate.
- Stations: create, activate/deactivate; staff can edit GPS/capacity/hours and manage slots, capacity and availability.
- Reservations: prosumer and staff-assisted create/edit/cancel; all/current/history/status views; text and local scheduled-date filters; details; approval/rejection; signed QR display.
- Operator completion: submit an already scanned QR token for server verification. This is not a web camera scanner.
- Dashboard: staff counters come from the dashboard API; reservation dates come from their slots, not creation timestamps.
- Settings: read account name/email and change password using the current password.
- React styling uses Bootstrap 5 layout/spacing utilities together with the existing custom theme.

NIC is a unique, indexed business identifier. MongoDB ObjectId remains the technical primary key; existing data has not been migrated. Confirm this interpretation against the official brief.

## Verification

```powershell
npm.cmd run build --prefix web
npm.cmd run lint --prefix web
npm.cmd test --prefix web
dotnet build SolarMicrogrid.Api --no-restore -o ./artifacts/management-build
```

Optional isolated integration verification (Docker and .NET 8 required; Node 22.6+ for TypeScript tests):

```powershell
docker run --detach --rm --name solargrid-verification-mongo --publish 127.0.0.1:27028:27017 mongo:7
python tests/verify_api.py
# Add --browser to run Edge UI checks and capture screenshots:
python tests/verify_api.py --browser
docker stop solargrid-verification-mongo
```

The verification script creates a fresh database on port 27028, starts its own API on port 5198, generates temporary credentials and stops its API afterwards. It does not use the application database. Browser checks use Vite on port 5178 and installed Microsoft Edge. Screenshots are written under `artifacts/screenshots/` using actual isolated-test records.

## Publish web and API together

Run `scripts/publish.ps1` to build React and publish the API with its static files to `artifacts/iis-publish`. Point IIS at that folder using the hosting instructions above. This prepares files; it does not install/configure IIS or prove a live deployment.

For a separately hosted frontend, set `VITE_API_URL` at build time and add its origin to the API CORS configuration. The same-origin IIS package needs no frontend API URL override.

See `docs/PROJECT_REPORT.md` for architecture, use-case and data-flow diagrams, the implemented scope and the remaining submission evidence. Mobile, team attribution, the official brief interpretation and actual IIS deployment must still be completed/confirmed by the team.
