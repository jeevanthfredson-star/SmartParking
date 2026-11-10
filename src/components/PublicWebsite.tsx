import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Clock,
  MapPin,
  QrCode,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import capabilityEvImg from '../assets/images/capability_ev_charging_1794317107050.jpg';
import capabilityLprImg from '../assets/images/capability_lpr_gate_1794317107599.jpg';
import heroGarageImg from '../assets/images/hero_smart_garage_1794317106114.jpg';
import {
  BAY_CATEGORY_LABELS,
  FLOOR_META,
  formatCurrency,
  getHourlyRateForBayAndVehicle,
  isVehicleCompatibleWithBay,
  normalizePlate,
  PROMO_CODES,
  recommendBestBay,
  VEHICLE_CLASS_LABELS,
} from '../shared/parkingTypes';
import type {
  FacilityState,
  FloorId,
  Reservation,
  VehicleClass,
} from '../shared/parkingTypes';

interface PublicWebsiteProps {
  state: FacilityState;
  onEnterOperatorConsole: (targetSection?: 'map' | 'reservations') => void;
  onCreateReservation: (params: {
    plate: string;
    vehicleClass: VehicleClass;
    driverName: string;
    driverPhone?: string;
    bayId?: string;
    startTime?: string;
    durationHours: number;
  }) => Promise<void>;
  onOpenTicketPass: (reservation: Reservation) => void;
  busy: boolean;
}

