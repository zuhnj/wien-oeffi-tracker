import cron from 'node-cron';
import { config, validateConfig } from './config.js';
import { db } from './database.js';
import { WienerLinienCollector } from './wiener-linien.js';
import { OebbCollector } from './oebb.js';

class Collector {
  private wienerLinienCollector = new WienerLinienCollector();
  private oebbCollector = new OebbCollector();
  private isRunning = false;

  async start() {
    console.log('🚊 Wien Öffi-Pünktlichkeits-Tracker - Starting collector...\n');

    // Validate configuration
    try {
      validateConfig();
    } catch (error) {
      console.error('❌ Configuration error:', error);
      process.exit(1);
    }

    // Connect to database
    try {
      await db.connect();
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      process.exit(1);
    }

    // Log configuration
    console.log('Configuration:');
    console.log(`  Wiener Linien: every ${config.wienerLinien.intervalMinutes} minutes`);
    console.log(`  ÖBB: every ${config.oebb.intervalMinutes} minutes`);
    console.log(`  Debug: ${config.debug}\n`);

    // Run initial collection
    console.log('Running initial collection...\n');
    await this.collectWienerLinien();
    await this.collectOebb();

    // Schedule periodic collections
    this.scheduleWienerLinien();
    this.scheduleOebb();

    // Schedule materialized view refresh (hourly)
    cron.schedule('0 * * * *', async () => {
      try {
        console.log('[Stats] Refreshing delay statistics...');
        await db.refreshDelayStats();
        console.log('[Stats] ✓ Statistics refreshed');
      } catch (error) {
        console.error('[Stats] Error refreshing statistics:', error);
      }
    });

    console.log('✓ Collector is running. Press Ctrl+C to stop.\n');

    // Graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  private scheduleWienerLinien() {
    // Convert minutes to cron format (e.g., "*/3 * * * *" for every 3 minutes)
    const cronExpression = `*/${config.wienerLinien.intervalMinutes} * * * *`;
    
    cron.schedule(cronExpression, async () => {
      await this.collectWienerLinien();
    });

    console.log(`✓ Wiener Linien collector scheduled: ${cronExpression}`);
  }

  private scheduleOebb() {
    const cronExpression = `*/${config.oebb.intervalMinutes} * * * *`;
    
    cron.schedule(cronExpression, async () => {
      await this.collectOebb();
    });

    console.log(`✓ ÖBB collector scheduled: ${cronExpression}`);
  }

  private async collectWienerLinien() {
    if (this.isRunning) {
      console.log('[WL] Skipping: collection already in progress');
      return;
    }

    this.isRunning = true;
    const runId = await db.startCollectorRun('wiener_linien');
    const startTime = Date.now();

    try {
      const stats = await this.wienerLinienCollector.collect();
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      await db.endCollectorRun(runId, {
        stopsFetched: stats.stops,
        departuresRecorded: stats.departures,
        errorsCount: 0,
        success: true,
      });

      console.log(`[WL] ✓ Collected ${stats.departures} departures from ${stats.stops} stops (${duration}s)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[WL] Collection failed:', error);

      await db.endCollectorRun(runId, {
        stopsFetched: 0,
        departuresRecorded: 0,
        errorsCount: 1,
        errorMessage,
        success: false,
      });
    } finally {
      this.isRunning = false;
    }
  }

  private async collectOebb() {
    if (this.isRunning) {
      console.log('[ÖBB] Skipping: collection already in progress');
      return;
    }

    this.isRunning = true;
    const runId = await db.startCollectorRun('oebb');
    const startTime = Date.now();

    try {
      const stats = await this.oebbCollector.collect();
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      await db.endCollectorRun(runId, {
        stopsFetched: stats.stops,
        departuresRecorded: stats.departures,
        errorsCount: 0,
        success: true,
      });

      console.log(`[ÖBB] ✓ Collected ${stats.departures} departures from ${stats.stops} stops (${duration}s)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[ÖBB] Collection failed:', error);

      await db.endCollectorRun(runId, {
        stopsFetched: 0,
        departuresRecorded: 0,
        errorsCount: 1,
        errorMessage,
        success: false,
      });
    } finally {
      this.isRunning = false;
    }
  }

  private async shutdown() {
    console.log('\n\nShutting down gracefully...');
    await db.close();
    console.log('✓ Database connection closed');
    process.exit(0);
  }
}

// Start the collector
const collector = new Collector();
collector.start().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
