import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export interface Stop {
  id: number;
  external_id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  municipality?: string;
  provider: 'wiener_linien' | 'oebb';
}

export interface Line {
  id: number;
  line_name: string;
  transport_type: 'u_bahn' | 'tram' | 'bus' | 's_bahn' | 'night_bus' | 'regional';
  provider: string;
  direction?: string;
}

export interface Departure {
  stop_id: number;
  line_id: number;
  timestamp: Date;
  scheduled_departure: Date;
  estimated_departure?: Date;
  actual_departure?: Date;
  delay_seconds?: number;
  platform?: string;
  towards?: string;
  is_cancelled: boolean;
  is_realtime: boolean;
  raw_data?: any;
}

export class Database {
  private pool: pg.Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.database.url,
    });
  }

  async connect() {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT NOW()');
      console.log('✓ Database connected');
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }

  // Stop management
  async upsertStop(stop: Omit<Stop, 'id'>): Promise<number> {
    const result = await this.pool.query(
      `INSERT INTO stops (external_id, name, latitude, longitude, municipality, provider)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (external_id) 
       DO UPDATE SET 
         name = EXCLUDED.name,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         municipality = EXCLUDED.municipality
       RETURNING id`,
      [stop.external_id, stop.name, stop.latitude, stop.longitude, stop.municipality, stop.provider]
    );
    return result.rows[0].id;
  }

  async getStopByExternalId(externalId: string): Promise<Stop | null> {
    const result = await this.pool.query(
      'SELECT * FROM stops WHERE external_id = $1',
      [externalId]
    );
    return result.rows[0] || null;
  }

  // Line management
  async upsertLine(line: Omit<Line, 'id'>): Promise<number> {
    const result = await this.pool.query(
      `INSERT INTO lines (line_name, transport_type, provider, direction)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (line_name, provider, direction)
       DO UPDATE SET transport_type = EXCLUDED.transport_type
       RETURNING id`,
      [line.line_name, line.transport_type, line.provider, line.direction]
    );
    return result.rows[0].id;
  }

  // Departure recording
  async insertDeparture(departure: Departure): Promise<void> {
    await this.pool.query(
      `INSERT INTO departures (
        stop_id, line_id, timestamp, scheduled_departure, estimated_departure,
        actual_departure, delay_seconds, platform, towards, is_cancelled, is_realtime, raw_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        departure.stop_id,
        departure.line_id,
        departure.timestamp,
        departure.scheduled_departure,
        departure.estimated_departure,
        departure.actual_departure,
        departure.delay_seconds,
        departure.platform,
        departure.towards,
        departure.is_cancelled,
        departure.is_realtime,
        departure.raw_data ? JSON.stringify(departure.raw_data) : null,
      ]
    );
  }

  async insertDepartures(departures: Departure[]): Promise<number> {
    if (departures.length === 0) return 0;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const departure of departures) {
        await client.query(
          `INSERT INTO departures (
            stop_id, line_id, timestamp, scheduled_departure, estimated_departure,
            actual_departure, delay_seconds, platform, towards, is_cancelled, is_realtime, raw_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            departure.stop_id,
            departure.line_id,
            departure.timestamp,
            departure.scheduled_departure,
            departure.estimated_departure,
            departure.actual_departure,
            departure.delay_seconds,
            departure.platform,
            departure.towards,
            departure.is_cancelled,
            departure.is_realtime,
            departure.raw_data ? JSON.stringify(departure.raw_data) : null,
          ]
        );
      }
      
      await client.query('COMMIT');
      return departures.length;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Collector run tracking
  async startCollectorRun(provider: string): Promise<number> {
    const result = await this.pool.query(
      'INSERT INTO collector_runs (provider, started_at) VALUES ($1, NOW()) RETURNING id',
      [provider]
    );
    return result.rows[0].id;
  }

  async endCollectorRun(
    runId: number,
    stats: {
      stopsFetched: number;
      departuresRecorded: number;
      errorsCount: number;
      errorMessage?: string;
      success: boolean;
    }
  ): Promise<void> {
    await this.pool.query(
      `UPDATE collector_runs 
       SET completed_at = NOW(),
           stops_fetched = $2,
           departures_recorded = $3,
           errors_count = $4,
           error_message = $5,
           success = $6
       WHERE id = $1`,
      [runId, stats.stopsFetched, stats.departuresRecorded, stats.errorsCount, stats.errorMessage, stats.success]
    );
  }

  // Utility: Refresh materialized view
  async refreshDelayStats(): Promise<void> {
    await this.pool.query('SELECT refresh_delay_stats()');
  }
}

export const db = new Database();
