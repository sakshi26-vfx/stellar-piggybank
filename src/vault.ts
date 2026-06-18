/**
 * Static vault keypair details generated on Stellar Testnet.
 * In a real production app, this would be the address of a Soroban smart contract.
 */
export const VAULT_PUBLIC_KEY = "GCCHNHOTUASHKIG5FIO5ZGLJEKYGWC5BSUWZLHSMIVXNK6IOYAA2IYRU";

/**
 * Funds an account using the Stellar Testnet Friendbot.
 * Useful for funding a user's test address or checking vault funding.
 */
export async function fundAccount(address: string): Promise<boolean> {
  try {
    const response = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`);
    return response.ok;
  } catch (error) {
    console.error("Error calling Friendbot:", error);
    return false;
  }
}
