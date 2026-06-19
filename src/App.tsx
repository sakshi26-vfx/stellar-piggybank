import React, { useState, useEffect } from "react";
import { 
  PiggyBank, Wallet, Loader2, ExternalLink, 
  CheckCircle2, AlertCircle, Sparkles, RefreshCw,
  Coins, Copy, Check
} from "lucide-react";
import confetti from "canvas-confetti";
import { walletKit } from "./lib/walletKit";
import { 
  getVaultBalance, getVaultMilestone, buildDepositOp, buildSetMilestoneOp, 
  rpcServer, horizonServer, VAULT_CONTRACT_ID, NETWORK_PASSPHRASE 
} from "./lib/vaultContract";
import { TxStatusBadge } from "./components/TxStatusBadge";
import { ActivityFeed } from "./components/ActivityFeed";
import type { TxState } from "./lib/txStatus";
import { TransactionBuilder, BASE_FEE, rpc, xdr } from "@stellar/stellar-sdk";

interface Toast {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message: string;
  txHash?: string;
}

export default function App() {
  const [userAddress, setUserAddress] = useState<string>("");
  const [userBalance, setUserBalance] = useState<string>("0.0000000");
  const [vaultBalance, setVaultBalance] = useState<string>("0.0000000");
  const [savingGoal, setSavingGoal] = useState<number>(50);
  
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [isWalletLoading, setIsWalletLoading] = useState<boolean>(false);
  const [isBalancesLoading, setIsBalancesLoading] = useState<boolean>(false);
  
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const [txState, setTxState] = useState<TxState>({ status: 'idle' });

  useEffect(() => {
    const savedAddress = sessionStorage.getItem("stellar_connected_address");
    if (savedAddress) {
      setUserAddress(savedAddress);
    }
  }, []);

  useEffect(() => {
    fetchBalances();
  }, [userAddress]);

  const addToast = (type: "success" | "error" | "info", title: string, message: string, txHash?: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, title, message, txHash }]);
    setTimeout(() => removeToast(id), 6000);
  };

  const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const fetchBalances = async () => {
    if (!userAddress) return;
    setIsBalancesLoading(true);
    try {
      try {
        const userAccount = await horizonServer.loadAccount(userAddress);
        setUserBalance(userAccount.balances.find((b: any) => b.asset_type === "native")?.balance || "0.0000000");
      } catch (err: any) {
        if (err?.response?.status === 404 || err?.message?.includes("404")) {
          setUserBalance("0.0000000 (Unfunded)");
        }
      }
      
      const milestone = await getVaultMilestone(userAddress);
      if (milestone > 0) {
        setSavingGoal(milestone);
      }
      
      const vBalance = await getVaultBalance(userAddress);
      setVaultBalance(vBalance);
    } catch (error) {
      console.error("Error fetching balances:", error);
    } finally {
      setIsBalancesLoading(false);
    }
  };

  const connectWallet = async () => {
    setIsWalletLoading(true);
    try {
      await walletKit.openModal({
        onWalletSelected: async (option: any) => {
          try {
            // @ts-ignore
            walletKit.setWallet(option.id);
            // @ts-ignore
            const { address } = await walletKit.getAddress();
            setUserAddress(address);
            sessionStorage.setItem("stellar_connected_address", address);
            addToast("success", "Wallet Connected", `Successfully linked: ${address.substring(0, 5)}...${address.substring(52)}`);
          } catch (e: any) {
            addToast("error", "Wallet Error", "No compatible wallet detected — install Freighter or xBull");
          }
        }
      });
    } catch (error: any) {
      console.error("WALLET ERROR:", error);
      addToast("error", "Connection Error", "Failed to open wallet modal.");
    } finally {
      setIsWalletLoading(false);
    }
  };

  const disconnectWallet = () => {
    setUserAddress("");
    setUserBalance("0.0000000");
    setVaultBalance("0.0000000");
    sessionStorage.removeItem("stellar_connected_address");
    // @ts-ignore
    walletKit.disconnect();
    addToast("info", "Disconnected", "Your session has been closed.");
  };

  const executeContractCall = async (op: xdr.Operation) => {
    if (!userAddress) return;
    setTxState({ status: 'building' });
    try {
      const account = await horizonServer.loadAccount(userAddress);
      
      let tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(op)
        .setTimeout(60)
        .build();

      setTxState({ status: 'submitting' });
      const simulation = await rpcServer.simulateTransaction(tx);
      
      if (rpc.Api.isSimulationError(simulation)) {
        if (simulation.error.includes("InsufficientBalance") || simulation.error.includes("Not enough")) {
          addToast("error", "Insufficient Balance", "Not enough XLM — you need at least the required XLM available (reserve included)");
        } else {
          addToast("error", "Transaction Failed", `Error details: ${simulation.error}`);
        }
        setTxState({ status: 'error', error: simulation.error });
        setTimeout(() => setTxState({ status: 'idle' }), 5000);
        return;
      }
      
      if (rpc.Api.isSimulationSuccess(simulation)) {
        tx = rpc.assembleTransaction(tx, simulation).build();
      } else {
        throw new Error("Simulation didn't succeed");
      }

      setTxState({ status: 'awaiting-signature' });
      
      let signedXdr: string;
      try {
        // @ts-ignore
        const result = await walletKit.signTransaction(tx.toXDR());
        signedXdr = typeof result === "string" ? result : result.signedTxXdr;
      } catch (err: any) {
        addToast("info", "Transaction Cancelled", "You declined the signature request.");
        setTxState({ status: 'error', error: "User rejected signature" });
        setTimeout(() => setTxState({ status: 'idle' }), 5000);
        return;
      }

      setTxState({ status: 'pending' });
      const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
      const submitResponse = await rpcServer.sendTransaction(signedTx);
      
      if (submitResponse.errorResult) {
        addToast("error", "Submission Failed", "The network rejected the transaction.");
        setTxState({ status: 'error', error: "Network rejection" });
        setTimeout(() => setTxState({ status: 'idle' }), 5000);
        return;
      }
      
      setTxState({ status: 'pending', hash: submitResponse.hash });
      
      let getTxResponse = await rpcServer.getTransaction(submitResponse.hash);
      while (getTxResponse.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        getTxResponse = await rpcServer.getTransaction(submitResponse.hash);
      }

      if (getTxResponse.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        addToast("success", "Transaction Successful!", "Your request was processed successfully.", submitResponse.hash);
        setTxState({ status: 'success', hash: submitResponse.hash });
        setDepositAmount("");
        fetchBalances();
      } else {
        addToast("error", "Transaction Failed", "The transaction failed during execution.");
        setTxState({ status: 'error', hash: submitResponse.hash });
      }
      
      setTimeout(() => setTxState({ status: 'idle' }), 5000);
    } catch (error: any) {
      console.error(error);
      addToast("error", "Transaction Error", error.message || "An unexpected error occurred.");
      setTxState({ status: 'error', error: error.message });
      setTimeout(() => setTxState({ status: 'idle' }), 5000);
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAddress || !depositAmount) return;
    
    const amountNum = parseFloat(depositAmount);
    const rawBalance = parseFloat(userBalance);
    if (!isNaN(rawBalance) && rawBalance < amountNum + 1.5) {
      addToast("error", "Insufficient Balance", "Not enough XLM — you need at least the required amount available (reserve included)");
      return;
    }
    
    const op = buildDepositOp(userAddress, depositAmount);
    await executeContractCall(op);
  };
  
  const handleSetMilestone = async () => {
    if (!userAddress) return;
    const op = buildSetMilestoneOp(userAddress, savingGoal.toString());
    await executeContractCall(op);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(label);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const formatAddress = (addr: string) => addr ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 6)}` : "";

  const parsedVaultBal = parseFloat(vaultBalance) || 0;
  const progressPercent = Math.min(Math.round((parsedVaultBal / savingGoal) * 100), 100);

  return (
    <div className="app-container">
      <div className="space-stars"></div>
      <header className="header">
        <div className="logo-container">
          <div className="logo-text">
            <span>🐖</span> FutureSelf <span className="logo-sub">// Vault</span>
          </div>
          <span className="btn-secondary" style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", borderRadius: "8px", pointerEvents: "none", color: "var(--primary-pink)", borderColor: "rgba(236, 72, 153, 0.2)" }}>
            SOROBAN TESTNET
          </span>
        </div>

        <div>
          {userAddress ? (
            <div style={{ display: "flex", gap: "0.50rem", alignItems: "center" }}>
              <span className="btn-secondary" style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", borderRadius: "10px", pointerEvents: "none" }}>
                Connected
              </span>
              <button onClick={disconnectWallet} className="btn btn-disconnect">
                Disconnect [{formatAddress(userAddress)}]
              </button>
            </div>
          ) : (
            <button onClick={connectWallet} disabled={isWalletLoading} className="btn btn-primary">
              {isWalletLoading ? <><Loader2 className="spinner" /> Connecting...</> : <><Wallet size={18} /> Connect Wallet</>}
            </button>
          )}
        </div>
      </header>

      <main style={{ flex: 1 }}>
        <div className="grid-2col">
          <div className="glass-card">
            <div className="card-title-section">
              <div className="card-title-icon icon-purple">
                <Wallet size={20} />
              </div>
              <h3>Your Wallet</h3>
            </div>
            
            {userAddress ? (
              <div>
                <div className="input-label" style={{ marginBottom: "0.25rem" }}>Address</div>
                <div className="address-display">
                  <span>{formatAddress(userAddress)}</span>
                  <button onClick={() => copyToClipboard(userAddress, 'wallet')} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                    {copiedAddress === 'wallet' ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
                  </button>
                </div>
                
                <div className="input-label">Available Balance</div>
                <div className="balance-value-container">
                  <span className="balance-large">{userBalance.split(" ")[0]}</span>
                  <span className="balance-denom">XLM</span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "2.5rem 0", color: "var(--text-muted)" }}>
                <Wallet size={48} style={{ opacity: 0.3, marginBottom: "1rem" }} />
                <p>Please connect your wallet to check your XLM balance.</p>
              </div>
            )}
          </div>

          <div className="glass-card">
            <div className="card-title-section" style={{ justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div className="card-title-icon icon-pink">
                  <PiggyBank size={20} />
                </div>
                <h3>Your Vault</h3>
              </div>
              <button onClick={fetchBalances} disabled={isBalancesLoading || !userAddress} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                <RefreshCw size={16} className={isBalancesLoading ? "spinner" : ""} />
              </button>
            </div>

            {VAULT_CONTRACT_ID ? (
              <>
                <div className="input-label" style={{ marginBottom: "0.25rem" }}>Vault Contract ID</div>
                <div className="address-display">
                  <span>{formatAddress(VAULT_CONTRACT_ID)}</span>
                  <button onClick={() => copyToClipboard(VAULT_CONTRACT_ID, 'vault')} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                    {copiedAddress === 'vault' ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ padding: "0.5rem 0", color: "var(--accent-amber)", fontSize: "0.85rem", fontWeight: 500 }}>
                ⚠️ Contract ID missing from .env
              </div>
            )}

            <div className="input-label">Locked Total Savings</div>
            <div className="balance-value-container">
              <span className="balance-large" style={{ color: "var(--primary-pink)" }}>{vaultBalance}</span>
              <span className="balance-denom" style={{ color: "var(--primary-pink)" }}>XLM</span>
            </div>

            {VAULT_CONTRACT_ID && (
              <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
                <a href={`https://stellar.expert/explorer/testnet/contract/${VAULT_CONTRACT_ID}`} target="_blank" rel="noopener noreferrer" className="toast-link" style={{ display: "flex", alignItems: "center", gap: "0.25rem", margin: 0, textDecoration: "none" }}>
                  View Vault on StellarExpert <ExternalLink size={14} />
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="grid-2col">
          <div className="glass-card">
            <div className="card-title-section">
              <div className="card-title-icon icon-purple">
                <Coins size={20} />
              </div>
              <h3>Lock XLM Into Piggy Bank</h3>
            </div>

            <form onSubmit={handleDeposit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div className="input-group">
                <label className="input-label">Deposit Amount (XLM)</label>
                <div className="input-field-wrapper">
                  <Coins size={18} className="input-icon-left" />
                  <input
                    type="number" step="0.0000001" min="0.0000001" placeholder="e.g. 10.5"
                    className="input-field" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} required
                    disabled={txState.status !== 'idle' || !userAddress || !VAULT_CONTRACT_ID}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "1rem" }} disabled={txState.status !== 'idle' || !userAddress || !depositAmount || !VAULT_CONTRACT_ID}>
                {txState.status !== 'idle' ? <><Loader2 className="spinner" /> Processing...</> : <>Deposit to the Future 🚀</>}
              </button>
            </form>
            
            <TxStatusBadge state={txState} />
          </div>

          <div className="glass-card">
            <div className="card-title-section">
              <div className="card-title-icon icon-pink">
                <Sparkles size={20} />
              </div>
              <h3>Savings Milestone Goal</h3>
            </div>

            <p style={{ fontSize: "0.9rem", color: "var(--text-body)", marginBottom: "1rem" }}>
              Your future self will thank you. Set a goal for your locked savings and see your progress!
            </p>

            <div className="input-group" style={{ marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className="input-label">Goal Target: {savingGoal} XLM</label>
                <button onClick={handleSetMilestone} className="btn btn-secondary" style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }} disabled={txState.status !== 'idle' || !userAddress || !VAULT_CONTRACT_ID}>
                  Save On-Chain
                </button>
              </div>
              <input 
                type="range" min="10" max="1000" step="10" value={savingGoal} onChange={(e) => setSavingGoal(parseInt(e.target.value))}
                style={{ width: "100%", accentColor: "var(--primary-pink)", cursor: "pointer", height: "6px", borderRadius: "3px", marginTop: "0.5rem" }}
              />
            </div>

            <div className="milestone-section">
              <div className="milestone-header">
                <span>Milestone Goal Progress</span>
                <span style={{ fontWeight: 700, color: "var(--primary-pink)" }}>{progressPercent}%</span>
              </div>
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                <span>{parsedVaultBal.toFixed(2)} XLM Saved</span>
                <span>Target: {savingGoal} XLM</span>
              </div>
            </div>
          </div>
        </div>

        <ActivityFeed />
      </main>

      <footer className="footer">
        <p>FutureSelf // Built for Stellar Level 2 (Soroban). Lock in assets today for a decentralised tomorrow.</p>
      </footer>

      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <div className="toast-icon">
              {toast.type === "success" && <CheckCircle2 className="text-emerald" size={20} />}
              {toast.type === "error" && <AlertCircle className="text-red" size={20} />}
              {toast.type === "info" && <Loader2 className="spinner text-blue" size={20} />}
            </div>
            <div className="toast-content">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-msg">{toast.message}</div>
              {toast.txHash && (
                <a href={`https://stellar.expert/explorer/testnet/tx/${toast.txHash}`} target="_blank" rel="noopener noreferrer" className="toast-link">
                  Successfully saved! View on StellarExpert <ExternalLink size={12} style={{ display: "inline", verticalAlign: "middle" }} />
                </a>
              )}
            </div>
            <button onClick={() => removeToast(toast.id)} className="toast-close">×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
