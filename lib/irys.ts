// lib/irys.ts
import { WebUploader } from '@irys/web-upload';
import { WebSolana } from '@irys/web-upload-solana';

export async function createIrysUploader(wallet?: any) {
  try {
    if (!wallet) {
      console.log("No wallet provided, creating read-only uploader");
      // For read-only operations without wallet
      return await WebUploader(WebSolana);
    }

    if (!wallet.connected) {
      throw new Error("Wallet not connected");
    }

    console.log("Creating Irys uploader with wallet:", wallet.publicKey?.toBase58());
    
    // Use the wallet object directly with withProvider as per documentation
    const irysUploader = await WebUploader(WebSolana).withProvider(wallet);
    
    console.log(`Connected to Irys from ${irysUploader.address}`);
    return irysUploader;
    
  } catch (error) {
    console.error("Error connecting to Irys:", error);
    throw new Error("Error connecting to Irys");
  }
}