function SafeImage({
  src,
  alt,
  className,
  fallbackTitle,
}: {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`bg-gradient-to-br from-slate-800 via-slate-900 to-teal-950 text-white flex flex-col items-center justify-center p-6 text-center ${className ?? ''}`}
      >
        <MapPin className="h-8 w-8 text-teal-400 mb-2" />
        <div className="font-display font-semibold text-sm">{fallbackTitle}</div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function PublicWebsite({
  state,
  onEnterOperatorConsole,
  onCreateReservation,
  onOpenTicketPass,
  busy,
}: PublicWebsiteProps) {
  const [activeFloor, setActiveFloor] = useState<FloorId>('P1');
  const [selectedBayId, setSelectedBayId] = useState<string>('');
  const [plate, setPlate] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [vehicleClass, setVehicleClass] = useState<VehicleClass>('sedan');
  const [arrivalOffsetMins, setArrivalOffsetMins] = useState(30);
  const [durationHours, setDurationHours] = useState(3);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmedPlate, setConfirmedPlate] = useState<string | null>(null);

  const sym = state.tariffs.currencySymbol;
  const totalBays = state.bays.length;
  const availableBays = state.bays.filter((b) => b.status === 'available');
  const evAvailable = availableBays.filter((b) => b.category === 'ev').length;
  const evTotal = state.bays.filter((b) => b.category === 'ev').length;

  const availP1 = availableBays.filter((b) => b.floor === 'P1').length;
  const availP2 = availableBays.filter((b) => b.floor === 'P2').length;
  const availP3 = availableBays.filter((b) => b.floor === 'P3').length;

  const floorBays = useMemo(
    () => state.bays.filter((b) => b.floor === activeFloor),
    [state.bays, activeFloor]
  );

  const compatibleOpenBays = useMemo(
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

  const selectedBayObj = useMemo(() => {
    if (selectedBayId) {
      const b = state.bays.find((x) => x.id === selectedBayId);
      if (b && b.status === 'available') return b;
    }
    return recommended?.bay ?? null;
  }, [selectedBayId, state.bays, recommended]);

  const estimatedTotal = useMemo(() => {
    const cat = selectedBayObj?.category ?? 'standard';
    const hourly = getHourlyRateForBayAndVehicle(cat, vehicleClass, state.tariffs);
    const raw = hourly * durationHours;
    const capped = Math.min(raw, state.tariffs.dailyMaxCap * Math.max(1, Math.ceil(durationHours / 24)));
    return Number((capped * (1 + state.tariffs.taxPercent / 100)).toFixed(2));
  }, [selectedBayObj, vehicleClass, durationHours, state.tariffs]);

  const latestConfirmedReservation = useMemo(() => {
    if (!confirmedPlate) return null;
    return (
      state.reservations.find(
        (r) => r.plate === confirmedPlate && (r.status === 'held' || r.status === 'upcoming')
      ) ?? null
    );
  }, [confirmedPlate, state.reservations]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSelectFloorBay = (bayId: string) => {
    const bay = state.bays.find((b) => b.id === bayId);
    if (!bay || bay.status !== 'available') return;
    setSelectedBayId(bay.id);
    if (bay.category === 'ev') setVehicleClass('ev');
    else if (bay.category === 'accessible') setVehicleClass('accessible');
    else if (bay.category === 'suv') setVehicleClass('suv');
    else if (vehicleClass === 'suv' && bay.category === 'compact') setVehicleClass('sedan');
    setConfirmedPlate(null);
  };

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleanPlate = normalizePlate(plate);
    if (cleanPlate.length < 3) {
      setFormError('Enter a valid license plate (minimum 3 characters).');
      return;
    }
    if (!driverName.trim()) {
      setFormError('Please enter the driver name for the reservation hold.');
      return;
    }
    if (selectedBayId) {
      const b = state.bays.find((x) => x.id === selectedBayId);
      if (b && !isVehicleCompatibleWithBay(vehicleClass, b.category)) {
        setFormError(`SUV / Truck vehicles cannot reserve Compact bay ${b.id}.`);
        return;
      }
    }

    const startTime = new Date(Date.now() + arrivalOffsetMins * 60000).toISOString();
    try {
      await onCreateReservation({
        plate: cleanPlate,
        vehicleClass,
        driverName: driverName.trim(),
        driverPhone: driverPhone.trim(),
        bayId: selectedBayId || undefined,
        startTime,
        durationHours,
      });
      setConfirmedPlate(cleanPlate);
      setPlate('');
      setDriverName('');
      setDriverPhone('');
      setSelectedBayId('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to reserve bay.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-slate-900 flex flex-col">
      {/* Strict 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200 no-print">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="font-display font-bold text-xl tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            MetroBay
          </a>

          {/* Zone 2: Clean single-line text navigation */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => scrollToSection('availability')}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Availability
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('capabilities')}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('rates')}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Rates
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('book-bay')}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Book a Spot
            </button>
            <button
              type="button"
              onClick={() => onEnterOperatorConsole('map')}
              className="hover:text-teal-800 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Operator Console
            </button>
          </nav>

          {/* Zone 3: 1 primary CTA */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onEnterOperatorConsole('map')}
              className="md:hidden text-xs font-medium text-slate-700 hover:text-slate-900 whitespace-nowrap shrink-0"
            >
              Console
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('book-bay')}
              className="h-9 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              Reserve Bay
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1 no-print">
        {/* Hero Split + Live Capacity Strip */}
        <section className="max-w-[1240px] mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-10 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center py-2 space-y-5">
              <div className="text-xs font-medium text-slate-500">
                480 Market Plaza · 3 Underground Decks · Open 24/7
              </div>

              <h1
                className="font-display font-bold tracking-tight text-slate-900 leading-[1.08]"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', textWrap: 'balance' }}
              >
                Automated parking and EV charging without circling the block.
              </h1>

              <p className="text-base text-slate-600 leading-relaxed max-w-[60ch]">
                View real-time stall availability across 72 sensor-monitored bays, lock a compatible spot before you arrive, and drive straight through license plate recognition barriers.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={() => scrollToSection('book-bay')}
                  className="h-11 px-6 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  Reserve a Bay Now
                </button>
                <button
                  type="button"
                  onClick={() => onEnterOperatorConsole('map')}
                  className="h-11 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  Open Operator Console
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[280px] sm:min-h-[360px] rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
                <SafeImage
                  src={heroGarageImg}
                  alt="MetroBay automated smart parking facility entrance with LPR barrier gate"
                  fallbackTitle="MetroBay Central Deck · 480 Market Plaza"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Full-Width 4-Column Live Facility Strip */}
          <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            <div className="p-4 sm:p-5">
              <div className="text-xs font-medium text-slate-500">Live Open Bays</div>
              <div className="mt-1 text-2xl font-display font-bold text-teal-800 font-mono tabular-nums">
                {availableBays.length} / {totalBays}
              </div>
              <div className="mt-1 text-xs text-slate-600 font-mono tabular-nums">
                P1: {availP1} · P2: {availP2} · P3: {availP3}
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <div className="text-xs font-medium text-slate-500">EV Fast-Charge Bays</div>
              <div className="mt-1 text-2xl font-display font-bold text-slate-900 font-mono tabular-nums">
                {evAvailable} / {evTotal} open
              </div>
              <div className="mt-1 text-xs text-slate-600">
                22 kW & 50 kW pedestals on P1 & P2
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <div className="text-xs font-medium text-slate-500">Standard Hourly Rate</div>
              <div className="mt-1 text-2xl font-display font-bold text-slate-900 font-mono tabular-nums">
                {formatCurrency(state.tariffs.standardHourlyRate, sym)}/hr
              </div>
              <div className="mt-1 text-xs text-slate-600 tabular-nums">
                {state.tariffs.gracePeriodMinutes}-min grace · {formatCurrency(state.tariffs.dailyMaxCap, sym)} daily max
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <div className="text-xs font-medium text-slate-500">Entry & Exit Gates</div>
              <div className="mt-1 text-2xl font-display font-bold text-slate-900">
                24/7 LPR
              </div>
              <div className="mt-1 text-xs text-slate-600">
                Automatic plate recognition & QR pass
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Live Availability Explorer + Instant Driver Booking */}
        <section id="availability" className="max-w-[1240px] mx-auto px-4 sm:px-6 py-10 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-medium text-teal-800">Real-Time Deck Telemetry</div>
              <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-slate-900">
                Inspect Open Bays & Reserve Before Arrival
              </h2>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
              {(['P1', 'P2', 'P3'] as FloorId[]).map((fl) => {
                const openOnFloor = state.bays.filter(
                  (b) => b.floor === fl && b.status === 'available'
                ).length;
                return (
                  <button
                    key={fl}
                    type="button"
                    onClick={() => setActiveFloor(fl)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      activeFloor === fl
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {FLOOR_META[fl].label} ({openOnFloor} open)
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Live Floor Grid */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-display font-semibold text-base text-slate-900">
                    {FLOOR_META[activeFloor].label}
                  </h3>
                  <p className="text-xs text-slate-500">{FLOOR_META[activeFloor].subtitle}</p>
                </div>
                <div className="text-xs text-slate-500">
                  Click any open bay to select it for booking
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {floorBays.map((bay) => {
                  const isOpen = bay.status === 'available';
                  const isSelected = selectedBayId === bay.id;
                  return (
                    <button
                      key={bay.id}
                      type="button"
                      disabled={!isOpen}
                      onClick={() => handleSelectFloorBay(bay.id)}
                      className={`p-2.5 rounded-lg border text-left transition-all min-h-[72px] flex flex-col justify-between ${
                        isSelected
                          ? 'bg-teal-700 border-teal-700 text-white ring-2 ring-teal-700 ring-offset-1'
                          : isOpen
                          ? 'bg-teal-50/45 border-teal-200 hover:border-teal-600 text-slate-900'
                          : bay.status === 'reserved'
                          ? 'bg-amber-50/70 border-amber-200 text-amber-900 opacity-75 cursor-not-allowed'
                          : bay.status === 'maintenance'
                          ? 'bay-hatch bg-red-50/50 border-red-200 text-red-800 opacity-75 cursor-not-allowed'
                          : 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-xs font-semibold tabular-nums">
                          {bay.id}
                        </span>
                        {bay.category === 'ev' && (
                          <Zap
                            className={`h-3 w-3 ${
                              isSelected ? 'text-white' : 'text-cyan-700'
                            }`}
                          />
                        )}
                      </div>
                      <div className="text-[11px] font-medium mt-1">
                        {isSelected
                          ? 'Selected'
                          : isOpen
                          ? BAY_CATEGORY_LABELS[bay.category]
                          : bay.status === 'reserved'
                          ? 'Held'
                          : bay.status === 'maintenance'
                          ? 'Blocked'
                          : 'Occupied'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Instant Reservation Form */}
            <div
              id="book-bay"
              className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
            >
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-display font-semibold text-base text-slate-900">
                    Reserve a Guaranteed Bay
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Instant confirmation synced with entry gates
                  </p>
                </div>
                <CalendarCheck className="h-5 w-5 text-teal-700 shrink-0" />
              </div>

              {latestConfirmedReservation && (
                <div className="p-4 rounded-lg bg-teal-50 border border-teal-200 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-teal-950">
                    <CheckCircle2 className="h-4 w-4 text-teal-700 shrink-0" />
                    <span>
                      Bay {latestConfirmedReservation.bayId} Held for {latestConfirmedReservation.plate}
                    </span>
                  </div>
                  <p className="text-xs text-teal-900">
                    Your stall is locked on {FLOOR_META[latestConfirmedReservation.floor].label}. Present your plate at Entry Gate A or scan your pass.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenTicketPass(latestConfirmedReservation)}
                      className="h-8 px-3 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium inline-flex items-center gap-1.5"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      <span>Open Gate Pass</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEnterOperatorConsole('reservations')}
                      className="h-8 px-3 rounded-lg border border-teal-300 bg-white text-teal-900 text-xs font-medium hover:bg-teal-50"
                    >
                      View in Console
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleBookSubmit} className="space-y-3.5">
                {formError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="web-plate" className="block text-xs font-medium text-slate-700 mb-1">
                      License Plate
                    </label>
                    <input
                      id="web-plate"
                      type="text"
                      required
                      value={plate}
                      onChange={(e) => setPlate(e.target.value.toUpperCase())}
                      placeholder="CA-9EV-204"
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono text-sm uppercase focus:outline-none focus:border-teal-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="web-class" className="block text-xs font-medium text-slate-700 mb-1">
                      Vehicle Type
                    </label>
                    <select
                      id="web-class"
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
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="web-name" className="block text-xs font-medium text-slate-700 mb-1">
                      Driver Name
                    </label>
                    <input
                      id="web-name"
                      type="text"
                      required
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      placeholder="Alex Morgan"
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-teal-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="web-phone" className="block text-xs font-medium text-slate-700 mb-1">
                      Mobile Number
                    </label>
                    <input
                      id="web-phone"
                      type="tel"
                      value={driverPhone}
                      onChange={(e) => setDriverPhone(e.target.value)}
                      placeholder="+1 415-555-0190"
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-teal-700"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="web-bay" className="block text-xs font-medium text-slate-700 mb-1">
                    Bay Assignment
                  </label>
                  <select
                    id="web-bay"
                    value={selectedBayId}
                    onChange={(e) => setSelectedBayId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-teal-700"
                  >
                    <option value="">
                      Smart Auto-Assign ({recommended ? `${recommended.bay.id} · ${BAY_CATEGORY_LABELS[recommended.bay.category]}` : 'Full'})
                    </option>
                    {compatibleOpenBays.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.id} · {FLOOR_META[b.floor].label} · {BAY_CATEGORY_LABELS[b.category]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="web-eta" className="block text-xs font-medium text-slate-700 mb-1">
                      Arrival Window
                    </label>
                    <select
                      id="web-eta"
                      value={arrivalOffsetMins}
                      onChange={(e) => setArrivalOffsetMins(Number(e.target.value))}
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-teal-700"
                    >
                      <option value={15}>Within 15 mins</option>
                      <option value={30}>Within 30 mins</option>
                      <option value={60}>In 1 hour</option>
                      <option value={120}>In 2 hours</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="web-dur" className="block text-xs font-medium text-slate-700 mb-1">
                      Stay Duration (Hours)
                    </label>
                    <input
                      id="web-dur"
                      type="number"
                      min={1}
                      max={48}
                      value={durationHours}
                      onChange={(e) => setDurationHours(Math.max(1, Number(e.target.value)))}
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 font-mono text-sm tabular-nums focus:outline-none focus:border-teal-700"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-600">
                    Estimated Stay Total (incl. tax)
                  </span>
                  <span className="font-mono font-bold text-sm text-slate-900 tabular-nums">
                    {formatCurrency(estimatedTotal, sym)}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={busy || (!selectedBayId && !recommended)}
                  className="w-full h-10 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  {busy ? 'Confirming Hold...' : 'Confirm Bay Reservation'}
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Section 3: Asymmetric Capabilities Bento */}
        <section id="capabilities" className="max-w-[1240px] mx-auto px-4 sm:px-6 py-10 space-y-6">
          <div className="space-y-1 max-w-2xl">
            <div className="text-xs font-medium text-teal-800">Facility Architecture</div>
            <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-slate-900">
              Built for Fast Turnaround and Transparent Metering
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Marquee 2-col capability card */}
            <article className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
              <div className="min-h-[220px] bg-slate-900">
                <SafeImage
                  src={capabilityLprImg}
                  alt="Overhead LPR camera gantry and green open bay guidance signs"
                  fallbackTitle="Automated LPR Entry & Guidance"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <h3 className="font-display font-semibold text-lg text-slate-900">
                    01. Automated LPR Entry & Dynamic Wayfinding
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    High-speed overhead optical scanners verify your license plate at the entry barrier and route sedans, SUVs, motorcycles, and accessible vehicles directly to the closest compatible bay.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 flex items-center gap-4 font-mono tabular-nums">
                  <span className="text-slate-900 font-semibold">Under 3s gate cycle</span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span>Zero paper tickets required</span>
                </div>
              </div>
            </article>

            {/* Capability 02 */}
            <article className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
              <div className="h-44 bg-slate-900">
                <SafeImage
                  src={capabilityEvImg}
                  alt="Electric vehicle connected to 50kW brushed steel charging pedestal"
                  fallbackTitle="50kW EV Fast-Charge Bays"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <h3 className="font-display font-semibold text-base text-slate-900">
                    02. 50 kW EV Fast-Charge Pedestals
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Dedicated charging bays on Levels P1 and P2 bill energy strictly per delivered kilowatt-hour alongside parking duration.
                  </p>
                </div>
                <div className="text-xs font-mono text-teal-800 font-semibold tabular-nums">
                  {formatCurrency(state.tariffs.evRatePerKwh, sym)}/kWh metered energy
                </div>
              </div>
            </article>

            {/* Capability 03 */}
            <article className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5">
              <Sparkles className="h-5 w-5 text-teal-700" />
              <h3 className="font-display font-semibold text-base text-slate-900">
                03. Vehicle-Size & Clearance Protection
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Oversized SUVs and trucks are automatically routed away from narrow compact lanes onto wide-clearance Level P3 stalls, while accessible permits prioritize lift-adjacent P1 bays.
              </p>
            </article>

            {/* Capability 04 */}
            <article className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5">
              <Clock className="h-5 w-5 text-teal-700" />
              <h3 className="font-display font-semibold text-base text-slate-900">
                04. {state.tariffs.gracePeriodMinutes}-Minute Grace Period & Daily Cap
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Quick drop-offs exit free within {state.tariffs.gracePeriodMinutes} minutes. Extended stays automatically cap at {formatCurrency(state.tariffs.dailyMaxCap, sym)} per 24-hour cycle with instant tap-to-pay exit settlement.
              </p>
            </article>

            {/* Capability 05 */}
            <article className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5">
              <ShieldCheck className="h-5 w-5 text-teal-700" />
              <h3 className="font-display font-semibold text-base text-slate-900">
                05. Integrated Facility Operations Console
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Facility attendants can inspect live occupancy, relocate parked cars, adjust hourly tariffs, and export settled CSV ledgers directly from the connected console.
              </p>
              <button
                type="button"
                onClick={() => onEnterOperatorConsole('map')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:underline pt-1"
              >
                <span>Launch Operator Console</span>
                <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
              </button>
            </article>
          </div>
        </section>

        {/* Section 4: Transparent Rates & Validations */}
        <section id="rates" className="max-w-[1240px] mx-auto px-4 sm:px-6 py-10 space-y-6">
          <div className="space-y-1">
            <div className="text-xs font-medium text-teal-800">Live Published Tariffs</div>
            <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-slate-900">
              Clear Hourly Rates & Merchant Validations
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div>
                <div className="text-xs font-medium text-slate-500">Commuter & Compact</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-3xl font-display font-bold text-slate-900 font-mono tabular-nums">
                    {formatCurrency(state.tariffs.standardHourlyRate, sym)}
                  </span>
                  <span className="text-xs text-slate-500">/ hour standard</span>
                </div>
              </div>
              <div className="space-y-2 pt-3 border-t border-slate-100 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Compact / Motorcycle Bay</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(state.tariffs.compactHourlyRate, sym)}/hr
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Accessible ADA Bay</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(state.tariffs.accessibleHourlyRate, sym)}/hr
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>24-Hour Maximum Cap</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(state.tariffs.dailyMaxCap, sym)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-teal-700 rounded-xl p-6 space-y-4">
              <div>
                <div className="text-xs font-medium text-teal-800">EV Fast-Charge Hub</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-3xl font-display font-bold text-slate-900 font-mono tabular-nums">
                    {formatCurrency(state.tariffs.evHourlyRate, sym)}
                  </span>
                  <span className="text-xs text-slate-500">/ hour + energy</span>
                </div>
              </div>
              <div className="space-y-2 pt-3 border-t border-slate-100 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Metered EV Energy</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(state.tariffs.evRatePerKwh, sym)}/kWh
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Charging Power</span>
                  <span className="font-mono font-semibold text-slate-900">22 kW / 50 kW</span>
                </div>
                <div className="flex justify-between">
                  <span>Promo Code EVFREE</span>
                  <span className="font-mono font-semibold text-teal-800">Waives EV fee</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div>
                <div className="text-xs font-medium text-slate-500">Oversized & Valet Deck</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-3xl font-display font-bold text-slate-900 font-mono tabular-nums">
                    {formatCurrency(state.tariffs.valetHourlyRate, sym)}
                  </span>
                  <span className="text-xs text-slate-500">/ hour valet</span>
                </div>
              </div>
              <div className="space-y-2 pt-3 border-t border-slate-100 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Wide SUV / Truck Bay</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(state.tariffs.suvHourlyRate, sym)}/hr
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Retail Validation ({Object.keys(PROMO_CODES)[0]})</span>
                  <span className="font-mono font-semibold text-slate-900">$10.00 off</span>
                </div>
                <div className="flex justify-between">
                  <span>Grace Period</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {state.tariffs.gracePeriodMinutes} mins free
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Institutional Footer */}
      <footer className="bg-white border-t border-slate-200 mt-8 no-print">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="font-display font-bold text-base text-slate-900">MetroBay</div>
            <div className="text-xs text-slate-500">
              480 Market Plaza · 72 Sensor Bays · Open 24 Hours Daily
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-600">
            <button type="button" onClick={() => scrollToSection('availability')} className="hover:text-slate-900">
              Availability
            </button>
            <button type="button" onClick={() => scrollToSection('capabilities')} className="hover:text-slate-900">
              Capabilities
            </button>
            <button type="button" onClick={() => scrollToSection('rates')} className="hover:text-slate-900">
              Rates
            </button>
            <button type="button" onClick={() => scrollToSection('book-bay')} className="hover:text-slate-900">
              Book a Spot
            </button>
            <button
              type="button"
              onClick={() => onEnterOperatorConsole('map')}
              className="text-teal-800 hover:underline font-semibold"
            >
              Operator Console
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
