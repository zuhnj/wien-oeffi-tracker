import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from collector directory
loadEnv({ path: join(__dirname, '..', '.env') });

export const config = {
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/wien_oeffi_tracker',
  },
  wienerLinien: {
    apiKey: process.env.WIENER_LINIEN_API_KEY || '',
    intervalMinutes: parseInt(process.env.WIENER_LINIEN_INTERVAL || '3', 10),
    stops: process.env.WIENER_LINIEN_STOPS?.split(',').filter(Boolean) || [],
  },
  oebb: {
    intervalMinutes: parseInt(process.env.OEBB_INTERVAL || '5', 10),
    stops: process.env.OEBB_STOPS?.split(',').filter(Boolean) || [],
  },
  userAgent: process.env.USER_AGENT || 'wien-oeffi-tracker',
  debug: process.env.DEBUG === 'true',
};

// Validate required config
export function validateConfig() {
  const errors: string[] = [];

  if (!config.database.url) {
    errors.push('DATABASE_URL is required');
  }

  // Note: Wiener Linien API is public, no API key required
  // Optional sender parameter can be set via WIENER_LINIEN_API_KEY for rate limit increases

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}
