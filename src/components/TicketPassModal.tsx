import { Printer, X } from 'lucide-react';
import { formatDuration, VEHICLE_CLASS_LABELS } from '../shared/parkingTypes';
import type { ActiveSession, Reservation } from '../shared/parkingTypes';

interface TicketPassModalProps {
  open: boolean;
  onClose: () => void;
  facilityName: string;
  session?: ActiveSession | null;
  reservation?: Reservation | null;
  nowMs: number;
}

function buildMatrix(seedText: string): boolean[][] {
  const size = 9;
  const grid: boolean[][] = [];
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) {
      // Corner finder patterns
      const inTopLeft = r < 3 && c < 3;
      const inTopRight = r < 3 && c >= size - 3;
      const inBottomLeft = r >= size - 3 && c < 3;
      if (inTopLeft || inTopRight || inBottomLeft) {
        const lr = r < 3 ? r : r - (size - 3);
        const lc = c < 3 ? c : c - (size - 3);
        row.push(lr === 0 || lr === 2 || lc === 0 || lc === 2 || (lr === 1 && lc === 1));
      } else {
        const bit = ((hash >>> ((r * size + c) % 24)) ^ (r * 7 + c * 13)) & 1;
        row.push(bit === 1);
      }
    }
    grid.push(row);
  }
  return grid;
}

export function TicketPassModal({
  open,
  onClose,
  facilityName,
  session,
  reservation,
  nowMs,
}: TicketPassModalProps) {
  if (!open || (!session && !reservation)) return null;

  const code = session ? session.id : reservation!.id;
  const plate = session ? session.plate : reservation!.plate;
  const bayId = session ? session.bayId : reservation!.bayId;
  const floor = session ? session.floor : reservation!.floor;
  const driverName = session ? session.driverName : reservation!.driverName;
  const vehicleClass = session ? session.vehicleClass : reservation!.vehicleClass;
  const matrix = buildMatrix(`${code}:${plate}:${bayId}`);

  const elapsedMins = session
    ? Math.max(1, Math.round((nowMs - new Date(session.entryTime).getTime()) / 60000))
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-pass-title"
        className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden print-only-receipt"
      >
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between no-print">
          <h2 id="ticket-pass-title" className="font-display font-semibold text-sm text-slate-900">
            {session ? 'Digital Gate Entry Pass' : 'Reservation Gate Pass'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close pass"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-center space-y-1">
            <div className="text-xs font-medium text-slate-500">{facilityName}</div>
            <div className="font-mono text-2xl font-bold tracking-tight text-slate-900">
              {plate}
            </div>
            <div className="text-xs text-slate-600">
              Assigned Bay <strong className="font-mono text-teal-800">{bayId}</strong> · Level {floor}
            </div>
          </div>

          <div className="flex justify-center py-2">
            <div className="p-3 bg-white border border-slate-200 rounded-xl">
              <svg
                width="126"
                height="126"
                viewBox="0 0 90 90"
                role="img"
                aria-label={`Gate pass matrix for ${plate}`}
              >
                {matrix.map((row, r) =>
                  row.map((filled, c) =>
                    filled ? (
                      <rect
                        key={`${r}-${c}`}
                        x={c * 10 + 1}
                        y={r * 10 + 1}
                        width="8"
                        height="8"
                        rx="1.2"
                        fill="#0f172a"
                      />
                    ) : null
                  )
                )}
              </svg>
            </div>
          </div>

          <div className="border-t border-dashed border-slate-200 pt-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Driver</span>
              <span className="font-medium text-slate-900">{driverName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Vehicle Class</span>
              <span className="text-slate-900">{VEHICLE_CLASS_LABELS[vehicleClass]}</span>
            </div>
            {session ? (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500">Entry Timestamp</span>
                  <span className="font-mono text-slate-800 tabular-nums">
                    {new Date(session.entryTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Duration</span>
                  <span className="font-mono text-slate-800 tabular-nums">
                    {formatDuration(elapsedMins)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span className="text-slate-500">Reserved Window</span>
                <span className="font-mono text-slate-800 tabular-nums">
                  {new Date(reservation!.startTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  ({reservation!.durationHours}h)
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Pass Reference</span>
              <span className="font-mono text-slate-600">{code}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 no-print">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 h-9 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Pass</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium whitespace-nowrap"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
