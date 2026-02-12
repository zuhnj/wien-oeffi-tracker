export default function StatsOverview({ stats }: { stats: any }) {
  const formatSeconds = (seconds: number) => {
    if (!seconds && seconds !== 0) return 'N/A';
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.abs(seconds) % 60;
    const sign = seconds < 0 ? '-' : '+';
    return `${sign}${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatNumber = (num: number) => {
    if (!num && num !== 0) return '0';
    return num.toLocaleString('de-AT');
  };

  const calculateOnTimeRate = () => {
    const tracked = parseInt(stats.tracked_departures || 0);
    const delayed = parseInt(stats.delays_over_1min || 0);
    if (tracked === 0) return 0;
    return ((tracked - delayed) / tracked * 100).toFixed(1);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Departures */}
      <div className="stat-card">
        <div className="stat-value text-blue-600">
          {formatNumber(stats.total_departures)}
        </div>
        <div className="stat-label">Abfahrten erfasst (7 Tage)</div>
      </div>

      {/* Average Delay */}
      <div className="stat-card">
        <div className="stat-value text-orange-600">
          {formatSeconds(parseFloat(stats.avg_delay))}
        </div>
        <div className="stat-label">Durchschn. Verspätung</div>
      </div>

      {/* Median Delay */}
      <div className="stat-card">
        <div className="stat-value text-purple-600">
          {formatSeconds(parseFloat(stats.median_delay))}
        </div>
        <div className="stat-label">Median Verspätung</div>
      </div>

      {/* On-Time Rate */}
      <div className="stat-card">
        <div className="stat-value text-green-600">
          {calculateOnTimeRate()}%
        </div>
        <div className="stat-label">Pünktlichkeit (&lt;1 Min)</div>
      </div>

      {/* Delays > 1min */}
      <div className="stat-card">
        <div className="stat-value text-red-600">
          {formatNumber(stats.delays_over_1min)}
        </div>
        <div className="stat-label">Verspätungen &gt;1 Min</div>
      </div>

      {/* Delays > 5min */}
      <div className="stat-card">
        <div className="stat-value text-red-700">
          {formatNumber(stats.delays_over_5min)}
        </div>
        <div className="stat-label">Verspätungen &gt;5 Min</div>
      </div>

      {/* Cancellations */}
      <div className="stat-card">
        <div className="stat-value text-gray-900">
          {formatNumber(stats.cancellations)}
        </div>
        <div className="stat-label">Ausfälle</div>
      </div>

      {/* Tracked Lines */}
      <div className="stat-card">
        <div className="stat-value text-gray-900">
          {formatNumber(stats.unique_lines)}
        </div>
        <div className="stat-label">Linien</div>
      </div>
    </div>
  );
}
