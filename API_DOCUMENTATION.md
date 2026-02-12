# API Documentation

This document describes the two APIs used for data collection.

## 1. Wiener Linien OGD Realtime API

### Overview

Official real-time API provided by Wiener Linien through data.gv.at (Open Government Data Austria).

### Registration

1. Visit https://www.data.gv.at/
2. Register for a free account
3. Request API access for "Wiener Linien Echtzeitdaten"
4. You'll receive an API key (sender parameter)

### Endpoints

**Monitor Endpoint** (used in this project)
```
GET https://www.wienerlinien.at/ogd_realtime/monitor
```

**Parameters:**
- `sender` (required): Your API key
- `stopId` (optional): Stop ID to query (e.g., "231" for Karlsplatz)
- `diva` (optional): Alternative stop identifier
- `activateTrafficInfo` (optional): Include traffic info

### Response Format

```json
{
  "data": {
    "monitors": [
      {
        "locationStop": {
          "type": "Feature",
          "properties": {
            "name": "Karlsplatz",
            "title": "Karlsplatz",
            "municipality": "Wien",
            "coordinates": [16.371989, 48.198671]
          }
        },
        "lines": [
          {
            "name": "U1",
            "towards": "Leopoldau",
            "direction": "H",
            "platform": "1",
            "type": "ptMetro",
            "realtimeSupported": true,
            "departures": {
              "departure": [
                {
                  "departureTime": {
                    "timePlanned": "2026-02-12T10:30:00.000+0100",
                    "timeReal": "2026-02-12T10:32:00.000+0100",
                    "countdown": 15
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  }
}
```

### Transport Types

- `ptMetro`: U-Bahn (subway)
- `ptTram`: Straßenbahn (tram)
- `ptBusCity`: City bus
- `ptBusNight`: Night bus

### Rate Limits

- ~100 requests per minute (unofficial)
- Be respectful and cache data

### Finding Stop IDs

1. Use the Wiener Linien website search
2. Use the stops endpoint: `https://www.wienerlinien.at/ogd_realtime/doku/ogd/steige.csv`
3. Common stops:
   - 231: Karlsplatz
   - 1346: Stephansplatz
   - 4918: Hauptbahnhof
   - 1390: Praterstern
   - 1391: Westbahnhof

## 2. ÖBB HAFAS API

### Overview

ÖBB uses the HAFAS system by HaCon. We use the `hafas-client` npm package with the ÖBB profile.

### Library

```bash
npm install hafas-client
```

### Usage

```javascript
import { createClient } from 'hafas-client';
import { profile as oebbProfile } from 'hafas-client/p/oebb/index.js';

const client = createClient(oebbProfile, 'your-user-agent');

// Get departures
const departures = await client.departures('1290401', {
  duration: 60, // next 60 minutes
  results: 50,
});
```

### Important Station IDs

Vienna S-Bahn stations:
- `1290401`: Wien Hauptbahnhof
- `1190100`: Wien Mitte
- `1190101`: Wien Praterstern
- `1190102`: Wien Floridsdorf
- `1390405`: Wien Westbahnhof
- `1291401`: Wien Meidling

### Response Format

```javascript
{
  departures: [
    {
      tripId: '...',
      stop: {
        type: 'station',
        id: '1290401',
        name: 'Wien Hauptbahnhof',
        location: {
          latitude: 48.184080,
          longitude: 16.378822
        }
      },
      when: '2026-02-12T10:30:00+01:00',
      plannedWhen: '2026-02-12T10:30:00+01:00',
      delay: 2, // minutes
      platform: '7',
      plannedPlatform: '7',
      direction: 'Wiener Neustadt Hbf',
      line: {
        type: 'line',
        name: 'S 60',
        mode: 'train',
        product: 'suburban',
        operator: {
          id: 'oebb',
          name: 'ÖBB'
        }
      }
    }
  ]
}
```

### Rate Limiting

**IMPORTANT:** Be respectful to the ÖBB API!

- No official rate limit
- Recommended: 1 request per 5 seconds
- Cache data locally
- Don't hammer the API

### Products

- `suburban`: S-Bahn (main focus)
- `regional`: Regional trains (REX, R)
- `express`: Long-distance trains (not relevant for city tracking)

## Data Collection Best Practices

1. **Stagger API calls** - Don't query all stops simultaneously
2. **Cache responses** - Store in database, don't re-fetch
3. **Handle errors gracefully** - APIs can be temporarily unavailable
4. **Use appropriate intervals**:
   - Wiener Linien: 2-5 minutes (high frequency)
   - ÖBB: 5-10 minutes (lower frequency)
5. **Monitor your usage** - Keep logs of API calls
6. **Respect rate limits** - Use exponential backoff on errors

## Error Handling

### Wiener Linien Errors

```json
{
  "message": {
    "value": "GET Anfrage Parameter fehlt (stopId oder diva)!",
    "messageCode": 321,
    "serverTime": "2026-02-12T10:00:00.000+0100"
  }
}
```

Common error codes:
- `321`: Missing parameters
- `316`: Invalid stop ID
- Rate limit exceeded (HTTP 429)

### ÖBB HAFAS Errors

The library throws JavaScript errors:
- Network errors
- Invalid station IDs
- Timeout errors

Always wrap API calls in try-catch blocks!

## Legal & Attribution

- Wiener Linien data: © Wiener Linien GmbH & Co KG, data.gv.at
- ÖBB data: © ÖBB-Infrastruktur AG

Always attribute data sources in your frontend!
