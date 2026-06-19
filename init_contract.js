import { Keypair, rpc, TransactionBuilder, Networks, Contract, nativeToScVal, Asset } from "@stellar/stellar-sdk";

const server = new rpc.Server("https://soroban-testnet.stellar.org");
const NETWORK_PASSPHRASE = Networks.TESTNET;
const contractId = "CAGXMPDMI5RY27OREPRV2IAWLT3S432ACKC74LNXWXSLEV6RJ3DODSKC";

async function run() {
  const admin = Keypair.random();
  console.log("Funding admin:", admin.publicKey());
  await fetch(`https://friendbot.stellar.org?addr=${admin.publicKey()}`);
  
  let account = await server.getAccount(admin.publicKey());
  const nativeTokenId = Asset.native().contractId(NETWORK_PASSPHRASE);
  console.log("Initializing with native token:", nativeTokenId);
  
  const contract = new Contract(contractId);
  const op = contract.call("initialize", nativeToScVal(nativeTokenId, { type: "address" }));
  
  let tx = new TransactionBuilder(account, { fee: "100", networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(op).setTimeout(60).build();
    
  let sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  
  account = await server.getAccount(admin.publicKey());
  tx = rpc.assembleTransaction(tx, sim).build();
  tx.sign(admin);
  
  let res = await server.sendTransaction(tx);
  console.log("Sent! Hash:", res.hash);
  
  let status = await server.getTransaction(res.hash);
  while(status.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
    await new Promise(r => setTimeout(r, 2000));
    status = await server.getTransaction(res.hash);
  }
  console.log("Status:", status.status);
}
run().catch(console.error);
