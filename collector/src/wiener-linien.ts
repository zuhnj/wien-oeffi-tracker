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
  
  // Major Vienna transit stops (can be customized via env)
  private defaultStops = [
    '231', // Karlsplatz
    '1346', // Stephansplatz
    '1391', // Westbahnhof
    '1390', // Praterstern
    '4918', // Hauptbahnhof
    '5710', // Schwedenplatz
    '231', // Karlsplatz
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

      // Rate limiting: 100ms between requests
      await this.sleep(100);
    }

    if (errors.length > 0) {
      console.warn(`[WL] Completed with ${errors.length} errors`);
    }

    return { stops: stops.length, departures: totalDepartures };
  }

  private async fetchStop(stopId: string): Promise<number> {
    const url = `${this.baseUrl}?stopId=${stopId}&sender=${config.wienerLinien.apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: WienerLinienResponse = await response.json();

    if (data.message) {
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
