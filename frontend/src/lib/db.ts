import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export interface Line {
  id: number;
  line_name: string;
  transport_type: string;
  provider: string;
}

export interface Stop {
  id: number;
  name: string;
  external_id: string;
}

export interface DelayStats {
  line_name: string;
  transport_type: string;
  avg_delay_seconds: number;
  median_delay_seconds: number;
  p95_delay_seconds: number;
  total_departures: number;
  delays_over_1min: number;
  delays_over_5min: number;
  cancellations: number;
}

export interface HourlyTrend {
  hour: Date;
  avg_delay: number;
  departure_count: number;
}

export async function getOverallStats(days: number = 7) {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total_departures,
      COUNT(*) FILTER (WHERE delay_seconds IS NOT NULL) as tracked_departures,
      AVG(delay_seconds) FILTER (WHERE delay_seconds IS NOT NULL) as avg_delay,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY delay_seconds) FILTER (WHERE delay_seconds IS NOT NULL) as median_delay,
      COUNT(*) FILTER (WHERE delay_seconds > 60) as delays_over_1min,
      COUNT(*) FILTER (WHERE delay_seconds > 300) as delays_over_5min,
      COUNT(*) FILTER (WHERE is_cancelled) as cancellations,
      COUNT(DISTINCT line_id) as unique_lines,
      COUNT(DISTINCT stop_id) as unique_stops
    FROM departures
    WHERE timestamp > NOW() - INTERVAL '${days} days'
  `);
  
  return result.rows[0];
}

export async function getDelayStatsByLine(days: number = 7): Promise<DelayStats[]> {
  const result = await pool.query(`
    SELECT 
      l.line_name,
      l.transport_type,
      AVG(d.delay_seconds) FILTER (WHERE d.delay_seconds IS NOT NULL) as avg_delay_seconds,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY d.delay_seconds) FILTER (WHERE d.delay_seconds IS NOT NULL) as median_delay_seconds,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY d.delay_seconds) FILTER (WHERE d.delay_seconds IS NOT NULL) as p95_delay_seconds,
      COUNT(*) as total_departures,
      COUNT(*) FILTER (WHERE d.delay_seconds > 60) as delays_over_1min,
      COUNT(*) FILTER (WHERE d.delay_seconds > 300) as delays_over_5min,
      COUNT(*) FILTER (WHERE d.is_cancelled) as cancellations
    FROM departures d
    JOIN lines l ON d.line_id = l.id
    WHERE d.timestamp > NOW() - INTERVAL '${days} days'
      AND d.delay_seconds IS NOT NULL
    GROUP BY l.line_name, l.transport_type
    ORDER BY avg_delay_seconds DESC
    LIMIT 50
  `);
  
  return result.rows;
}

export async function getDelayStatsByStop(days: number = 7): Promise<any[]> {
  const result = await pool.query(`
    SELECT 
      s.name as stop_name,
      s.external_id,
      AVG(d.delay_seconds) FILTER (WHERE d.delay_seconds IS NOT NULL) as avg_delay_seconds,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY d.delay_seconds) FILTER (WHERE d.delay_seconds IS NOT NULL) as median_delay_seconds,
      COUNT(*) as total_departures,
      COUNT(*) FILTER (WHERE d.delay_seconds > 60) as delays_over_1min,
      COUNT(*) FILTER (WHERE d.delay_seconds > 300) as delays_over_5min
    FROM departures d
    JOIN stops s ON d.stop_id = s.id
    WHERE d.timestamp > NOW() - INTERVAL '${days} days'
      AND d.delay_seconds IS NOT NULL
    GROUP BY s.name, s.external_id
    HAVING COUNT(*) > 100
    ORDER BY avg_delay_seconds DESC
    LIMIT 30
  `);
  
  return result.rows;
}

export async function getHourlyTrends(days: number = 7): Promise<HourlyTrend[]> {
  const result = await pool.query(`
    SELECT 
      DATE_TRUNC('hour', timestamp) as hour,
      AVG(delay_seconds) FILTER (WHERE delay_seconds IS NOT NULL) as avg_delay,
      COUNT(*) as departure_count
    FROM departures
    WHERE timestamp > NOW() - INTERVAL '${days} days'
      AND delay_seconds IS NOT NULL
    GROUP BY DATE_TRUNC('hour', timestamp)
    ORDER BY hour ASC
  `);
  
  return result.rows;
}

export async function getWeekdayStats(days: number = 30): Promise<any[]> {
  const result = await pool.query(`
    SELECT 
      EXTRACT(DOW FROM timestamp) as day_of_week,
      TO_CHAR(timestamp, 'Day') as day_name,
      AVG(delay_seconds) FILTER (WHERE delay_seconds IS NOT NULL) as avg_delay,
      COUNT(*) as departure_count
    FROM departures
    WHERE timestamp > NOW() - INTERVAL '${days} days'
      AND delay_seconds IS NOT NULL
    GROUP BY EXTRACT(DOW FROM timestamp), TO_CHAR(timestamp, 'Day')
    ORDER BY day_of_week
  `);
  
  return result.rows;
}

export async function getTimeOfDayStats(days: number = 7): Promise<any[]> {
  const result = await pool.query(`
    SELECT 
      EXTRACT(HOUR FROM scheduled_departure) as hour,
      AVG(delay_seconds) FILTER (WHERE delay_seconds IS NOT NULL) as avg_delay,
      COUNT(*) as departure_count
    FROM departures
    WHERE timestamp > NOW() - INTERVAL '${days} days'
      AND delay_seconds IS NOT NULL
    GROUP BY EXTRACT(HOUR FROM scheduled_departure)
    ORDER BY hour
  `);
  
  return result.rows;
}

export async function getRecentDepartures(limit: number = 100) {
  const result = await pool.query(`
    SELECT 
      d.*,
      l.line_name,
      l.transport_type,
      s.name as stop_name
    FROM departures d
    JOIN lines l ON d.line_id = l.id
    JOIN stops s ON d.stop_id = s.id
    WHERE d.timestamp > NOW() - INTERVAL '2 hours'
    ORDER BY d.timestamp DESC
    LIMIT $1
  `, [limit]);
  
  return result.rows;
}

export default pool;
