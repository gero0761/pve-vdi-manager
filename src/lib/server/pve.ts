import { env } from '$env/dynamic/private';
const { PVE_API_URL, PVE_TOKEN_ID, PVE_SECRET, PVE_PASSWORD, PVE_START_ID } = env;

const startID = PVE_START_ID ? parseInt(PVE_START_ID, 10) : 1000;

const baseUrls = (PVE_API_URL || '').split(',').map((url) => url.trim().replace(/\/+$/, ''));

if (!(globalThis as any).__activePveUrl && baseUrls.length > 0) {
	(globalThis as any).__activePveUrl = baseUrls[0];
}

export async function pveFetch(
	endpoint: string,
	options: RequestInit = {},
	auth?: { ticket: string; csrfToken?: string } | 'none'
) {
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // For TLS ignore

	const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

	let lastError: any = null;

	// Try each URL in the list if there are network issues
	for (let attempt = 0; attempt < baseUrls.length; attempt++) {
		const currentBaseUrl = (globalThis as any).__activePveUrl || baseUrls[0];
		const url = path.startsWith('/api2/json') ? `${currentBaseUrl}${path}` : `${currentBaseUrl}/api2/json${path}`;

		try {
			const headers: Record<string, string> = {
				...((options.headers as Record<string, string>) || {})
			};

			if (auth === 'none') {
				// No auth headers
			} else if (auth && typeof auth === 'object') {
				headers['Cookie'] = `PVEAuthCookie=${auth.ticket}`;
				if (auth.csrfToken) {
					headers['CSRFPreventionToken'] = auth.csrfToken;
				}
			} else {
				headers['Authorization'] = `PVEAPIToken=${PVE_TOKEN_ID}=${PVE_SECRET}`;
			}

			const response = await fetch(url, { ...options, headers });
			if (!response.ok) {
				const text = await response.text();
				throw new Error(`PVE API Error (${response.status}): ${text}`);
			}
			return response;
		} catch (err: any) {
			lastError = err;

			// Check if this error is a connection/network failure
			const isNetworkError =
				err.message &&
				(err.message.includes('fetch failed') ||
					err.message.includes('ECONNREFUSED') ||
					err.message.includes('EHOSTUNREACH') ||
					err.message.includes('ETIMEDOUT') ||
					err.message.includes('ENOTFOUND') ||
					err.code === 'ECONNREFUSED' ||
					err.code === 'EHOSTUNREACH' ||
					err.code === 'ETIMEDOUT' ||
					err.code === 'ENOTFOUND');

			if (isNetworkError && baseUrls.length > 1) {
				const currentIndex = baseUrls.indexOf(currentBaseUrl);
				const nextIndex = (currentIndex === -1 ? 0 : currentIndex + 1) % baseUrls.length;
				const nextUrl = baseUrls[nextIndex];
				
				console.warn(
					`[PVE Fetch] Connection failed to ${currentBaseUrl}. Swapping active node to: ${nextUrl}`
				);
				(globalThis as any).__activePveUrl = nextUrl;
			} else {
				// If it's a regular API error (e.g. 400, 403, 404, 500), do not retry another node
				throw err;
			}
		}
	}

	throw lastError;
}

export async function getNextVmid(startId: number = startID): Promise<number> {
	const baseRes = await pveFetch('/cluster/nextid');
	const baseJson = await baseRes.json();
	const proxmoxNextId = parseInt(baseJson.data, 10);

	let currentId = Math.max(startId, proxmoxNextId);

	for (let attempt = 0; attempt < 1000; attempt++) {
		try {
			const res = await pveFetch(`/cluster/nextid?vmid=${currentId}`);

			const json = await res.json();
			return parseInt(json.data, 10);
		} catch (error: any) {
			// Proxmox returns 400 if the ID already exists
			if (error.message && (error.message.includes('400') || error.message.includes('exists'))) {
				currentId++;
			} else {
				throw error;
			}
		}
	}

	throw new Error(`Failed to find a free VMID after 1000 attempts.`);
}

export async function getAccessTicket() {
	const username = PVE_TOKEN_ID.split('!')[0]; // Extract user from token ID
	const res = await pveFetch(
		`/access/ticket`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				username: username,
				password: PVE_PASSWORD
			})
		},
		'none'
	);
	const json = await res.json();

	const ticket: string = json.data.ticket;
	const csrfToken: string = json.data.CSRFPreventionToken;
	console.log('Access Ticket requested for user: ' + username + ' Ticket: ' + ticket);
	return { ticket, csrfToken };
}
