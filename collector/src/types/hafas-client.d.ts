declare module 'hafas-client' {
  export interface Station {
    type: 'station';
    id: string;
    name: string;
    location?: {
      type: 'location';
      latitude: number;
      longitude: number;
    };
  }

  export interface Line {
    type: 'line';
    id?: string;
    name?: string;
    mode?: string;
    product?: string;
  }

  export interface Departure {
    tripId: string;
    stop: Station;
    when: string | null;
    plannedWhen: string | null;
    delay?: number;
    platform?: string;
    plannedPlatform?: string;
    direction?: string;
    line: Line;
    cancelled?: boolean;
  }

  export interface HafasClient {
    departures(stationId: string, options?: any): Promise<{ departures?: Departure[], realtimeDataUpdatedAt?: number }>;
    stop(id: string): Promise<Station>;
    locations(query: string, options?: any): Promise<Station[]>;
  }

  export function createClient(profile: any, userAgent: string): HafasClient;
}

declare module 'hafas-client/p/oebb/index.js' {
  export const profile: any;
}
