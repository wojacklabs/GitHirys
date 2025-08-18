# Irys Setup Guide for GitHirys

## Problem: RPC CORS Issues

Browser environments face CORS issues when accessing `solana.public-rpc.com` or `api.mainnet-beta.solana.com`.

## Solutions

### Option 1: Use Browser-Friendly RPC (Recommended)

Configure a browser-friendly RPC endpoint in your `.env.local`:

```bash
# Option A: Helius (Free tier available)
NEXT_PUBLIC_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY

# Option B: QuickNode
NEXT_PUBLIC_SOLANA_RPC_URL=https://YOUR_ENDPOINT.solana-mainnet.quiknode.pro/YOUR_KEY

# Option C: Alchemy
NEXT_PUBLIC_SOLANA_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

### Option 2: Use Wallet's Built-in RPC

Many wallets like Phantom and Solflare provide their own RPC endpoints:

1. Let Irys use the wallet's default connection
2. The wallet handles RPC connections internally
3. No additional configuration needed

### Option 3: Server-Side Proxy (Not Recommended)

While we implemented server-side upload proxy, it has drawbacks:

- All uploads appear from server wallet address
- Loses user attribution
- Centralizes control

## Current Implementation

1. **SolanaProvider**: Tries multiple RPC endpoints in order
2. **Irys Setup**: Uses wallet's connection without specifying RPC
3. **Fallback**: If custom RPC not provided, uses public endpoints

## Best Practice

1. Get a free API key from Helius, QuickNode, or Alchemy
2. Set `NEXT_PUBLIC_SOLANA_RPC_URL` in `.env.local`
3. Users upload with their own wallets
4. Maintains decentralization and proper attribution

## Testing

To test if your RPC works:

```javascript
const connection = new Connection(YOUR_RPC_URL);
const blockHeight = await connection.getBlockHeight();
console.log('RPC working, block height:', blockHeight);
```
