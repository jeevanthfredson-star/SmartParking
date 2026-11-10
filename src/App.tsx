/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useState } from 'react';
import { ActiveSessionsView } from './components/ActiveSessionsView';
import { AnalyticsView } from './components/AnalyticsView';
import { BayMapView } from './components/BayMapView';
import { CheckInModal } from './components/CheckInModal';
import { CheckOutModal } from './components/CheckOutModal';
import { FacilityKPIStrip } from './components/FacilityKPIStrip';
import { PublicWebsite } from './components/PublicWebsite';
import { ReservationsView } from './components/ReservationsView';
import { Sidebar } from './components/Sidebar';
import type { NavSection } from './components/Sidebar';
import { TariffsAndGatesView } from './components/TariffsAndGatesView';
import { TicketPassModal } from './components/TicketPassModal';
import { TopBar } from './components/TopBar';
import { useParkingStore } from './hooks/useParkingStore';
import type { ActiveSession, Reservation } from './shared/parkingTypes';

export default function App() {
  const {
    state,
    loading,
    busy,
    error,
    nowMs,
    toasts,
    dismissToast,
    refresh,
    checkIn,
    checkOut,
    relocateVehicle,
    updateBay,
    createReservation,
    cancelReservation,
    updateTariffs,
    simulateGate,
    resetDemo,
  } = useParkingStore();

  const [viewMode, setViewMode] = useState<'website' | 'console'>('website');
  const [activeSection, setActiveSection] = useState<NavSection>('map');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBayId, setSelectedBayId] = useState<string | null>('P1-01');

  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInInitialBayId, setCheckInInitialBayId] = useState<string | null>(null);

  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [checkOutInitialSession, setCheckOutInitialSession] = useState<ActiveSession | null>(null);

  const [reserveInitialBayId, setReserveInitialBayId] = useState<string | null>(null);

  const [ticketPassTarget, setTicketPassTarget] = useState<{
    session?: ActiveSession | null;
    reservation?: Reservation | null;
  } | null>(null);

  const openCheckIn = (bayId: string | null = null) => {
    setCheckInInitialBayId(bayId);
    setCheckInOpen(true);
  };

  const openCheckOut = (session: ActiveSession | null = null) => {
    setCheckOutInitialSession(session);
    setCheckOutOpen(true);
  };

  const handleOpenReserveForBay = (bayId: string) => {
    setReserveInitialBayId(bayId);
    setActiveSection('reservations');
  };

  const handleConvertReservation = async (reservation: Reservation) => {
    await checkIn({
      plate: reservation.plate,
      vehicleClass: reservation.vehicleClass,
      driverName: reservation.driverName,
      driverPhone: reservation.driverPhone,
      reservationId: reservation.id,
    });
    setSelectedBayId(reservation.bayId);
  };

  const handleInspectBayFromSessions = (bayId: string) => {
    setSelectedBayId(bayId);
    setActiveSection('map');
  };

  const handleEnterConsole = (targetSection: NavSection = 'map') => {
    setActiveSection(targetSection);
    setViewMode('console');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderLoadingOrError = () => {
    if (loading && !state) {
      return (
        <div className="min-h-screen bg-[#F4F6F8] p-6 max-w-[1240px] mx-auto space-y-6" aria-busy="true">
          <div className="h-16 bg-white border border-slate-200 rounded-xl animate-pulse" />
          <div className="h-80 bg-white border border-slate-200 rounded-xl animate-pulse" />
        </div>
      );
    }
    if (error && !state) {
      return (
        <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center p-6">
          <div className="bg-white border border-red-200 rounded-xl p-8 text-center max-w-md w-full space-y-3">
            <AlertCircle className="h-7 w-7 text-red-700 mx-auto" />
            <div className="font-display font-semibold text-base text-slate-900">
              Unable to load MetroBay facility
            </div>
            <p className="text-xs text-slate-600">{error}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="h-9 px-4 rounded-lg bg-slate-900 text-white text-xs font-medium"
            >
              Retry Connection
            </button>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      {!state ? (
        renderLoadingOrError()
      ) : viewMode === 'website' ? (
        <PublicWebsite
          state={state}
          onEnterOperatorConsole={(section) => handleEnterConsole(section ?? 'map')}
          onCreateReservation={createReservation}
          onOpenTicketPass={(res) => setTicketPassTarget({ reservation: res })}
          busy={busy}
        />
      ) : (
        <div className="min-h-screen flex bg-[#F4F6F8] text-slate-900">
          <Sidebar
            activeSection={activeSection}
            onSelectSection={setActiveSection}
            onBackToWebsite={() => {
              setViewMode('website');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            state={state}
            mobileOpen={mobileMenuOpen}
            onCloseMobile={() => setMobileMenuOpen(false)}
            onResetDemo={resetDemo}
            busy={busy}
          />

          <div className="flex-1 min-w-0 flex flex-col">
            <TopBar
              activeSection={activeSection}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onOpenCheckIn={() => openCheckIn(null)}
              onOpenCheckOut={() => openCheckOut(null)}
              onOpenMobileMenu={() => setMobileMenuOpen(true)}
            />

            <main className="flex-1 p-4 sm:p-5 max-w-[1440px] w-full mx-auto space-y-4 no-print">
              <FacilityKPIStrip state={state} nowMs={nowMs} />

              {activeSection === 'map' && (
                <BayMapView
                  state={state}
                  nowMs={nowMs}
                  searchQuery={searchQuery}
                  selectedBayId={selectedBayId}
                  onSelectBay={setSelectedBayId}
                  onOpenCheckInForBay={(bayId) => openCheckIn(bayId)}
                  onOpenCheckOutForSession={(ses) => openCheckOut(ses)}
                  onOpenReserveForBay={handleOpenReserveForBay}
                  onOpenTicketPass={(target) => setTicketPassTarget(target)}
                  onRelocateVehicle={relocateVehicle}
                  onUpdateBay={updateBay}
                  onCancelReservation={cancelReservation}
                  onConvertReservationToCheckIn={handleConvertReservation}
                  onSimulateEntry={simulateGate}
                  busy={busy}
                />
              )}

              {activeSection === 'sessions' && (
                <ActiveSessionsView
                  state={state}
                  nowMs={nowMs}
                  searchQuery={searchQuery}
                  onClearSearch={() => setSearchQuery('')}
                  onInspectBay={handleInspectBayFromSessions}
                  onCheckOutSession={(ses) => openCheckOut(ses)}
                  onOpenTicketPass={(ses) => setTicketPassTarget({ session: ses })}
                  onOpenCheckIn={() => openCheckIn(null)}
                />
              )}

              {activeSection === 'reservations' && (
                <ReservationsView
                  state={state}
                  searchQuery={searchQuery}
                  initialBayId={reserveInitialBayId}
                  onClearInitialBay={() => setReserveInitialBayId(null)}
                  onCreateReservation={createReservation}
                  onCancelReservation={cancelReservation}
                  onConvertToCheckIn={handleConvertReservation}
                  onOpenTicketPass={(res) => setTicketPassTarget({ reservation: res })}
                  busy={busy}
                />
              )}

              {activeSection === 'analytics' && (
                <AnalyticsView state={state} searchQuery={searchQuery} />
              )}

              {activeSection === 'tariffs' && (
                <TariffsAndGatesView
                  state={state}
                  onSaveTariffs={updateTariffs}
                  onSimulateGate={simulateGate}
                  busy={busy}
                />
              )}
            </main>
          </div>
        </div>
      )}

      {state && (
        <>
          <CheckInModal
            open={checkInOpen}
            onClose={() => setCheckInOpen(false)}
            state={state}
            initialBayId={checkInInitialBayId}
            onCheckIn={checkIn}
            busy={busy}
          />

          <CheckOutModal
            open={checkOutOpen}
            onClose={() => setCheckOutOpen(false)}
            state={state}
            nowMs={nowMs}
            initialSession={checkOutInitialSession}
            onCheckOut={checkOut}
            busy={busy}
          />

          <TicketPassModal
            open={Boolean(ticketPassTarget)}
            onClose={() => setTicketPassTarget(null)}
            facilityName={state.facilityName}
            session={ticketPassTarget?.session}
            reservation={ticketPassTarget?.reservation}
            nowMs={nowMs}
          />
        </>
      )}

      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none no-print"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-xs font-medium shadow-md bg-white ${
                toast.tone === 'error'
                  ? 'border-red-200 text-red-900'
                  : toast.tone === 'success'
                  ? 'border-teal-200 text-teal-950'
                  : 'border-slate-200 text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                {toast.tone === 'error' ? (
                  <AlertCircle className="h-4 w-4 text-red-700 shrink-0" />
                ) : toast.tone === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-teal-700 shrink-0" />
                ) : (
                  <Info className="h-4 w-4 text-teal-700 shrink-0" />
                )}
                <span className="truncate">{toast.text}</span>
              </span>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="p-0.5 text-slate-400 hover:text-slate-700 shrink-0"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
