import { env } from '$env/dynamic/private';
const { PVE_API_URL, PVE_TOKEN_ID, PVE_SECRET, PVE_PASSWORD } = env;

export async function pveFetch(
	endpoint: string,
	options: RequestInit = {},
	auth?: { ticket: string; csrfToken?: string } | 'none'
) {
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // For TLS ignore

	const baseUrl = PVE_API_URL.replace(/\/+$/, '');

	const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

	const url = path.startsWith('/api2/json') ? `${baseUrl}${path}` : `${baseUrl}/api2/json${path}`;

	/* console.log(
		'[PVE Fetch]: \n',
		'Base URL: ' + baseUrl + '\n',
		'Path: ' + path + '\n',
		'Endpoint: ' + endpoint + '\n',
		'URL: ' + url + '\n',
		'Auth Method: ' + (auth === 'none' ? 'None' : auth ? 'Ticket' : 'Token') + '\n'
	); */

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
}

export async function getNextVmid(): Promise<number> {
	const res = await pveFetch('/cluster/nextid');
	const json = await res.json();
	return parseInt(json.data, 10);
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
