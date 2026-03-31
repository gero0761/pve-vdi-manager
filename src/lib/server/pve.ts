import { PVE_API_URL, PVE_TOKEN_ID, PVE_SECRET } from '$env/static/private';

export async function pveFetch(endpoint: string, options: RequestInit = {}) {
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
	const baseUrl = PVE_API_URL.replace(/\/+$/, '');
	const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
	const url = path.startsWith('/api2/json') ? `${baseUrl}${path}` : `${baseUrl}/api2/json${path}`;
	const headers = {
		Authorization: `PVEAPIToken=${PVE_TOKEN_ID}=${PVE_SECRET}`,
		...options.headers
	};

	const response = await fetch(url, { ...options, headers });
	if (!response.ok) {
		const text = await response.text();
		throw new Error(`PVE API Error (${response.status}): ${text}`);
	}
	return response;
}

export async function getNextVmid(): Promise<number> {
	const res = await pveFetch('/cluster/nextid');
	const json = await res.json();
	return parseInt(json.data, 10);
}
