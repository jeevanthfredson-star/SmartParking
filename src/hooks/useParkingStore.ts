import { useCallback, useEffect, useState } from 'react';
import type {
  FacilityState,
  FloorId,
  GateEvent,
  PaymentMethod,
  TariffConfig,
  Transaction,
  VehicleClass,
} from '../shared/parkingTypes';

export interface ToastMessage {
  id: string;
  tone: 'success' | 'error' | 'info';
  text: string;
}

export function useParkingStore() {
  const [state, setState] = useState<FacilityState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback((tone: ToastMessage['tone'], text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, tone, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchState = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/parking/state');
      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }
      const data = (await res.json()) as FacilityState;
      setState(data);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reach parking server';
      setError(msg);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchState(false);
  }, [fetchState]);

  // Tick live clock every 15s for stay durations & fee previews
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  async function requestJson<T>(url: string, options: RequestInit): Promise<T> {
    setBusy(true);
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers ?? {}),
        },
      });
      const payload = (await res.json()) as T & { error?: string; state?: FacilityState };
      if (!res.ok) {
        throw new Error(payload.error || `Request failed (${res.status})`);
      }
      if (payload.state) {
        setState(payload.state);
      }
      return payload;
    } finally {
      setBusy(false);
    }
  }

  const checkIn = useCallback(
    async (params: {
      plate: string;
      vehicleClass: VehicleClass;
      driverName?: string;
      driverPhone?: string;
      passType?: 'hourly' | 'monthly' | 'valet' | 'reservation';
      bayId?: string;
      autoAssign?: boolean;
      preferredFloor?: FloorId;
      reservationId?: string;
      notes?: string;
    }) => {
      try {
        const res = await requestJson<{ session: { bayId: string; plate: string }; state: FacilityState }>(
          '/api/parking/checkin',
          {
            method: 'POST',
            body: JSON.stringify(params),
          }
        );
        pushToast('success', `Checked in ${res.session.plate} to bay ${res.session.bayId}`);
        setNowMs(Date.now());
        return res;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Check-in failed';
        pushToast('error', msg);
        throw err;
      }
    },
    [pushToast]
  );

  const checkOut = useCallback(
    async (params: {
      sessionId?: string;
      bayId?: string;
      plate?: string;
      paymentMethod: PaymentMethod;
      discountCode?: string;
      customDiscountAmount?: number;
      evKwhOverride?: number;
    }): Promise<Transaction> => {
      try {
        const res = await requestJson<{ transaction: Transaction; state: FacilityState }>(
          '/api/parking/checkout',
          {
            method: 'POST',
            body: JSON.stringify(params),
          }
        );
        pushToast(
          'success',
          `Settled ${res.transaction.plate} (${res.transaction.receiptNumber}) · $${res.transaction.totalAmount.toFixed(2)}`
        );
        setNowMs(Date.now());
        return res.transaction;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Check-out failed';
        pushToast('error', msg);
        throw err;
      }
    },
    [pushToast]
  );

  const relocateVehicle = useCallback(
    async (sessionId: string, targetBayId: string) => {
      try {
        await requestJson('/api/parking/relocate', {
          method: 'POST',
          body: JSON.stringify({ sessionId, targetBayId }),
        });
        pushToast('info', `Relocated vehicle to bay ${targetBayId}`);
      } catch (err) {
        pushToast('error', err instanceof Error ? err.message : 'Relocation failed');
        throw err;
      }
    },
    [pushToast]
  );

  const updateBay = useCallback(
    async (
      bayId: string,
      action: 'set_maintenance' | 'restore_service' | 'toggle_ev_charge' | 'add_ev_kwh',
      extra?: { maintenanceNote?: string; kwhDelta?: number }
    ) => {
      try {
        await requestJson(`/api/parking/bays/${encodeURIComponent(bayId)}`, {
          method: 'PATCH',
          body: JSON.stringify({ action, ...extra }),
        });
        const labelMap: Record<string, string> = {
          set_maintenance: `Bay ${bayId} locked for maintenance`,
          restore_service: `Bay ${bayId} restored to service`,
          toggle_ev_charge: `Updated EV charger state on ${bayId}`,
          add_ev_kwh: `Updated EV energy reading on ${bayId}`,
        };
        pushToast('info', labelMap[action] ?? `Updated bay ${bayId}`);
      } catch (err) {
        pushToast('error', err instanceof Error ? err.message : 'Bay update failed');
        throw err;
      }
    },
    [pushToast]
  );

  const createReservation = useCallback(
    async (params: {
      plate: string;
      vehicleClass: VehicleClass;
      driverName: string;
      driverPhone?: string;
      bayId?: string;
      startTime?: string;
      durationHours: number;
    }) => {
      try {
        const res = await requestJson<{ reservation: { bayId: string; plate: string } }>(
          '/api/parking/reservations',
          {
            method: 'POST',
            body: JSON.stringify(params),
          }
        );
        pushToast('success', `Reserved bay ${res.reservation.bayId} for ${res.reservation.plate}`);
      } catch (err) {
        pushToast('error', err instanceof Error ? err.message : 'Could not create reservation');
        throw err;
      }
    },
    [pushToast]
  );

  const cancelReservation = useCallback(
    async (reservationId: string) => {
      try {
        await requestJson(`/api/parking/reservations/${encodeURIComponent(reservationId)}`, {
          method: 'DELETE',
        });
        pushToast('info', 'Reservation cancelled and bay released');
      } catch (err) {
        pushToast('error', err instanceof Error ? err.message : 'Failed to cancel reservation');
        throw err;
      }
    },
    [pushToast]
  );

  const updateTariffs = useCallback(
    async (tariffs: Partial<TariffConfig>) => {
      try {
        await requestJson('/api/parking/tariffs', {
          method: 'PATCH',
          body: JSON.stringify(tariffs),
        });
        pushToast('success', 'Tariff rules updated and applied');
      } catch (err) {
        pushToast('error', err instanceof Error ? err.message : 'Failed to save tariffs');
        throw err;
      }
    },
    [pushToast]
  );

  const simulateGate = useCallback(
    async (action: 'barrier_test' | 'simulate_entry', gateName?: GateEvent['gateName']) => {
      try {
        await requestJson('/api/parking/gate/simulate', {
          method: 'POST',
          body: JSON.stringify({ action, gateName }),
        });
        pushToast(
          'success',
          action === 'simulate_entry'
            ? 'Simulated LPR vehicle arrival & smart allocation'
            : `Verified barrier test cycle on ${gateName ?? 'Entry Gate A'}`
        );
      } catch (err) {
        pushToast('error', err instanceof Error ? err.message : 'Gate action failed');
        throw err;
      }
    },
    [pushToast]
  );

  const resetDemo = useCallback(async () => {
    try {
      await requestJson('/api/parking/reset-demo', { method: 'POST' });
      pushToast('info', 'Facility reset to baseline sample operations');
      setNowMs(Date.now());
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to reset facility');
    }
  }, [pushToast]);

  return {
    state,
    loading,
    busy,
    error,
    nowMs,
    toasts,
    dismissToast,
    refresh: () => fetchState(true),
    checkIn,
    checkOut,
    relocateVehicle,
    updateBay,
    createReservation,
    cancelReservation,
    updateTariffs,
    simulateGate,
    resetDemo,
  };
}
