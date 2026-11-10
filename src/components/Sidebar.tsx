import {
  BarChart3,
  CalendarClock,
  CarFront,
  Globe,
  LayoutGrid,
  RotateCcw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { FacilityState, FloorId } from '../shared/parkingTypes';

export type NavSection = 'map' | 'sessions' | 'reservations' | 'analytics' | 'tariffs';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  onBackToWebsite: () => void;
  state: FacilityState | null;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onResetDemo: () => void;
  busy: boolean;
}

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: typeof LayoutGrid;
}> = [
  { id: 'map', label: 'Deck Map', icon: LayoutGrid },
  { id: 'sessions', label: 'Active Vehicles', icon: CarFront },
  { id: 'reservations', label: 'Reservations', icon: CalendarClock },
  { id: 'analytics', label: 'Revenue & Ledger', icon: BarChart3 },
  { id: 'tariffs', label: 'Tariffs & Gates', icon: SlidersHorizontal },
];

export function Sidebar({
  activeSection,
  onSelectSection,
  onBackToWebsite,
  state,
  mobileOpen,
  onCloseMobile,
  onResetDemo,
  busy,
}: SidebarProps) {
  const totalBays = state?.bays.length ?? 72;
  const occupiedCount = state?.bays.filter((b) => b.status === 'occupied').length ?? 0;
  const heldReservations =
    state?.reservations.filter((r) => r.status === 'held' || r.status === 'upcoming').length ?? 0;

  const floorStats = (['P1', 'P2', 'P3'] as FloorId[]).map((fl) => {
    const bays = state?.bays.filter((b) => b.floor === fl) ?? [];
    const open = bays.filter((b) => b.status === 'available').length;
    return { fl, open, total: bays.length || 24 };
  });

  const content = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-slate-200 w-56 select-none">
      <div>
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200">
          <button
            type="button"
            onClick={onBackToWebsite}
            className="flex items-center gap-2.5 min-w-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <div className="h-8 w-8 rounded-lg bg-teal-700 text-white flex items-center justify-center font-display font-bold text-sm shrink-0">
              M
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              MetroBay
            </span>
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="p-2.5 space-y-1" aria-label="Primary sections">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const count =
              item.id === 'sessions'
                ? occupiedCount
                : item.id === 'reservations'
                ? heldReservations
                : null;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectSection(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                  isActive
                    ? 'bg-teal-50 text-teal-900'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? 'text-teal-700' : 'text-slate-500'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {count !== null && (
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      isActive ? 'text-teal-800 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-2 mt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                onBackToWebsite();
                onCloseMobile();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              <Globe className="h-4 w-4 text-slate-500 shrink-0" />
              <span>Public Website</span>
            </button>
          </div>
        </nav>
      </div>

      <div className="p-3.5 border-t border-slate-200 space-y-3">
        <div className="space-y-2 text-xs">
          <div className="font-semibold text-slate-900">
            {state?.facilityName ?? 'MetroBay Central Deck'}
          </div>
          <div className="space-y-1 text-slate-600 font-mono tabular-nums">
            <div className="flex justify-between">
              <span className="font-sans">Occupied</span>
              <span className="font-medium text-slate-900">
                {occupiedCount} / {totalBays}
              </span>
            </div>
            {floorStats.map((s) => (
              <div key={s.fl} className="flex justify-between text-[11px]">
                <span className="font-sans text-slate-500">Deck {s.fl} Open</span>
                <span className="text-teal-800 font-medium">
                  {s.open} / {s.total}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={onResetDemo}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset Sample Data</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0 no-print">{content}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
}
