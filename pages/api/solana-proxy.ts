import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// Configure CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[solana-proxy] Proxying request to Solana public RPC');

    // Forward the request to Solana RPC using axios
    const response = await axios.post(
      'https://solana.public-rpc.com/',
      req.body,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 second timeout
      }
    );

    // Add CORS headers to response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Return the response
    res.status(200).json(response.data);
  } catch (error: any) {
    console.error('[solana-proxy] Proxy error:', error);

    // Handle axios error
    if (error.response) {
      // The request was made and the server responded with a status code
      console.error('[solana-proxy] RPC error response:', error.response.data);
      return res.status(error.response.status).json(error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('[solana-proxy] No response received from RPC');
      return res.status(503).json({
        error: 'No response from Solana RPC',
        message: 'The RPC server did not respond',
      });
    } else {
      // Something else happened
      const errorDetails = {
        error: 'Failed to proxy request to Solana RPC',
        message: error.message || 'Unknown error',
        type: error.name || 'UnknownError',
      };

      res.status(500).json(errorDetails);
    }
  }
}

// Disable body parsing to handle raw JSON
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
