import { NextRequest, NextResponse } from 'next/server';
import { 
  getOverallStats, 
  getDelayStatsByLine, 
  getDelayStatsByStop,
  getHourlyTrends,
  getWeekdayStats,
  getTimeOfDayStats,
  getStationDelays,
  TransportFilter
} from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filter = (searchParams.get('filter') || 'all') as TransportFilter;

  try {
    const [
      overallStats,
      lineStats,
      stopStats,
      hourlyTrends,
      weekdayStats,
      timeOfDayStats,
      stationDelays,
    ] = await Promise.all([
      getOverallStats(7, filter),
      getDelayStatsByLine(7, filter),
      getDelayStatsByStop(7, filter),
      getHourlyTrends(7),
      getWeekdayStats(30),
      getTimeOfDayStats(7),
      getStationDelays(7),
    ]);

    return NextResponse.json({
      overallStats,
      lineStats,
      stopStats,
      hourlyTrends,
      weekdayStats,
      timeOfDayStats,
      stationDelays,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
