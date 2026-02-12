# Implementation Notes

This document explains key implementation decisions and architecture choices.

## Technology Choices

### Why Node.js for the Collector?

**Chosen:** Node.js + TypeScript

**Rationale:**
1. **hafas-client** is a mature, well-maintained npm package specifically for HAFAS APIs
2. ÖBB support is built-in with the `oebb` profile
3. Native async/await for concurrent API calls
4. TypeScript provides type safety
5. Easy deployment with PM2 or systemd
6. JSON parsing is native and fast
7. Large ecosystem for HTTP requests, scheduling, etc.

**Alternative (Python):** Would require finding/building HAFAS client, but has better data science libraries. Not needed for this use case.

### Why PostgreSQL?

**Chosen:** PostgreSQL with optional TimescaleDB extension

**Rationale:**
1. Excellent time-series data support (even without TimescaleDB)
2. Powerful indexing and query optimization
3. JSONB for storing raw API responses
4. Materialized views for pre-aggregated stats
5. Free and open source
6. Wide hosting support (Neon, Supabase, Railway, etc.)
7. Battle-tested reliability

**Alternative (InfluxDB/TimescaleDB only):** Overkill for this scale, harder to deploy

### Why Next.js 15?

**Chosen:** Next.js 15 with App Router

**Rationale:**
1. Server Components reduce client-side JavaScript
2. Built-in API routes for backend queries
3. Excellent performance out of the box
4. Easy Vercel deployment
5. TypeScript support
6. Great developer experience
7. TailwindCSS integrates perfectly

**Alternative (SvelteKit/Astro):** Would work but Next.js has better ecosystem for dashboards

### Why Recharts?

**Chosen:** Recharts for data visualization

**Rationale:**
1. React-first charting library
2. Responsive by default
3. Clean API
4. Good TypeScript support
5. No D3 complexity for simple charts

**Alternative (Chart.js/D3.js):** Chart.js is canvas-based (harder to customize), D3 is too low-level

## Architecture Decisions

### Separation of Collector and Frontend

**Decision:** Run collector as separate service, not serverless

**Rationale:**
1. Cron-based collection needs persistent process
2. API rate limiting requires precise timing control
3. Long-running connections (database pooling)
4. Simpler error handling and recovery
5. Can scale independently from frontend

### Database Schema Design

**Key Decisions:**

1. **Separate tables for stops, lines, departures**
   - Normalization reduces data duplication
   - Easy to add new lines/stops without schema changes
   - Foreign keys ensure data integrity

2. **ENUM for transport_type**
   - Type safety at database level
   - Easy to query by type
   - Prevents invalid values

3. **delay_seconds as INTEGER**
   - Stored as seconds (not minutes) for precision
   - Positive = delayed, negative = early, NULL = no real-time data
   - Easy to aggregate and analyze

4. **Materialized view for stats**
   - Pre-aggregated hourly stats
   - Refreshed periodically (not on every query)
   - Dramatically speeds up dashboard queries
   - CONCURRENTLY allows updates without locking

5. **Indexes**
   - Timestamp DESC for recent data queries
   - Composite indexes for common query patterns
   - Partial index on delays > 0 for delay analysis
   - GIN index on JSONB raw_data if needed later

6. **Optional TimescaleDB**
   - Hypertable conversion is commented out
   - Easy to enable for better time-series performance
   - Not required for initial deployment

### API Integration Strategy

**Wiener Linien:**
- Requires API key (registration needed)
- Query by stopId parameter
- Returns full real-time data with planned vs. actual times
- Higher frequency (every 2-5 minutes)

**ÖBB HAFAS:**
- No API key required (but be respectful!)
- Uses hafas-client npm package
- Returns structured departure data
- Lower frequency (every 5 minutes with 5s delays between stops)
- Delay in minutes (converted to seconds for consistency)

### Error Handling

**Strategy:**
1. Try-catch around every API call
2. Log errors but don't crash
3. Track failures in `collector_runs` table
4. Skip failed stops and continue
5. Graceful shutdown on SIGTERM/SIGINT

### Data Collection Logic

**Approach:**
1. Fetch real-time departures for next 60 minutes
2. Calculate delay: `estimated_time - scheduled_time`
3. Store raw data in JSONB for debugging
4. Upsert stops/lines (handle API changes gracefully)
5. Insert departures in bulk transactions

**Why not store ALL departures?**
- We only store departures that happen (past or near-future)
- Reduces database size
- Focus on actual punctuality, not predictions

## Code Organization

### Collector Structure

```
collector/
├── src/
│   ├── config.ts          # Environment & configuration
│   ├── database.ts        # Database client & queries
│   ├── wiener-linien.ts   # Wiener Linien API client
│   ├── oebb.ts            # ÖBB HAFAS client
│   ├── index.ts           # Main scheduler & orchestration
│   └── migrate.ts         # Database migration runner
├── migrations/
│   └── 001_initial_schema.sql
└── deployment/
    └── oeffi-collector.service
```

