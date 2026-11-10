import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  calculateFeeBreakdown,
  isVehicleCompatibleWithBay,
  normalizePlate,
  recommendBestBay,
} from './src/shared/parkingTypes.ts';
import type {
  ActiveSession,
  BayCategory,
  FacilityState,
  FloorId,
  GateEvent,
  ParkingBay,
  PaymentMethod,
  Reservation,
  TariffConfig,
  Transaction,
  VehicleClass,
} from './src/shared/parkingTypes.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'parking-store.json');

const DEFAULT_TARIFFS: TariffConfig = {
  currencySymbol: '$',
  standardHourlyRate: 5.0,
  evHourlyRate: 5.5,
  suvHourlyRate: 6.5,
  compactHourlyRate: 4.0,
  accessibleHourlyRate: 4.5,
  valetHourlyRate: 9.0,
  gracePeriodMinutes: 15,
  dailyMaxCap: 38.0,
  evRatePerKwh: 0.34,
  taxPercent: 8.5,
};

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildInitialBays(): ParkingBay[] {
  const bays: ParkingBay[] = [];
  const floors: FloorId[] = ['P1', 'P2', 'P3'];

  for (const floor of floors) {
    for (let n = 1; n <= 24; n++) {
      const bayNumberStr = String(n).padStart(2, '0');
      const id = `${floor}-${bayNumberStr}`;
      const row: 'north' | 'south' = n <= 12 ? 'north' : 'south';
      const nearElevator = n === 6 || n === 7 || n === 18 || n === 19;

      let category: BayCategory = 'standard';
      let chargerKw: number | undefined;

      if (floor === 'P1') {
        if (n >= 1 && n <= 8) {
          category = 'ev';
          chargerKw = n <= 4 ? 50 : 22;
        } else if (n === 9 || n === 10 || n === 19 || n === 20) {
          category = 'accessible';
        } else {
          category = 'standard';
        }
      } else if (floor === 'P2') {
        if (n >= 1 && n <= 6) {
          category = 'compact';
        } else if (n >= 21 && n <= 24) {
          category = 'ev';
          chargerKw = 22;
        } else {
          category = 'standard';
        }
      } else {
        // P3
        if (n >= 1 && n <= 8) {
          category = 'suv';
        } else if (n >= 19 && n <= 24) {
          category = 'valet';
        } else {
          category = 'standard';
        }
      }

      bays.push({
        id,
        floor,
        bayNumber: n,
        row,
        category,
        status: 'available',
        chargerKw,
        evChargingActive: false,
        nearElevator,
      });
    }
  }

  return bays;
}

