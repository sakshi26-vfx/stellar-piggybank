import React, { useEffect, useState } from 'react';
import { rpcServer, VAULT_CONTRACT_ID, stroopsToXlm } from '../lib/vaultContract';
import { History, ExternalLink } from 'lucide-react';
import { scValToNative } from '@stellar/stellar-sdk';

interface VaultEvent {
  id: string;
  type: string;
  who: string;
  amount?: string;
  target?: string;
  ledger: number;
}

export const ActivityFeed: React.FC = () => {
  const [events, setEvents] = useState<VaultEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!VAULT_CONTRACT_ID) return;

    const fetchEvents = async () => {
      try {
        const latestLedger = await rpcServer.getLatestLedger();
        // Look back ~1000 ledgers (approx 1.5 hours)
        const startLedger = Math.max(latestLedger.sequence - 1000, 1);
        
        const response = await rpcServer.getEvents({
          startLedger,
          filters: [
            {
              type: "contract",
              contractIds: [VAULT_CONTRACT_ID],
            }
          ],
          limit: 10
        });

        const parsedEvents: VaultEvent[] = [];

        response.events.forEach(evt => {
          if (evt.type !== 'contract') return;
          try {
            // The topic array contains [symbol, address]
            const topic1 = scValToNative(evt.topic[0]);
            
            if (topic1 === 'deposit' || topic1 === 'withdraw') {
              const who = scValToNative(evt.topic[1]);
              const valueTuple = scValToNative(evt.value); // (amount, new_balance)
              const amountStroops = valueTuple[0];
              
              parsedEvents.push({
                id: evt.id,
                type: topic1,
                who: who as string,
                amount: stroopsToXlm(amountStroops),
                ledger: evt.ledger
              });
            } else if (topic1 === 'milestone') {
              const who = scValToNative(evt.topic[1]);
              const targetStroops = scValToNative(evt.value);
              parsedEvents.push({
                id: evt.id,
                type: topic1,
                who: who as string,
                target: stroopsToXlm(targetStroops),
                ledger: evt.ledger
              });
            }
          } catch (e) {
            console.error("Failed to parse event", e);
          }
        });

        // Reverse to show newest first
        setEvents(parsedEvents.reverse());
      } catch (err) {
        console.error("Error fetching events:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 10000);
    return () => clearInterval(interval);
  }, []);

  if (events.length === 0 && !isLoading) return null;

  return (
    <div className="glass-card" style={{ marginTop: "1.5rem" }}>
      <div className="card-title-section">
        <div className="card-title-icon icon-purple">
          <History size={20} />
        </div>
        <h3>Live Vault Activity</h3>
      </div>
      
      {isLoading && events.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Scanning testnet for activity...</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {events.map((evt) => (
            <div 
              key={evt.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: "rgba(0, 0, 0, 0.15)", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.03)" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: evt.type === 'deposit' ? "var(--accent-emerald)" : evt.type === 'withdraw' ? "var(--accent-amber)" : "var(--primary-pink)" }}></div>
                <div>
                  <div style={{ color: "var(--text-title)", fontWeight: 600, fontSize: "0.9rem", textTransform: 'capitalize' }}>
                    {evt.type === 'milestone' 
                      ? `Goal Set to ${evt.target} XLM`
                      : `${evt.type === 'deposit' ? '+' : '-'}${evt.amount} XLM ${evt.type === 'deposit' ? 'Locked' : 'Withdrawn'}`
                    }
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    By {evt.who.substring(0, 4)}...{evt.who.substring(52)} • Ledger {evt.ledger}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
