#!/usr/bin/env node
/**
 * Discover U-Bahn station IDs (4000-5000 range)
 */

import { writeFileSync, appendFileSync, existsSync, readFileSync } from 'fs';

const API_BASE = 'https://www.wienerlinien.at/ogd_realtime/monitor';
const DELAY_MS = 15000;
const OUTPUT_FILE = 'discovered-ubahn-stops.json';
const PROGRESS_FILE = 'ubahn-progress.txt';

interface DiscoveredStop {
  id: string;
  name: string;
  monitors_count: number;
  lines: string[];
  discovered_at: string;
}

const RANGE = { start: 4000, end: 5000 };

let discoveredStops: DiscoveredStop[] = [];
let testedCount = 0;

function loadProgress(): number {
  if (existsSync(PROGRESS_FILE)) {
    const content = readFileSync(PROGRESS_FILE, 'utf-8');
    return parseInt(content.trim()) || RANGE.start;
  }
  return RANGE.start;
}

function saveProgress(lastTestedId: number) {
  writeFileSync(PROGRESS_FILE, lastTestedId.toString());
}

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

function saveDiscovered() {
  writeFileSync(OUTPUT_FILE, JSON.stringify(discoveredStops, null, 2));
  console.log(`💾 Saved ${discoveredStops.length} U-Bahn stops`);
}

async function testStopId(id: string): Promise<DiscoveredStop | null> {
  const url = `${API_BASE}?stopId=${id}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 403) {
        console.log(`⚠️  Rate limit hit, waiting longer...`);
        await sleep(30000);
        return null;
      }
      return null;
    }

    const data: any = await response.json();
    
    if (data.message && data.message.messageCode !== 1) {
      return null;
    }
    
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
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🔍 U-Bahn Station Discovery (4000-5000)\n');
  
  discoveredStops = loadDiscovered();
  const startFrom = loadProgress();
  
  if (discoveredStops.length > 0) {
    console.log(`📂 Loaded ${discoveredStops.length} previously discovered stops`);
  }
  
  if (startFrom > RANGE.start) {
    console.log(`▶️  Resuming from ID ${startFrom}\n`);
  }
  
  for (let id = startFrom; id <= RANGE.end; id++) {
    testedCount++;
    
    const stopId = id.toString();
    const result = await testStopId(stopId);
    
    if (result) {
      discoveredStops.push(result);
      console.log(`✅ [${id}] ${result.name} (${result.lines.join(', ')})`);
    }
    
    if (testedCount % 50 === 0) {
      saveDiscovered();
      saveProgress(id);
    }
    
    await sleep(DELAY_MS);
  }
  
  saveDiscovered();
  saveProgress(RANGE.end);
  
  console.log(`\n🎉 U-Bahn discovery complete! Found ${discoveredStops.length} stops`);
}

process.on('SIGINT', () => {
  console.log(`\n\n⏸️  Interrupted! Saving progress...`);
  saveDiscovered();
  saveProgress(testedCount + RANGE.start);
  process.exit(0);
});

main().catch(console.error);
