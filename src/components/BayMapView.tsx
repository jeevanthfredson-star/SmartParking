import {
  Accessibility,
  ArrowRightLeft,
  Ban,
  CheckCircle2,
  Clock,
  LogOut,
  Play,
  Plus,
  QrCode,
  Wrench,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  BAY_CATEGORY_LABELS,
  calculateFeeBreakdown,
  FLOOR_META,
  formatCurrency,
  formatDuration,
  isVehicleCompatibleWithBay,
  VEHICLE_CLASS_LABELS,
} from '../shared/parkingTypes';
import type {
  ActiveSession,
  BayCategory,
  BayStatus,
  FacilityState,
  FloorId,
  GateEvent,
  ParkingBay,
  Reservation,
} from '../shared/parkingTypes';

interface BayMapViewProps {
  state: FacilityState;
  nowMs: number;
  searchQuery: string;
  selectedBayId: string | null;
  onSelectBay: (bayId: string) => void;
  onOpenCheckInForBay: (bayId: string) => void;
  onOpenCheckOutForSession: (session: ActiveSession) => void;
  onOpenReserveForBay: (bayId: string) => void;
  onOpenTicketPass: (target: { session?: ActiveSession; reservation?: Reservation }) => void;
  onRelocateVehicle: (sessionId: string, targetBayId: string) => Promise<void>;
  onUpdateBay: (
    bayId: string,
    action: 'set_maintenance' | 'restore_service' | 'toggle_ev_charge' | 'add_ev_kwh',
    extra?: { maintenanceNote?: string; kwhDelta?: number }
  ) => Promise<void>;
  onCancelReservation: (reservationId: string) => Promise<void>;
  onConvertReservationToCheckIn: (reservation: Reservation) => Promise<void>;
  onSimulateEntry: (
    action: 'barrier_test' | 'simulate_entry',
    gateName?: GateEvent['gateName']
  ) => Promise<void>;
  busy: boolean;
}

const FLOOR_TABS: Array<{ id: FloorId | 'ALL'; label: string }> = [
  { id: 'P1', label: 'Level P1 · EV & Express' },
  { id: 'P2', label: 'Level P2 · Commuter' },
  { id: 'P3', label: 'Level P3 · Long-Stay' },
  { id: 'ALL', label: 'All Decks' },
];

const STATUS_FILTERS: Array<{ id: 'ALL' | BayStatus; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'available', label: 'Open' },
  { id: 'occupied', label: 'Occupied' },
  { id: 'reserved', label: 'Reserved' },
  { id: 'maintenance', label: 'Blocked' },
];

const CATEGORY_SHORT: Record<BayCategory, string> = {
  standard: 'STD',
  ev: 'EV',
  compact: 'CMP',
  suv: 'SUV',
  accessible: 'ADA',
  valet: 'VLT',
};

