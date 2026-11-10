import { LogOut, Menu, Plus, Search, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { NavSection } from './Sidebar';

interface TopBarProps {
  activeSection: NavSection;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onOpenCheckIn: () => void;
  onOpenCheckOut: () => void;
  onOpenMobileMenu: () => void;
}

const SECTION_TITLES: Record<NavSection, string> = {
  map: 'Deck Map',
  sessions: 'Active Vehicles',
  reservations: 'Reservations',
  analytics: 'Revenue & Ledger',
  tariffs: 'Tariffs & Gates',
};

export function TopBar({
  activeSection,
  searchQuery,
  onSearchChange,
  onOpenCheckIn,
  onOpenCheckOut,
  onOpenMobileMenu,
}: TopBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sm:gap-8 sticky top-0 z-30 no-print">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-slate-500 whitespace-nowrap shrink-0 hidden sm:inline">
            MetroBay
          </span>
          <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
            /
          </span>
          <span className="text-slate-500 whitespace-nowrap shrink-0 hidden md:inline">
            Operations
          </span>
          <span className="text-slate-300 hidden md:inline" aria-hidden="true">
            /
          </span>
          <h1 className="font-display font-semibold text-slate-900 truncate">
            {SECTION_TITLES[activeSection]}
          </h1>
        </nav>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <div className="relative hidden md:block w-56 lg:w-68">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Find plate, bay, driver ( / )"
            className="w-full h-9 pl-9 pr-8 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-teal-700"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenCheckOut}
          className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-sm font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <LogOut className="h-4 w-4 text-slate-500" />
          <span className="hidden sm:inline">Check Out</span>
        </button>

        <button
          type="button"
          onClick={onOpenCheckIn}
          className="h-9 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <Plus className="h-4 w-4" />
          <span>Check In Vehicle</span>
        </button>
      </div>
    </header>
  );
}
