import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { playwright } from '@vitest/browser-playwright';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const targetUrl = new URL(env.PVE_API_URL || 'https://10.0.5.5:8006').origin;

	return {
		plugins: [tailwindcss(), sveltekit()],
		server: {
			proxy: {
				'/api2/json/nodes': {
					target: targetUrl,
					ws: true,
					secure: false, // Wichtig für selbstsignierte Zertifikate
					changeOrigin: true,
					configure: (proxy) => {
						proxy.on('proxyReqWs', (proxyReq) => {
							proxyReq.setHeader('Authorization', `PVEAPIToken=${env.PVE_TOKEN_ID}=${env.PVE_SECRET}`);
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
