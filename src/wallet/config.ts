import { http, createConfig, createStorage } from 'wagmi'
import { base } from 'wagmi/chains'
import { injected, coinbaseWallet } from 'wagmi/connectors'

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    injected({ shimDisconnect: true }),
    coinbaseWallet({ appName: 'Gear Ask', preference: 'all' }),
  ],
  transports: {
    [base.id]: http(),
  },
  storage: createStorage({ storage: localStorage }),
  ssr: false,
})

export const BASE_CHAIN_ID = base.id
export { base }
