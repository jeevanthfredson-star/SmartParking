import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  FLOOR_META,
  formatCurrency,
  formatDuration,
  PAYMENT_METHOD_LABELS,
} from '../shared/parkingTypes';
import type { FacilityState, FloorId, PaymentMethod } from '../shared/parkingTypes';

interface AnalyticsViewProps {
  state: FacilityState;
  searchQuery: string;
}

export function AnalyticsView({ state, searchQuery }: AnalyticsViewProps) {
  const [methodFilter, setMethodFilter] = useState<'ALL' | PaymentMethod>('ALL');
  const [hoveredBucket, setHoveredBucket] = useState<number | null>(null);

  const sym = state.tariffs.currencySymbol;

  const hourlyBuckets = useMemo(() => {
    const now = Date.now();
    const bucketCount = 12;
    const bucketMs = 2 * 3600 * 1000;
    const buckets = Array.from({ length: bucketCount }, (_, i) => {
      const endMs = now - (bucketCount - 1 - i) * bucketMs;
      const startMs = endMs - bucketMs;
      const label = new Date(endMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return {
        index: i,
        label,
        startMs,
        endMs,
        revenue: 0,
        exits: 0,
        entries: 0,
      };
    });

    for (const tx of state.transactions) {
      const tMs = new Date(tx.exitTime).getTime();
      const b = buckets.find((x) => tMs >= x.startMs && tMs <= x.endMs);
      if (b) {
        b.revenue += tx.totalAmount;
        b.exits += 1;
      }
      const eMs = new Date(tx.entryTime).getTime();
      const eb = buckets.find((x) => eMs >= x.startMs && eMs <= x.endMs);
      if (eb) eb.entries += 1;
    }

    for (const ses of state.activeSessions) {
      const eMs = new Date(ses.entryTime).getTime();
      const eb = buckets.find((x) => eMs >= x.startMs && eMs <= x.endMs);
      if (eb) eb.entries += 1;
    }

    return buckets;
  }, [state.transactions, state.activeSessions]);

  const maxBucketVal = Math.max(
    1,
    ...hourlyBuckets.map((b) => Math.max(b.revenue, b.entries * 12))
  );

  const floorBreakdown = useMemo(() => {
    const floors: FloorId[] = ['P1', 'P2', 'P3'];
    return floors.map((floor) => {
      const floorBays = state.bays.filter((b) => b.floor === floor);
      const occupied = floorBays.filter((b) => b.status === 'occupied').length;
      const available = floorBays.filter((b) => b.status === 'available').length;
      const reserved = floorBays.filter((b) => b.status === 'reserved').length;
      const maintenance = floorBays.filter((b) => b.status === 'maintenance').length;
      const revenue = state.transactions
        .filter((t) => t.floor === floor)
        .reduce((sum, t) => sum + t.totalAmount, 0);
      const pct = floorBays.length > 0 ? (occupied / floorBays.length) * 100 : 0;
      return {
        floor,
        label: FLOOR_META[floor].label,
        subtitle: FLOOR_META[floor].subtitle,
        total: floorBays.length,
        occupied,
        available,
        reserved,
        maintenance,
        revenue,
        pct,
      };
    });
  }, [state.bays, state.transactions]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.transactions.filter((t) => {
      if (methodFilter !== 'ALL' && t.paymentMethod !== methodFilter) return false;
      if (!q) return true;
      return (
        t.plate.toLowerCase().includes(q) ||
        t.receiptNumber.toLowerCase().includes(q) ||
        t.bayId.toLowerCase().includes(q) ||
        t.driverName.toLowerCase().includes(q)
      );
    });
  }, [state.transactions, methodFilter, searchQuery]);

  const handleExportCsv = () => {
    const headers = [
      'Receipt',
      'Plate',
      'Bay',
      'Floor',
      'Driver',
      'EntryTime',
      'ExitTime',
      'Minutes',
      'ParkingFee',
      'EVFee',
      'Discount',
      'Tax',
      'Total',
      'PaymentMethod',
    ];
    const lines = [
      headers.join(','),
      ...filteredTransactions.map((t) =>
        [
          t.receiptNumber,
          t.plate,
          t.bayId,
          t.floor,
          `"${t.driverName.replace(/"/g, '""')}"`,
          t.entryTime,
          t.exitTime,
          t.elapsedMinutes,
          t.parkingFee.toFixed(2),
          t.evEnergyFee.toFixed(2),
          t.discountAmount.toFixed(2),
          t.taxAmount.toFixed(2),
          t.totalAmount.toFixed(2),
          t.paymentMethod,
        ].join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `metrobay-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalRevenue = state.transactions.reduce((s, t) => s + t.totalAmount, 0);
  const totalEvKwh = state.transactions.reduce((s, t) => s + t.evKwhDelivered, 0);
  const avgStayMins =
    state.transactions.length > 0
      ? Math.round(
          state.transactions.reduce((s, t) => s + t.elapsedMinutes, 0) / state.transactions.length
        )
      : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h2 className="font-display font-semibold text-base text-slate-900">
                24-Hour Revenue & Gate Flow
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                2-hour settlement intervals · Hover bars to inspect settled revenue and vehicle entries
              </p>
            </div>
            <div className="text-xs text-slate-600 font-mono tabular-nums">
              Avg Stay: {formatDuration(avgStayMins)} · {totalEvKwh.toFixed(1)} kWh delivered
            </div>
          </div>

          <div className="mt-5">
            <div className="h-52 flex items-end justify-between gap-2 px-1">
              {hourlyBuckets.map((b) => {
                const heightPct = Math.max(6, Math.round((b.revenue / maxBucketVal) * 100));
                const isHovered = hoveredBucket === b.index;
                return (
                  <div
                    key={b.index}
                    onMouseEnter={() => setHoveredBucket(b.index)}
                    onMouseLeave={() => setHoveredBucket(null)}
                    className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-default"
                  >
                    {isHovered && (
                      <div className="absolute -top-2 -translate-y-full z-10 bg-slate-900 text-white text-[11px] rounded-md px-2.5 py-1.5 whitespace-nowrap pointer-events-none font-mono tabular-nums shadow-sm">
                        <div>{b.label}</div>
                        <div>
                          {formatCurrency(b.revenue, sym)} · {b.exits} exits · {b.entries} in
                        </div>
                      </div>
                    )}
                    <div className="w-full flex items-end justify-center h-40">
                      <div
                        className={`w-full max-w-[34px] rounded-t-md transition-colors ${
                          b.revenue > 0
                            ? isHovered
                              ? 'bg-teal-800'
                              : 'bg-teal-700'
                            : 'bg-slate-200'
                        }`}
                        style={{ height: `${b.revenue > 0 ? heightPct : 4}%` }}
                      />
                    </div>
                    <span className="mt-2 text-[10px] font-mono text-slate-500 tabular-nums">
                      {b.label.replace(':00', '')}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>Settled Total: <strong className="font-mono text-slate-900">{formatCurrency(totalRevenue, sym)}</strong></span>
              <span>Completed Exits: <strong className="font-mono text-slate-900">{state.transactions.length}</strong></span>
            </div>
          </div>
        </section>

        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
          <div className="pb-4 border-b border-slate-100">
            <h2 className="font-display font-semibold text-base text-slate-900">
              Utilization & Revenue by Level
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live occupancy distribution across all 3 parking decks
            </p>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {floorBreakdown.map((fl) => (
              <div key={fl.floor} className="py-3.5 first:pt-1 last:pb-1 space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{fl.label}</div>
                    <div className="text-xs text-slate-500">{fl.subtitle}</div>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <div className="text-sm font-semibold text-slate-900">
                      {formatCurrency(fl.revenue, sym)}
                    </div>
                    <div className="text-xs text-slate-500">{fl.pct.toFixed(0)}% full</div>
                  </div>
                </div>

                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-700 rounded-full"
                    style={{ width: `${Math.min(100, fl.pct)}%` }}
                  />
                </div>

                <div className="text-[11px] text-slate-600 font-mono tabular-nums flex items-center gap-2">
                  <span>{fl.occupied} occ</span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span className="text-teal-800">{fl.available} open</span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span>{fl.reserved} res</span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span>{fl.maintenance} blocked</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold text-base text-slate-900">
              Completed Transactions Ledger
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {filteredTransactions.length} settled receipts
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
              <button
                type="button"
                onClick={() => setMethodFilter('ALL')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
                  methodFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Methods
              </button>
              {(Object.entries(PAYMENT_METHOD_LABELS) as Array<[PaymentMethod, string]>).map(
                ([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMethodFilter(key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
                      methodFilter === key
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="h-8 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 px-4">Receipt #</th>
                <th className="py-2.5 px-3">Plate & Driver</th>
                <th className="py-2.5 px-3">Bay</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3">Payment</th>
                <th className="py-2.5 px-3 text-right">EV kWh</th>
                <th className="py-2.5 px-4 text-right">Total Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 font-mono text-xs font-medium text-slate-700">
                    {tx.receiptNumber}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-mono text-xs font-semibold text-slate-900">
                      {tx.plate}
                    </div>
                    <div className="text-[11px] text-slate-500">{tx.driverName}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs text-slate-700">
                    {tx.bayId}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs tabular-nums text-slate-700">
                    {formatDuration(tx.elapsedMinutes)}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-700">
                    {PAYMENT_METHOD_LABELS[tx.paymentMethod]}
                    {tx.discountCode && (
                      <span className="ml-1.5 text-[11px] font-mono text-teal-800">
                        ({tx.discountCode})
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-xs tabular-nums text-slate-600">
                    {tx.evKwhDelivered > 0 ? tx.evKwhDelivered.toFixed(1) : '—'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(tx.totalAmount, sym)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
