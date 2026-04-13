# Deployment & Environment Setup Guide

## Local Development

### Backend Setup
```bash
cd backend
cp .env.example .env
# Edit .env with your local PostgreSQL credentials
npm install
npm run dev
```

### Frontend Setup
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`
The backend will be available at `http://localhost:5000`

## Production Deployment

### Environment Variables

**Backend (.env)**
- `PORT`: Server port (default: 5000)
- `DB_HOST`: PostgreSQL host
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_USER`: PostgreSQL username
- `DB_PASSWORD`: PostgreSQL password (**NEVER commit this**)
- `DB_NAME`: PostgreSQL database name
- `JWT_SECRET`: Secret for JWT token signing (**NEVER commit this**)

**Frontend (.env)**
- `VITE_API_BASE_URL`: Backend API URL (e.g., `https://api.example.com`)

### Deployment Steps

1. **Clone repository to server**
   ```bash
   git clone <repository-url>
   cd erp_system
   ```

2. **Set up backend**
   ```bash
   cd backend
   npm install --production
   
   # Create .env file with production values
   echo "PORT=5000" > .env
   echo "DB_HOST=<prod-db-host>" >> .env
   echo "DB_PORT=5432" >> .env
   echo "DB_USER=<prod-db-user>" >> .env
   echo "DB_PASSWORD=<prod-db-password>" >> .env
   echo "DB_NAME=erp_system" >> .env
   echo "JWT_SECRET=<generate-random-secret>" >> .env
   
   npm run start
   ```

3. **Set up frontend**
   ```bash
   cd frontend
   npm install --production
   
   # Create .env file with production API URL
   echo "VITE_API_BASE_URL=https://api.yourdomain.com" > .env
   
   npm run build
   # Deploy dist/ folder to your static host
   ```

### Database Setup

1. Create PostgreSQL database:
   ```sql
   CREATE DATABASE erp_system;
   ```

2. Apply schema:
   ```bash
   psql -U postgres -d erp_system -f database/schema.sql
   ```

3. Run migrations (if needed):
   ```bash
   psql -U postgres -d erp_system -f database/migrate_enterprise.sql
   ```

### Security Checklist

- [ ] `backend/.env` is in `.gitignore`
- [ ] `frontend/.env` is in `.gitignore`
- [ ] JWT_SECRET is a strong, random string (use `openssl rand -hex 32`)
- [ ] Database password is strong and unique
- [ ] HTTPS is enabled on the frontend
- [ ] CORS is configured properly on the backend
- [ ] No credentials are logged or exposed in error messages
- [ ] Environment variables are set via hosting platform (not hardcoded)

### Demo Data

To seed demo users and inventory for testing:

**Backend only (development/testing):**
```bash
cd backend
npm run seed:request-demo
```

This creates:
- SuperAdmin: `superadmin@inventory.local` / `Test1234!`
- Main Store Admin: `admin@inventory.local` / `Test1234!`
- Main Store Staff: `staff@inventory.local` / `Test1234!`
- Annex Store Staff: `annex.staff@inventory.local` / `Test1234!`

**Do NOT run seed script in production.**

## Troubleshooting

### "Cannot connect to database"
- Verify DB_HOST, DB_PORT, DB_USER, DB_PASSWORD in backend/.env
- Ensure PostgreSQL is running and accessible
- Check firewall rules

### "API URL is blank"
- Ensure frontend/.env has `VITE_API_BASE_URL` set
- Rebuild frontend after changing .env: `npm run build`

### "CORS error"
- Check that CORS is enabled on backend
- Verify frontend URL is allowed in backend CORS configuration

## Support

See [backend/HANDOFF.md](./backend/HANDOFF.md) for architecture details.
See [backend/API_REFERENCE.md](./backend/API_REFERENCE.md) for API endpoints.
