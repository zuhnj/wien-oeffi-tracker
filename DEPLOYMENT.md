# Deployment Guide

Complete guide for deploying the Wien Öffi Tracker.

## Prerequisites

- PostgreSQL 14+ database (cloud or local)
- Wiener Linien API key
- Vercel account (for frontend)
- Server for collector (Linux recommended)

## Step 1: Database Setup

### Cloud Database (Recommended)

Use a managed PostgreSQL service:
- **Neon** (https://neon.tech) - Free tier available
- **Supabase** (https://supabase.com) - Free tier available
- **Railway** (https://railway.app) - Free trial

### Local Database

```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Create database
sudo -u postgres createdb wien_oeffi_tracker

# Create user
sudo -u postgres psql
CREATE USER oeffi WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE wien_oeffi_tracker TO oeffi;
```

### Run Migrations

```bash
cd collector
npm install
npm run migrate
```

## Step 2: Deploy Collector Service

### Option A: PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Build collector
cd collector
npm install
npm run build

# Configure environment
cp .env.example .env
nano .env  # Edit with your credentials

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup  # Follow instructions to enable auto-start

# Monitor
pm2 logs wien-oeffi-collector
pm2 status
```

### Option B: Systemd Service

```bash
# Build collector
cd collector
npm install
npm run build

# Configure environment
cp .env.example .env
nano .env

# Copy systemd service
sudo cp deployment/oeffi-collector.service /etc/systemd/system/

# Edit service file with correct paths
sudo nano /etc/systemd/system/oeffi-collector.service

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable oeffi-collector
sudo systemctl start oeffi-collector

# Check status
sudo systemctl status oeffi-collector
sudo journalctl -u oeffi-collector -f
```

### Option C: Docker (Advanced)

Create `collector/Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .
RUN npm run build

CMD ["node", "dist/index.js"]
```

```bash
docker build -t wien-oeffi-collector ./collector
docker run -d --name collector --env-file .env wien-oeffi-collector
```

## Step 3: Deploy Frontend to Vercel

### Via CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend
vercel

# Follow prompts:
# - Select/create project
# - Set environment variables
```

### Via GitHub Integration (Recommended)

1. Push code to GitHub
2. Visit https://vercel.com
3. Import repository
4. Configure:
   - Framework: Next.js
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Environment Variables:
     - `DATABASE_URL`: Your PostgreSQL connection string

5. Deploy!

### Environment Variables in Vercel

```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

⚠️ **Security Note:** Use a read-only database user for the frontend!

```sql
-- Create read-only user for frontend
CREATE USER oeffi_readonly WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE wien_oeffi_tracker TO oeffi_readonly;
GRANT USAGE ON SCHEMA public TO oeffi_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO oeffi_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO oeffi_readonly;
```

## Step 4: Configure Monitoring

### Collector Health Checks

Add a simple HTTP health endpoint (optional enhancement):

```typescript
// collector/src/health.ts
import express from 'express';
const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(3001);
```

### Database Monitoring

```sql
-- Check recent collection activity
SELECT 
  provider, 
  COUNT(*) as runs,
  AVG(departures_recorded) as avg_departures,
  COUNT(*) FILTER (WHERE success = false) as failures
FROM collector_runs
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY provider;

-- Check data freshness
SELECT 
  provider,
  MAX(timestamp) as last_collection,
  NOW() - MAX(timestamp) as age
FROM departures d
JOIN stops s ON d.stop_id = s.id
GROUP BY provider;
```

## Step 5: Maintenance Tasks

### Daily

```bash
# Check logs
pm2 logs wien-oeffi-collector --lines 100

# Check database size
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size('wien_oeffi_tracker'));"
```

### Weekly

```bash
# Refresh materialized view (done automatically by collector)
# But can be run manually:
psql $DATABASE_URL -c "SELECT refresh_delay_stats();"

# Vacuum database
psql $DATABASE_URL -c "VACUUM ANALYZE;"
```

### Monthly

```bash
# Clean old data (optional - currently keeps 1 year)
psql $DATABASE_URL -c "SELECT cleanup_old_departures();"

# Backup database
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

## Troubleshooting

### Collector Not Starting

```bash
# Check logs
pm2 logs wien-oeffi-collector

# Common issues:
# 1. Missing API key
# 2. Database connection failed
# 3. Port already in use
```

### Database Connection Issues

```bash
# Test connection
psql $DATABASE_URL -c "SELECT NOW();"

# Check if database exists
psql -l

# Check user permissions
psql $DATABASE_URL -c "SELECT current_user, current_database();"
```

### Frontend Not Loading Data

1. Check database connection in Vercel logs
2. Verify `DATABASE_URL` environment variable
3. Check database user has SELECT permissions
4. Look at Vercel function logs

### API Rate Limiting

If you hit rate limits:

1. **Wiener Linien:** Increase collection interval in `.env`
2. **ÖBB:** Already has 5-second delays, but can be increased
3. Monitor `collector_runs` table for errors

## Scaling

### High Traffic

If the frontend gets heavy traffic:

1. Add Redis caching layer
2. Use Vercel Edge Functions
3. Pre-aggregate more data in materialized views

### More Data Collection

If tracking more stops/lines:

1. Add more collector instances (one per region)
2. Use TimescaleDB compression
3. Partition departures table by month

## Cost Estimates

**Free Tier (Proof of Concept):**
- Database: Neon free tier (0.5GB)
- Frontend: Vercel Hobby (free)
- Collector: Self-hosted ($0)
- Total: **$0/month**

**Production (Recommended):**
- Database: Neon Pro ($20/month)
- Frontend: Vercel Pro ($20/month)
- Collector: VPS ($5-10/month)
- Total: **$45-50/month**

## Backup Strategy

### Automated Backups

```bash
# Add to crontab
0 3 * * * pg_dump $DATABASE_URL | gzip > /backups/wien-oeffi-$(date +\%Y\%m\%d).sql.gz

# Rotate old backups (keep 30 days)
find /backups -name "wien-oeffi-*.sql.gz" -mtime +30 -delete
```

### Manual Backup

```bash
pg_dump $DATABASE_URL > backup.sql
```

### Restore

```bash
psql $DATABASE_URL < backup.sql
```

## Security Checklist

- [ ] API keys in `.env`, not in code
- [ ] Frontend uses read-only database user
- [ ] Database not publicly accessible
- [ ] HTTPS enabled (Vercel does this automatically)
- [ ] Environment variables secured in Vercel
- [ ] Logs don't contain sensitive data
- [ ] Regular security updates (`npm audit`)

## Support

For issues:
1. Check collector logs
2. Check database for recent data
3. Verify API keys are valid
4. Test API endpoints manually

Happy tracking! 🚊
