import React, { useState, useEffect } from "react";
import { Horizon, TransactionBuilder, Networks, Operation, Asset, BASE_FEE } from "@stellar/stellar-sdk";
import { isConnected, signTransaction, requestAccess } from "@stellar/freighter-api";
import { 
  PiggyBank, 
  Wallet, 
  Loader2, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  RefreshCw,
  Coins,
  History,
  Copy,
  Check
} from "lucide-react";
import confetti from "canvas-confetti";
import { VAULT_PUBLIC_KEY, fundAccount } from "./vault";

// Initialize Horizon server for Testnet
const server = new Horizon.Server("https://horizon-testnet.stellar.org");

interface Toast {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message: string;
  txHash?: string;
}

interface DepositHistoryItem {
  id: string;
  amount: string;
  txHash: string;
  timestamp: number;
}

export default function App() {
  // Wallet States
  const [userAddress, setUserAddress] = useState<string>("");
  const [userBalance, setUserBalance] = useState<string>("0.0000000");
  const [vaultBalance, setVaultBalance] = useState<string>("0.0000000");
  
  // App States
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isWalletLoading, setIsWalletLoading] = useState<boolean>(false);
  const [isBalancesLoading, setIsBalancesLoading] = useState<boolean>(false);
  const [isFundingWallet, setIsFundingWallet] = useState<boolean>(false);
  
  // Custom interactive state: Saving Goal
  const [savingGoal, setSavingGoal] = useState<number>(50); // Default goal in XLM
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  
  // History and Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [history, setHistory] = useState<DepositHistoryItem[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem("stellar_piggy_history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    // Persist connected address if session active
    const savedAddress = sessionStorage.getItem("stellar_connected_address");
    if (savedAddress) {
      setUserAddress(savedAddress);
    }
  }, []);

  // Sync wallet and vault balances when userAddress or loading state changes
  useEffect(() => {
    fetchBalances();
    // Refresh balances every 15 seconds automatically
    const interval = setInterval(fetchBalances, 15000);
    return () => clearInterval(interval);
  }, [userAddress]);

  const addToast = (type: "success" | "error" | "info", title: string, message: string, txHash?: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, title, message, txHash }]);
    setTimeout(() => {
      removeToast(id);
    }, 6000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const fetchBalances = async () => {
    if (!userAddress) {
      // Just fetch vault balance
      setIsBalancesLoading(true);
      try {
        const vaultAccount = await server.loadAccount(VAULT_PUBLIC_KEY);
        const vaultXlm = vaultAccount.balances.find((b) => b.asset_type === "native")?.balance || "0.0000000";
        setVaultBalance(vaultXlm);
      } catch (error) {
        console.error("Error loading vault account:", error);
      } finally {
        setIsBalancesLoading(false);
      }
      return;
    }

    setIsBalancesLoading(true);
    try {
      // Fetch User Balance
      let userXlm = "0.0000000";
      try {
        const userAccount = await server.loadAccount(userAddress);
        userXlm = userAccount.balances.find((b) => b.asset_type === "native")?.balance || "0.0000000";
      } catch (err: any) {
        // If account not found (404), it needs funding
        if (err.response?.status === 404) {
          userXlm = "0.0000000 (Unfunded)";
        } else {
          throw err;
        }
      }
      setUserBalance(userXlm);

      // Fetch Vault Balance
      const vaultAccount = await server.loadAccount(VAULT_PUBLIC_KEY);
      const vaultXlm = vaultAccount.balances.find((b) => b.asset_type === "native")?.balance || "0.0000000";
      setVaultBalance(vaultXlm);
    } catch (error) {
      console.error("Error loading account balances:", error);
      addToast("error", "Horizon Error", "Failed to retrieve balances from Stellar Testnet.");
    } finally {
      setIsBalancesLoading(false);
    }
  };

  // Connect Freighter Wallet
  const connectWallet = async () => {
    setIsWalletLoading(true);
    try {
      if (await isConnected()) {
        const result = await requestAccess();
        if (result && result.address) {
          const publicKey = result.address;
          setUserAddress(publicKey);
          sessionStorage.setItem("stellar_connected_address", publicKey);
          addToast("success", "Wallet Connected", `Successfully linked Freighter: ${publicKey.substring(0, 5)}...${publicKey.substring(52)}`);
        } else {
          const errorMsg = (result as any)?.error || "Unable to get wallet address. Please unlock Freighter.";
          addToast("error", "Connection Failed", errorMsg);
        }
      } else {
        addToast("info", "Freighter Required", "Please install the Freighter wallet extension to deposit.");
        window.open("https://www.freighter.app/", "_blank");
      }
    } catch (error: any) {
      console.error("Connection error:", error);
      addToast("error", "Connection Rejected", error.message || "User rejected the connection request.");
    } finally {
      setIsWalletLoading(false);
    }
  };

  // Disconnect Freighter Wallet
  const disconnectWallet = () => {
    setUserAddress("");
    setUserBalance("0.0000000");
    sessionStorage.removeItem("stellar_connected_address");
    addToast("info", "Disconnected", "Your Freighter session has been closed.");
  };

  // Fund user wallet via Friendbot for easier review testing
  const handleFundWallet = async () => {
    if (!userAddress) return;
    setIsFundingWallet(true);
    addToast("info", "Requesting Funds", "Requesting 10,000 Testnet XLM from Friendbot...");
    try {
      const success = await fundAccount(userAddress);
      if (success) {
        addToast("success", "Account Funded", "Successfully received 10,000 XLM on Testnet.");
        fetchBalances();
      } else {
        addToast("error", "Funding Failed", "Friendbot was unable to fund this address. Please try again.");
      }
    } catch (error) {
      console.error(error);
      addToast("error", "Error", "An error occurred while funding.");
    } finally {
      setIsFundingWallet(false);
    }
  };

  // Deposit transaction flow
  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAddress) {
      addToast("error", "Wallet Not Connected", "Please connect your Freighter wallet first.");
      return;
    }

    const amountNum = parseFloat(depositAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      addToast("error", "Invalid Amount", "Please enter a positive transaction amount.");
      return;
    }

    // Check if user has sufficient funds (assuming 1.5 XLM reserve + fee)
    const rawBalance = parseFloat(userBalance);
    if (isNaN(rawBalance) || rawBalance < amountNum + 1) {
      addToast("error", "Insufficient Balance", "Make sure you have enough XLM (including fees/reserve).");
      return;
    }

    setIsLoading(true);
    try {
      addToast("info", "Preparing Transaction", "Fetching account sequence and building transaction...");
      
      // 1. Fetch latest account details for transaction sequence number
      const account = await server.loadAccount(userAddress);

      // 2. Build the transaction (sending XLM from User to Piggy Bank)
      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: VAULT_PUBLIC_KEY,
            asset: Asset.native(),
            amount: depositAmount,
          })
        )
        .setTimeout(30)
        .build();

      // 3. Request user signature via Freighter
      addToast("info", "Signing Transaction", "Please sign the payment transaction in your Freighter extension.");
      const xdr = tx.toXDR();
      
      const result = await signTransaction(xdr, { networkPassphrase: Networks.TESTNET });
      const signedXdr = typeof result === "string" ? result : result.signedTxXdr;

      if (!signedXdr) {
        throw new Error("Freighter signature was rejected or returned empty.");
      }

      // 4. Submit to the Stellar Testnet
      addToast("info", "Submitting Transaction", "Broadcasting transaction to Horizon Testnet...");
      const txResult = await server.submitTransaction(
        TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET)
      );

      if (txResult.hash) {
        // Success state!
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 }
        });

        addToast(
          "success",
          "Deposit Successful",
          `Successfully saved ${depositAmount} XLM to your Future Self Vault!`,
          txResult.hash
        );

        // Add to history
        const newHistoryItem: DepositHistoryItem = {
          id: Date.now().toString(),
          amount: depositAmount,
          txHash: txResult.hash,
          timestamp: Date.now()
        };
        const updatedHistory = [newHistoryItem, ...history].slice(0, 10);
        setHistory(updatedHistory);
        localStorage.setItem("stellar_piggy_history", JSON.stringify(updatedHistory));

        // Reset inputs & refresh balances
        setDepositAmount("");
        fetchBalances();
      }
    } catch (error: any) {
      console.error("Transaction failed:", error);
      const errorMsg = error.response?.data?.extras?.result_codes?.transaction || error.message || "Submission failed.";
      addToast("error", "Transaction Failed", `Error details: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(label);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  // Helper formatting values
  const formatAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 6)}`;
  };

  // Milestone Math
  const parsedVaultBal = parseFloat(vaultBalance) || 0;
  const progressPercent = Math.min(Math.round((parsedVaultBal / savingGoal) * 100), 100);

  return (
    <div className="app-container">
      <div className="space-stars"></div>

      {/* Header component */}
      <header className="header">
        <div className="logo-container">
          <div className="logo-text">
            <span>🐖</span> FutureSelf <span className="logo-sub">// Piggy Bank</span>
          </div>
          <span className="btn-secondary" style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", borderRadius: "8px", pointerEvents: "none", color: "var(--primary-pink)", borderColor: "rgba(236, 72, 153, 0.2)" }}>
            TESTNET
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
            <button 
              onClick={connectWallet} 
              disabled={isWalletLoading} 
              className="btn btn-primary"
            >
              {isWalletLoading ? (
                <>
                  <Loader2 className="spinner" /> Connecting...
                </>
              ) : (
                <>
                  <Wallet size={18} /> Connect Wallet
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Grid Section */}
      <main style={{ flex: 1 }}>
        <div className="grid-2col">
          {/* User Wallet Card */}
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
                  <button 
                    onClick={() => copyToClipboard(userAddress, 'wallet')} 
                    style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center" }}
                  >
                    {copiedAddress === 'wallet' ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
                  </button>
                </div>
                
                <div className="input-label">Available Balance</div>
                <div className="balance-value-container">
                  <span className="balance-large">{userBalance.split(" ")[0]}</span>
                  <span className="balance-denom">XLM</span>
                </div>

                {userBalance.includes("Unfunded") && (
                  <div style={{ marginTop: "1rem" }}>
                    <p style={{ fontSize: "0.8rem", color: "var(--accent-amber)", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <AlertCircle size={14} /> This Testnet wallet needs funding.
                    </p>
                    <button 
                      onClick={handleFundWallet}
                      disabled={isFundingWallet}
                      className="btn btn-secondary"
                      style={{ width: "100%", fontSize: "0.85rem", padding: "0.5rem" }}
                    >
                      {isFundingWallet ? (
                        <>
                          <Loader2 className="spinner" /> Funding Wallet...
                        </>
                      ) : (
                        "Fund 10,000 XLM with Friendbot"
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "2.5rem 0", color: "var(--text-muted)" }}>
                <Wallet size={48} style={{ opacity: 0.3, marginBottom: "1rem" }} />
                <p>Please connect your Freighter wallet to check your XLM balance.</p>
              </div>
            )}
          </div>

          {/* Vault Card */}
          <div className="glass-card">
            <div className="card-title-section" style={{ justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div className="card-title-icon icon-pink">
                  <PiggyBank size={20} />
                </div>
                <h3>Your Vault</h3>
              </div>
              <button 
                onClick={fetchBalances} 
                disabled={isBalancesLoading}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center" }}
                title="Refresh Balances"
              >
                <RefreshCw size={16} className={isBalancesLoading ? "spinner" : ""} />
              </button>
            </div>

            <div className="input-label" style={{ marginBottom: "0.25rem" }}>Vault Key (Static Testnet Address)</div>
            <div className="address-display">
              <span>{formatAddress(VAULT_PUBLIC_KEY)}</span>
              <button 
                onClick={() => copyToClipboard(VAULT_PUBLIC_KEY, 'vault')} 
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center" }}
              >
                {copiedAddress === 'vault' ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
              </button>
            </div>

            <div className="input-label">Locked Total Savings</div>
            <div className="balance-value-container">
              <span className="balance-large" style={{ color: "var(--primary-pink)" }}>
                {vaultBalance}
              </span>
              <span className="balance-denom" style={{ color: "var(--primary-pink)" }}>XLM</span>
            </div>

            <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
              <a 
                href={`https://stellar.expert/explorer/testnet/account/${VAULT_PUBLIC_KEY}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="toast-link"
                style={{ display: "flex", alignItems: "center", gap: "0.25rem", margin: 0, textDecoration: "none" }}
              >
                View Vault on StellarExpert <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>

        {/* Action Panel & Savings Milestones */}
        <div className="grid-2col">
          {/* Action Card */}
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
                    type="number"
                    step="0.0000001"
                    min="0.0000001"
                    placeholder="e.g. 10.5"
                    className="input-field"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    required
                    disabled={isLoading || !userAddress}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: "100%", padding: "1rem" }}
                disabled={isLoading || !userAddress || !depositAmount}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="spinner" /> Securing Funds...
                  </>
                ) : (
                  <>
                    Deposit to the Future 🚀
                  </>
                )}
              </button>

              {!userAddress && (
                <p style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Connect Freighter Wallet above to enable deposits.
                </p>
              )}
            </form>
          </div>

          {/* Goal Milestone Card */}
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
              <label className="input-label">Goal Target: {savingGoal} XLM</label>
              <input 
                type="range" 
                min="10" 
                max="1000" 
                step="10"
                value={savingGoal}
                onChange={(e) => setSavingGoal(parseInt(e.target.value))}
                style={{ width: "100%", accentColor: "var(--primary-pink)", cursor: "pointer", height: "6px", borderRadius: "3px" }}
              />
            </div>

            <div className="milestone-section">
              <div className="milestone-header">
                <span>Milestone Goal Progress</span>
                <span style={{ fontWeight: 700, color: "var(--primary-pink)" }}>
                  {progressPercent}%
                </span>
              </div>
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                <span>{parsedVaultBal.toFixed(2)} XLM Saved</span>
                <span>Target: {savingGoal} XLM</span>
              </div>
            </div>

            {progressPercent >= 100 && (
              <div style={{ marginTop: "1rem", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "12px", padding: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--accent-emerald)" }}>
                <Sparkles size={16} />
                <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Milestone achieved! You've locked in your goal! 🎉</span>
              </div>
            )}
          </div>
        </div>

        {/* History List */}
        {history.length > 0 && (
          <div className="glass-card" style={{ marginTop: "1.5rem" }}>
            <div className="card-title-section">
              <div className="card-title-icon icon-purple">
                <History size={20} />
              </div>
              <h3>Recent Locked Deposits</h3>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {history.map((item) => (
                <div 
                  key={item.id}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: "rgba(0, 0, 0, 0.15)", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.03)" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-emerald)" }}></div>
                    <div>
                      <div style={{ color: "var(--text-title)", fontWeight: 600, fontSize: "0.9rem" }}>
                        +{item.amount} XLM Locked
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {new Date(item.timestamp).toLocaleTimeString()} • {new Date(item.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  <a 
                    href={`https://stellar.expert/explorer/testnet/tx/${item.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: "0.8rem", color: "var(--accent-blue)", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.25rem" }}
                  >
                    Details <ExternalLink size={12} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>FutureSelf // Built for Stellar Level 1. Lock in assets today for a decentralised tomorrow.</p>
      </footer>

      {/* Notifications / Toast Stack */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <div className="toast-icon">
              {toast.type === "success" && <CheckCircle2 className="text-emerald" style={{ color: "var(--accent-emerald)" }} size={20} />}
              {toast.type === "error" && <AlertCircle style={{ color: "#ef4444" }} size={20} />}
              {toast.type === "info" && <Loader2 className="spinner" style={{ color: "var(--accent-blue)" }} size={20} />}
            </div>
            <div className="toast-content">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-msg">{toast.message}</div>
              {toast.txHash && (
                <a 
                  href={`https://stellar.expert/explorer/testnet/tx/${toast.txHash}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="toast-link"
                >
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
