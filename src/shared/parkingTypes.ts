export type FloorId = 'P1' | 'P2' | 'P3';

export type BayCategory =
  | 'standard'
  | 'ev'
  | 'compact'
  | 'suv'
  | 'accessible'
  | 'valet';

export type BayStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';

export type VehicleClass =
  | 'sedan'
  | 'suv'
  | 'ev'
  | 'motorcycle'
  | 'accessible';

export type PaymentMethod = 'card' | 'upi' | 'fleet' | 'cash';

export interface ParkingBay {
  id: string; // e.g. P1-01
  floor: FloorId;
  bayNumber: number; // 1..24
  row: 'north' | 'south';
  category: BayCategory;
  status: BayStatus;
  chargerKw?: number; // present for EV bays (e.g. 22 or 50)
  evChargingActive?: boolean;
  maintenanceNote?: string;
  nearElevator?: boolean;
}

export interface ActiveSession {
  id: string;
  bayId: string;
  floor: FloorId;
  plate: string;
  vehicleClass: VehicleClass;
  driverName: string;
  driverPhone: string;
  passType: 'hourly' | 'monthly' | 'valet' | 'reservation';
  entryTime: string; // ISO string
  evStartKwh: number;
  evKwhDelivered: number;
  notes?: string;
  reservationId?: string;
}

export interface Reservation {
  id: string;
  bayId: string;
  floor: FloorId;
  plate: string;
  vehicleClass: VehicleClass;
  driverName: string;
  driverPhone: string;
  startTime: string; // ISO string
  durationHours: number;
  status: 'upcoming' | 'held' | 'checked_in' | 'cancelled';
  createdAt: string;
}

export interface Transaction {
  id: string;
  receiptNumber: string;
  sessionId: string;
  bayId: string;
  floor: FloorId;
  plate: string;
  vehicleClass: VehicleClass;
  driverName: string;
  entryTime: string;
  exitTime: string;
  elapsedMinutes: number;
  billableHours: number;
  parkingFee: number;
  evEnergyFee: number;
  evKwhDelivered: number;
  discountCode: string;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
}

export interface GateEvent {
  id: string;
  timestamp: string;
  gateName: 'Entry Gate A' | 'Entry Gate B' | 'Exit Gate A' | 'Exit Gate B' | 'EV Zone Gate';
  eventType: 'entry' | 'exit' | 'reservation_hold' | 'relocation' | 'maintenance' | 'barrier_test';
  plate: string;
  bayId: string;
  message: string;
}

export interface TariffConfig {
  currencySymbol: string;
  standardHourlyRate: number;
  evHourlyRate: number;
  suvHourlyRate: number;
  compactHourlyRate: number;
  accessibleHourlyRate: number;
  valetHourlyRate: number;
  gracePeriodMinutes: number;
  dailyMaxCap: number;
  evRatePerKwh: number;
  taxPercent: number;
}

export interface FacilityState {
  facilityName: string;
  bays: ParkingBay[];
  activeSessions: ActiveSession[];
  reservations: Reservation[];
  transactions: Transaction[];
  gateEvents: GateEvent[];
  tariffs: TariffConfig;
  updatedAt: string;
}

export interface FeeBreakdown {
  elapsedMinutes: number;
  graceApplied: boolean;
  billableHours: number;
  hourlyRateApplied: number;
  parkingFee: number;
  evEnergyFee: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  cappedAtDailyMax: boolean;
}

export interface BayRecommendation {
  bay: ParkingBay;
  reason: string;
  score: number;
}

export const FLOOR_META: Record<
  FloorId,
  { label: string; subtitle: string; capacity: number }
> = {
  P1: {
    label: 'Level P1',
    subtitle: 'Express, EV Fast-Charge & Accessible',
    capacity: 24,
  },
  P2: {
    label: 'Level P2',
    subtitle: 'Standard Commuter & Compact Deck',
    capacity: 24,
  },
  P3: {
    label: 'Level P3',
    subtitle: 'Long-Stay, Oversized SUV & Valet',
    capacity: 24,
  },
};

export const BAY_CATEGORY_LABELS: Record<BayCategory, string> = {
  standard: 'Standard',
  ev: 'EV Charge',
  compact: 'Compact',
  suv: 'SUV / Large',
  accessible: 'Accessible',
  valet: 'Valet',
};

