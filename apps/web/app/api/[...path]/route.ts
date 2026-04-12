/**
 * Transparent proxy — forwards all /api/* requests from the Next.js frontend
 * to the backend server. This means NEXT_PUBLIC_API_URL is never needed;
 * the backend URL lives only in the server-side API_URL env var which can be
 * updated in Vercel dashboard without a redeploy.
 */

export const dynamic = 'force-dynamic';

const BACKEND = process.env.API_URL || 'http://localhost:3001';

async function proxy(req: Request, params: { path: string[] }): Promise<Response> {
  const pathStr = params.path.join('/');
  const incoming = new URL(req.url);
  const target = `${BACKEND}/api/${pathStr}${incoming.search}`;

  // Forward all headers, inject bypass header for localtunnel
  const headers = new Headers(req.headers);
  headers.set('bypass-tunnel-reminder', '1');
  headers.delete('host'); // must not forward host to avoid conflicts

  const isBodyMethod = !['GET', 'HEAD'].includes(req.method.toUpperCase());
  const body = isBodyMethod ? await req.arrayBuffer() : undefined;

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body,
  });

  const responseHeaders = new Headers(upstream.headers);
  // Allow CORS from Vercel frontend
  responseHeaders.set('Access-Control-Allow-Origin', '*');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET    = (req: Request, { params }: { params: { path: string[] } }) => proxy(req, params);
export const POST   = (req: Request, { params }: { params: { path: string[] } }) => proxy(req, params);
export const PUT    = (req: Request, { params }: { params: { path: string[] } }) => proxy(req, params);
export const PATCH  = (req: Request, { params }: { params: { path: string[] } }) => proxy(req, params);
export const DELETE = (req: Request, { params }: { params: { path: string[] } }) => proxy(req, params);
