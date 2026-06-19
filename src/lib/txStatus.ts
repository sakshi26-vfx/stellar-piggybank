export type TxStatus = 
  | 'idle' 
  | 'building' 
  | 'awaiting-signature' 
  | 'submitting' 
  | 'pending' 
  | 'success' 
  | 'error';

export interface TxState {
  status: TxStatus;
  hash?: string;
  error?: string;
}
