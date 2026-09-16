import type { ClientEvmSigner } from '@x402/evm'
import type { WalletClient } from 'viem'

/** Adapt a wagmi/viem wallet client into an x402 ClientEvmSigner. */
export function walletClientToX402Signer(
  walletClient: WalletClient,
  address: `0x${string}`,
  publicClient?: { readContract: (args: never) => Promise<unknown> } | null,
): ClientEvmSigner {
  return {
    address,
    async signTypedData(message) {
      const sig = await walletClient.signTypedData({
        account: address,
        domain: message.domain as Record<string, unknown>,
        types: message.types as Record<string, Array<{ name: string; type: string }>>,
        primaryType: message.primaryType as string,
        message: message.message as Record<string, unknown>,
      } as Parameters<WalletClient['signTypedData']>[0])
      return sig
    },
    async readContract(args) {
      if (!publicClient) throw new Error('Public client required for readContract')
      return publicClient.readContract(args as never)
    },
  }
}
