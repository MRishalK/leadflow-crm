# LeadFlow CRM

A loan sales and call-centre CRM demo with Admin and Staff portals.

## Run locally

Requires Node.js 22.5 or later.

```bash
npm run dev
```

Open `http://127.0.0.1:5173/`. The command starts the Vite frontend and local API. The mobile-style Admin layout is available at `http://127.0.0.1:5173/mobile`.

To run a production build locally:

```bash
npm run build
npm start
```

## Demo credentials

- Admin: `admin@leadflow.com` / `password`
- Staff: `priya@leadflow.com` / `password`

## Working in this demo

- Login with server-validated demo credentials and Admin/Staff access boundaries.
- SQLite persistence for leads, employees, calls, and follow-ups. The database is created at `server/data/leadflow.sqlite`.
- Lead creation, search, loan/status filtering, status updates, and assignment of unassigned new leads.
- CSV lead import (required columns: `name`, `phone`, `loan`, `amount`; optional: `source`, `notes`; up to 500 records).
- A seeded team of 20 employees, with the ability for Admins to create staff accounts.
- Follow-up scheduling and call logging; call activity updates the assigned employee's call count.
- Customer document uploads (PDF/JPG/PNG up to 4 MB), downloads, and Admin verification.
- Loan application creation and status tracking, including lead status updates on approval.
- Bank and loan-scheme management for Admins.
- Live dashboard and team reports, including CSV performance export.
- Responsive layouts and Staff views that are limited to that employee's assigned leads.
- On the first Admin login, existing browser-stored leads are imported into SQLite; seeded leads are deduplicated by phone.
