import { CalendarPlus, Check, QrCode, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  BAY_CATEGORY_LABELS,
  FLOOR_META,
  isVehicleCompatibleWithBay,
  normalizePlate,
  recommendBestBay,
  VEHICLE_CLASS_LABELS,
} from '../shared/parkingTypes';
import type {
  FacilityState,
  FloorId,
  Reservation,
  VehicleClass,
} from '../shared/parkingTypes';

interface ReservationsViewProps {
  state: FacilityState;
  searchQuery: string;
  initialBayId?: string | null;
  onClearInitialBay: () => void;
  onCreateReservation: (params: {
    plate: string;
    vehicleClass: VehicleClass;
    driverName: string;
    driverPhone?: string;
    bayId?: string;
    startTime?: string;
    durationHours: number;
  }) => Promise<void>;
  onCancelReservation: (id: string) => Promise<void>;
  onConvertToCheckIn: (reservation: Reservation) => Promise<void>;
  onOpenTicketPass: (reservation: Reservation) => void;
  busy: boolean;
}

export function ReservationsView({
  state,
  searchQuery,
  initialBayId,
  onClearInitialBay,
  onCreateReservation,
  onCancelReservation,
  onConvertToCheckIn,
  onOpenTicketPass,
  busy,
}: ReservationsViewProps) {
  const [showForm, setShowForm] = useState(Boolean(initialBayId));
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'checked_in' | 'cancelled'>('active');

  const [plate, setPlate] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [vehicleClass, setVehicleClass] = useState<VehicleClass>('sedan');
  const [bayId, setBayId] = useState(initialBayId ?? '');
  const [durationHours, setDurationHours] = useState(4);
  const [arrivalMinutesOffset, setArrivalMinutesOffset] = useState(30);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (initialBayId) {
      setShowForm(true);
      setBayId(initialBayId);
      const b = state.bays.find((x) => x.id === initialBayId);
      if (b?.category === 'ev') setVehicleClass('ev');
      else if (b?.category === 'accessible') setVehicleClass('accessible');
      else if (b?.category === 'suv') setVehicleClass('suv');
      onClearInitialBay();
    }
  }, [initialBayId, state.bays, onClearInitialBay]);

  const availableCompatibleBays = useMemo(
    () =>
      state.bays.filter(
        (b) => b.status === 'available' && isVehicleCompatibleWithBay(vehicleClass, b.category)
      ),
    [state.bays, vehicleClass]
  );

  const recommended = useMemo(
    () => recommendBestBay(state.bays, vehicleClass),
    [state.bays, vehicleClass]
  );

  const filteredReservations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.reservations.filter((r) => {
      if (statusFilter === 'active' && r.status !== 'held' && r.status !== 'upcoming') {
        return false;
      }
      if (statusFilter === 'checked_in' && r.status !== 'checked_in') return false;
      if (statusFilter === 'cancelled' && r.status !== 'cancelled') return false;
      if (!q) return true;
      return (
        r.plate.toLowerCase().includes(q) ||
        r.driverName.toLowerCase().includes(q) ||
        r.bayId.toLowerCase().includes(q)
      );
    });
  }, [state.reservations, statusFilter, searchQuery]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleanPlate = normalizePlate(plate);
    if (cleanPlate.length < 3) {
      setFormError('Enter a valid license plate (at least 3 characters).');
      return;
    }
    if (!driverName.trim()) {
      setFormError('Driver name is required for reservation holds.');
      return;
    }

    const startTime = new Date(Date.now() + arrivalMinutesOffset * 60000).toISOString();

    try {
      await onCreateReservation({
        plate: cleanPlate,
        vehicleClass,
        driverName: driverName.trim(),
        driverPhone: driverPhone.trim(),
        bayId: bayId || undefined,
        startTime,
        durationHours,
      });
      setPlate('');
      setDriverName('');
      setDriverPhone('');
      setBayId('');
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to reserve bay');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-semibold text-base text-slate-900">
            Advance Bay Reservations
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Hold dedicated slots ahead of arrival and convert them to active sessions in one click
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                ['active', 'Active Holds'],
                ['checked_in', 'Arrived'],
                ['cancelled', 'Cancelled'],
                ['all', 'All'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setStatusFilter(id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="h-9 px-3.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <CalendarPlus className="h-4 w-4" />
            <span>{showForm ? 'Close Form' : 'New Reservation'}</span>
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-display font-semibold text-sm text-slate-900">
              Create Bay Hold
            </h3>
            {recommended && !bayId && (
              <span className="text-xs text-teal-800">
                Auto-assign will lock <span className="font-mono font-semibold">{recommended.bay.id}</span>
              </span>
            )}
          </div>

          {formError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                License Plate
              </label>
              <input
                type="text"
                required
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="CA-7EV-905"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono text-sm uppercase focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Driver Name
              </label>
              <input
                type="text"
                required
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Full name"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                placeholder="+1 415-555-0188"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Vehicle Class
              </label>
              <select
                value={vehicleClass}
                onChange={(e) => setVehicleClass(e.target.value as VehicleClass)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-teal-700"
              >
                {Object.entries(VEHICLE_CLASS_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Target Bay
              </label>
              <select
                value={bayId}
                onChange={(e) => setBayId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-teal-700"
              >
                <option value="">Smart Auto-Select ({recommended?.bay.id ?? 'None'})</option>
                {(['P1', 'P2', 'P3'] as FloorId[]).map((fl) => {
                  const list = availableCompatibleBays.filter((b) => b.floor === fl);
                  if (list.length === 0) return null;
                  return (
                    <optgroup key={fl} label={FLOOR_META[fl].label}>
                      {list.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.id} · {BAY_CATEGORY_LABELS[b.category]}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ETA Window
                </label>
                <select
                  value={arrivalMinutesOffset}
                  onChange={(e) => setArrivalMinutesOffset(Number(e.target.value))}
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:border-teal-700"
                >
                  <option value={15}>In 15 mins</option>
                  <option value={30}>In 30 mins</option>
                  <option value={60}>In 1 hour</option>
                  <option value={120}>In 2 hours</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Duration (Hrs)
                </label>
                <input
                  type="number"
                  min={1}
                  max={48}
                  value={durationHours}
                  onChange={(e) => setDurationHours(Math.max(1, Number(e.target.value)))}
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:border-teal-700"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="h-9 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium disabled:opacity-50"
            >
              {busy ? 'Reserving...' : 'Confirm Bay Reservation'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredReservations.length === 0 ? (
          <div className="py-12 px-6 text-center space-y-2.5">
            <div className="text-sm font-medium text-slate-900">
              No reservations in this view
            </div>
            <p className="text-xs text-slate-500">
              Create a new reservation hold to lock a compatible bay ahead of a driver arrival.
            </p>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="h-9 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium"
            >
              New Reservation
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4">Plate & Driver</th>
                  <th className="py-2.5 px-3">Reserved Bay</th>
                  <th className="py-2.5 px-3">Vehicle Class</th>
                  <th className="py-2.5 px-3">Arrival Window</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredReservations.map((res) => {
                  const isActiveHold = res.status === 'held' || res.status === 'upcoming';
                  return (
                    <tr key={res.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-xs text-slate-900">
                          {res.plate}
                        </div>
                        <div className="text-xs text-slate-500">
                          {res.driverName}
                          {res.driverPhone ? ` · ${res.driverPhone}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-xs font-semibold text-slate-900">
                        {res.bayId}
                        <span className="text-slate-400 font-sans font-normal ml-1.5">
                          ({res.floor})
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-700">
                        {VEHICLE_CLASS_LABELS[res.vehicleClass]}
                      </td>
                      <td className="py-3 px-3 font-mono text-xs tabular-nums text-slate-700">
                        {new Date(res.startTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        <span className="text-slate-400 font-sans">· {res.durationHours}h hold</span>
                      </td>
                      <td className="py-3 px-3 text-xs font-medium">
                        {isActiveHold && <span className="text-amber-800">Bay Held</span>}
                        {res.status === 'checked_in' && (
                          <span className="text-teal-800">Checked In</span>
                        )}
                        {res.status === 'cancelled' && (
                          <span className="text-slate-400">Cancelled</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isActiveHold ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onOpenTicketPass(res)}
                              title="View Reservation Gate Pass"
                              aria-label={`View Gate Pass for ${res.plate}`}
                              className="h-8 w-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 inline-flex items-center justify-center"
                            >
                              <QrCode className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void onConvertToCheckIn(res)}
                              className="h-8 px-3 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium inline-flex items-center gap-1 whitespace-nowrap disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Check In Arrival</span>
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void onCancelReservation(res.id)}
                              className="h-8 px-2.5 rounded-lg border border-slate-200 hover:border-red-300 hover:text-red-700 text-xs font-medium text-slate-600 inline-flex items-center gap-1 whitespace-nowrap disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Cancel</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