**Design Patterns:**
- Each API has its own collector class
- Database client is singleton
- Configuration loaded from environment
- Dependency injection for testability (could be improved)

### Frontend Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx     # Root layout
│   │   ├── page.tsx       # Main dashboard
│   │   └── globals.css    # Global styles
│   ├── components/        # React components
│   │   ├── StatsOverview.tsx
│   │   ├── DelayByLineChart.tsx
│   │   ├── DelayByStopChart.tsx
│   │   ├── HourlyTrendChart.tsx
│   │   ├── WeekdayChart.tsx
│   │   └── TimeOfDayChart.tsx
│   └── lib/
│       └── db.ts          # Database queries for frontend
```

**Design Patterns:**
- Server Components fetch data
- Client Components for charts (use 'use client')
- Suspense boundaries for loading states
- Utility functions for formatting

## Performance Optimizations

1. **Materialized Views**
   - Pre-aggregate hourly stats
   - Refresh every hour (not on every query)

2. **Database Indexes**
   - Covering indexes for common queries
   - Partial indexes for specific filters

3. **Bulk Inserts**
   - Insert departures in transactions
   - Reduces database round-trips

4. **Client-Side Chart Optimization**
   - Sample data points for large datasets
   - Responsive charts with ResponsiveContainer

5. **Next.js Optimizations**
   - Server Components (less JS to client)
   - Route caching (revalidate: 60)
   - Static optimization where possible

## Known Limitations

1. **No Real-Time Updates**
   - Dashboard updates every 60 seconds (revalidate)
   - Could add WebSockets for true real-time

2. **Limited Historical Analysis**
   - Currently keeps 1 year of data
   - Could add data archival strategy

3. **No User Authentication**
   - Dashboard is public
   - Could add auth for admin features

4. **Single Collector Instance**
   - Not horizontally scalable
   - Could add distributed locking for multi-instance

5. **No Alert System**
   - Just displays data
   - Could add alerts for significant delays

## Future Enhancements

### Short-Term (1-2 weeks)

- [ ] Add data export (CSV/JSON)
- [ ] Filter by line or stop
- [ ] Mobile-responsive optimizations
- [ ] Error boundaries for graceful failures

### Medium-Term (1-2 months)

- [ ] Predictive analytics (ML for delay predictions)
- [ ] Historical trend comparison
- [ ] More detailed time-of-day analysis
- [ ] Email/SMS alerts for tracked lines
- [ ] Public API for third-party use

### Long-Term (3-6 months)

- [ ] Real-time dashboard updates (WebSockets)
- [ ] Mobile app (React Native)
- [ ] User accounts & personalization
- [ ] Compare against official punctuality reports
- [ ] Expand to other Austrian cities (Graz, Linz, Salzburg)

## Testing Strategy

Currently: No tests (MVP focus)

**Recommended:**

1. **Unit Tests**
   - Database query functions
   - Delay calculation logic
   - Data transformation utilities

2. **Integration Tests**
   - API clients with mocked responses
   - Database migrations
   - End-to-end data flow

3. **E2E Tests**
   - Frontend dashboard rendering
   - Chart data accuracy

## Monitoring Recommendations

1. **Application Monitoring**
   - PM2 dashboard
   - Error tracking (Sentry)
   - Performance monitoring (New Relic/DataDog)

2. **Database Monitoring**
   - Query performance
   - Table sizes
   - Index usage

3. **API Monitoring**
   - Response times
   - Error rates
   - Rate limit hits

4. **Business Metrics**
   - Data freshness
   - Collection success rate
   - Coverage (lines/stops tracked)

## Lessons Learned

1. **API Documentation Matters**
   - Wiener Linien docs are sparse, needed trial & error
   - hafas-client saved massive time vs. raw HAFAS

2. **Type Safety is Worth It**
   - TypeScript caught many bugs early
   - Database schema as types would be even better

3. **Start Simple**
   - MVP first, optimize later
   - Materialized views added after profiling

4. **Error Handling is Critical**
   - APIs fail, handle gracefully
   - Logging is essential for debugging

5. **Documentation Early**
   - Writing docs as you build helps clarify design
   - Future-you will thank present-you

## Contributing Guidelines

For future developers:

1. **Code Style**
   - Use TypeScript strict mode
   - Follow existing patterns
   - Add types for everything

2. **Commits**
   - Descriptive commit messages
   - One logical change per commit
   - Reference issues/tickets

3. **Testing**
   - Add tests for new features
   - Don't break existing tests

4. **Documentation**
   - Update README for user-facing changes
   - Update this file for architecture changes
   - Comment complex logic

## License

MIT License - See LICENSE file for details

## Contact

For questions or contributions, open an issue on GitHub!
