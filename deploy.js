import { Keypair, rpc, TransactionBuilder, Networks, Operation, xdr, Address, scValToNative } from "@stellar/stellar-sdk";
import fs from "fs";
import crypto from "crypto";

const NETWORK_PASSPHRASE = Networks.TESTNET;
const RPC_URL = "https://soroban-testnet.stellar.org";
const server = new rpc.Server(RPC_URL);

async function fundWithFriendbot(publicKey) {
  try {
    console.log("Funding account via Friendbot...");
    const res = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
    console.log("Friendbot status:", res.status);
    await res.json();
  } catch (e) {
    console.error("Friendbot failed:", e);
  }
}

async function deployContract() {
  const keypair = Keypair.random();
  console.log("Generated Keypair:", keypair.publicKey());
  
  await fundWithFriendbot(keypair.publicKey());

  let account = await server.getAccount(keypair.publicKey());

  const wasmPath = "./contracts/vault/target/future_self_vault.wasm";
  const wasm = fs.readFileSync(wasmPath);
  
  console.log("Uploading WASM...");
  const uploadOp = Operation.invokeHostFunction({
    func: xdr.HostFunction.hostFunctionTypeUploadContractWasm(wasm),
    auth: [],
  });

  let tx1 = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(uploadOp)
    .setTimeout(60)
    .build();

  let simulation = await server.simulateTransaction(tx1);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`WASM Upload Simulation failed: ${simulation.error}`);
  }

  // Reload account for fresh sequence
  account = await server.getAccount(keypair.publicKey());

  tx1 = new TransactionBuilder(account, {
    fee: "10000000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(uploadOp)
    .setSorobanData(simulation.transactionData.build())
    .setTimeout(60)
    .build();

  tx1.sign(keypair);

  let submitResponse = await server.sendTransaction(tx1);
  if (submitResponse.status === "ERROR") {
    console.error("WASM Upload rejected!");
    throw new Error("WASM Upload Error");
  }

  console.log("Upload Tx Hash:", submitResponse.hash);
  
  let uploadStatus = await server.getTransaction(submitResponse.hash);
  let attempts = 0;
  while (uploadStatus.status === rpc.Api.GetTransactionStatus.NOT_FOUND && attempts < 30) {
    attempts++;
    await new Promise(r => setTimeout(r, 2000));
    uploadStatus = await server.getTransaction(submitResponse.hash);
  }

  if (uploadStatus.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error("WASM upload failed");
  }

  const wasmHash = simulation.result.retval.value().toString("hex");
  console.log("WASM Uploaded. Hash:", wasmHash);

  console.log("Instantiating Contract...");
  
  let salt = crypto.randomBytes(32);
  const createOpArgs = new xdr.CreateContractArgs({
    contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
      new xdr.ContractIdPreimageFromAddress({
        address: Address.fromString(keypair.publicKey()).toScAddress(),
        salt: salt,
      })
    ),
    executable: xdr.ContractExecutable.contractExecutableWasm(
      Buffer.from(wasmHash, "hex")
    ),
  });

  const createOp = Operation.invokeHostFunction({
    func: xdr.HostFunction.hostFunctionTypeCreateContract(createOpArgs),
    auth: [],
  });

  account = await server.getAccount(keypair.publicKey());
  
  let tx2 = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(createOp)
    .setTimeout(60)
    .build();

  let simulation2 = await server.simulateTransaction(tx2);
  if (rpc.Api.isSimulationError(simulation2)) {
    throw new Error(`Contract instantiation Simulation failed: ${simulation2.error}`);
  }

  // Reload account for fresh sequence again
  account = await server.getAccount(keypair.publicKey());

  const createOpWithAuth = Operation.invokeHostFunction({
    func: xdr.HostFunction.hostFunctionTypeCreateContract(createOpArgs),
    auth: simulation2.result ? (simulation2.result.auth || []) : [],
  });

  tx2 = new TransactionBuilder(account, {
    fee: "10000000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(createOpWithAuth)
    .setSorobanData(simulation2.transactionData.build())
    .setTimeout(60)
    .build();

  tx2.sign(keypair);

  let submitResponse2 = await server.sendTransaction(tx2);
  if (submitResponse2.status === "ERROR") {
    throw new Error("Create Error");
  }

  console.log("Create Tx Hash:", submitResponse2.hash);
  
  let createStatus = await server.getTransaction(submitResponse2.hash);
  attempts = 0;
  while (createStatus.status === rpc.Api.GetTransactionStatus.NOT_FOUND && attempts < 30) {
    attempts++;
    await new Promise(r => setTimeout(r, 2000));
    createStatus = await server.getTransaction(submitResponse2.hash);
  }

  if (createStatus.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    console.error("Contract instantiation failed. Status:", createStatus.status);
    throw new Error("Contract instantiation failed");
  }

  const contractIdBuffer = createStatus.returnValue.value();
  const contractIdStr = scValToNative(createStatus.returnValue);
  console.log("======================================");
  console.log("CONTRACT SUCCESSFULLY DEPLOYED!");
  console.log("Contract ID:", contractIdStr);
  console.log("======================================");
}

deployContract().catch(console.error);
