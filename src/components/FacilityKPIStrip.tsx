import { calculateFeeBreakdown, formatCurrency } from '../shared/parkingTypes';
import type { FacilityState } from '../shared/parkingTypes';

interface FacilityKPIStripProps {
  state: FacilityState;
  nowMs: number;
}

export function FacilityKPIStrip({ state, nowMs }: FacilityKPIStripProps) {
  const totalBays = state.bays.length;
  const occupiedBays = state.bays.filter((b) => b.status === 'occupied');
  const availableBays = state.bays.filter((b) => b.status === 'available');
  const reservedBays = state.bays.filter((b) => b.status === 'reserved');
  const maintBays = state.bays.filter((b) => b.status === 'maintenance');

  const occupancyPct = totalBays > 0 ? (occupiedBays.length / totalBays) * 100 : 0;

  const availP1 = availableBays.filter((b) => b.floor === 'P1').length;
  const availP2 = availableBays.filter((b) => b.floor === 'P2').length;
  const availP3 = availableBays.filter((b) => b.floor === 'P3').length;

  const evTotal = state.bays.filter((b) => b.category === 'ev').length;
  const evActiveCharging = state.bays.filter(
    (b) => b.category === 'ev' && b.status === 'occupied' && b.evChargingActive
  ).length;
  const activeKwLoad = state.bays
    .filter((b) => b.category === 'ev' && b.status === 'occupied' && b.evChargingActive)
    .reduce((sum, b) => sum + (b.chargerKw ?? 22), 0);

  const settledRevenue = state.transactions.reduce((sum, t) => sum + t.totalAmount, 0);

  const bayMap = new Map(state.bays.map((b) => [b.id, b]));
  const accruedOpen = state.activeSessions.reduce((sum, s) => {
    const bay = bayMap.get(s.bayId);
    const fee = calculateFeeBreakdown({
      entryTimeIso: s.entryTime,
      exitTimeIso: new Date(nowMs).toISOString(),
      bayCategory: bay?.category ?? 'standard',
      vehicleClass: s.vehicleClass,
      passType: s.passType,
      evKwhDelivered: s.evKwhDelivered,
      tariffs: state.tariffs,
    });
    return sum + fee.totalAmount;
  }, 0);

  return (
    <section
      aria-label="Facility operational metrics"
      className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
    >
      <div className="p-4">
        <div className="text-xs font-medium text-slate-500">Facility Occupancy</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-display font-bold text-slate-900 tabular-nums">
            {occupancyPct.toFixed(1)}%
          </span>
          <span className="text-xs text-slate-500 tabular-nums">
            {occupiedBays.length} / {totalBays} bays
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-700 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, occupancyPct)}%` }}
          />
        </div>
      </div>

      <div className="p-4">
        <div className="text-xs font-medium text-slate-500">Available Bays</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-display font-bold text-teal-800 tabular-nums">
            {availableBays.length}
          </span>
          <span className="text-xs text-slate-500 tabular-nums">
            {reservedBays.length} held · {maintBays.length} blocked
          </span>
        </div>
        <div className="mt-1.5 text-xs text-slate-600 font-mono tabular-nums">
          P1: {availP1} · P2: {availP2} · P3: {availP3}
        </div>
      </div>

      <div className="p-4">
        <div className="text-xs font-medium text-slate-500">Settled + Accrued</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-display font-bold text-slate-900 font-mono tabular-nums">
            {formatCurrency(settledRevenue, state.tariffs.currencySymbol)}
          </span>
          <span className="text-xs text-slate-500 tabular-nums">
            {state.transactions.length} exits
          </span>
        </div>
        <div className="mt-1.5 text-xs text-slate-600 tabular-nums">
          Open meter: {formatCurrency(accruedOpen, state.tariffs.currencySymbol)}
        </div>
      </div>

      <div className="p-4">
        <div className="text-xs font-medium text-slate-500">EV Pedestal Load</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-display font-bold text-cyan-800 font-mono tabular-nums">
            {evActiveCharging} / {evTotal}
          </span>
          <span className="text-xs text-slate-500 tabular-nums">active</span>
        </div>
        <div className="mt-1.5 text-xs text-slate-600 font-mono tabular-nums">
          {activeKwLoad} kW draw · {formatCurrency(state.tariffs.evRatePerKwh, state.tariffs.currencySymbol)}/kWh
        </div>
      </div>
    </section>
  );
}
