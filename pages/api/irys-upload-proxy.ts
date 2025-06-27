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
    .withRpc('https://api.mainnet-beta.solana.com');

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
    const { data, tags, userAddress } = req.body;

    if (!data || !tags || !userAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get server's Irys instance
    const irysUploader = await getIrysUploader();

    // Add user address to tags for tracking
    const finalTags = [
      ...tags,
      { name: 'Uploaded-For', value: userAddress },
      { name: 'Uploaded-By', value: 'GitHirys-Server' },
    ];

    // Check price
    const dataBuffer = Buffer.from(data, 'base64');
    const price = await irysUploader.getPrice(dataBuffer.length);
    console.log(`[irys-upload-proxy] Upload price: ${price.toString()}`);

    // Check balance
    const balance = await irysUploader.getLoadedBalance();
    console.log(`[irys-upload-proxy] Current balance: ${balance.toString()}`);

    // Fund if needed
    if (balance.isLessThan(price)) {
      const fundAmount = price.minus(balance).multipliedBy(1.1); // 10% buffer
      console.log(`[irys-upload-proxy] Funding ${fundAmount.toString()}`);
      await irysUploader.fund(fundAmount);
    }

    // Upload on behalf of user
    const receipt = await irysUploader.upload(dataBuffer, { tags: finalTags });

    console.log(`[irys-upload-proxy] Upload successful:`, receipt.id);

    return res.status(200).json({
      success: true,
      id: receipt.id,
      timestamp: receipt.timestamp,
      version: receipt.version,
      public: receipt.public,
    });
  } catch (error) {
    console.error('[irys-upload-proxy] Error:', error);
    return res.status(500).json({
      error: 'Failed to upload via proxy',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Configure API route
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Allow larger uploads
    },
  },
};
