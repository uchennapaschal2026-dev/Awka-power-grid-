import { AlertTriangle, CheckCircle2, Clock, PowerOff, ShieldAlert } from 'lucide-react';
import { DisputeStatus, PowerState } from '../types/awka';

export function PowerStateLabel({ state }: { state: PowerState }) {
  if (state === 'ON') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Grid ON</span>
      </span>
    );
  }
  if (state === 'LOW_VOLTAGE' || state === 'FLUCTUATING') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{state === 'LOW_VOLTAGE' ? 'Low Voltage' : 'Fluctuating'}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
      <PowerOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>Grid OFF</span>
    </span>
  );
}

export function DisputeStatusLabel({ status }: { status: DisputeStatus }) {
  switch (status) {
    case 'RESOLVED_ADJUSTED':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Resolved &amp; Credited</span>
        </span>
      );
    case 'ESCALATED_TO_NERC':
    case 'ESCALATED_TO_FCCPC':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{status === 'ESCALATED_TO_NERC' ? 'Escalated: NERC Forum' : 'Escalated: FCCPC'}</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Submitted to EEDC</span>
        </span>
      );
  }
}

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
