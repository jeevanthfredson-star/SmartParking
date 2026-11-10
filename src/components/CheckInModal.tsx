import { Sparkles, X } from 'lucide-react';
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

interface CheckInModalProps {
  open: boolean;
  onClose: () => void;
  state: FacilityState;
  initialBayId?: string | null;
  onCheckIn: (params: {
    plate: string;
    vehicleClass: VehicleClass;
    driverName?: string;
    driverPhone?: string;
    passType?: 'hourly' | 'monthly' | 'valet' | 'reservation';
    bayId?: string;
    autoAssign?: boolean;
    preferredFloor?: FloorId;
    reservationId?: string;
  }) => Promise<unknown>;
  busy: boolean;
}

export function CheckInModal({
  open,
  onClose,
  state,
  initialBayId,
  onCheckIn,
  busy,
}: CheckInModalProps) {
  const [plate, setPlate] = useState('');
  const [vehicleClass, setVehicleClass] = useState<VehicleClass>('sedan');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [passType, setPassType] = useState<'hourly' | 'monthly' | 'valet'>('hourly');
  const [assignmentMode, setAssignmentMode] = useState<'auto' | 'manual'>('auto');
  const [preferredFloor, setPreferredFloor] = useState<'' | FloorId>('');
  const [manualBayId, setManualBayId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPlate('');
      setDriverName('');
      setDriverPhone('');
      setPassType('hourly');
      setFormError(null);
      if (initialBayId) {
        const bay = state.bays.find((b) => b.id === initialBayId);
        setAssignmentMode('manual');
        setManualBayId(initialBayId);
        if (bay?.category === 'ev') setVehicleClass('ev');
        else if (bay?.category === 'accessible') setVehicleClass('accessible');
        else if (bay?.category === 'suv') setVehicleClass('suv');
        else setVehicleClass('sedan');
      } else {
        setAssignmentMode('auto');
        setManualBayId('');
        setVehicleClass('sedan');
      }
    }
  }, [open, initialBayId, state.bays]);

  const normalizedInput = normalizePlate(plate);

  const matchingReservation: Reservation | undefined = useMemo(() => {
    if (normalizedInput.length < 3) return undefined;
    return state.reservations.find(
      (r) =>
        (r.status === 'held' || r.status === 'upcoming') &&
        r.plate === normalizedInput
    );
  }, [normalizedInput, state.reservations]);

  const recommendation = useMemo(
    () =>
      recommendBestBay(
        state.bays,
        vehicleClass,
        preferredFloor ? preferredFloor : undefined
      ),
    [state.bays, vehicleClass, preferredFloor]
  );

  const compatibleAvailableBays = useMemo(
    () =>
      state.bays.filter(
        (b) => b.status === 'available' && isVehicleCompatibleWithBay(vehicleClass, b.category)
      ),
    [state.bays, vehicleClass]
  );

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (normalizedInput.length < 3) {
      setFormError('Enter a license plate with at least 3 characters.');
      return;
    }

    if (assignmentMode === 'manual' && !manualBayId) {
      setFormError('Select an available parking bay.');
      return;
    }

    try {
      await onCheckIn({
        plate: normalizedInput,
        vehicleClass,
        driverName,
        driverPhone,
        passType,
        autoAssign: assignmentMode === 'auto',
        bayId: assignmentMode === 'manual' ? manualBayId : undefined,
        preferredFloor: preferredFloor || undefined,
      });
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Check-in failed');
    }
  };

  const handleFulfillReservation = async () => {
    if (!matchingReservation) return;
    setFormError(null);
    try {
      await onCheckIn({
        plate: matchingReservation.plate,
        vehicleClass: matchingReservation.vehicleClass,
        driverName: matchingReservation.driverName,
        driverPhone: matchingReservation.driverPhone,
        reservationId: matchingReservation.id,
      });
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to check in reservation');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 no-print">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-modal-title"
        className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 id="checkin-modal-title" className="font-display font-semibold text-base text-slate-900">
              Vehicle Check-In
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Assign a smart-allocated bay or override to a specific deck slot
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {formError}
            </div>
          )}

          {matchingReservation && (
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between gap-3">
              <div className="text-xs text-amber-950">
                <div className="font-semibold">
                  Active Reservation Found · Bay {matchingReservation.bayId}
                </div>
                <div className="text-amber-800 mt-0.5">
                  {matchingReservation.driverName} · {matchingReservation.durationHours}h hold
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handleFulfillReservation}
                className="px-3 py-1.5 rounded-lg bg-amber-900 text-white text-xs font-medium hover:bg-amber-800 whitespace-nowrap shrink-0"
              >
                Check In Held Bay
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="checkin-plate" className="block text-xs font-medium text-slate-700 mb-1">
                License Plate
              </label>
              <input
                id="checkin-plate"
                type="text"
                required
                autoFocus
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="CA-8XTR-419"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 font-mono text-sm uppercase text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label htmlFor="checkin-class" className="block text-xs font-medium text-slate-700 mb-1">
                Vehicle Class
              </label>
              <select
                id="checkin-class"
                value={vehicleClass}
                onChange={(e) => setVehicleClass(e.target.value as VehicleClass)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:border-teal-700"
              >
                {Object.entries(VEHICLE_CLASS_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label htmlFor="checkin-driver" className="block text-xs font-medium text-slate-700 mb-1">
                Driver Name (Optional)
              </label>
              <input
                id="checkin-driver"
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Walk-in Driver"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label htmlFor="checkin-phone" className="block text-xs font-medium text-slate-700 mb-1">
                Phone (Optional)
              </label>
              <input
                id="checkin-phone"
                type="tel"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                placeholder="+1 415-555-0192"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label htmlFor="checkin-pass" className="block text-xs font-medium text-slate-700 mb-1">
                Rate Plan
              </label>
              <select
                id="checkin-pass"
                value={passType}
                onChange={(e) => setPassType(e.target.value as 'hourly' | 'monthly' | 'valet')}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:border-teal-700"
              >
                <option value="hourly">Standard Hourly</option>
                <option value="monthly">Monthly Permit</option>
                <option value="valet">Valet Service</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-700">Bay Assignment</span>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setAssignmentMode('auto')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    assignmentMode === 'auto'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Smart Auto-Assign
                </button>
                <button
                  type="button"
                  onClick={() => setAssignmentMode('manual')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    assignmentMode === 'manual'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Manual Bay Pick
                </button>
              </div>
            </div>

            {assignmentMode === 'auto' ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="pref-floor" className="text-xs text-slate-600">
                    Preferred Deck
                  </label>
                  <select
                    id="pref-floor"
                    value={preferredFloor}
                    onChange={(e) => setPreferredFloor(e.target.value as '' | FloorId)}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white"
                  >
                    <option value="">Any Level (Optimal)</option>
                    <option value="P1">Level P1</option>
                    <option value="P2">Level P2</option>
                    <option value="P3">Level P3</option>
                  </select>
                </div>

                {recommendation ? (
                  <div className="p-3 rounded-lg bg-teal-50/70 border border-teal-200 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-950">
                        <Sparkles className="h-3.5 w-3.5 text-teal-700 shrink-0" />
                        <span>Recommended Bay: {recommendation.bay.id}</span>
                      </div>
                      <div className="text-xs text-teal-800 mt-0.5 truncate">
                        {recommendation.reason}
                      </div>
                    </div>
                    <span className="font-mono text-xs font-semibold text-teal-900 shrink-0">
                      {BAY_CATEGORY_LABELS[recommendation.bay.category]}
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                    No compatible open bays remaining for this vehicle class.
                  </div>
                )}
              </div>
            ) : (
              <div>
                <select
                  value={manualBayId}
                  onChange={(e) => setManualBayId(e.target.value)}
                  aria-label="Select manual parking bay"
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:border-teal-700"
                >
                  <option value="">Select available bay...</option>
                  {(['P1', 'P2', 'P3'] as FloorId[]).map((floor) => {
                    const floorBays = compatibleAvailableBays.filter((b) => b.floor === floor);
                    if (floorBays.length === 0) return null;
                    return (
                      <optgroup key={floor} label={FLOOR_META[floor].label}>
                        {floorBays.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.id} · {BAY_CATEGORY_LABELS[b.category]}
                            {b.chargerKw ? ` (${b.chargerKw}kW)` : ''}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || (assignmentMode === 'auto' && !recommendation)}
              className="h-10 px-5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-50"
            >
              {busy ? 'Checking In...' : 'Confirm Check-In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
