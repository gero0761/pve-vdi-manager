import { handler } from './build/handler.js';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import { URL } from 'url';

// Umgebungsvariablen laden (wie loadEnv in Vite)
dotenv.config();

const app = express();

const PORT = process.env.APP_PORT || 3000;
const HOST = process.env.APP_HOST || '0.0.0.0';

const PVE_TARGET = process.env.PVE_API_URL;
if (!PVE_TARGET) {
	console.error('[ERROR] PVE_API_URL is not defined');
	process.exit(1);
}
const targetUrl = new URL(PVE_TARGET).origin;
const targetHost = new URL(PVE_TARGET).host;
const PVE_TOKEN = `PVEAPIToken=${process.env.PVE_TOKEN_ID}=${process.env.PVE_SECRET}`;

// Proxy-Konfiguration
const pveProxy = createProxyMiddleware({
	target: targetUrl,
	changeOrigin: true,
	secure: false,
	ws: true,
	xfwd: true,
	// Entspricht deinen Timeout-Einstellungen
	proxyTimeout: 30000,
	timeout: 30000,
	on: {
		// 1. Logik für normale API-Calls (proxyReq)
		proxyReq: (proxyReq, req, res) => {
			proxyReq.setHeader('Authorization', PVE_TOKEN);
			proxyReq.setHeader('Origin', targetUrl);
			proxyReq.setHeader('Host', targetHost);
		},

		// 2. Logik für WebSockets (proxyReqWs)
		proxyReqWs: (proxyReq, req, socket, options, head) => {
			// Standard-Header für PVE
			proxyReq.setHeader('Authorization', PVE_TOKEN);
			proxyReq.setHeader('Origin', targetUrl);
			proxyReq.setHeader('Host', targetHost);

			// Ticket-Logik (exakt wie in deiner vite.config.ts)
			const url = new URL(req.url || '', `${req.protocol}://${req.headers.host}`);
			const ticket = url.searchParams.get('tmpTicket');

			if (ticket) {
				proxyReq.setHeader('Cookie', `PVEAuthCookie=${decodeURIComponent(ticket)}`);
				proxyReq.setHeader('CSRFPreventionToken', 'invisible');

				url.searchParams.delete('tmpTicket');
				const cleanPath = url.pathname + url.search;

				// Pfad-Korrektur für den Proxy
				req.url = cleanPath;
				proxyReq.path = cleanPath;

				console.log(`[Proxy] Forwarding to PVE: ${cleanPath}`);
			}
		},

		error: (err, req, res) => {
			console.error('[Proxy] Proxy Error:', err.message);
		}
	}
});

// Zuerst den Proxy registrieren
app.use('/api2', pveProxy);

// Danach den SvelteKit-Handler für alles andere
app.use(handler);

const server = app.listen(PORT, HOST, () => {
	console.log(`PVE VDI Manager runs on http://${HOST}:${PORT}`);
});

// WICHTIG: WebSocket Upgrades explizit an den Proxy delegieren
server.on('upgrade', (req, socket, head) => {
	if (req.url.startsWith('/api2')) {
		pveProxy.upgrade(req, socket, head);
	}
});
