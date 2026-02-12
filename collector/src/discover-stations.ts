#!/usr/bin/env node
/**
 * Discover and extract station IDs from actual API responses
 */

import { createClient } from 'hafas-client';
import { profile as oebbProfile } from 'hafas-client/p/oebb/index.js';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_qh3ClLNu4amc@ep-noisy-thunder-agfzvcfh-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function discoverWienerLinienStops() {
  console.log('\n🔍 Discovering Wiener Linien Stops from existing data...\n');
  
  const result = await pool.query(`
    SELECT DISTINCT 
      s.external_id,
      s.name,
      l.transport_type,
      COUNT(DISTINCT l.line_name) as line_count
    FROM stops s
    JOIN departures d ON s.id = d.stop_id
    JOIN lines l ON d.line_id = l.id
    WHERE s.provider = 'wiener_linien'
    GROUP BY s.external_id, s.name, l.transport_type
    ORDER BY l.transport_type, line_count DESC
  `);

  console.log('Found stops:');
  const byType: Record<string, string[]> = {};
  
  for (const row of result.rows) {
    const stopId = row.external_id.replace('wl_', '');
    const type = row.transport_type;
    
    if (!byType[type]) byType[type] = [];
    byType[type].push(stopId);
    
    console.log(`  ${stopId.padEnd(10)} | ${type.padEnd(10)} | ${row.name} (${row.line_count} lines)`);
  }

  console.log('\n📋 Station IDs by type:');
  for (const [type, ids] of Object.entries(byType)) {
    console.log(`\n${type.toUpperCase()}:`);
    console.log(ids.join(','));
  }
  
  return byType;
}

async function discoverOebbStops() {
  console.log('\n🔍 Discovering ÖBB S-Bahn stops...\n');
  
  const client = createClient(oebbProfile, 'wien-oeffi-tracker-discover');
  
  // Search for Wien stations
  const searchTerms = [
    'Wien',
    'Wien Mitte',
    'Wien Praterstern',
    'Wien Hauptbahnhof',
    'Wien Westbahnhof',
    'Wien Meidling',
    'Wien Floridsdorf',
    'Wien Heiligenstadt',
    'Wien Handelskai',
    'Wien Traisengasse'
  ];

  const foundStops = new Map<string, any>();

  for (const term of searchTerms) {
    try {
      console.log(`Searching for: ${term}...`);
      const locations = await client.locations(term, { results: 10 });
      
      for (const loc of locations) {
        if (loc.type === 'station' && loc.name.includes('Wien')) {
          if (!foundStops.has(loc.id)) {
            foundStops.set(loc.id, loc);
            console.log(`  ✓ ${loc.id.padEnd(12)} | ${loc.name}`);
          }
        }
      }
      
      await sleep(1000); // Be nice to API
    } catch (error) {
      console.error(`  ✗ Error searching ${term}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`\n📊 Found ${foundStops.size} unique ÖBB stations\n`);
  
  // Test which ones actually have departures
  console.log('Testing stations for S-Bahn departures...\n');
  
  const workingStops: string[] = [];
  
  for (const [id, station] of foundStops) {
    try {
      const deps = await client.departures(id, { duration: 30, results: 10 });
      
      // Check if it's S-Bahn
      const sBahnCount = deps.departures?.filter((d: any) => 
        d.line?.name?.startsWith('S ') || d.line?.product === 'suburban'
      ).length || 0;
      
      if (sBahnCount > 0) {
        workingStops.push(id);
        console.log(`  ✓ ${id.padEnd(12)} | ${station.name.padEnd(30)} | ${sBahnCount} S-Bahn departures`);
      } else {
        console.log(`  - ${id.padEnd(12)} | ${station.name.padEnd(30)} | No S-Bahn`);
      }
      
      await sleep(2000); // Be extra nice
    } catch (error) {
      console.log(`  ✗ ${id.padEnd(12)} | ${station.name.padEnd(30)} | Error: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`\n📋 Working S-Bahn station IDs:\n`);
  console.log(workingStops.join(','));
  
  return workingStops;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚊 Wien Öffi Station Discovery Tool\n');
  console.log('This will take a few minutes...\n');
  
  try {
    // Discover Wiener Linien stops from existing data
    const wlStops = await discoverWienerLinienStops();
    
    // Discover ÖBB stops by searching and testing
    const oebbStops = await discoverOebbStops();
    
    console.log('\n✅ Discovery complete!\n');
    console.log('Update your .env with these station IDs:\n');
    console.log('WIENER_LINIEN_STOPS=' + Object.values(wlStops).flat().join(','));
    console.log('OEBB_STOPS=' + oebbStops.join(','));
    
  } catch (error) {
    console.error('❌ Error during discovery:', error);
  } finally {
    await pool.end();
  }
}

main();