function createSeedState(): FacilityState {
  const now = Date.now();
  const minsAgo = (m: number) => new Date(now - m * 60000).toISOString();
  const minsAhead = (m: number) => new Date(now + m * 60000).toISOString();

  const bays = buildInitialBays();
  const bayMap = new Map(bays.map((b) => [b.id, b]));

  const seedOccupied: Array<{
    bayId: string;
    plate: string;
    vehicleClass: VehicleClass;
    driverName: string;
    driverPhone: string;
    passType: ActiveSession['passType'];
    minutesAgo: number;
    evKwh: number;
    charging?: boolean;
  }> = [
    { bayId: 'P1-01', plate: 'CA-8EV-402', vehicleClass: 'ev', driverName: 'Elena Vance', driverPhone: '+1 415-882-0194', passType: 'hourly', minutesAgo: 138, evKwh: 26.4, charging: true },
    { bayId: 'P1-02', plate: 'CA-9TR-811', vehicleClass: 'ev', driverName: 'Marcus Chen', driverPhone: '+1 415-610-3320', passType: 'hourly', minutesAgo: 54, evKwh: 14.8, charging: true },
    { bayId: 'P1-04', plate: 'WA-4ZN-903', vehicleClass: 'ev', driverName: 'Priya Nair', driverPhone: '+1 206-441-7712', passType: 'monthly', minutesAgo: 215, evKwh: 31.2, charging: false },
    { bayId: 'P1-06', plate: 'CA-5PL-219', vehicleClass: 'ev', driverName: 'Daniel Park', driverPhone: '+1 415-309-8841', passType: 'hourly', minutesAgo: 42, evKwh: 7.5, charging: true },
    { bayId: 'P1-09', plate: 'CA-2ADA-74', vehicleClass: 'accessible', driverName: 'Arthur Miller', driverPhone: '+1 415-774-1092', passType: 'hourly', minutesAgo: 96, evKwh: 0 },
    { bayId: 'P1-11', plate: 'CA-7KM-530', vehicleClass: 'sedan', driverName: 'Sophia Patel', driverPhone: '+1 650-519-4403', passType: 'hourly', minutesAgo: 29, evKwh: 0 },
    { bayId: 'P1-13', plate: 'NV-6BX-118', vehicleClass: 'sedan', driverName: 'Owen Brooks', driverPhone: '+1 702-901-2381', passType: 'hourly', minutesAgo: 175, evKwh: 0 },
    { bayId: 'P1-15', plate: 'CA-3GT-664', vehicleClass: 'sedan', driverName: 'Hannah Kim', driverPhone: '+1 415-221-9045', passType: 'monthly', minutesAgo: 312, evKwh: 0 },
    { bayId: 'P1-17', plate: 'OR-9FD-442', vehicleClass: 'sedan', driverName: 'Liam OConnor', driverPhone: '+1 503-482-1190', passType: 'hourly', minutesAgo: 11, evKwh: 0 },
    { bayId: 'P1-22', plate: 'CA-1VX-920', vehicleClass: 'sedan', driverName: 'Nadia Alvarez', driverPhone: '+1 415-994-5521', passType: 'hourly', minutesAgo: 164, evKwh: 0 },

    { bayId: 'P2-01', plate: 'CA-6MC-109', vehicleClass: 'motorcycle', driverName: 'Tariq Hassan', driverPhone: '+1 415-672-4190', passType: 'hourly', minutesAgo: 88, evKwh: 0 },
    { bayId: 'P2-03', plate: 'CA-4LM-390', vehicleClass: 'sedan', driverName: 'Claire Dubois', driverPhone: '+1 650-283-7740', passType: 'hourly', minutesAgo: 245, evKwh: 0 },
    { bayId: 'P2-04', plate: 'AZ-8PQ-512', vehicleClass: 'sedan', driverName: 'Noah Wright', driverPhone: '+1 480-332-6619', passType: 'hourly', minutesAgo: 63, evKwh: 0 },
    { bayId: 'P2-08', plate: 'CA-9KW-704', vehicleClass: 'sedan', driverName: 'Grace Liu', driverPhone: '+1 415-801-3342', passType: 'monthly', minutesAgo: 280, evKwh: 0 },
    { bayId: 'P2-10', plate: 'CA-3RH-255', vehicleClass: 'sedan', driverName: 'Victor Rossi', driverPhone: '+1 415-402-8876', passType: 'hourly', minutesAgo: 125, evKwh: 0 },
    { bayId: 'P2-14', plate: 'CA-7NJ-889', vehicleClass: 'suv', driverName: 'Amara Okafor', driverPhone: '+1 510-772-1930', passType: 'hourly', minutesAgo: 192, evKwh: 0 },
    { bayId: 'P2-16', plate: 'TX-2DL-614', vehicleClass: 'sedan', driverName: 'Ethan Carter', driverPhone: '+1 512-903-4421', passType: 'hourly', minutesAgo: 47, evKwh: 0 },
    { bayId: 'P2-21', plate: 'CA-5EV-938', vehicleClass: 'ev', driverName: 'Chloe Bennett', driverPhone: '+1 415-619-0024', passType: 'hourly', minutesAgo: 74, evKwh: 11.4, charging: true },

    { bayId: 'P3-01', plate: 'CA-8SUV-114', vehicleClass: 'suv', driverName: 'Rajesh Sharma', driverPhone: '+1 408-551-9201', passType: 'hourly', minutesAgo: 340, evKwh: 0 },
    { bayId: 'P3-02', plate: 'CA-4XL-773', vehicleClass: 'suv', driverName: 'Megan Foster', driverPhone: '+1 415-318-6604', passType: 'hourly', minutesAgo: 152, evKwh: 0 },
    { bayId: 'P3-05', plate: 'NV-1TR-805', vehicleClass: 'suv', driverName: 'Jordan Hayes', driverPhone: '+1 775-440-8192', passType: 'hourly', minutesAgo: 410, evKwh: 0 },
    { bayId: 'P3-12', plate: 'CA-9BN-302', vehicleClass: 'sedan', driverName: 'Iris Tanaka', driverPhone: '+1 415-772-5591', passType: 'monthly', minutesAgo: 465, evKwh: 0 },
    { bayId: 'P3-19', plate: 'CA-1VLT-88', vehicleClass: 'suv', driverName: 'Sebastian Cole', driverPhone: '+1 415-900-1122', passType: 'valet', minutesAgo: 110, evKwh: 0 },
    { bayId: 'P3-20', plate: 'CA-6VLT-41', vehicleClass: 'sedan', driverName: 'Victoria Sterling', driverPhone: '+1 415-902-7731', passType: 'valet', minutesAgo: 198, evKwh: 0 },
  ];

  const activeSessions: ActiveSession[] = seedOccupied.map((item, idx) => {
    const bay = bayMap.get(item.bayId)!;
    bay.status = 'occupied';
    bay.evChargingActive = Boolean(item.charging);
    return {
      id: `ses-seed-${idx + 1}`,
      bayId: item.bayId,
      floor: bay.floor,
      plate: item.plate,
      vehicleClass: item.vehicleClass,
      driverName: item.driverName,
      driverPhone: item.driverPhone,
      passType: item.passType,
      entryTime: minsAgo(item.minutesAgo),
      evStartKwh: 0,
      evKwhDelivered: item.evKwh,
    };
  });

  // Seed 2 maintenance bays
  const maint1 = bayMap.get('P2-12')!;
  maint1.status = 'maintenance';
  maint1.maintenanceNote = 'Overhead LED ballast replacement';

  const maint2 = bayMap.get('P1-08')!;
  maint2.status = 'maintenance';
  maint2.maintenanceNote = 'EVSE connector recalibration';

  // Seed 4 reservations (3 holding bays now, 1 upcoming)
  const reservations: Reservation[] = [
    {
      id: 'res-seed-1',
      bayId: 'P1-05',
      floor: 'P1',
      plate: 'CA-7EV-905',
      vehicleClass: 'ev',
      driverName: 'Sora Takahashi',
      driverPhone: '+1 415-822-9104',
      startTime: minsAhead(15),
      durationHours: 4,
      status: 'held',
      createdAt: minsAgo(120),
    },
    {
      id: 'res-seed-2',
      bayId: 'P1-10',
      floor: 'P1',
      plate: 'CA-2ADA-99',
      vehicleClass: 'accessible',
      driverName: 'Evelyn Grant',
      driverPhone: '+1 415-311-4409',
      startTime: minsAhead(25),
      durationHours: 3,
      status: 'held',
      createdAt: minsAgo(90),
    },
    {
      id: 'res-seed-3',
      bayId: 'P3-21',
      floor: 'P3',
      plate: 'CA-8VLT-19',
      vehicleClass: 'suv',
      driverName: 'Julian Vance',
      driverPhone: '+1 650-881-2230',
      startTime: minsAhead(40),
      durationHours: 6,
      status: 'held',
      createdAt: minsAgo(75),
    },
    {
      id: 'res-seed-4',
      bayId: 'P2-07',
      floor: 'P2',
      plate: 'WA-5HY-210',
      vehicleClass: 'sedan',
      driverName: 'Maya Lin',
      driverPhone: '+1 206-718-9940',
      startTime: minsAhead(90),
      durationHours: 5,
      status: 'held',
      createdAt: minsAgo(45),
    },
  ];

  for (const res of reservations) {
    const b = bayMap.get(res.bayId);
    if (b && b.status === 'available') {
      b.status = 'reserved';
    }
  }

  // Seed 16 historical transactions across the past 20 hours for analytics
  const histSeeds: Array<{
    bayId: string;
    floor: FloorId;
    plate: string;
    vehicleClass: VehicleClass;
    driverName: string;
    stayMins: number;
    exitedMinsAgo: number;
    evKwh: number;
    method: PaymentMethod;
    cat: BayCategory;
    promo: string;
  }> = [
    { bayId: 'P1-12', floor: 'P1', plate: 'CA-4RT-112', vehicleClass: 'sedan', driverName: 'Kevin Wu', stayMins: 145, exitedMinsAgo: 18, evKwh: 0, method: 'card', cat: 'standard', promo: '' },
    { bayId: 'P1-03', floor: 'P1', plate: 'CA-9EV-310', vehicleClass: 'ev', driverName: 'Natalie Kim', stayMins: 190, exitedMinsAgo: 35, evKwh: 22.5, method: 'upi', cat: 'ev', promo: '' },
    { bayId: 'P2-05', floor: 'P2', plate: 'OR-3CD-774', vehicleClass: 'sedan', driverName: 'Lucas Meyer', stayMins: 95, exitedMinsAgo: 58, evKwh: 0, method: 'card', cat: 'compact', promo: '' },
    { bayId: 'P3-03', floor: 'P3', plate: 'CA-7SUV-82', vehicleClass: 'suv', driverName: 'Diana Ross', stayMins: 260, exitedMinsAgo: 82, evKwh: 0, method: 'fleet', cat: 'suv', promo: '' },
    { bayId: 'P3-22', floor: 'P3', plate: 'CA-5VLT-09', vehicleClass: 'sedan', driverName: 'Harrison Reid', stayMins: 180, exitedMinsAgo: 115, evKwh: 0, method: 'card', cat: 'valet', promo: 'VALET10' },
    { bayId: 'P2-15', floor: 'P2', plate: 'CA-2KM-601', vehicleClass: 'sedan', driverName: 'Zoe Martinez', stayMins: 120, exitedMinsAgo: 150, evKwh: 0, method: 'upi', cat: 'standard', promo: 'RETAIL2HR' },
    { bayId: 'P1-14', floor: 'P1', plate: 'NV-8GH-419', vehicleClass: 'sedan', driverName: 'Samir Patel', stayMins: 75, exitedMinsAgo: 210, evKwh: 0, method: 'cash', cat: 'standard', promo: '' },
    { bayId: 'P1-07', floor: 'P1', plate: 'CA-6EV-554', vehicleClass: 'ev', driverName: 'Claire Zhao', stayMins: 230, exitedMinsAgo: 270, evKwh: 28.0, method: 'card', cat: 'ev', promo: '' },
    { bayId: 'P2-02', floor: 'P2', plate: 'CA-3MC-882', vehicleClass: 'motorcycle', driverName: 'Dylan Vance', stayMins: 110, exitedMinsAgo: 340, evKwh: 0, method: 'upi', cat: 'compact', promo: '' },
    { bayId: 'P3-06', floor: 'P3', plate: 'TX-9TR-120', vehicleClass: 'suv', driverName: 'Olivia Brooks', stayMins: 420, exitedMinsAgo: 410, evKwh: 0, method: 'card', cat: 'suv', promo: '' },
    { bayId: 'P2-18', floor: 'P2', plate: 'CA-1PQ-739', vehicleClass: 'sedan', driverName: 'Ben Cooper', stayMins: 165, exitedMinsAgo: 510, evKwh: 0, method: 'fleet', cat: 'standard', promo: '' },
    { bayId: 'P1-16', floor: 'P1', plate: 'CA-5DF-908', vehicleClass: 'sedan', driverName: 'Rachel Green', stayMins: 90, exitedMinsAgo: 620, evKwh: 0, method: 'card', cat: 'standard', promo: '' },
    { bayId: 'P3-23', floor: 'P3', plate: 'CA-2VLT-66', vehicleClass: 'suv', driverName: 'Arthur Pendelton', stayMins: 310, exitedMinsAgo: 740, evKwh: 0, method: 'card', cat: 'valet', promo: '' },
    { bayId: 'P2-22', floor: 'P2', plate: 'WA-7EV-309', vehicleClass: 'ev', driverName: 'Nora Hayes', stayMins: 155, exitedMinsAgo: 890, evKwh: 19.2, method: 'upi', cat: 'ev', promo: '' },
  ];

  const transactions: Transaction[] = histSeeds.map((item, idx) => {
    const exitTime = minsAgo(item.exitedMinsAgo);
    const entryTime = minsAgo(item.exitedMinsAgo + item.stayMins);
    const breakdown = calculateFeeBreakdown({
      entryTimeIso: entryTime,
      exitTimeIso: exitTime,
      bayCategory: item.cat,
      vehicleClass: item.vehicleClass,
      evKwhDelivered: item.evKwh,
      discountCode: item.promo,
      tariffs: DEFAULT_TARIFFS,
    });
    return {
      id: `tx-seed-${idx + 1}`,
      receiptNumber: `RCP-${String(4021 + idx).padStart(5, '0')}`,
      sessionId: `ses-hist-${idx + 1}`,
      bayId: item.bayId,
      floor: item.floor,
      plate: item.plate,
      vehicleClass: item.vehicleClass,
      driverName: item.driverName,
      entryTime,
      exitTime,
      elapsedMinutes: breakdown.elapsedMinutes,
      billableHours: breakdown.billableHours,
      parkingFee: breakdown.parkingFee,
      evEnergyFee: breakdown.evEnergyFee,
      evKwhDelivered: item.evKwh,
      discountCode: item.promo,
      discountAmount: breakdown.discountAmount,
      taxAmount: breakdown.taxAmount,
      totalAmount: breakdown.totalAmount,
      paymentMethod: item.method,
    };
  });

  const gateEvents: GateEvent[] = [
    {
      id: 'evt-seed-1',
      timestamp: minsAgo(11),
      gateName: 'Entry Gate A',
      eventType: 'entry',
      plate: 'OR-9FD-442',
      bayId: 'P1-17',
      message: 'Smart-allocated sedan to Level P1 Standard bay P1-17',
    },
    {
      id: 'evt-seed-2',
      timestamp: minsAgo(18),
      gateName: 'Exit Gate A',
      eventType: 'exit',
      plate: 'CA-4RT-112',
      bayId: 'P1-12',
      message: 'Settled $16.28 via Card / Tap · Receipt RCP-04021',
    },
    {
      id: 'evt-seed-3',
      timestamp: minsAgo(29),
      gateName: 'Entry Gate A',
      eventType: 'entry',
      plate: 'CA-7KM-530',
      bayId: 'P1-11',
      message: 'Checked in sedan to P1-11 via LPR entry capture',
    },
    {
      id: 'evt-seed-4',
      timestamp: minsAgo(35),
      gateName: 'EV Zone Gate',
      eventType: 'exit',
      plate: 'CA-9EV-310',
      bayId: 'P1-03',
      message: 'EV session completed (22.5 kWh) · Receipt RCP-04022',
    },
    {
      id: 'evt-seed-5',
      timestamp: minsAgo(45),
      gateName: 'Entry Gate B',
      eventType: 'reservation_hold',
      plate: 'WA-5HY-210',
      bayId: 'P2-07',
      message: 'Bay P2-07 locked for upcoming 5h commuter reservation',
    },
    {
      id: 'evt-seed-6',
      timestamp: minsAgo(54),
      gateName: 'EV Zone Gate',
      eventType: 'entry',
      plate: 'CA-9TR-811',
      bayId: 'P1-02',
      message: 'EV fast-charge initiated at 50kW pedestal P1-02',
    },
  ];

  return {
    facilityName: 'MetroBay Central Deck',
    bays,
    activeSessions,
    reservations,
    transactions,
    gateEvents,
    tariffs: { ...DEFAULT_TARIFFS },
    updatedAt: new Date(now).toISOString(),
  };
}