export const VEHICLE_CLASS_LABELS: Record<VehicleClass, string> = {
  sedan: 'Sedan',
  suv: 'SUV / Truck',
  ev: 'Electric (EV)',
  motorcycle: 'Motorcycle',
  accessible: 'Accessible Permit',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: 'Card / Tap',
  upi: 'UPI / QR',
  fleet: 'Fleet Pass',
  cash: 'Cash',
};

export const PROMO_CODES: Record<
  string,
  { label: string; type: 'flat' | 'percent' | 'ev_waive'; value: number }
> = {
  RETAIL2HR: { label: 'Retail Validation ($10 off)', type: 'flat', value: 10 },
  VALET10: { label: 'Valet Member (15% off)', type: 'percent', value: 15 },
  EVFREE: { label: 'Complimentary EV Energy', type: 'ev_waive', value: 100 },
  MONTHLY: { label: 'Monthly Permit Pass (100% parking)', type: 'percent', value: 100 },
};

export function normalizePlate(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-\s]/g, '')
    .replace(/\s+/g, '-');
}

export function formatDuration(elapsedMinutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(elapsedMinutes));
  const days = Math.floor(safeMinutes / 1440);
  const hours = Math.floor((safeMinutes % 1440) / 60);
  const mins = safeMinutes % 60;
  if (days > 0) {
    return `${days}d ${hours}h ${mins}m`;
  }
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export function formatCurrency(amount: number, symbol = '$'): string {
  return `${symbol}${amount.toFixed(2)}`;
}

export function getHourlyRateForBayAndVehicle(
  bayCategory: BayCategory,
  vehicleClass: VehicleClass,
  tariffs: TariffConfig
): number {
  if (bayCategory === 'valet') return tariffs.valetHourlyRate;
  if (bayCategory === 'ev' || vehicleClass === 'ev') return tariffs.evHourlyRate;
  if (bayCategory === 'accessible' || vehicleClass === 'accessible')
    return tariffs.accessibleHourlyRate;
  if (bayCategory === 'suv' || vehicleClass === 'suv') return tariffs.suvHourlyRate;
  if (bayCategory === 'compact' || vehicleClass === 'motorcycle')
    return tariffs.compactHourlyRate;
  return tariffs.standardHourlyRate;
}

export function calculateFeeBreakdown(params: {
  entryTimeIso: string;
  exitTimeIso?: string;
  bayCategory: BayCategory;
  vehicleClass: VehicleClass;
  passType?: ActiveSession['passType'];
  evKwhDelivered?: number;
  discountCode?: string;
  customDiscountAmount?: number;
  tariffs: TariffConfig;
}): FeeBreakdown {
  const entryMs = new Date(params.entryTimeIso).getTime();
  const exitMs = params.exitTimeIso ? new Date(params.exitTimeIso).getTime() : Date.now();
  const elapsedMinutes = Math.max(1, Math.round((exitMs - entryMs) / 60000));

  const hourlyRateApplied = getHourlyRateForBayAndVehicle(
    params.bayCategory,
    params.vehicleClass,
    params.tariffs
  );

  const graceApplied = elapsedMinutes <= params.tariffs.gracePeriodMinutes;

  let billableHours = 0;
  let parkingFee = 0;
  let cappedAtDailyMax = false;

  if (!graceApplied) {
    // Bill in 30-minute increments after the first hour, minimum 1h
    if (elapsedMinutes <= 60) {
      billableHours = 1;
    } else {
      billableHours = Math.ceil(elapsedMinutes / 30) * 0.5;
    }
    const rawParking = billableHours * hourlyRateApplied;
    const days = Math.max(1, Math.ceil(elapsedMinutes / 1440));
    const maxForStay = params.tariffs.dailyMaxCap * days;
    if (rawParking > maxForStay) {
      parkingFee = maxForStay;
      cappedAtDailyMax = true;
    } else {
      parkingFee = Number(rawParking.toFixed(2));
    }
  }

  if (params.passType === 'monthly') {
    parkingFee = 0;
  }

  const kwh = Math.max(0, params.evKwhDelivered ?? 0);
  let evEnergyFee = Number((kwh * params.tariffs.evRatePerKwh).toFixed(2));

  let discountAmount = 0;
  const code = (params.discountCode ?? '').trim().toUpperCase();
  const promo = PROMO_CODES[code];

  if (promo) {
    if (promo.type === 'flat') {
      discountAmount = Math.min(parkingFee + evEnergyFee, promo.value);
    } else if (promo.type === 'percent') {
      discountAmount = Number(((parkingFee * promo.value) / 100).toFixed(2));
    } else if (promo.type === 'ev_waive') {
      discountAmount = evEnergyFee;
      evEnergyFee = 0;
    }
  } else if (params.customDiscountAmount && params.customDiscountAmount > 0) {
    discountAmount = Math.min(
      parkingFee + evEnergyFee,
      Number(params.customDiscountAmount.toFixed(2))
    );
  }

  const netBeforeTax = Math.max(0, parkingFee + evEnergyFee - discountAmount);
  const taxAmount = Number(((netBeforeTax * params.tariffs.taxPercent) / 100).toFixed(2));
  const totalAmount = Number((netBeforeTax + taxAmount).toFixed(2));

  return {
    elapsedMinutes,
    graceApplied,
    billableHours,
    hourlyRateApplied,
    parkingFee,
    evEnergyFee,
    discountAmount,
    taxAmount,
    totalAmount,
    cappedAtDailyMax,
  };
}

