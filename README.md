# 🐖 FutureSelf // Stellar Piggy Bank (Level 2 - Soroban Edition)

**FutureSelf** is a premium, space-themed dark mode decentralised application (dApp) built on the **Stellar Testnet** for the Level 2 (Soroban Smart Contracts) Stellar developer challenge. It enables users to connect their preferred wallets (via StellarWalletsKit), monitor their balances, set visual saving milestones, and lock XLM directly into a **Soroban Smart Contract Vault**.

The project replaces the simple wallet-to-wallet transfer from Level 1 with full smart contract read/write invocations, utilizing the official `@stellar/stellar-sdk` to simulate, sign, and submit transactions.

---

## 📜 Soroban Smart Contract Details

- **Testnet Contract ID**: `CAGXMPDMI5RY27OREPRV2IAWLT3S432ACKC74LNXWXSLEV6RJ3DODSKC`
- **Deployment Transaction Hash**: `1c02d50755aa272e81329305df6a022c640380260cf9785761066a24ec05020a`
- The Rust source code for the contract is located in `contracts/vault`.

---

## 📸 Interface Preview & Screenshots

To satisfy the Level 1 challenge review requirements, here is the complete visual walkthrough of the application states:

### 1. Wallet Connected State & Balance Displayed
When a user connects their Freighter Wallet, the dApp queries the Stellar Horizon API to load and display their live testnet XLM balance alongside the target saving milestone.
![Wallet Connected & Balance Displayed](./screenshots/wallet_and_vault.png)

### 2. Transaction Flow (Freighter Signature Request)
When initiating a deposit (e.g. 30 XLM), the transaction is built using the Stellar SDK and sent to the Freighter browser extension for user signature.
![Transaction Confirmation](./screenshots/transaction_confirmation.png)

### 3. Successful Testnet Transaction & User Feedback
Once signed, the transaction is submitted to the Stellar Testnet. Upon success, confetti is triggered, a success toast notification appears showing the details, and a direct clickable link to **StellarExpert** is shown to verify the transaction hash.
![Transaction Success Feedback](./screenshots/milestone_achieved.png)

### 4. Wallet Connection Prompt (Unconnected State)
If the Freighter wallet is not connected, the app provides clean call-to-actions to prompt the user to link their wallet.
![Unconnected State](./screenshots/connecting_wallet.png)

### 5. Full Browser Dashboard view
The full layout of the app:
![Full App view](./screenshots/dashboard_full.png)

---

## 🎯 Level 2 Checklist Alignment

Our project satisfies the advanced Level 2 requirements:

| Requirement | Implementation Detail | Status |
| :--- | :--- | :---: |
| **Multi-Wallet Support** | Integrated `@creit.tech/stellar-wallets-kit` to allow users to connect Freighter, xBull, and Albedo wallets. | ✅ |
| **Smart Contract Deployment** | Deployed a custom Rust vault contract (`contracts/vault`) to the Soroban Testnet. | ✅ |
| **Contract Interactions** | Submits complex smart contract transactions utilizing `simulateTransaction` to estimate fees, fetch the auth footprint, and assemble transactions safely. | ✅ |
| **Contract Reads** | Invokes view functions (`get_balance` and `get_milestone`) live from the network to drive the UI. | ✅ |
| **Robust Error Handling** | Displays specific toasts for user signature rejections, insufficient wallet balance (detected during simulation), and ledger execution failures. | ✅ |
| **Status Feed & Badges** | Implemented a live `TxStatusBadge` indicating `building -> submitting -> awaiting-signature -> pending -> success` alongside an `ActivityFeed`. | ✅ |

---

## 🛠️ Tech Stack & Key Libraries

- **Framework**: React 19 + TypeScript + Vite
- **Stellar Connection**:
  - `@stellar/stellar-sdk` (v16.0) — for Soroban contract invocation and transaction building.
  - `@creit.tech/stellar-wallets-kit` — for seamless multi-wallet integrations.
- **Smart Contract**: Soroban Rust SDK (`soroban-sdk` v22.0)
- **Icons**: `lucide-react`
- **Effects**: `canvas-confetti`

---

## 🚀 Local Installation & Setup

To run this project on your machine, follow these steps:

### Prerequisites
1. Install [Node.js](https://nodejs.org/) (v18 or newer recommended).
2. Install the [Freighter Wallet browser extension](https://www.freighter.app/) and configure it to use the **Stellar Testnet**.

### Steps
1. **Clone the repository**:
   ```bash
   git clone <your-repository-url>
   cd stellar-piggybank-sakshi
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the local development server**:
   ```bash
   npm run dev
   ```

4. **Open in browser**:
   Navigate to `http://localhost:5173/` in your browser.

---

## 💡 How to Test the dApp

1. **Connect Wallet**: Click the **Connect Wallet** button in the header. If you haven't approved the site, Freighter will prompt you to authorize the connection.
2. **Fund Wallet (Faucet)**: If your Freighter account is new or has `0 XLM`, a warning banner will appear. Click **Fund 10,000 XLM with Friendbot** to automatically create and fund the wallet on the Testnet.
3. **Set a Savings Goal**: Drag the **Savings Milestone Goal** slider to select your target (e.g. `200 XLM`). The progress bar will automatically calculate how close the vault is to reaching this milestone.
4. **Make a Deposit**:
   - Enter an amount (e.g. `10`) in the input field.
   - Click **Deposit to the Future 🚀**.
   - Approve and sign the transaction in the Freighter popup window.
   - Watch the confetti celebrate your deposit, and click the link in the green success toast to check the transaction logs live on **StellarExpert**!
