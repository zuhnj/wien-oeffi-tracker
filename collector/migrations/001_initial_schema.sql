-- Wien Öffi Tracker - Initial Database Schema
-- Optimized for time-series data analysis

-- Enable TimescaleDB if available (optional)
-- CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Transit line types
CREATE TYPE transport_type AS ENUM (
  'u_bahn',      -- U-Bahn (subway)
  'tram',        -- Straßenbahn (tram)
  'bus',         -- Bus
  's_bahn',      -- S-Bahn (suburban railway)
  'night_bus',   -- Nightline bus
  'regional'     -- Regional trains
);

-- Stops/stations table
CREATE TABLE stops (
  id SERIAL PRIMARY KEY,
  external_id VARCHAR(50) UNIQUE NOT NULL, -- API-specific ID
  name VARCHAR(255) NOT NULL,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  municipality VARCHAR(100),
  provider VARCHAR(50) NOT NULL, -- 'wiener_linien' or 'oebb'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_stops_provider ON stops(provider);
CREATE INDEX idx_stops_location ON stops(latitude, longitude) WHERE latitude IS NOT NULL;

-- Transit lines table
CREATE TABLE lines (
  id SERIAL PRIMARY KEY,
  line_name VARCHAR(50) NOT NULL, -- 'U1', 'U2', 'S7', '13A', etc.
  transport_type transport_type NOT NULL,
  provider VARCHAR(50) NOT NULL,
  direction VARCHAR(255), -- End station name
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(line_name, provider, direction)
);

CREATE INDEX idx_lines_type ON lines(transport_type);
CREATE INDEX idx_lines_provider ON lines(provider);

-- Main departures table (time-series data)
CREATE TABLE departures (
  id BIGSERIAL PRIMARY KEY,
  stop_id INTEGER NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  line_id INTEGER NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
  
  -- Time information
  timestamp TIMESTAMP NOT NULL, -- When data was collected
  scheduled_departure TIMESTAMP NOT NULL, -- Planned departure time
  estimated_departure TIMESTAMP, -- Real-time estimated departure
  actual_departure TIMESTAMP, -- Actual departure (if available)
  
  -- Delay calculation (in seconds)
  delay_seconds INTEGER, -- positive = delayed, negative = early, NULL = no real-time data
  
  -- Platform/track info
  platform VARCHAR(10),
  
  -- Direction/destination
  towards VARCHAR(255),
  
  -- Status flags
  is_cancelled BOOLEAN DEFAULT FALSE,
  is_realtime BOOLEAN DEFAULT FALSE, -- true if real-time data available
  
  -- Raw data snapshot (for debugging)
  raw_data JSONB,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_departures_timestamp ON departures(timestamp DESC);
CREATE INDEX idx_departures_stop ON departures(stop_id, timestamp DESC);
CREATE INDEX idx_departures_line ON departures(line_id, timestamp DESC);
CREATE INDEX idx_departures_scheduled ON departures(scheduled_departure);
CREATE INDEX idx_departures_delay ON departures(delay_seconds) WHERE delay_seconds IS NOT NULL;

-- Composite index for common query patterns
CREATE INDEX idx_departures_analysis ON departures(line_id, stop_id, timestamp DESC);

-- Partial index for delays only (optimization)
CREATE INDEX idx_departures_delayed ON departures(line_id, stop_id, delay_seconds, timestamp DESC) 
  WHERE delay_seconds > 0;

-- Optional: Convert to TimescaleDB hypertable
-- SELECT create_hypertable('departures', 'timestamp', chunk_time_interval => INTERVAL '1 day');

-- Materialized view for aggregated statistics (updated periodically)
CREATE MATERIALIZED VIEW delay_stats_hourly AS
SELECT 
  DATE_TRUNC('hour', timestamp) as hour,
  line_id,
  stop_id,
  COUNT(*) as total_departures,
  COUNT(*) FILTER (WHERE delay_seconds IS NOT NULL) as tracked_departures,
  AVG(delay_seconds) FILTER (WHERE delay_seconds IS NOT NULL) as avg_delay_seconds,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY delay_seconds) FILTER (WHERE delay_seconds IS NOT NULL) as median_delay_seconds,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY delay_seconds) FILTER (WHERE delay_seconds IS NOT NULL) as p95_delay_seconds,
  COUNT(*) FILTER (WHERE delay_seconds > 60) as delays_over_1min,
  COUNT(*) FILTER (WHERE delay_seconds > 300) as delays_over_5min,
  COUNT(*) FILTER (WHERE is_cancelled) as cancellations
FROM departures
WHERE timestamp > NOW() - INTERVAL '90 days' -- Keep last 90 days
GROUP BY DATE_TRUNC('hour', timestamp), line_id, stop_id;

CREATE UNIQUE INDEX idx_delay_stats_hourly ON delay_stats_hourly(hour, line_id, stop_id);
CREATE INDEX idx_delay_stats_hourly_line ON delay_stats_hourly(line_id, hour DESC);

-- Function to refresh materialized view (call periodically)
CREATE OR REPLACE FUNCTION refresh_delay_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY delay_stats_hourly;
END;
$$ LANGUAGE plpgsql;

-- Data retention policy (optional)
-- Delete data older than 1 year
CREATE OR REPLACE FUNCTION cleanup_old_departures()
RETURNS void AS $$
BEGIN
  DELETE FROM departures WHERE timestamp < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- Collector status tracking
CREATE TABLE collector_runs (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50) NOT NULL, -- 'wiener_linien' or 'oebb'
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  stops_fetched INTEGER DEFAULT 0,
  departures_recorded INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  error_message TEXT,
  success BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_collector_runs_provider ON collector_runs(provider, started_at DESC);

COMMENT ON TABLE stops IS 'Public transport stops and stations';
COMMENT ON TABLE lines IS 'Transit lines (U-Bahn, Tram, Bus, S-Bahn, etc.)';
COMMENT ON TABLE departures IS 'Time-series departure data with real-time delay information';
COMMENT ON TABLE delay_stats_hourly IS 'Pre-aggregated hourly statistics for faster dashboard queries';
COMMENT ON TABLE collector_runs IS 'Audit log of data collection runs';
