/**
 * Next.js Pages Router catch-all API handler.
 *
 * Imports the Express app from apps/api and passes Node.js req/res directly.
 * Pages Router gives us real Node.js IncomingMessage / ServerResponse — exactly
 * what Express expects — so no bridging is needed.
 *
 * This replaces the App Router transparent proxy and eliminates the Railway
 * dependency entirely: the backend runs embedded in this Vercel serverless fn.
 *
 * Env vars come from apps/web/.env.production (loaded by Next.js before this runs).
 * dotenv is NOT imported here — it's only needed for the standalone Node.js server.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
// @ts-ignore — cross-workspace relative import resolved by webpack at build time
import app from '../../../api/src/app';

export const config = {
  api: {
    // Let Express handle body parsing (it has its own json/urlencoded middleware)
    bodyParser: false,
    // Suppress Next.js "API resolved without sending a response" warning
    externalResolver: true,
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Express app(req, res) — Pages Router req/res are Node.js IncomingMessage/ServerResponse
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (app as any)(req, res);
}
