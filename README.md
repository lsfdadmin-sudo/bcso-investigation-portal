# BCSO Investigation Portal

Self-hosted case management workspace for the Blaine County Sheriff's Office. Deputies sign in with a badge number and a preset role password, work open and closed case files, and lay suspects, events, and evidence out on an investigation board.

The app is a Next.js server with a SQLite database and local photo storage. Nothing leaves the machine it runs on.

## Run it

Requires Node.js 22 or newer.

```bash
npm install
npm run build
npm start
```

The portal listens on port **4317** unless you set `PORT`. Open [http://localhost:4317](http://localhost:4317).

For local development with hot reload:

```bash
npm run dev
```

The database and uploaded photos are created in `data/` on first launch. That folder is gitignored. Delete `data/` to wipe the portal and seed it again.

## Sign in

Any badge number works (`412`, `D-08`, `SGT-01`). The password selects the role.

| Role | Factory password | Access |
| --- | --- | --- |
| General Patrol | `patrol412` | View open and closed cases, open cases, log events, add evidence and photos |
| Detective | `detective08` | Patrol access, plus narratives, responders, case details, suspects, related items, and links |
| Administration | `sheriff01` | Full access, close or reopen cases, delete cases and nodes, rotate role passwords |

Factory passwords are stored as hashes the first time the database is created. Changing the environment variables later does not rotate them. Use **Portal settings** in the header while signed in as Administration, or delete `data/` and start over.

Sessions last 12 hours and are kept in an HTTP-only cookie.

## Environment

Copy `.env.example` if you want the variables in a file. The process environment is enough.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4317` | HTTP port |
| `BCSO_PATROL_PASSWORD` | `patrol412` | Patrol password on first launch |
| `BCSO_DETECTIVE_PASSWORD` | `detective08` | Detective password on first launch |
| `BCSO_ADMIN_PASSWORD` | `sheriff01` | Admin password on first launch |
| `DATA_DIR` | `data` | SQLite file and `uploads/` directory |
| `BCSO_COOKIE_SECURE` | `false` | Set `true` when the portal is served over HTTPS |

## Docker

```bash
docker compose up --build
```

The compose file publishes port 4317 and stores the database in the `bcso-data` volume. `docker compose down -v` removes that volume and the seeded cases.

## What you can do

- **Case board.** Open and closed tabs with counts, search, and incident-type filter. New cases take an incident type, location, date and time, narrative, and the initial responding units.
- **Incident file.** Narrative with a save indicator, the initial-response roster, and a chronological event log.
- **Investigation board.** Three columns beside the case file: suspects, chronological events, and evidence. Click an event to reveal the suspects and evidence linked to it. The inspector still edits fields, photos, and suspect-to-evidence links, and can link an item to other events. Open cases refresh live over SSE.
- **Photos.** Drop or pick JPEG, PNG, WEBP, or GIF files on a node (up to 8 MB each, 12 per node). Open a thumbnail for the full image.
- **Roles.** Closed cases are locked until an administrator reopens them. Only administration can delete a case or a node, or change role passwords.

Four cases are seeded on first launch: Sandy Shores Armed Robbery, Paleto Bay Narcotics Interdiction, Grapeseed Hit and Run, and a closed Cassidy Creek homicide.
