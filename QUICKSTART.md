# Quick Start Guide

Get the Wien Öffi Tracker running in 10 minutes!

## Prerequisites

- [ ] Node.js 20+
- [ ] PostgreSQL database
- [ ] Wiener Linien API key ([get one here](https://www.data.gv.at/))

## 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/wien-oeffi-tracker.git
cd wien-oeffi-tracker
```

## 2. Database Setup

### Option A: Cloud Database (Easiest)

**Neon (Recommended):**
1. Go to https://neon.tech
2. Sign up for free
3. Create a new project
4. Copy the connection string

**Supabase:**
1. Go to https://supabase.com
2. Create new project
3. Get connection string from Settings → Database

### Option B: Local PostgreSQL

```bash
# macOS
brew install postgresql
brew services start postgresql

# Ubuntu/Debian
sudo apt install postgresql
sudo systemctl start postgresql

# Create database
createdb wien_oeffi_tracker
```

## 3. Collector Setup

```bash
cd collector
npm install

# Configure
cp .env.example .env
nano .env  # Add your DATABASE_URL and WIENER_LINIEN_API_KEY

# Run migrations
npm run migrate

# Test
npm run dev
```

**You should see:**
```
✓ Database connected
✓ Wiener Linien collector scheduled
✓ ÖBB collector scheduled
Running initial collection...
[WL] Collecting from 7 stops...
[ÖBB] Collecting from 6 stops...
```

## 4. Frontend Setup

```bash
cd ../frontend
npm install

# Configure
cp .env.example .env.local
nano .env.local  # Add your DATABASE_URL

# Run dev server
npm run dev
```

Open http://localhost:3000 - you should see the dashboard!

## 5. Deploy Collector (Production)

### Option A: PM2

```bash
cd collector
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions
```

### Option B: Systemd

```bash
cd collector
npm run build
sudo cp deployment/oeffi-collector.service /etc/systemd/system/
sudo nano /etc/systemd/system/oeffi-collector.service  # Edit paths
sudo systemctl enable oeffi-collector
sudo systemctl start oeffi-collector
```

## 6. Deploy Frontend (Vercel)

```bash
cd frontend
npm install -g vercel
vercel

# Or use GitHub integration:
# 1. Push to GitHub
# 2. Import in Vercel
# 3. Set DATABASE_URL environment variable
```

## 🎉 Done!

Your tracker is now running!

- **Local Frontend:** http://localhost:3000
- **Production Frontend:** https://your-app.vercel.app

## Troubleshooting

### "Database connection failed"
```bash
# Test your connection string
psql $DATABASE_URL -c "SELECT NOW();"
```

### "API Error 321: Missing parameters"
- Check if `WIENER_LINIEN_API_KEY` is set correctly in `.env`

### "No data in dashboard"
- Wait 3-5 minutes for first collection to complete
- Check collector logs: `pm2 logs wien-oeffi-collector`

### "Module not found"
```bash
cd collector && npm install
cd ../frontend && npm install
```

## What's Being Collected?

The collector runs every 3-5 minutes and tracks:
- Wiener Linien: U-Bahn, Tram, Bus (from 7 major stops)
- ÖBB: S-Bahn (from 6 major stations)

To track more stops, edit `WIENER_LINIEN_STOPS` and `OEBB_STOPS` in `.env`.

## Next Steps

- Read `README.md` for detailed documentation
- Check `DEPLOYMENT.md` for production setup
- See `API_DOCUMENTATION.md` to understand the data sources

## Support

Having issues? Check:
1. Collector logs: `pm2 logs` or `journalctl -u oeffi-collector -f`
2. Database: `psql $DATABASE_URL -c "SELECT COUNT(*) FROM departures;"`
3. API key validity: https://www.data.gv.at/

---

Happy tracking! 🚊