function loadStore(): FacilityState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as FacilityState;
      if (parsed && Array.isArray(parsed.bays) && parsed.bays.length === 72) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read parking-store.json, seeding fresh store:', err);
  }
  const initial = createSeedState();
  saveStore(initial);
  return initial;
}

function saveStore(state: FacilityState): void {
  state.updatedAt = new Date().toISOString();
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmpPath, STORE_PATH);
}

let store: FacilityState = loadStore();

function appendGateEvent(event: Omit<GateEvent, 'id' | 'timestamp'>): void {
  store.gateEvents.unshift({
    id: makeId('evt'),
    timestamp: new Date().toISOString(),
    ...event,
  });
  if (store.gateEvents.length > 80) {
    store.gateEvents = store.gateEvents.slice(0, 80);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, facility: store.facilityName });
  });

  // Get complete facility state
  app.get('/api/parking/state', (_req, res) => {
    res.json(store);
  });

  // Check in a vehicle
  app.post('/api/parking/checkin', (req, res) => {
    const body = req.body as {
      plate?: string;
      vehicleClass?: VehicleClass;
      driverName?: string;
      driverPhone?: string;
      passType?: ActiveSession['passType'];
      bayId?: string;
      autoAssign?: boolean;
      preferredFloor?: FloorId;
      reservationId?: string;
      notes?: string;
    };

    const plate = normalizePlate(body.plate ?? '');
    if (!plate || plate.length < 3) {
      res.status(400).json({ error: 'Please enter a valid license plate (at least 3 characters).' });
      return;
    }

    // Prevent duplicate active session for the same plate
    const duplicate = store.activeSessions.find((s) => s.plate === plate);
    if (duplicate) {
      res.status(409).json({
        error: `Vehicle ${plate} is already parked in bay ${duplicate.bayId}.`,
      });
      return;
    }

    const vehicleClass: VehicleClass = body.vehicleClass ?? 'sedan';
    let targetBay: ParkingBay | undefined;
    let matchedReservation: Reservation | undefined;

    if (body.reservationId) {
      matchedReservation = store.reservations.find(
        (r) => r.id === body.reservationId && (r.status === 'held' || r.status === 'upcoming')
      );
      if (!matchedReservation) {
        res.status(404).json({ error: 'Active reservation not found.' });
        return;
      }
      targetBay = store.bays.find((b) => b.id === matchedReservation!.bayId);
      if (!targetBay || targetBay.status === 'occupied' || targetBay.status === 'maintenance') {
        res.status(409).json({ error: `Reserved bay ${matchedReservation.bayId} is unavailable.` });
        return;
      }
    } else if (body.bayId && !body.autoAssign) {
      targetBay = store.bays.find((b) => b.id === body.bayId);
      if (!targetBay) {
        res.status(404).json({ error: `Bay ${body.bayId} does not exist.` });
        return;
      }
      if (targetBay.status !== 'available') {
        res.status(409).json({
          error: `Bay ${targetBay.id} is currently ${targetBay.status}.`,
        });
        return;
      }
      if (!isVehicleCompatibleWithBay(vehicleClass, targetBay.category)) {
        res.status(400).json({
          error: `SUV/Truck vehicles cannot fit inside Compact bay ${targetBay.id}.`,
        });
        return;
      }
    } else {
      const rec = recommendBestBay(store.bays, vehicleClass, body.preferredFloor);
      if (!rec) {
        res.status(409).json({
          error: 'No compatible parking bays are currently available.',
        });
        return;
      }
      targetBay = store.bays.find((b) => b.id === rec.bay.id);
    }

    if (!targetBay) {
      res.status(404).json({ error: 'Unable to resolve target parking bay.' });
      return;
    }

    targetBay.status = 'occupied';
    targetBay.evChargingActive = targetBay.category === 'ev';

    if (matchedReservation) {
      matchedReservation.status = 'checked_in';
    }

    const session: ActiveSession = {
      id: makeId('ses'),
      bayId: targetBay.id,
      floor: targetBay.floor,
      plate,
      vehicleClass,
      driverName: (body.driverName ?? '').trim() || 'Walk-in Driver',
      driverPhone: (body.driverPhone ?? '').trim(),
      passType: matchedReservation ? 'reservation' : (body.passType ?? 'hourly'),
      entryTime: new Date().toISOString(),
      evStartKwh: 0,
      evKwhDelivered: 0,
      notes: body.notes?.trim(),
      reservationId: matchedReservation?.id,
    };

    store.activeSessions.unshift(session);

    appendGateEvent({
      gateName: targetBay.category === 'ev' ? 'EV Zone Gate' : 'Entry Gate A',
      eventType: 'entry',
      plate,
      bayId: targetBay.id,
      message: matchedReservation
        ? `Reservation arrived · Checked into ${targetBay.id}`
        : `Assigned ${vehicleClass.toUpperCase()} to ${targetBay.id} (${targetBay.floor})`,
    });

    saveStore(store);
    res.status(201).json({ session, bay: targetBay, state: store });
  });

  // Check out an active session and settle payment
  app.post('/api/parking/checkout', (req, res) => {
    const body = req.body as {
      sessionId?: string;
      bayId?: string;
      plate?: string;
      paymentMethod?: PaymentMethod;
      discountCode?: string;
      customDiscountAmount?: number;
      evKwhOverride?: number;
    };

    const normalized = body.plate ? normalizePlate(body.plate) : '';
    const sessionIdx = store.activeSessions.findIndex(
      (s) =>
        (body.sessionId && s.id === body.sessionId) ||
        (body.bayId && s.bayId === body.bayId) ||
        (normalized && s.plate === normalized)
    );

    if (sessionIdx === -1) {
      res.status(404).json({ error: 'Active parking session not found.' });
      return;
    }

    const session = store.activeSessions[sessionIdx];
    const bay = store.bays.find((b) => b.id === session.bayId);
    if (!bay) {
      res.status(404).json({ error: 'Assigned bay record not found.' });
      return;
    }

    const evKwh =
      typeof body.evKwhOverride === 'number' && body.evKwhOverride >= 0
        ? body.evKwhOverride
        : session.evKwhDelivered;

    const exitTime = new Date().toISOString();
    const breakdown = calculateFeeBreakdown({
      entryTimeIso: session.entryTime,
      exitTimeIso: exitTime,
      bayCategory: bay.category,
      vehicleClass: session.vehicleClass,
      passType: session.passType,
      evKwhDelivered: evKwh,
      discountCode: body.discountCode,
      customDiscountAmount: body.customDiscountAmount,
      tariffs: store.tariffs,
    });

    const nextReceiptNum = 4021 + store.transactions.length;
    const transaction: Transaction = {
      id: makeId('tx'),
      receiptNumber: `RCP-${String(nextReceiptNum).padStart(5, '0')}`,
      sessionId: session.id,
      bayId: bay.id,
      floor: bay.floor,
      plate: session.plate,
      vehicleClass: session.vehicleClass,
      driverName: session.driverName,
      entryTime: session.entryTime,
      exitTime,
      elapsedMinutes: breakdown.elapsedMinutes,
      billableHours: breakdown.billableHours,
      parkingFee: breakdown.parkingFee,
      evEnergyFee: breakdown.evEnergyFee,
      evKwhDelivered: evKwh,
      discountCode: (body.discountCode ?? '').trim().toUpperCase(),
      discountAmount: breakdown.discountAmount,
      taxAmount: breakdown.taxAmount,
      totalAmount: breakdown.totalAmount,
      paymentMethod: body.paymentMethod ?? 'card',
    };

    // Release bay & remove active session
    store.activeSessions.splice(sessionIdx, 1);
    bay.status = 'available';
    bay.evChargingActive = false;

    // If there is another held reservation specifically waiting on this bay, keep available unless explicitly held
    store.transactions.unshift(transaction);

    appendGateEvent({
      gateName: bay.category === 'ev' ? 'EV Zone Gate' : 'Exit Gate A',
      eventType: 'exit',
      plate: session.plate,
      bayId: bay.id,
      message: `Settled $${transaction.totalAmount.toFixed(2)} via ${transaction.paymentMethod.toUpperCase()} · ${transaction.receiptNumber}`,
    });

    saveStore(store);
    res.json({ transaction, state: store });
  });

  // Relocate active vehicle to another available bay
  app.post('/api/parking/relocate', (req, res) => {
    const body = req.body as { sessionId?: string; targetBayId?: string };
    const session = store.activeSessions.find((s) => s.id === body.sessionId);
    if (!session) {
      res.status(404).json({ error: 'Active session not found.' });
      return;
    }

    const oldBay = store.bays.find((b) => b.id === session.bayId);
    const newBay = store.bays.find((b) => b.id === body.targetBayId);
    if (!oldBay || !newBay) {
      res.status(404).json({ error: 'Target bay not found.' });
      return;
    }
    if (newBay.status !== 'available') {
      res.status(409).json({ error: `Target bay ${newBay.id} is ${newBay.status}.` });
      return;
    }
    if (!isVehicleCompatibleWithBay(session.vehicleClass, newBay.category)) {
      res.status(400).json({ error: `${session.vehicleClass} cannot fit in ${newBay.id}.` });
      return;
    }

    oldBay.status = 'available';
    oldBay.evChargingActive = false;

    newBay.status = 'occupied';
    newBay.evChargingActive = newBay.category === 'ev';

    session.bayId = newBay.id;
    session.floor = newBay.floor;

    appendGateEvent({
      gateName: 'Entry Gate B',
      eventType: 'relocation',
      plate: session.plate,
      bayId: newBay.id,
      message: `Relocated ${session.plate} from ${oldBay.id} to ${newBay.id}`,
    });

    saveStore(store);
    res.json({ session, state: store });
  });

  // Update bay maintenance state or EV charging telemetry
  app.patch('/api/parking/bays/:bayId', (req, res) => {
    const bay = store.bays.find((b) => b.id === req.params.bayId);
    if (!bay) {
      res.status(404).json({ error: 'Parking bay not found.' });
      return;
    }

    const body = req.body as {
      action?: 'set_maintenance' | 'restore_service' | 'toggle_ev_charge' | 'add_ev_kwh';
      maintenanceNote?: string;
      kwhDelta?: number;
    };

    if (body.action === 'set_maintenance') {
      if (bay.status === 'occupied') {
        res.status(409).json({ error: 'Cannot lock an occupied bay. Check out or relocate vehicle first.' });
        return;
      }
      bay.status = 'maintenance';
      bay.maintenanceNote = body.maintenanceNote?.trim() || 'Scheduled sensor & surface inspection';
      bay.evChargingActive = false;
      appendGateEvent({
        gateName: 'Entry Gate B',
        eventType: 'maintenance',
        plate: 'FACILITY',
        bayId: bay.id,
        message: `Locked bay ${bay.id} for maintenance: ${bay.maintenanceNote}`,
      });
    } else if (body.action === 'restore_service') {
      if (bay.status !== 'maintenance') {
        res.status(400).json({ error: 'Bay is not currently in maintenance.' });
        return;
      }
      bay.status = 'available';
      bay.maintenanceNote = undefined;
      appendGateEvent({
        gateName: 'Entry Gate B',
        eventType: 'maintenance',
        plate: 'FACILITY',
        bayId: bay.id,
        message: `Restored bay ${bay.id} to active service`,
      });
    } else if (body.action === 'toggle_ev_charge') {
      if (bay.category !== 'ev' || bay.status !== 'occupied') {
        res.status(400).json({ error: 'Bay must be an occupied EV bay to toggle charging.' });
        return;
      }
      bay.evChargingActive = !bay.evChargingActive;
      if (bay.evChargingActive) {
        const session = store.activeSessions.find((s) => s.bayId === bay.id);
        if (session) {
          session.evKwhDelivered = Number((session.evKwhDelivered + 2.4).toFixed(1));
        }
      }
    } else if (body.action === 'add_ev_kwh') {
      const session = store.activeSessions.find((s) => s.bayId === bay.id);
      if (!session) {
        res.status(404).json({ error: 'No active session in bay.' });
        return;
      }
      const delta = Number(body.kwhDelta ?? 5);
      session.evKwhDelivered = Number(Math.max(0, session.evKwhDelivered + delta).toFixed(1));
    } else {
      res.status(400).json({ error: 'Unsupported bay action.' });
      return;
    }

    saveStore(store);
    res.json({ bay, state: store });
  });

  // Create reservation
  app.post('/api/parking/reservations', (req, res) => {
    const body = req.body as {
      plate?: string;
      vehicleClass?: VehicleClass;
      driverName?: string;
      driverPhone?: string;
      bayId?: string;
      startTime?: string;
      durationHours?: number;
    };

    const plate = normalizePlate(body.plate ?? '');
    if (!plate || plate.length < 3) {
      res.status(400).json({ error: 'Valid license plate is required.' });
      return;
    }

    const vehicleClass: VehicleClass = body.vehicleClass ?? 'sedan';
    let targetBay: ParkingBay | undefined;

    if (body.bayId) {
      targetBay = store.bays.find((b) => b.id === body.bayId);
      if (!targetBay) {
        res.status(404).json({ error: `Bay ${body.bayId} not found.` });
        return;
      }
      if (targetBay.status !== 'available') {
        res.status(409).json({ error: `Bay ${targetBay.id} is currently ${targetBay.status}.` });
        return;
      }
      if (!isVehicleCompatibleWithBay(vehicleClass, targetBay.category)) {
        res.status(400).json({ error: `Bay ${targetBay.id} is not compatible with ${vehicleClass}.` });
        return;
      }
    } else {
      const rec = recommendBestBay(store.bays, vehicleClass);
      if (!rec) {
        res.status(409).json({ error: 'No compatible bays available to reserve.' });
        return;
      }
      targetBay = store.bays.find((b) => b.id === rec.bay.id);
    }

    if (!targetBay) {
      res.status(404).json({ error: 'Target bay unavailable.' });
      return;
    }

    targetBay.status = 'reserved';
    const reservation: Reservation = {
      id: makeId('res'),
      bayId: targetBay.id,
      floor: targetBay.floor,
      plate,
      vehicleClass,
      driverName: (body.driverName ?? '').trim() || 'Reserved Guest',
      driverPhone: (body.driverPhone ?? '').trim(),
      startTime: body.startTime || new Date(Date.now() + 30 * 60000).toISOString(),
      durationHours: Math.max(1, Math.min(48, Number(body.durationHours ?? 3))),
      status: 'held',
      createdAt: new Date().toISOString(),
    };

    store.reservations.unshift(reservation);

    appendGateEvent({
      gateName: 'Entry Gate B',
      eventType: 'reservation_hold',
      plate,
      bayId: targetBay.id,
      message: `Reserved bay ${targetBay.id} for ${reservation.driverName} (${reservation.durationHours}h)`,
    });

    saveStore(store);
    res.status(201).json({ reservation, state: store });
  });

  // Cancel reservation
  app.delete('/api/parking/reservations/:id', (req, res) => {
    const reservation = store.reservations.find((r) => r.id === req.params.id);
    if (!reservation) {
      res.status(404).json({ error: 'Reservation not found.' });
      return;
    }

    reservation.status = 'cancelled';
    const bay = store.bays.find((b) => b.id === reservation.bayId);
    if (bay && bay.status === 'reserved') {
      bay.status = 'available';
    }

    appendGateEvent({
      gateName: 'Entry Gate B',
      eventType: 'reservation_hold',
      plate: reservation.plate,
      bayId: reservation.bayId,
      message: `Cancelled reservation hold on bay ${reservation.bayId}`,
    });

    saveStore(store);
    res.json({ ok: true, state: store });
  });

  // Update tariff rules
  app.patch('/api/parking/tariffs', (req, res) => {
    const body = req.body as Partial<TariffConfig>;
    const clampPositive = (val: unknown, fallback: number, min = 0, max = 500) => {
      const n = Number(val);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, Number(n.toFixed(2)))) : fallback;
    };

    store.tariffs = {
      currencySymbol: body.currencySymbol || store.tariffs.currencySymbol,
      standardHourlyRate: clampPositive(body.standardHourlyRate, store.tariffs.standardHourlyRate, 0.5),
      evHourlyRate: clampPositive(body.evHourlyRate, store.tariffs.evHourlyRate, 0.5),
      suvHourlyRate: clampPositive(body.suvHourlyRate, store.tariffs.suvHourlyRate, 0.5),
      compactHourlyRate: clampPositive(body.compactHourlyRate, store.tariffs.compactHourlyRate, 0.5),
      accessibleHourlyRate: clampPositive(body.accessibleHourlyRate, store.tariffs.accessibleHourlyRate, 0.5),
      valetHourlyRate: clampPositive(body.valetHourlyRate, store.tariffs.valetHourlyRate, 0.5),
      gracePeriodMinutes: Math.round(clampPositive(body.gracePeriodMinutes, store.tariffs.gracePeriodMinutes, 0, 120)),
      dailyMaxCap: clampPositive(body.dailyMaxCap, store.tariffs.dailyMaxCap, 5, 1000),
      evRatePerKwh: clampPositive(body.evRatePerKwh, store.tariffs.evRatePerKwh, 0, 10),
      taxPercent: clampPositive(body.taxPercent, store.tariffs.taxPercent, 0, 40),
    };

    saveStore(store);
    res.json({ tariffs: store.tariffs, state: store });
  });

  // Trigger gate barrier test or simulated entry
  app.post('/api/parking/gate/simulate', (req, res) => {
    const body = req.body as {
      action?: 'barrier_test' | 'simulate_entry';
      gateName?: GateEvent['gateName'];
    };

    const gateName = body.gateName ?? 'Entry Gate A';

    if (body.action === 'simulate_entry') {
      const classes: VehicleClass[] = ['sedan', 'ev', 'suv', 'sedan', 'motorcycle'];
      const chosenClass = classes[Math.floor(Math.random() * classes.length)];
      const rec = recommendBestBay(store.bays, chosenClass);
      if (!rec) {
        res.status(409).json({ error: 'Facility is full — no open bays for simulated arrival.' });
        return;
      }
      const platePrefix = ['CA', 'WA', 'NV', 'OR', 'TX'][Math.floor(Math.random() * 5)];
      const plate = `${platePrefix}-${Math.floor(1 + Math.random() * 9)}${String.fromCharCode(
        65 + Math.floor(Math.random() * 26)
      )}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}-${Math.floor(
        100 + Math.random() * 899
      )}`;

      const bay = store.bays.find((b) => b.id === rec.bay.id)!;
      bay.status = 'occupied';
      bay.evChargingActive = bay.category === 'ev';

      const session: ActiveSession = {
        id: makeId('ses'),
        bayId: bay.id,
        floor: bay.floor,
        plate,
        vehicleClass: chosenClass,
        driverName: 'LPR Auto-Entry',
        driverPhone: '',
        passType: 'hourly',
        entryTime: new Date().toISOString(),
        evStartKwh: 0,
        evKwhDelivered: bay.category === 'ev' ? 0.5 : 0,
      };
      store.activeSessions.unshift(session);

      appendGateEvent({
        gateName,
        eventType: 'entry',
        plate,
        bayId: bay.id,
        message: `LPR entry captured · ${rec.reason}`,
      });
      saveStore(store);
      res.json({ session, state: store });
      return;
    }

    appendGateEvent({
      gateName,
      eventType: 'barrier_test',
      plate: 'TEST-CYCLE',
      bayId: 'GATE',
      message: `Manual barrier lift & inductive loop diagnostics verified on ${gateName}`,
    });
    saveStore(store);
    res.json({ ok: true, state: store });
  });

  // Reset seed baseline
  app.post('/api/parking/reset-demo', (_req, res) => {
    store = createSeedState();
    saveStore(store);
    res.json({ ok: true, state: store });
  });

  // Attach Vite middleware in development or serve built static files in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`MetroBay server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MetroBay server:', err);
  process.exit(1);
});
