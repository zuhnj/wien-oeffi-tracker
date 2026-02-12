import { createClient } from 'hafas-client';
import { profile as oebbProfile } from 'hafas-client/p/oebb/index.js';
import { config } from './config.js';
import { db, type Departure } from './database.js';

interface HafasStop {
  type: 'stop' | 'station';
  id: string;
  name: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

interface HafasStopover {
  stop: HafasStop;
  departure?: string;
  plannedDeparture?: string;
  departureDelay?: number | null;
  departurePlatform?: string;
  plannedDeparturePlatform?: string;
  cancelled?: boolean;
}

interface HafasLine {
  type: 'line';
  id?: string;
  name: string;
  mode: string;
  product?: string;
  operator?: {
    id: string;
    name: string;
  };
}

interface HafasTrip {
  id: string;
  line: HafasLine;
  direction?: string;
  stopovers?: HafasStopover[];
}

export class OebbCollector {
  private client: any;
  
  // Major Vienna S-Bahn stations (validated working IDs from actual data)
  private defaultStops = [
    '8103000', // Wien Hbf (Tiefgeschoß Straßenbahn) - works!
    '1290401', // Wien Hbf (Tiefgeschoß Straßenbahn) - works!
    '1291401', // Wien Hütteldorf Bahnhof - works!
    '1190100', // Wien Hbf - works!
    '8101003', // Wien Blumental Bahnhst - works!
    
    // Additional major S-Bahn hubs to try
    '1390104', // Wien Praterstern
    '1391403', // Wien Westbahnhof
    '1290462', // Wien Meidling
    '1303305', // Wien Floridsdorf
    '1370107', // Wien Heiligenstadt
    '1170550', // Wien Handelskai
  ];

  constructor() {
    this.client = createClient(oebbProfile, config.userAgent);
  }

  async collect(): Promise<{ stops: number; departures: number }> {
    const stops = config.oebb.stops.length > 0 
      ? config.oebb.stops 
      : this.defaultStops;

    console.log(`[ÖBB] Collecting from ${stops.length} stops...`);

    let totalDepartures = 0;
    const errors: string[] = [];

    for (const stopId of stops) {
      try {
        const departures = await this.fetchStop(stopId);
        totalDepartures += departures;
        
        if (config.debug) {
          console.log(`[ÖBB] Stop ${stopId}: ${departures} departures`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Stop ${stopId}: ${message}`);
        console.error(`[ÖBB] Error fetching stop ${stopId}:`, error);
      }

      // Rate limiting: 5 seconds between requests (be nice to the API)
      await this.sleep(5000);
    }

    if (errors.length > 0) {
      console.warn(`[ÖBB] Completed with ${errors.length} errors`);
    }

    return { stops: stops.length, departures: totalDepartures };
  }

  private async fetchStop(stopId: string): Promise<number> {
    const now = new Date();
    
    // Fetch departures for the next 90 minutes (ensures overlap, no departures missed)
    const result = await this.client.departures(stopId, {
      duration: 90,
      results: 50,
      remarks: false,
    });

    if (!result.departures || result.departures.length === 0) {
      console.warn(`[ÖBB] No departures found for stop ${stopId}`);
      return 0;
    }

    // Upsert stop
    const stopData = result.departures[0].stop;
    const dbStopId = await db.upsertStop({
      external_id: `oebb_${stopId}`,
      name: stopData.name,
      latitude: stopData.location?.latitude,
      longitude: stopData.location?.longitude,
      provider: 'oebb',
    });

    const departures: Departure[] = [];

    for (const dep of result.departures) {
      const line = dep.line;
      if (!line) continue;

      // Determine transport type
      const transportType = this.mapTransportType(line.mode, line.product);

      // Upsert line
      const lineId = await db.upsertLine({
        line_name: line.name,
        transport_type: transportType,
        provider: 'oebb',
        direction: dep.direction || undefined,
      });

      // Parse times
      const plannedTime = dep.plannedWhen ? new Date(dep.plannedWhen) : new Date(dep.when);
      const estimatedTime = dep.when ? new Date(dep.when) : undefined;

      const delaySeconds = dep.delay !== null && dep.delay !== undefined 
        ? dep.delay * 60 // HAFAS returns delay in minutes
        : undefined;

      departures.push({
        stop_id: dbStopId,
        line_id: lineId,
        timestamp: now,
        scheduled_departure: plannedTime,
        estimated_departure: estimatedTime,
        delay_seconds: delaySeconds,
        platform: dep.platform || dep.plannedPlatform,
        towards: dep.direction || undefined,
        is_cancelled: dep.cancelled || false,
        is_realtime: delaySeconds !== undefined,
        raw_data: {
          tripId: dep.tripId,
          line: line.name,
          operator: line.operator?.name,
        },
      });
    }

    if (departures.length > 0) {
      await db.insertDepartures(departures);
    }

    return departures.length;
  }

  private mapTransportType(mode: string, product?: string): 's_bahn' | 'regional' | 'u_bahn' | 'tram' | 'bus' {
    // S-Bahn (suburban railway)
    if (mode === 'train' && product === 'suburban') return 's_bahn';
    
    // Regional trains
    if (mode === 'train' && (product === 'regional' || product === 'regionalExp')) return 'regional';
    
    // U-Bahn (shouldn't appear in ÖBB but just in case)
    if (mode === 'train' && product === 'subway') return 'u_bahn';
    
    // Tram
    if (mode === 'train' && product === 'tram') return 'tram';
    
    // Bus
    if (mode === 'bus') return 'bus';
    
    // Default fallback
    return mode === 'train' ? 's_bahn' : 'bus';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
