import type { Request as ExpressReq, Response as ExpressRes } from 'express';

export function adaptExpress(
  handler: (req: Request, env?: Record<string, any>) => Promise<Response>
) {
  return async (req: ExpressReq, res: ExpressRes) => {
    try {
      const protocol = req.protocol || 'http';
      const host = req.get('host') || 'localhost';
      const url = `${protocol}://${host}${req.originalUrl || req.url}`;

      const headers = new Headers();
      for (const [key, val] of Object.entries(req.headers)) {
        if (typeof val === 'string') {
          headers.set(key, val);
        } else if (Array.isArray(val)) {
          headers.set(key, val.join(', '));
        }
      }

      const body = ['GET', 'HEAD'].includes(req.method.toUpperCase())
        ? undefined
        : JSON.stringify(req.body);

      const webReq = new Request(url, {
        method: req.method,
        headers,
        body,
      });

      const webRes = await handler(webReq, process.env as Record<string, string>);

      res.status(webRes.status);
      webRes.headers.forEach((val, key) => {
        res.setHeader(key, val);
      });

      const contentType = webRes.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') && webRes.body) {
        const reader = webRes.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
        } finally {
          res.end();
        }
      } else {
        const text = await webRes.text();
        res.send(text);
      }
    } catch (err: any) {
      console.error('[API Express Adapter Error]', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || 'Internal Server Error' });
      }
    }
  };
}
