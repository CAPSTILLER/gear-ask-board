import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { BASE_CHAIN_ID } from '../wallet/config'

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

export function WalletButton() {
  const { address, isConnected, chainId } = useAccount()
  const { connect, connectors, isPending, error } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: switching } = useSwitchChain()

  const wrongNetwork = isConnected && chainId !== BASE_CHAIN_ID

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        {wrongNetwork ? (
          <button
            type="button"
            disabled={switching}
            onClick={() => switchChain?.({ chainId: BASE_CHAIN_ID })}
            className="text-[10px] uppercase tracking-wider text-amber-300 border border-amber-500/40 rounded-md px-2 py-1 hover:bg-amber-500/10"
          >
            Switch to Base
          </button>
        ) : (
          <span
            className="text-[10px] text-cap-steel tabular-nums hidden sm:inline"
            title={address}
          >
            {shortAddr(address)} · Base
          </span>
        )}
        <button
          type="button"
          onClick={() => disconnect()}
          className="text-[10px] uppercase tracking-wider text-cap-steel hover:text-cap-gold border border-cap-border rounded-md px-2 py-1"
        >
          Disconnect
        </button>
      </div>
    )
  }

  const injected = connectors.find((c) => c.id === 'injected' || c.type === 'injected')
  const coinbase = connectors.find(
    (c) => c.id === 'coinbaseWalletSDK' || c.name.toLowerCase().includes('coinbase'),
  )

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          const c = injected ?? connectors[0]
          if (c) connect({ connector: c, chainId: BASE_CHAIN_ID })
        }}
        className="text-[10px] uppercase tracking-wider text-cap-gold border border-cap-gold/40 rounded-md px-2.5 py-1 hover:bg-cap-gold/10 disabled:opacity-40"
      >
        {isPending ? 'Connecting…' : 'Connect wallet'}
      </button>
      {coinbase && coinbase !== injected && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => connect({ connector: coinbase, chainId: BASE_CHAIN_ID })}
          className="text-[10px] uppercase tracking-wider text-cap-steel border border-cap-border rounded-md px-2 py-1 hover:border-cap-gold-dim hidden sm:inline"
        >
          Coinbase
        </button>
      )}
      {error && (
        <span className="text-[9px] text-amber-400 max-w-[8rem] truncate" title={error.message}>
          {error.message}
        </span>
      )}
    </div>
  )
}
