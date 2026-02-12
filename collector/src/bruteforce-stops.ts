#!/usr/bin/env node
/**
 * Systematically discover ALL Wiener Linien Stop IDs by brute-force
 * Strategy: Test ID ranges with high probability first
 */

import { writeFileSync, appendFileSync, existsSync, readFileSync } from 'fs';

const API_BASE = 'https://www.wienerlinien.at/ogd_realtime/monitor';
const DELAY_MS = 15000; // 15 seconds between requests (avoid 403)
const BATCH_SIZE = 100; // Save results every 100 requests
const OUTPUT_FILE = 'discovered-stops.json';
const PROGRESS_FILE = 'discovery-progress.txt';

interface DiscoveredStop {
  id: string;
  name: string;
  monitors_count: number;
  lines: string[];
  discovered_at: string;
}

// ID ranges to test - only 1 to 1300 (focused on most important stations)
const RANGES = [
  { start: 1, end: 1300, name: 'main' },
];

let discoveredStops: DiscoveredStop[] = [];
let testedCount = 0;
let lastSaveCount = 0;
let errorCount = 0;
let rateLimitCount = 0;

// Load existing progress
function loadProgress(): number {
  if (existsSync(PROGRESS_FILE)) {
    const content = readFileSync(PROGRESS_FILE, 'utf-8');
    return parseInt(content.trim()) || 0;
  }
  return 0;
}

// Save progress
function saveProgress(lastTestedId: number) {
  writeFileSync(PROGRESS_FILE, lastTestedId.toString());
}

// Load existing discovered stops
function loadDiscovered(): DiscoveredStop[] {
  if (existsSync(OUTPUT_FILE)) {
    try {
      return JSON.parse(readFileSync(OUTPUT_FILE, 'utf-8'));
    } catch {
      return [];
    }
  }
  return [];
}

// Save discovered stops
function saveDiscovered() {
  writeFileSync(OUTPUT_FILE, JSON.stringify(discoveredStops, null, 2));
  console.log(`💾 Saved ${discoveredStops.length} stops to ${OUTPUT_FILE}`);
}

async function testStopId(id: string): Promise<DiscoveredStop | null> {
  const url = `${API_BASE}?stopId=${id}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 403) {
        rateLimitCount++;
        console.log(`⚠️  Rate limit hit, waiting longer...`);
        await sleep(30000); // Wait 30 seconds on rate limit
        return null;
      }
      return null;
    }

    const data: any = await response.json();
    
    // Check for errors
    if (data.message && data.message.messageCode !== 1) {
      return null;
    }
    
    // Check if we got valid data
    if (data.data?.monitors && data.data.monitors.length > 0) {
      const monitor = data.data.monitors[0];
      const lines = monitor.lines?.map((l: any) => l.name) || [];
      
      return {
        id,
        name: monitor.locationStop?.properties?.title || monitor.locationStop?.properties?.name || 'Unknown',
        monitors_count: data.data.monitors.length,
        lines,
        discovered_at: new Date().toISOString(),
      };
    }
    
    return null;
  } catch (error) {
    errorCount++;
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      console.error(`❌ Connection refused, waiting...`);
      await sleep(60000); // Wait 1 minute
    }
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

async function main() {
  console.log('🔍 Wiener Linien Stop ID Discovery - Systematic Brute Force\n');
  console.log(`⏱️  Delay between requests: ${DELAY_MS}ms`);
  console.log(`📁 Output: ${OUTPUT_FILE}\n`);
  
  // Load existing data
  discoveredStops = loadDiscovered();
  const startFrom = loadProgress();
  
  if (discoveredStops.length > 0) {
    console.log(`📂 Loaded ${discoveredStops.length} previously discovered stops`);
  }
  
  if (startFrom > 0) {
    console.log(`▶️  Resuming from ID ${startFrom}\n`);
  }
  
  const startTime = Date.now();
  let currentId = startFrom;
  
  for (const range of RANGES) {
    // Skip if already completed
    if (startFrom > range.end) continue;
    
    const actualStart = Math.max(range.start, startFrom);
    const totalInRange = range.end - actualStart;
    const estimatedTime = (totalInRange * DELAY_MS) / 1000;
    
    console.log(`\n📍 Testing range: ${range.name} (${actualStart} - ${range.end})`);
    console.log(`   Estimated time: ${formatTime(estimatedTime)}`);
    console.log(`   Already discovered: ${discoveredStops.length} stops\n`);
    
    for (let id = actualStart; id <= range.end; id++) {
      currentId = id;
      testedCount++;
      
      const stopId = id.toString();
      const result = await testStopId(stopId);
      
      if (result) {
        discoveredStops.push(result);
        console.log(`✅ [${id}] ${result.name} (${result.lines.length} lines: ${result.lines.slice(0, 3).join(', ')}${result.lines.length > 3 ? '...' : ''})`);
      } else {
        if (testedCount % 100 === 0) {
          process.stdout.write(`\r⏳ Tested ${testedCount} IDs, found ${discoveredStops.length} stops (errors: ${errorCount}, rate limits: ${rateLimitCount})`);
        }
      }
      
      // Save periodically
      if (testedCount - lastSaveCount >= BATCH_SIZE) {
        saveDiscovered();
        saveProgress(id);
        lastSaveCount = testedCount;
      }
      
      // Rate limiting
      await sleep(DELAY_MS);
    }
  }
  
  // Final save
  saveDiscovered();
  saveProgress(currentId);
  
  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`\n\n🎉 Discovery complete!`);
  console.log(`   Total IDs tested: ${testedCount}`);
  console.log(`   Stops discovered: ${discoveredStops.length}`);
  console.log(`   Time elapsed: ${formatTime(elapsed)}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Rate limits: ${rateLimitCount}`);
  
  // Group by type
  const byType: Record<string, string[]> = {};
  for (const stop of discoveredStops) {
    const hasUBahn = stop.lines.some(l => l.match(/^U[1-6]$/));
    const hasTram = stop.lines.some(l => l.match(/^\d+$/));
    const hasBus = stop.lines.some(l => l.match(/[A-Z]$/));
    
    const type = hasUBahn ? 'ubahn' : hasTram ? 'tram' : hasBus ? 'bus' : 'other';
    if (!byType[type]) byType[type] = [];
    byType[type].push(stop.id);
  }
  
  console.log(`\n📊 Breakdown:`);
  for (const [type, ids] of Object.entries(byType)) {
    console.log(`   ${type}: ${ids.length} stops`);
  }
  
  console.log(`\n✅ Results saved to ${OUTPUT_FILE}`);
  console.log(`\n📝 To use these IDs, update .env:`);
  console.log(`WIENER_LINIEN_STOPS=${discoveredStops.map(s => s.id).join(',')}`);
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(`\n\n⏸️  Interrupted! Saving progress...`);
  saveDiscovered();
  saveProgress(testedCount);
  console.log(`✅ Progress saved. Run again to resume from ID ${testedCount}`);
  process.exit(0);
});

main().catch(console.error);
