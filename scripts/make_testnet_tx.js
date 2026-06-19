import { Keypair, rpc, TransactionBuilder, Networks, Contract, nativeToScVal, scValToNative } from "@stellar/stellar-sdk";

const NETWORK_PASSPHRASE = Networks.TESTNET;
const RPC_URL = "https://soroban-testnet.stellar.org";
const server = new rpc.Server(RPC_URL);
const contractId = "CAGXMPDMI5RY27OREPRV2IAWLT3S432ACKC74LNXWXSLEV6RJ3DODSKC";

async function fundWithFriendbot(publicKey) {
  try {
    console.log(`Funding account ${publicKey} via Friendbot...`);
    const res = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
    console.log("Friendbot status:", res.status);
    await res.json();
    console.log("Account successfully funded!");
  } catch (e) {
    console.error("Friendbot failed:", e);
    throw e;
  }
}

async function run() {
  const keypair = Keypair.random();
  console.log("Generated Keypair:", keypair.publicKey());

  await fundWithFriendbot(keypair.publicKey());

  // Wait a short moment for Horizon/Friendbot ledger to close
  await new Promise(r => setTimeout(r, 3000));

  console.log("Retrieving account details...");
  let account = await server.getAccount(keypair.publicKey());

  console.log("Building set_milestone transaction...");
  const contract = new Contract(contractId);
  // Setting a milestone of 150 XLM (1,500,000,000 stroops)
  const milestoneStroops = BigInt(150 * 10000000);
  const op = contract.call(
    "set_milestone",
    nativeToScVal(keypair.publicKey(), { type: "address" }),
    nativeToScVal(milestoneStroops, { type: "i128" })
  );

  let tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  console.log("Simulating transaction...");
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  console.log("Assembling transaction with simulation results...");
  account = await server.getAccount(keypair.publicKey());
  tx = rpc.assembleTransaction(tx, sim).build();

  console.log("Signing transaction...");
  tx.sign(keypair);

  console.log("Sending transaction to RPC...");
  let submitResponse = await server.sendTransaction(tx);
  if (submitResponse.status === "ERROR") {
    throw new Error(`Submit transaction failed: ${JSON.stringify(submitResponse)}`);
  }

  console.log("Submitted! Tx Hash:", submitResponse.hash);

  console.log("Polling transaction status...");
  let attempts = 0;
  let status = await server.getTransaction(submitResponse.hash);
  while (status.status === rpc.Api.GetTransactionStatus.NOT_FOUND && attempts < 30) {
    attempts++;
    console.log(`Polling status... attempt ${attempts}`);
    await new Promise(r => setTimeout(r, 2000));
    status = await server.getTransaction(submitResponse.hash);
  }

  console.log("Final status:", status.status);
  if (status.status === rpc.Api.GetTransactionStatus.SUCCESS) {
    console.log("======================================");
    console.log("TRANSACTION SUCCESSFULLY COMPLETED!");
    console.log("Tx Hash:", submitResponse.hash);
    console.log("======================================");
  } else {
    throw new Error(`Transaction failed or timed out. Status: ${status.status}`);
  }
}

run().catch(err => {
  console.error("Error running transaction:", err);
  process.exit(1);
});
