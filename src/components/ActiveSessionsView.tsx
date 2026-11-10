import { ArrowUpDown, ExternalLink, LogOut, QrCode, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  BAY_CATEGORY_LABELS,
  calculateFeeBreakdown,
  formatCurrency,
  formatDuration,
  VEHICLE_CLASS_LABELS,
} from '../shared/parkingTypes';
import type { ActiveSession, FacilityState, FloorId, VehicleClass } from '../shared/parkingTypes';

interface ActiveSessionsViewProps {
  state: FacilityState;
  nowMs: number;
  searchQuery: string;
  onClearSearch: () => void;
  onInspectBay: (bayId: string) => void;
  onCheckOutSession: (session: ActiveSession) => void;
  onOpenTicketPass: (session: ActiveSession) => void;
  onOpenCheckIn: () => void;
}

type SortKey = 'entryTime' | 'bayId' | 'fee';

export function ActiveSessionsView({
  state,
  nowMs,
  searchQuery,
  onClearSearch,
  onInspectBay,
  onCheckOutSession,
  onOpenTicketPass,
  onOpenCheckIn,
}: ActiveSessionsViewProps) {
  const [floorFilter, setFloorFilter] = useState<'ALL' | FloorId>('ALL');
  const [classFilter, setClassFilter] = useState<'ALL' | VehicleClass>('ALL');
  const [sortBy, setSortBy] = useState<SortKey>('entryTime');
  const [sortAsc, setSortAsc] = useState(false);

  const bayMap = useMemo(
    () => new Map(state.bays.map((b) => [b.id, b])),
    [state.bays]
  );

  const rows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = state.activeSessions
      .map((session) => {
        const bay = bayMap.get(session.bayId);
        const breakdown = calculateFeeBreakdown({
          entryTimeIso: session.entryTime,
          exitTimeIso: new Date(nowMs).toISOString(),
          bayCategory: bay?.category ?? 'standard',
          vehicleClass: session.vehicleClass,
          passType: session.passType,
          evKwhDelivered: session.evKwhDelivered,
          tariffs: state.tariffs,
        });
        return { session, bay, breakdown };
      })
      .filter(({ session }) => {
        if (floorFilter !== 'ALL' && session.floor !== floorFilter) return false;
        if (classFilter !== 'ALL' && session.vehicleClass !== classFilter) return false;
        if (!q) return true;
        return (
          session.plate.toLowerCase().includes(q) ||
          session.bayId.toLowerCase().includes(q) ||
          session.driverName.toLowerCase().includes(q)
        );
      });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'entryTime') {
        cmp = new Date(a.session.entryTime).getTime() - new Date(b.session.entryTime).getTime();
      } else if (sortBy === 'bayId') {
        cmp = a.session.bayId.localeCompare(b.session.bayId);
      } else {
        cmp = a.breakdown.totalAmount - b.breakdown.totalAmount;
      }
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [state.activeSessions, state.tariffs, bayMap, nowMs, floorFilter, classFilter, searchQuery, sortBy, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortAsc((v) => !v);
    } else {
      setSortBy(key);
      setSortAsc(key === 'bayId');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-semibold text-base text-slate-900">
            Active Parked Vehicles
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            Showing {rows.length} of {state.activeSessions.length} active sessions · Live meter accrual
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['ALL', 'P1', 'P2', 'P3'] as const).map((fl) => (
              <button
                key={fl}
                type="button"
                onClick={() => setFloorFilter(fl)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  floorFilter === fl
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {fl === 'ALL' ? 'All Levels' : `Level ${fl}`}
              </button>
            ))}
          </div>

          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value as 'ALL' | VehicleClass)}
            aria-label="Filter by vehicle class"
            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-teal-700"
          >
            <option value="ALL">All Vehicle Classes</option>
            {Object.entries(VEHICLE_CLASS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="py-12 px-6 text-center space-y-3">
          <div className="text-sm font-medium text-slate-900">
            No active parking sessions match the current filters
          </div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Clear your search query or filters, or check in a new vehicle to assign an available bay.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            {(searchQuery || floorFilter !== 'ALL' || classFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  onClearSearch();
                  setFloorFilter('ALL');
                  setClassFilter('ALL');
                }}
                className="h-9 px-3.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Clear Filters
              </button>
            )}
            <button
              type="button"
              onClick={onOpenCheckIn}
              className="h-9 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium"
            >
              Check In Vehicle
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 px-4">Plate & Driver</th>
                <th className="py-2.5 px-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('bayId')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    <span>Bay</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3">Vehicle & Plan</th>
                <th className="py-2.5 px-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('entryTime')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    <span>Entry & Stay</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">EV kWh</th>
                <th className="py-2.5 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('fee')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 ml-auto"
                  >
                    <span>Accrued</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {rows.map(({ session, bay, breakdown }) => (
                <tr key={session.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4">
                    <div className="font-mono font-semibold text-slate-900 text-xs">
                      {session.plate}
                    </div>
                    <div className="text-xs text-slate-500 truncate max-w-[180px]">
                      {session.driverName}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <button
                      type="button"
                      onClick={() => onInspectBay(session.bayId)}
                      className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-teal-800 hover:underline"
                    >
                      <span>{session.bayId}</span>
                      <ExternalLink className="h-3 w-3" />
                    </button>
                    <div className="text-[11px] text-slate-500">
                      {BAY_CATEGORY_LABELS[bay?.category ?? 'standard']}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="text-xs font-medium text-slate-800">
                      {VEHICLE_CLASS_LABELS[session.vehicleClass]}
                    </div>
                    <div className="text-[11px] text-slate-500 capitalize">
                      {session.passType} pass
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums">
                    <div className="text-xs font-medium text-slate-900">
                      {formatDuration(breakdown.elapsedMinutes)}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      In{' '}
                      {new Date(session.entryTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-xs tabular-nums">
                    {bay?.category === 'ev' ? (
                      <span className="inline-flex items-center gap-1 text-cyan-800 font-medium">
                        <Zap className="h-3 w-3" />
                        {session.evKwhDelivered.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(breakdown.totalAmount, state.tariffs.currencySymbol)}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenTicketPass(session)}
                        title="View Digital Gate Pass"
                        aria-label={`View Gate Pass for ${session.plate}`}
                        className="h-8 w-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 inline-flex items-center justify-center"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onCheckOutSession(session)}
                        className="h-8 px-3 rounded-lg border border-slate-200 hover:border-teal-700 hover:text-teal-800 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Check Out</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
