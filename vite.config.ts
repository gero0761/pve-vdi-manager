import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { playwright } from '@vitest/browser-playwright';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const targetUrl = new URL(env.PVE_API_URL).origin;

	return {
		plugins: [tailwindcss(), sveltekit()],
		server: {
			proxy: {
				'/api2': {
					target: targetUrl,
					ws: true,
					secure: false, // Wichtig für selbstsignierte Zertifikate
					changeOrigin: true,
					proxyTimeout: 30000,
					timeout: 30000,
					xfwd: true, // X-Forwarded-For Header setzen
					configure: (proxy) => {
						// Für normale API-Calls
						proxy.on('proxyReq', (proxyReq) => {
							const targetHost = new URL(targetUrl).host;
							proxyReq.setHeader(
								'Authorization',
								`PVEAPIToken=${env.PVE_TOKEN_ID}=${env.PVE_SECRET}`
							);
							proxyReq.setHeader('Origin', targetUrl);
							proxyReq.setHeader('Host', targetHost);
						});

						proxy.on('proxyReqWs', (proxyReq, req) => {
							proxyReq.setHeader(
								'Authorization',
								`PVEAPIToken=${env.PVE_TOKEN_ID}=${env.PVE_SECRET}`
							);
							proxyReq.setHeader('Origin', targetUrl);
							// Zwinge den Host-Header auf die Ziel-URL (Proxmox-IP)
							const targetHost = new URL(targetUrl).host;
							proxyReq.setHeader('Host', targetHost);

							// Wir extrahieren das Ticket aus der URL des Requests
							const url = new URL(req.url || '', `${req.headers.protocol}://${req.headers.host}`);
							const ticket = url.searchParams.get('tmpTicket');

							if (ticket) {
								// Wir setzen das Ticket als PVEAuthCookie Header
								proxyReq.setHeader('Cookie', `PVEAuthCookie=${decodeURIComponent(ticket)}`);
								// Optional: CSRF Prävention umgehen, falls nötig
								proxyReq.setHeader('CSRFPreventionToken', 'invisible');

								url.searchParams.delete('tmpTicket');

								const cleanPath = url.pathname + url.search;
								req.url = cleanPath;
								proxyReq.path = cleanPath;

								// DEBUG: Das hier erscheint in deinem Terminal, wo "npm run dev" läuft!
								console.log(`[Proxy-WS] Weiterleitung an PVE: ${cleanPath}`);
							}
						});

						proxy.on('error', (err, req, socket) => {
							console.error('Vite Proxy Error:', err.message);
						});
					}
				}
			}
		},
		test: {
			expect: { requireAssertions: true },
			projects: [
				{
					extends: './vite.config.ts',
					test: {
						name: 'client',
						browser: {
							enabled: true,
							provider: playwright(),
							instances: [{ browser: 'chromium', headless: true }]
						},
						include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
						exclude: ['src/lib/server/**']
					}
				},

				{
					extends: './vite.config.ts',
					test: {
						name: 'server',
						environment: 'node',
						include: ['src/**/*.{test,spec}.{js,ts}'],
						exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
					}
				}
			]
		}
	};
});
