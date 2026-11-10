import { CheckCircle2, Printer, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  BAY_CATEGORY_LABELS,
  calculateFeeBreakdown,
  formatCurrency,
  formatDuration,
  PAYMENT_METHOD_LABELS,
  PROMO_CODES,
} from '../shared/parkingTypes';
import type {
  ActiveSession,
  FacilityState,
  PaymentMethod,
  Transaction,
} from '../shared/parkingTypes';

interface CheckOutModalProps {
  open: boolean;
  onClose: () => void;
  state: FacilityState;
  nowMs: number;
  initialSession?: ActiveSession | null;
  onCheckOut: (params: {
    sessionId: string;
    paymentMethod: PaymentMethod;
    discountCode?: string;
    customDiscountAmount?: number;
  }) => Promise<Transaction>;
  busy: boolean;
}

export function CheckOutModal({
  open,
  onClose,
  state,
  nowMs,
  initialSession,
  onCheckOut,
  busy,
}: CheckOutModalProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [lookupQuery, setLookupQuery] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [discountCode, setDiscountCode] = useState('');
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReceipt(null);
      setFormError(null);
      setDiscountCode('');
      setPaymentMethod('card');
      setLookupQuery('');
      setSelectedSessionId(initialSession?.id ?? state.activeSessions[0]?.id ?? '');
    }
  }, [open, initialSession, state.activeSessions]);

  const filteredSessions = useMemo(() => {
    const q = lookupQuery.trim().toLowerCase();
    if (!q) return state.activeSessions;
    return state.activeSessions.filter(
      (s) =>
        s.plate.toLowerCase().includes(q) ||
        s.bayId.toLowerCase().includes(q) ||
        s.driverName.toLowerCase().includes(q)
    );
  }, [lookupQuery, state.activeSessions]);

  const activeSession = useMemo(
    () => state.activeSessions.find((s) => s.id === selectedSessionId) ?? null,
    [selectedSessionId, state.activeSessions]
  );

  const activeBay = useMemo(
    () => (activeSession ? state.bays.find((b) => b.id === activeSession.bayId) : undefined),
    [activeSession, state.bays]
  );

  const breakdown = useMemo(() => {
    if (!activeSession) return null;
    return calculateFeeBreakdown({
      entryTimeIso: activeSession.entryTime,
      exitTimeIso: new Date(nowMs).toISOString(),
      bayCategory: activeBay?.category ?? 'standard',
      vehicleClass: activeSession.vehicleClass,
      passType: activeSession.passType,
      evKwhDelivered: activeSession.evKwhDelivered,
      discountCode,
      tariffs: state.tariffs,
    });
  }, [activeSession, activeBay, nowMs, discountCode, state.tariffs]);

  if (!open) return null;

  const sym = state.tariffs.currencySymbol;

  const handleSettle = async () => {
    if (!activeSession) return;
    setFormError(null);
    try {
      const tx = await onCheckOut({
        sessionId: activeSession.id,
        paymentMethod,
        discountCode: discountCode.trim().toUpperCase(),
      });
      setReceipt(tx);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Checkout failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-modal-title"
        className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden print-only-receipt"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between no-print">
          <div>
            <h2 id="checkout-modal-title" className="font-display font-semibold text-base text-slate-900">
              {receipt ? 'Payment Receipt & Gate Release' : 'Check Out & Payment Settlement'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {receipt
                ? `Exit barrier opened for ${receipt.plate}`
                : 'Review stay duration, apply validations, and settle exit fee'}
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

        {receipt ? (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-teal-50 border border-teal-200 text-teal-950 text-xs">
              <CheckCircle2 className="h-4 w-4 text-teal-700 shrink-0" />
              <span>
                Settled via {PAYMENT_METHOD_LABELS[receipt.paymentMethod]} · Bay {receipt.bayId} is now open.
              </span>
            </div>

            <div className="border border-slate-200 rounded-lg p-4 space-y-2.5 text-sm">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                <div>
                  <div className="font-display font-bold text-slate-900">{state.facilityName}</div>
                  <div className="text-xs text-slate-500 font-mono">{receipt.receiptNumber}</div>
                </div>
                <div className="text-right font-mono">
                  <div className="font-semibold text-slate-900">{receipt.plate}</div>
                  <div className="text-xs text-slate-500">Bay {receipt.bayId}</div>
                </div>
              </div>

              <div className="flex justify-between text-xs text-slate-600">
                <span>Duration ({receipt.billableHours} billable hrs)</span>
                <span className="font-mono tabular-nums">{formatDuration(receipt.elapsedMinutes)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Parking Tariff</span>
                <span className="font-mono tabular-nums">{formatCurrency(receipt.parkingFee, sym)}</span>
              </div>
              {receipt.evEnergyFee > 0 && (
                <div className="flex justify-between text-xs text-slate-600">
                  <span>EV Charging ({receipt.evKwhDelivered.toFixed(1)} kWh)</span>
                  <span className="font-mono tabular-nums">{formatCurrency(receipt.evEnergyFee, sym)}</span>
                </div>
              )}
              {receipt.discountAmount > 0 && (
                <div className="flex justify-between text-xs text-teal-800">
                  <span>Validation ({receipt.discountCode || 'Discount'})</span>
                  <span className="font-mono tabular-nums">-{formatCurrency(receipt.discountAmount, sym)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-slate-600">
                <span>Tax</span>
                <span className="font-mono tabular-nums">{formatCurrency(receipt.taxAmount, sym)}</span>
              </div>
              <div className="flex justify-between pt-2.5 border-t border-slate-200 font-semibold text-base text-slate-900">
                <span>Total Paid</span>
                <span className="font-mono tabular-nums">{formatCurrency(receipt.totalAmount, sym)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="h-10 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Printer className="h-4 w-4" />
                <span>Print Receipt</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-10 px-5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium whitespace-nowrap"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {formError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                {formError}
              </div>
            )}

            {!initialSession && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={lookupQuery}
                    onChange={(e) => setLookupQuery(e.target.value)}
                    placeholder="Filter active vehicles by plate or bay..."
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
                  />
                </div>
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  aria-label="Select active parked vehicle"
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm bg-white text-slate-900 focus:outline-none focus:border-teal-700"
                >
                  {filteredSessions.length === 0 ? (
                    <option value="">No matching active sessions</option>
                  ) : (
                    filteredSessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.plate} · Bay {s.bayId} ({s.driverName})
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {activeSession && breakdown ? (
              <>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-sm">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div>
                      <div className="font-mono font-bold text-base text-slate-900">
                        {activeSession.plate}
                      </div>
                      <div className="text-xs text-slate-500">
                        Bay {activeSession.bayId} · {BAY_CATEGORY_LABELS[activeBay?.category ?? 'standard']} · {activeSession.driverName}
                      </div>
                    </div>
                    <div className="text-right font-mono text-xs text-slate-600 tabular-nums">
                      <div>Stay: {formatDuration(breakdown.elapsedMinutes)}</div>
                      <div>{breakdown.graceApplied ? 'Grace Period' : `${breakdown.billableHours}h billed`}</div>
                    </div>
                  </div>

                  <div className="flex justify-between text-xs text-slate-600">
                    <span>
                      Base Parking ({formatCurrency(breakdown.hourlyRateApplied, sym)}/hr
                      {breakdown.cappedAtDailyMax ? ' · Daily Cap' : ''})
                    </span>
                    <span className="font-mono tabular-nums">{formatCurrency(breakdown.parkingFee, sym)}</span>
                  </div>

                  {activeSession.evKwhDelivered > 0 && (
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>EV Charging ({activeSession.evKwhDelivered.toFixed(1)} kWh)</span>
                      <span className="font-mono tabular-nums">{formatCurrency(breakdown.evEnergyFee, sym)}</span>
                    </div>
                  )}

                  {breakdown.discountAmount > 0 && (
                    <div className="flex justify-between text-xs text-teal-800 font-medium">
                      <span>Validation Applied ({discountCode.toUpperCase()})</span>
                      <span className="font-mono tabular-nums">
                        -{formatCurrency(breakdown.discountAmount, sym)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Tax ({state.tariffs.taxPercent}%)</span>
                    <span className="font-mono tabular-nums">{formatCurrency(breakdown.taxAmount, sym)}</span>
                  </div>

                  <div className="flex justify-between pt-2 border-t border-slate-200 font-semibold text-base text-slate-900">
                    <span>Amount Due</span>
                    <span className="font-mono tabular-nums">{formatCurrency(breakdown.totalAmount, sym)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="promo-code" className="block text-xs font-medium text-slate-700 mb-1">
                      Validation Code (Optional)
                    </label>
                    <input
                      id="promo-code"
                      type="text"
                      value={discountCode}
                      onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                      placeholder="RETAIL2HR, VALET10, EVFREE"
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 font-mono text-xs uppercase text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700"
                    />
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                      {Object.keys(PROMO_CODES).map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => setDiscountCode(code)}
                          className="text-teal-700 hover:underline font-mono"
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="block text-xs font-medium text-slate-700 mb-1">
                      Payment Method
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(Object.entries(PAYMENT_METHOD_LABELS) as Array<[PaymentMethod, string]>).map(
                        ([key, label]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setPaymentMethod(key)}
                            className={`h-9 px-2.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                              paymentMethod === key
                                ? 'bg-teal-50 border-teal-700 text-teal-900'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {label}
                          </button>
                        )
                      )}
                    </div>
                  </div>
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
                    type="button"
                    disabled={busy}
                    onClick={handleSettle}
                    className="h-10 px-5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    {busy
                      ? 'Settling...'
                      : `Collect ${formatCurrency(breakdown.totalAmount, sym)} & Open Gate`}
                  </button>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-sm text-slate-500">
                No active parked vehicles available for check-out.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