export function BayMapView({
  state,
  nowMs,
  searchQuery,
  selectedBayId,
  onSelectBay,
  onOpenCheckInForBay,
  onOpenCheckOutForSession,
  onOpenReserveForBay,
  onOpenTicketPass,
  onRelocateVehicle,
  onUpdateBay,
  onCancelReservation,
  onConvertReservationToCheckIn,
  onSimulateEntry,
  busy,
}: BayMapViewProps) {
  const [floorFilter, setFloorFilter] = useState<FloorId | 'ALL'>('P1');
  const [statusFilter, setStatusFilter] = useState<'ALL' | BayStatus>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | BayCategory>('ALL');
  const [maintenanceNote, setMaintenanceNote] = useState('');
  const [relocateTarget, setRelocateTarget] = useState('');

  const sessionByBay = useMemo(
    () => new Map(state.activeSessions.map((s) => [s.bayId, s])),
    [state.activeSessions]
  );

  const reservationByBay = useMemo(() => {
    const map = new Map<string, Reservation>();
    for (const r of state.reservations) {
      if (r.status === 'held' || r.status === 'upcoming') {
        map.set(r.bayId, r);
      }
    }
    return map;
  }, [state.reservations]);

  const activeBay = useMemo(() => {
    if (selectedBayId) {
      const found = state.bays.find((b) => b.id === selectedBayId);
      if (found) return found;
    }
    return state.bays.find((b) => b.status === 'occupied') ?? state.bays[0];
  }, [selectedBayId, state.bays]);

  const queryLower = searchQuery.trim().toLowerCase();

  // If user searches a plate on another floor while on P1, automatically switch to ALL decks so match is visible
  const effectiveFloors: FloorId[] = useMemo(() => {
    if (queryLower) {
      const matchedFloors = new Set<FloorId>();
      for (const b of state.bays) {
        const ses = sessionByBay.get(b.id);
        const res = reservationByBay.get(b.id);
        if (
          b.id.toLowerCase().includes(queryLower) ||
          (ses?.plate.toLowerCase().includes(queryLower) ?? false) ||
          (ses?.driverName.toLowerCase().includes(queryLower) ?? false) ||
          (res?.plate.toLowerCase().includes(queryLower) ?? false)
        ) {
          matchedFloors.add(b.floor);
        }
      }
      if (matchedFloors.size > 0 && floorFilter !== 'ALL' && !matchedFloors.has(floorFilter)) {
        return ['P1', 'P2', 'P3'];
      }
    }
    return floorFilter === 'ALL' ? ['P1', 'P2', 'P3'] : [floorFilter];
  }, [floorFilter, queryLower, state.bays, sessionByBay, reservationByBay]);

  const matchesFilters = (bay: ParkingBay): boolean => {
    if (statusFilter !== 'ALL' && bay.status !== statusFilter) return false;
    if (categoryFilter !== 'ALL' && bay.category !== categoryFilter) return false;
    if (!queryLower) return true;

    const ses = sessionByBay.get(bay.id);
    const res = reservationByBay.get(bay.id);
    return (
      bay.id.toLowerCase().includes(queryLower) ||
      BAY_CATEGORY_LABELS[bay.category].toLowerCase().includes(queryLower) ||
      (ses?.plate.toLowerCase().includes(queryLower) ?? false) ||
      (ses?.driverName.toLowerCase().includes(queryLower) ?? false) ||
      (res?.plate.toLowerCase().includes(queryLower) ?? false) ||
      (res?.driverName.toLowerCase().includes(queryLower) ?? false)
    );
  };

  const activeSession = activeBay ? sessionByBay.get(activeBay.id) : undefined;
  const activeReservation = activeBay ? reservationByBay.get(activeBay.id) : undefined;

  const activeFee = activeSession
    ? calculateFeeBreakdown({
        entryTimeIso: activeSession.entryTime,
        exitTimeIso: new Date(nowMs).toISOString(),
        bayCategory: activeBay.category,
        vehicleClass: activeSession.vehicleClass,
        passType: activeSession.passType,
        evKwhDelivered: activeSession.evKwhDelivered,
        tariffs: state.tariffs,
      })
    : null;

  const compatibleRelocateBays = useMemo(() => {
    if (!activeSession) return [];
    return state.bays.filter(
      (b) =>
        b.status === 'available' &&
        b.id !== activeSession.bayId &&
        isVehicleCompatibleWithBay(activeSession.vehicleClass, b.category)
    );
  }, [activeSession, state.bays]);

  const renderBayTile = (bay: ParkingBay) => {
    const isHighlighted = matchesFilters(bay);
    const isSelected = activeBay?.id === bay.id;
    const ses = sessionByBay.get(bay.id);
    const res = reservationByBay.get(bay.id);

    const elapsedMins = ses
      ? Math.max(1, Math.round((nowMs - new Date(ses.entryTime).getTime()) / 60000))
      : 0;

    let surfaceClass = 'bg-white border-slate-200 hover:border-slate-400 text-slate-800';
    if (bay.status === 'available') {
      surfaceClass =
        'bg-teal-50/40 border-teal-200 hover:border-teal-600 text-slate-900';
    } else if (bay.status === 'occupied') {
      surfaceClass =
        'bg-slate-900 border-slate-900 hover:bg-slate-800 text-white';
    } else if (bay.status === 'reserved') {
      surfaceClass =
        'bg-amber-50/85 border-amber-300 hover:border-amber-500 text-amber-950';
    } else if (bay.status === 'maintenance') {
      surfaceClass =
        'bay-hatch bg-red-50/55 border-red-200 hover:border-red-400 text-red-900';
    }

    return (
      <button
        key={bay.id}
        type="button"
        onClick={() => {
          onSelectBay(bay.id);
          setRelocateTarget('');
        }}
        className={`relative text-left p-2.5 rounded-lg border transition-all duration-150 flex flex-col justify-between min-h-[84px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${surfaceClass} ${
          isSelected ? 'ring-2 ring-teal-700 ring-offset-1' : ''
        } ${!isHighlighted ? 'opacity-25' : 'opacity-100'}`}
        aria-label={`Bay ${bay.id}, ${BAY_CATEGORY_LABELS[bay.category]}, status ${bay.status}`}
      >
        <div className="flex items-center justify-between gap-1 w-full">
          <span
            className={`font-mono text-xs font-semibold tabular-nums ${
              bay.status === 'occupied' ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            {bay.id}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] font-medium tracking-tight shrink-0">
            {bay.category === 'ev' && (
              <Zap
                className={`h-3 w-3 ${
                  bay.evChargingActive
                    ? 'text-cyan-400 fill-cyan-400'
                    : bay.status === 'occupied'
                    ? 'text-cyan-300'
                    : 'text-cyan-700'
                }`}
              />
            )}
            {bay.category === 'accessible' && (
              <Accessibility
                className={`h-3 w-3 ${
                  bay.status === 'occupied' ? 'text-teal-300' : 'text-teal-700'
                }`}
              />
            )}
            <span
              className={
                bay.status === 'occupied'
                  ? 'text-slate-400'
                  : bay.category === 'ev'
                  ? 'text-cyan-800'
                  : 'text-slate-500'
              }
            >
              {CATEGORY_SHORT[bay.category]}
            </span>
          </span>
        </div>

        <div className="mt-2 min-w-0">
          {bay.status === 'occupied' && ses && (
            <>
              <div className="font-mono text-xs font-semibold tracking-tight text-white truncate">
                {ses.plate}
              </div>
              <div className="text-[11px] text-slate-300 font-mono tabular-nums mt-0.5 flex items-center justify-between gap-1">
                <span>{formatDuration(elapsedMins)}</span>
                {bay.evChargingActive && (
                  <span className="text-cyan-300 text-[10px]">{ses.evKwhDelivered.toFixed(1)}kWh</span>
                )}
              </div>
            </>
          )}
          {bay.status === 'available' && (
            <div className="text-xs font-medium text-teal-800 flex items-center justify-between gap-1">
              <span>Open</span>
              {bay.chargerKw && (
                <span className="text-[10px] text-cyan-800 font-mono">{bay.chargerKw}kW</span>
              )}
            </div>
          )}
          {bay.status === 'reserved' && (
            <>
              <div className="text-[11px] font-semibold text-amber-900">Reserved</div>
              <div className="font-mono text-[11px] text-amber-800 truncate">
                {res?.plate ?? 'HOLD'}
              </div>
            </>
          )}
          {bay.status === 'maintenance' && (
            <div className="text-[11px] font-semibold text-red-800 flex items-center gap-1">
              <Ban className="h-3 w-3 shrink-0" />
              <span>Blocked</span>
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto max-w-full">
          {FLOOR_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setFloorFilter(tab.id);
                if (tab.id !== 'ALL' && activeBay?.floor !== tab.id) {
                  const firstOnFloor = state.bays.find((b) => b.floor === tab.id);
                  if (firstOnFloor) onSelectBay(firstOnFloor.id);
                }
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                floorFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {STATUS_FILTERS.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'ALL' | BayCategory)}
            aria-label="Filter by bay category"
            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-teal-700"
          >
            <option value="ALL">All Types</option>
            <option value="standard">Standard</option>
            <option value="ev">EV Charge</option>
            <option value="compact">Compact</option>
            <option value="suv">SUV / Large</option>
            <option value="accessible">Accessible</option>
            <option value="valet">Valet</option>
          </select>

          <button
            type="button"
            disabled={busy}
            onClick={() => void onSimulateEntry('simulate_entry', 'Entry Gate A')}
            className="h-8 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Play className="h-3 w-3 text-teal-700" />
            <span>Simulate Arrival</span>
          </button>
        </div>
      </div>

      {/* Main Split: Architectural Deck Plan + Side Inspector (side-by-side at lg:1024px+) */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <div className="flex-1 min-w-0 w-full space-y-4">
          {effectiveFloors.map((floorId) => {
            const floorBays = state.bays.filter((b) => b.floor === floorId);
            const northRow = floorBays.filter((b) => b.row === 'north');
            const southRow = floorBays.filter((b) => b.row === 'south');
            const openCnt = floorBays.filter((b) => b.status === 'available').length;
            const occCnt = floorBays.filter((b) => b.status === 'occupied').length;
            const resCnt = floorBays.filter((b) => b.status === 'reserved').length;
            const maintCnt = floorBays.filter((b) => b.status === 'maintenance').length;
            const meta = FLOOR_META[floorId];

            return (
              <section
                key={floorId}
                className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5"
                aria-label={meta.label}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3.5 border-b border-slate-100">
                  <div className="flex items-baseline gap-2.5">
                    <h2 className="font-display font-semibold text-base text-slate-900">
                      {meta.label}
                    </h2>
                    <span className="text-xs text-slate-500">{meta.subtitle}</span>
                  </div>
                  <div className="text-xs text-slate-600 tabular-nums flex items-center gap-2">
                    <span className="font-medium text-teal-800">{openCnt} Open</span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span className="font-medium text-slate-900">{occCnt} Occupied</span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span>{resCnt} Reserved</span>
                    {maintCnt > 0 && (
                      <>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span className="text-red-700">{maintCnt} Blocked</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <div className="text-[11px] font-medium text-slate-400 mb-1.5">
                      North Wing · Bays 01–12
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                      {northRow.map(renderBayTile)}
                    </div>
                  </div>

                  {/* Center Drive Aisle */}
                  <div className="h-9 rounded-lg bg-slate-100 border border-dashed border-slate-300 px-3 flex items-center justify-between text-[11px] font-medium text-slate-500">
                    <span>Entry Ramp →</span>
                    <span className="font-mono tracking-wider text-slate-400 hidden sm:inline">
                      CENTER DRIVE LANE · ELEVATOR CORE (06–07 / 18–19)
                    </span>
                    <span className="sm:hidden text-slate-400">Drive Lane</span>
                    <span>→ Exit Ramp</span>
                  </div>

                  <div>
                    <div className="text-[11px] font-medium text-slate-400 mb-1.5">
                      South Wing · Bays 13–24
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                      {southRow.map(renderBayTile)}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        {/* Right Bay Inspector */}
        <aside
          aria-label="Selected bay inspector"
          className="w-full lg:w-80 xl:w-88 shrink-0 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 lg:sticky lg:top-20"
        >
          {activeBay ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-200">
                <div>
                  <div className="text-xs text-slate-500">
                    {FLOOR_META[activeBay.floor].label} · {activeBay.row === 'north' ? 'North Wing' : 'South Wing'}
                  </div>
                  <h3 className="mt-0.5 text-xl font-display font-bold text-slate-900 font-mono">
                    Bay {activeBay.id}
                  </h3>
                  <div className="mt-1 text-xs text-slate-600 flex items-center gap-1.5">
                    <span>{BAY_CATEGORY_LABELS[activeBay.category]}</span>
                    {activeBay.chargerKw && (
                      <>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span className="text-cyan-800 font-mono">{activeBay.chargerKw}kW EVSE</span>
                      </>
                    )}
                    {activeBay.nearElevator && (
                      <>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span>Near Lift</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {activeBay.status === 'available' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Available
                    </span>
                  )}
                  {activeBay.status === 'occupied' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900">
                      Occupied
                    </span>
                  )}
                  {activeBay.status === 'reserved' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800">
                      <Clock className="h-3.5 w-3.5" />
                      Reserved
                    </span>
                  )}
                  {activeBay.status === 'maintenance' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                      <Wrench className="h-3.5 w-3.5" />
                      Blocked
                    </span>
                  )}
                </div>
              </div>

              {activeBay.status === 'occupied' && activeSession && activeFee && (
                <div className="space-y-3.5">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">License Plate</span>
                      <span className="font-mono font-semibold text-sm text-slate-900">
                        {activeSession.plate}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Vehicle Class</span>
                      <span className="text-slate-900 font-medium">
                        {VEHICLE_CLASS_LABELS[activeSession.vehicleClass]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Driver</span>
                      <span className="text-slate-900">{activeSession.driverName}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Entry Time</span>
                      <span className="font-mono text-slate-700 tabular-nums">
                        {new Date(activeSession.entryTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Elapsed Stay</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {formatDuration(activeFee.elapsedMinutes)}
                      </span>
                    </div>
                    {activeBay.category === 'ev' && (
                      <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500">EV Energy</span>
                        <span className="font-mono text-cyan-800 font-semibold tabular-nums">
                          {activeSession.evKwhDelivered.toFixed(1)} kWh · {activeBay.evChargingActive ? 'Charging' : 'Idle'}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2">
                      <span className="font-medium text-sm text-slate-900">Accrued Meter</span>
                      <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                        {formatCurrency(activeFee.totalAmount, state.tariffs.currencySymbol)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-5 gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onOpenCheckOutForSession(activeSession)}
                        className="col-span-4 h-9 px-3 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap disabled:opacity-50"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Check Out & Settle</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenTicketPass({ session: activeSession })}
                        title="View Digital Gate Pass"
                        aria-label="View Digital Gate Pass"
                        className="col-span-1 h-9 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 inline-flex items-center justify-center"
                      >
                        <QrCode className="h-4 w-4" />
                      </button>
                    </div>

                    {activeBay.category === 'ev' && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onUpdateBay(activeBay.id, 'toggle_ev_charge')}
                          className="h-8 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center justify-center gap-1 whitespace-nowrap disabled:opacity-50"
                        >
                          <Zap className="h-3.5 w-3.5 text-cyan-700" />
                          <span>{activeBay.evChargingActive ? 'Pause EV' : 'Start EV'}</span>
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void onUpdateBay(activeBay.id, 'add_ev_kwh', { kwhDelta: 5 })
                          }
                          className="h-8 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center justify-center whitespace-nowrap disabled:opacity-50"
                        >
                          +5.0 kWh
                        </button>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <label className="block text-xs font-medium text-slate-600">
                        Relocate Vehicle
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={relocateTarget}
                          onChange={(e) => setRelocateTarget(e.target.value)}
                          className="flex-1 h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-teal-700"
                        >
                          <option value="">Pick open bay...</option>
                          {compatibleRelocateBays.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.id} · {BAY_CATEGORY_LABELS[b.category]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={busy || !relocateTarget}
                          onClick={async () => {
                            if (!relocateTarget) return;
                            await onRelocateVehicle(activeSession.id, relocateTarget);
                            onSelectBay(relocateTarget);
                            setRelocateTarget('');
                          }}
                          className="h-8 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1 whitespace-nowrap shrink-0 disabled:opacity-40"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                          <span>Move</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeBay.status === 'available' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Bay {activeBay.id} is ready for occupancy. Assign a vehicle immediately or hold for an incoming reservation.
                  </p>

                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onOpenCheckInForBay(activeBay.id)}
                      className="w-full h-9 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Check In to {activeBay.id}</span>
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onOpenReserveForBay(activeBay.id)}
                      className="w-full h-9 px-4 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap disabled:opacity-50"
                    >
                      <Clock className="h-3.5 w-3.5 text-slate-500" />
                      <span>Reserve This Bay</span>
                    </button>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 space-y-2">
                    <label className="block text-xs font-medium text-slate-600">
                      Lock Bay for Maintenance
                    </label>
                    <input
                      type="text"
                      value={maintenanceNote}
                      onChange={(e) => setMaintenanceNote(e.target.value)}
                      placeholder="Reason (e.g. Sensor calibration)"
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        await onUpdateBay(activeBay.id, 'set_maintenance', {
                          maintenanceNote: maintenanceNote || 'Scheduled maintenance',
                        });
                        setMaintenanceNote('');
                      }}
                      className="w-full h-8 px-3 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap disabled:opacity-50"
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      <span>Set Out of Service</span>
                    </button>
                  </div>
                </div>
              )}

              {activeBay.status === 'reserved' && activeReservation && (
                <div className="space-y-3.5">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Reserved Plate</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {activeReservation.plate}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Driver</span>
                      <span className="text-slate-900">{activeReservation.driverName}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Arrival Window</span>
                      <span className="font-mono text-slate-700 tabular-nums">
                        {new Date(activeReservation.startTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        ({activeReservation.durationHours}h)
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-5 gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onConvertReservationToCheckIn(activeReservation)}
                        className="col-span-4 h-9 px-3 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-50"
                      >
                        Confirm Arrival & Check In
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenTicketPass({ reservation: activeReservation })}
                        title="View Reservation Gate Pass"
                        aria-label="View Reservation Gate Pass"
                        className="col-span-1 h-9 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 inline-flex items-center justify-center"
                      >
                        <QrCode className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onCancelReservation(activeReservation.id)}
                      className="w-full h-8 px-4 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-50"
                    >
                      Release Reservation Hold
                    </button>
                  </div>
                </div>
              )}

              {activeBay.status === 'maintenance' && (
                <div className="space-y-3.5">
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900 space-y-1">
                    <div className="font-semibold">Bay Out of Service</div>
                    <div>{activeBay.maintenanceNote || 'Scheduled facility maintenance'}</div>
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onUpdateBay(activeBay.id, 'restore_service')}
                    className="w-full h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    Restore Bay to Service
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500 py-8 text-center">
              Select any parking bay on the deck plan to inspect details or manage occupancy.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
