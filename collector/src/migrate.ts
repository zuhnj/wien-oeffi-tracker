import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrate() {
  console.log('🔧 Running database migrations...\n');

  const pool = new Pool({
    connectionString: config.database.url,
  });

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✓ Database connected\n');

    // Read migration file
    const migrationPath = join(__dirname, '..', 'migrations', '001_initial_schema.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('Running migration: 001_initial_schema.sql');

    // Execute migration
    await pool.query(sql);

    console.log('✓ Migration completed successfully\n');
    console.log('Database schema created:');
    console.log('  - stops: Public transport stops and stations');
    console.log('  - lines: Transit lines (U-Bahn, Tram, Bus, S-Bahn, etc.)');
    console.log('  - departures: Time-series departure data with delays');
    console.log('  - delay_stats_hourly: Pre-aggregated hourly statistics');
    console.log('  - collector_runs: Audit log of collection runs\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
