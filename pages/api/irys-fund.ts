import { NextApiRequest, NextApiResponse } from 'next';
import { Uploader } from '@irys/upload';
import { Solana } from '@irys/upload-solana';

// Initialize Irys instance for server-side operations
const getIrysUploader = async () => {
  if (!process.env.FUND_WALLET_PRIVATE_KEY) {
    throw new Error('FUND_WALLET_PRIVATE_KEY not configured');
  }

  // Use the Node.js SDK for server-side operations
  const irysUploader = await Uploader(Solana)
    .withWallet(process.env.FUND_WALLET_PRIVATE_KEY)
    .withRpc('https://api.mainnet-beta.solana.com'); // Server can use this RPC

  console.log(`[getIrysUploader] Server Irys address: ${irysUploader.address}`);
  return irysUploader;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userAddress, amount } = req.body;

    if (!userAddress || !amount) {
      return res.status(400).json({ error: 'Missing userAddress or amount' });
    }

    // Get server's Irys instance
    const irysUploader = await getIrysUploader();

    // Direct funding approach: Server funds its own Irys account first
    // Then the user can use uploadWithReceipt which will use the server's funded balance

    // Check current server Irys balance
    const serverBalance = await irysUploader.getLoadedBalance();
    console.log(`[irys-fund] Server Irys balance: ${serverBalance.toString()}`);

    // Fund the server's Irys account if needed
    const fundResult = await irysUploader.fund(amount);
    console.log(`[irys-fund] Funded server account:`, {
      id: fundResult.id,
      quantity: fundResult.quantity,
      reward: fundResult.reward,
    });

    // Alternative approach: Transfer funds directly to user's Irys address
    // This would require implementing a custom transfer mechanism

    return res.status(200).json({
      success: true,
      fundTx: {
        id: fundResult.id,
        amount: fundResult.quantity,
        reward: fundResult.reward,
      },
      serverAddress: irysUploader.address,
      message: 'Server Irys account funded successfully',
    });
  } catch (error) {
    console.error('[irys-fund] Error:', error);
    return res.status(500).json({
      error: 'Failed to create balance approval',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Configure API route
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
