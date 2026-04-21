/**
 * Vercel serverless entry point.
 * Vercel will bundle this file and all its imports into a single serverless function.
 * All /api/* and /health requests are rewritten here by vercel.json.
 */
import app from '../src/app';

export default app;
