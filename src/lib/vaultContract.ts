import {
  Contract,
  nativeToScVal,
  scValToNative,
  rpc,
  Horizon,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Account,
  xdr,
} from "@stellar/stellar-sdk";

export const SOROBAN_RPC_URL = import.meta.env.VITE_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
export const HORIZON_URL = import.meta.env.VITE_HORIZON_URL || "https://horizon-testnet.stellar.org";
export const VAULT_CONTRACT_ID = import.meta.env.VITE_VAULT_CONTRACT_ID || "";
export const NETWORK_PASSPHRASE = Networks.TESTNET;

export const rpcServer = new rpc.Server(SOROBAN_RPC_URL);
export const horizonServer = new Horizon.Server(HORIZON_URL);


// Dummy account for read-only simulation
const DUMMY_ACCOUNT = new Account("GA7YBE2XEXUXD5T5RUGJ3VAKZJ4N3D5CWWK4LMMQNTZQZ3JUXZ5G3B4D", "0");

export const getVaultContract = () => {
  if (!VAULT_CONTRACT_ID) {
    throw new Error("Vault Contract ID is missing from .env");
  }
  return new Contract(VAULT_CONTRACT_ID);
};

export const xlmToStroops = (xlm: string): bigint => {
  return BigInt(Math.round(parseFloat(xlm) * 10000000));
};

export const stroopsToXlm = (stroops: bigint | number | string): string => {
  return (Number(stroops) / 10000000).toFixed(7);
};

export const simulateReadCall = async (op: xdr.Operation) => {
  const tx = new TransactionBuilder(DUMMY_ACCOUNT, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(30)
    .build();

  const simulation = await rpcServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation failed: ${simulation.error}`);
  }
  if (rpc.Api.isSimulationSuccess(simulation)) {
    return scValToNative(simulation.result.retval);
  }
  throw new Error("Simulation neither successful nor error");
};

export const getVaultBalance = async (userAddress: string): Promise<string> => {
  if (!VAULT_CONTRACT_ID) return "0.0000000";
  try {
    const contract = getVaultContract();
    const op = contract.call("get_balance", nativeToScVal(userAddress, { type: "address" }));
    const result = await simulateReadCall(op);
    return stroopsToXlm(result as bigint);
  } catch (err) {
    console.error("Error fetching vault balance:", err);
    return "0.0000000";
  }
};

export const getVaultMilestone = async (userAddress: string): Promise<number> => {
  if (!VAULT_CONTRACT_ID) return 0;
  try {
    const contract = getVaultContract();
    const op = contract.call("get_milestone", nativeToScVal(userAddress, { type: "address" }));
    const result = await simulateReadCall(op);
    return Number(stroopsToXlm(result as bigint));
  } catch (err) {
    console.error("Error fetching vault milestone:", err);
    return 0;
  }
};

export const buildDepositOp = (fromAddress: string, amountXlm: string): xdr.Operation => {
  const contract = getVaultContract();
  return contract.call(
    "deposit",
    nativeToScVal(fromAddress, { type: "address" }),
    nativeToScVal(xlmToStroops(amountXlm), { type: "i128" })
  );
};

export const buildSetMilestoneOp = (whoAddress: string, targetXlm: string): xdr.Operation => {
  const contract = getVaultContract();
  return contract.call(
    "set_milestone",
    nativeToScVal(whoAddress, { type: "address" }),
    nativeToScVal(xlmToStroops(targetXlm), { type: "i128" })
  );
};

export const buildWithdrawOp = (toAddress: string, amountXlm: string): xdr.Operation => {
  const contract = getVaultContract();
  return contract.call(
    "withdraw",
    nativeToScVal(toAddress, { type: "address" }),
    nativeToScVal(xlmToStroops(amountXlm), { type: "i128" })
  );
};