export function isVehicleCompatibleWithBay(
  vehicleClass: VehicleClass,
  bayCategory: BayCategory
): boolean {
  if (vehicleClass === 'suv' && bayCategory === 'compact') {
    return false; // SUVs cannot fit in compact bays
  }
  return true;
}

export function recommendBestBay(
  bays: ParkingBay[],
  vehicleClass: VehicleClass,
  preferredFloor?: FloorId
): BayRecommendation | null {
  const candidates = bays.filter(
    (b) => b.status === 'available' && isVehicleCompatibleWithBay(vehicleClass, b.category)
  );

  if (candidates.length === 0) return null;

  const floorOrder: Record<FloorId, number> = { P1: 0, P2: 1, P3: 2 };

  const scored = candidates.map((bay) => {
    let score = 100;
    const reasons: string[] = [];

    if (preferredFloor && bay.floor === preferredFloor) {
      score += 40;
    }

    // Category fit scoring
    if (vehicleClass === 'ev') {
      if (bay.category === 'ev') {
        score += 80 + (bay.chargerKw ?? 22) * 0.4;
        reasons.push(`${bay.chargerKw ?? 22}kW EV fast-charger bay`);
      } else {
        score -= 20;
      }
    } else if (vehicleClass === 'accessible') {
      if (bay.category === 'accessible') {
        score += 90;
        reasons.push('ADA accessible bay near elevator core');
      } else {
        score -= 30;
      }
    } else if (vehicleClass === 'suv') {
      if (bay.category === 'suv') {
        score += 65;
        reasons.push('Wide-clearance oversized SUV bay');
      } else if (bay.category === 'standard') {
        score += 35;
        reasons.push('Standard clearance bay');
      } else if (bay.category === 'ev' || bay.category === 'accessible') {
        score -= 25;
      }
    } else if (vehicleClass === 'motorcycle') {
      if (bay.category === 'compact') {
        score += 60;
        reasons.push('Compact lane bay near ramp');
      } else if (bay.category === 'standard') {
        score += 30;
      } else if (bay.category === 'ev' || bay.category === 'accessible') {
        score -= 30;
      }
    } else {
      // Sedan
      if (bay.category === 'standard') {
        score += 55;
        reasons.push('Standard commuter bay');
      } else if (bay.category === 'compact') {
        score += 45;
        reasons.push('Compact rate bay');
      } else if (bay.category === 'ev' || bay.category === 'accessible') {
        score -= 25;
      }
    }

    // Prefer lower floors and lower bay numbers (closer to gate/elevator)
    score -= floorOrder[bay.floor] * 12;
    score -= bay.bayNumber * 0.5;
    if (bay.nearElevator) {
      score += 12;
      if (reasons.length === 0) reasons.push('Near central elevator');
    }

    const reasonText =
      reasons.length > 0
        ? `${reasons[0]} on ${FLOOR_META[bay.floor].label}`
        : `Closest open ${BAY_CATEGORY_LABELS[bay.category]} bay on ${FLOOR_META[bay.floor].label}`;

    return {
      bay,
      score,
      reason: reasonText,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}
