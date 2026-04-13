# Quick Start Guide

## Development Setup (5 minutes)

### 1. Backend
```bash
cd backend
npm install
npm run seed:request-demo  # Create demo users & data
npm run dev                 # Start backend on localhost:5000
```

### 2. Frontend (in new terminal)
```bash
cd frontend
npm install
npm run dev  # Start frontend on localhost:5173
```

### 3. Login
Open http://localhost:5173 and use these credentials:
- **SuperAdmin**: `superadmin@inventory.local` / `Test1234!`
- **Admin**: `admin@inventory.local` / `Test1234!`
- **Staff**: `staff@inventory.local` / `Test1234!`

## Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full production setup.

### Quick Summary:
1. Set `VITE_API_BASE_URL` to your backend URL in `frontend/.env`
2. Configure database credentials in `backend/.env`
3. Set strong `JWT_SECRET` in `backend/.env`
4. Run `npm run build` in frontend
5. Deploy frontend dist/ to CDN or static host
6. Deploy backend with `npm run start`

## Common Commands

```bash
# Backend
npm run dev                    # Development with auto-reload
npm run start                  # Production
npm run seed:request-demo      # Load demo data
npm run hash-password          # Hash a password
npm run migrate:units          # Run units migration
npm run migrate:normalize-items # Run items normalization

# Frontend
npm run dev       # Development with hot-reload
npm run build     # Build for production (creates dist/)
npm run preview   # Preview production build locally
npm run lint      # Run ESLint
```

## URLs

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:5000
- **API Docs**: See [backend/API_REFERENCE.md](./backend/API_REFERENCE.md)

## Troubleshooting

**Cannot connect to database?**
- Install PostgreSQL and create `erp_system` database
- Update `backend/.env` with correct credentials
- Run `psql -U postgres -d erp_system -f database/schema.sql`

**API calls failing?**
- Ensure backend is running: `npm run dev` in `/backend`
- Check `VITE_API_BASE_URL` in `frontend/.env`
- Clear browser cache and reload

**Demo users not appearing?**
- Run `npm run seed:request-demo` in backend folder
- Restart backend and frontend

## Architecture

- **Frontend**: React 19 + Vite + TailwindCSS
- **Backend**: Node.js + Express + PostgreSQL
- **Auth**: JWT with role-based access control
- **Features**: Inventory, Stock Movements, Requests, Maintenance, Reports

See [backend/HANDOFF.md](./backend/HANDOFF.md) for detailed architecture.
