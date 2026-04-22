/**
 * Next.js Pages Router catch-all API handler.
 *
 * Imports the Express app from apps/api and passes Node.js req/res directly.
 * Pages Router gives us real Node.js IncomingMessage / ServerResponse — exactly
 * what Express expects — so no bridging is needed.
 *
 * This replaces the App Router transparent proxy and eliminates the Railway
 * dependency entirely: the backend runs embedded in this Vercel serverless fn.
 */

// Load env vars before anything else (for local dev; Vercel injects them in prod)
import 'dotenv/config';

import type { NextApiRequest, NextApiResponse } from 'next';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — cross-workspace relative import, TS path not configured but bundler resolves it
import app from '../../api/src/app';

export const config = {
  api: {
    // Let Express handle body parsing (it has its own middleware)
    bodyParser: false,
    // Suppress Next.js warning about async handlers with no response
    externalResolver: true,
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (app as any)(req, res);
}
