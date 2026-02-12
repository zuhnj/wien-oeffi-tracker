import { config } from './config.js';
import { db, type Departure } from './database.js';

interface WienerLinienMonitor {
  locationStop: {
    type: string;
    properties: {
      name: string;
      title: string;
      municipality?: string;
      coordinates?: [number, number];
    };
    geometry?: {
      coordinates: [number, number];
    };
  };
  lines: Array<{
    name: string;
    towards: string;
    direction: string;
    platform?: string;
    richtungsId?: string;
    barrierFree?: boolean;
    realtimeSupported?: boolean;
    trafficjam?: boolean;
    departures?: {
      departure: Array<{
        departureTime: {
          timePlanned: string; // ISO timestamp
          timeReal?: string; // ISO timestamp
          countdown?: number; // Minutes
        };
      }>;
    };
    type: string;
    lineId?: number;
  }>;
}

interface WienerLinienResponse {
  data: {
    monitors: WienerLinienMonitor[];
  };
  message?: {
    value: string;
    messageCode: number;
  };
}

const TRANSPORT_TYPE_MAP: Record<string, 'u_bahn' | 'tram' | 'bus' | 's_bahn' | 'night_bus'> = {
  ptMetro: 'u_bahn',
  ptTram: 'tram',
  ptBusCity: 'bus',
  ptBusNight: 'night_bus',
};

export class WienerLinienCollector {
  private baseUrl = 'https://www.wienerlinien.at/ogd_realtime/monitor';
  
  // Major Vienna transit stops - U-Bahn nodes + important tram/bus hubs
  private defaultStops = [
    // U1, U2, U4 hub
    '231', // Karlsplatz U1,U2,U4
    
    // U1, U3 hub
    '1346', // Stephansplatz U1,U3
    
    // U1, U2 hub
    '1390', // Praterstern U1,U2
    
    // U3, U6 hub
    '1391', // Westbahnhof U3,U6
    
    // Main station
    '4918', // Hauptbahnhof
    
    // U2 stations
    '4201', // Seestadt U2
    '4203', // Hausfeldstraße U2
    '4220', // Karlsplatz U2 (duplicate check)
    
    // U3 endpoints
    '1901', // Ottakring U3
    '1920', // Simmering U3
    
    // U4 endpoints  
    '5901', // Hütteldorf U4
    '5920', // Heiligenstadt U4
    
    // U6 endpoints
    '4601', // Siebenhirten U6
    '4622', // Floridsdorf U6
    
    // Important tram hubs
    '60201509', // Schwarzenbergplatz (Badner Bahn)
    '60200454', // Ring/Volkstheater
  ];

  async collect(): Promise<{ stops: number; departures: number }> {
    const stops = config.wienerLinien.stops.length > 0 
      ? config.wienerLinien.stops 
      : this.defaultStops;

    console.log(`[WL] Collecting from ${stops.length} stops...`);

    let totalDepartures = 0;
    const errors: string[] = [];

    for (const stopId of stops) {
      try {
        const departures = await this.fetchStop(stopId);
        totalDepartures += departures;
        
        if (config.debug) {
          console.log(`[WL] Stop ${stopId}: ${departures} departures`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Stop ${stopId}: ${message}`);
        console.error(`[WL] Error fetching stop ${stopId}:`, error);
      }

      // Rate limiting: 3 seconds between requests to avoid 403 Forbidden
      await this.sleep(3000);
    }

    if (errors.length > 0) {
      console.warn(`[WL] Completed with ${errors.length} errors`);
    }

    return { stops: stops.length, departures: totalDepartures };
  }

  private async fetchStop(stopId: string): Promise<number> {
    // Build URL - sender parameter is optional (for rate limit increases only)
    let url = `${this.baseUrl}?stopId=${stopId}`;
    if (config.wienerLinien.apiKey) {
      url += `&sender=${config.wienerLinien.apiKey}`;
    }
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as WienerLinienResponse;

    // Message code 1 with value "OK" is not an error
    if (data.message && data.message.messageCode !== 1) {
      throw new Error(`API Error ${data.message.messageCode}: ${data.message.value}`);
    }

    if (!data.data?.monitors || data.data.monitors.length === 0) {
      console.warn(`[WL] No monitors found for stop ${stopId}`);
      return 0;
    }

    const departures: Departure[] = [];
    const now = new Date();

    for (const monitor of data.data.monitors) {
      // Upsert stop
      const stopData = monitor.locationStop;
      const coordinates = stopData.geometry?.coordinates || stopData.properties.coordinates;
      
      const dbStopId = await db.upsertStop({
        external_id: `wl_${stopId}`,
        name: stopData.properties.title || stopData.properties.name,
        latitude: coordinates ? coordinates[1] : undefined,
        longitude: coordinates ? coordinates[0] : undefined,
        municipality: stopData.properties.municipality,
        provider: 'wiener_linien',
      });

      // Process lines
      for (const line of monitor.lines) {
        if (!line.departures?.departure) continue;

        const transportType = TRANSPORT_TYPE_MAP[line.type] || 'bus';

        // Upsert line
        const lineId = await db.upsertLine({
          line_name: line.name,
          transport_type: transportType,
          provider: 'wiener_linien',
          direction: line.towards,
        });

        // Process departures
        for (const dep of line.departures.departure) {
          const scheduledTime = new Date(dep.departureTime.timePlanned);
          const estimatedTime = dep.departureTime.timeReal 
            ? new Date(dep.departureTime.timeReal) 
            : undefined;

          const delaySeconds = estimatedTime
            ? Math.round((estimatedTime.getTime() - scheduledTime.getTime()) / 1000)
            : undefined;

          departures.push({
            stop_id: dbStopId,
            line_id: lineId,
            timestamp: now,
            scheduled_departure: scheduledTime,
            estimated_departure: estimatedTime,
            delay_seconds: delaySeconds,
            platform: line.platform,
            towards: line.towards,
            is_cancelled: false,
            is_realtime: line.realtimeSupported || false,
            raw_data: {
              line: line.name,
              countdown: dep.departureTime.countdown,
            },
          });
        }
      }
    }

    if (departures.length > 0) {
      await db.insertDepartures(departures);
    }

    return departures.length;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
