import React from 'react';
import type { TxState } from '../lib/txStatus';
import { Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface Props {
  state: TxState;
}

export const TxStatusBadge: React.FC<Props> = ({ state }) => {
  if (state.status === 'idle') return null;

  let icon = <Loader2 className="spinner" size={16} />;
  let colorClass = 'text-blue';
  let label = 'Processing...';
  
  switch (state.status) {
    case 'building':
      label = 'Building Transaction...';
      colorClass = 'text-purple';
      break;
    case 'awaiting-signature':
      label = 'Awaiting Wallet Signature...';
      colorClass = 'text-amber';
      break;
    case 'submitting':
      label = 'Submitting to Network...';
      colorClass = 'text-blue';
      break;
    case 'pending':
      label = 'Confirming on Chain...';
      colorClass = 'text-blue';
      break;
    case 'success':
      icon = <CheckCircle2 size={16} />;
      label = 'Transaction Successful!';
      colorClass = 'text-emerald';
      break;
    case 'error':
      icon = <AlertCircle size={16} />;
      label = 'Transaction Failed';
      colorClass = 'text-red';
      break;
  }

  return (
    <div className={`tx-status-badge ${colorClass}`} style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem', 
      padding: '0.75rem 1rem', borderRadius: '8px', 
      background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)',
      marginTop: '1rem', fontSize: '0.85rem', fontWeight: 500
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
        {icon} <span>{label}</span>
      </div>
      {state.hash && (
        <a 
          href={`https://stellar.expert/explorer/testnet/tx/${state.hash}`} 
          target="_blank" rel="noreferrer"
          style={{ color: 'var(--accent-blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
        >
          View <Clock size={12} />
        </a>
      )}
    </div>
  );
};
