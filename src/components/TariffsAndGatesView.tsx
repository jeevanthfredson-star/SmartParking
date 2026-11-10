import { Play, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PROMO_CODES } from '../shared/parkingTypes';
import type { FacilityState, GateEvent, TariffConfig } from '../shared/parkingTypes';

interface TariffsAndGatesViewProps {
  state: FacilityState;
  onSaveTariffs: (tariffs: Partial<TariffConfig>) => Promise<void>;
  onSimulateGate: (
    action: 'barrier_test' | 'simulate_entry',
    gateName?: GateEvent['gateName']
  ) => Promise<void>;
  busy: boolean;
}

export function TariffsAndGatesView({
  state,
  onSaveTariffs,
  onSimulateGate,
  busy,
}: TariffsAndGatesViewProps) {
  const [form, setForm] = useState<TariffConfig>(state.tariffs);
  const [gateFilter, setGateFilter] = useState<'ALL' | GateEvent['eventType']>('ALL');

  useEffect(() => {
    setForm(state.tariffs);
  }, [state.tariffs]);

  const isDirty = JSON.stringify(form) !== JSON.stringify(state.tariffs);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveTariffs(form);
  };

  const filteredEvents = state.gateEvents.filter(
    (ev) => gateFilter === 'ALL' || ev.eventType === gateFilter
  );

  const updateNum = (field: keyof TariffConfig, raw: string) => {
    const val = Number(raw);
    setForm((prev) => ({
      ...prev,
      [field]: Number.isFinite(val) ? val : 0,
    }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="pb-3 border-b border-slate-100">
          <h2 className="font-display font-semibold text-base text-slate-900">
            Dynamic Tariff & Billing Rules
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Changes apply immediately to live accrued meters and future exits
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Standard Hourly ($)
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={form.standardHourlyRate}
                onChange={(e) => updateNum('standardHourlyRate', e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono text-sm tabular-nums focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                EV Bay Hourly ($)
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={form.evHourlyRate}
                onChange={(e) => updateNum('evHourlyRate', e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono text-sm tabular-nums focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                SUV / Large Hourly ($)
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={form.suvHourlyRate}
                onChange={(e) => updateNum('suvHourlyRate', e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono text-sm tabular-nums focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Compact / Moto Hourly ($)
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={form.compactHourlyRate}
                onChange={(e) => updateNum('compactHourlyRate', e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono text-sm tabular-nums focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Accessible Hourly ($)
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={form.accessibleHourlyRate}
                onChange={(e) => updateNum('accessibleHourlyRate', e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono text-sm tabular-nums focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Valet Deck Hourly ($)
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={form.valetHourlyRate}
                onChange={(e) => updateNum('valetHourlyRate', e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono text-sm tabular-nums focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Grace Period (Mins)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                max="120"
                value={form.gracePeriodMinutes}
                onChange={(e) => updateNum('gracePeriodMinutes', e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono text-sm tabular-nums focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                24h Daily Max Cap ($)
              </label>
              <input
                type="number"
                step="1"
                min="5"
                value={form.dailyMaxCap}
                onChange={(e) => updateNum('dailyMaxCap', e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono text-sm tabular-nums focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                EV Energy ($/kWh)
              </label>
              <input
                type="number"
                step="0.02"
                min="0"
                value={form.evRatePerKwh}
                onChange={(e) => updateNum('evRatePerKwh', e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono text-sm tabular-nums focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Municipal Tax (%)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="40"
                value={form.taxPercent}
                onChange={(e) => updateNum('taxPercent', e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono text-sm tabular-nums focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              {isDirty ? 'Unsaved tariff adjustments' : 'Rates synced with backend'}
            </span>
            <div className="flex items-center gap-2">
              {isDirty && (
                <button
                  type="button"
                  onClick={() => setForm(state.tariffs)}
                  className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Revert
                </button>
              )}
              <button
                type="submit"
                disabled={busy || !isDirty}
                className="h-9 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium transition-colors disabled:opacity-40"
              >
                Save Tariff Rules
              </button>
            </div>
          </div>
        </form>

        <div className="pt-3 border-t border-slate-200 space-y-2">
          <div className="text-xs font-semibold text-slate-900">
            Active Validation Promo Codes
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {Object.entries(PROMO_CODES).map(([code, def]) => (
              <div key={code} className="py-1.5 flex items-center justify-between gap-2">
                <span className="font-mono font-semibold text-teal-800">{code}</span>
                <span className="text-slate-600">{def.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold text-base text-slate-900">
              Gate Lanes & Event Log
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Operate automated LPR barriers and inspect entry/exit audit history
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onSimulateGate('barrier_test', 'Entry Gate A')}
              className="h-9 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-teal-700" />
              <span>Test Gate A Barrier</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onSimulateGate('simulate_entry', 'Entry Gate A')}
              className="h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Simulate LPR Entry</span>
            </button>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              ['ALL', 'All Events'],
              ['entry', 'Entries'],
              ['exit', 'Exits'],
              ['reservation_hold', 'Reservations'],
              ['relocation', 'Relocations'],
              ['maintenance', 'Maintenance'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setGateFilter(id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
                gateFilter === id
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
          {filteredEvents.map((ev) => (
            <div
              key={ev.id}
              className="px-5 py-3 flex items-start justify-between gap-4 hover:bg-slate-50/70 text-xs"
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{ev.gateName}</span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span className="font-mono font-medium text-teal-800">{ev.plate}</span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span className="font-mono text-slate-600">{ev.bayId}</span>
                </div>
                <div className="text-slate-600">{ev.message}</div>
              </div>
              <div className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                {new Date(ev.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
