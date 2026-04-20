import { json, type RequestHandler } from '@sveltejs/kit';
import { pveFetch, getAccessTicket } from '$lib/server/pve';
import { db } from '$lib/server/db';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const { id } = params;
	const user = locals.user;

	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!id) {
		return json({ error: 'Missing ID parameter' }, { status: 400 });
	}

	const instance = await db.getInstanceById(id);
	if (!instance) {
		return json({ error: 'Provided ID is invalid or instance does not exist' }, { status: 404 });
	}

	// Access Check
	if (user.role !== 'admin') {
		const hasAccess = await db.hasInstanceAccess(user.id, instance.id);
		if (!hasAccess) {
			return json({ error: 'Forbidden: You do not have access to this instance' }, { status: 403 });
		}
	}

	const { vmid, node, type } = instance;

	console.log('Type: ' + type);

	let response;
	const proxyEndpoint =
		type === 'lxc'
			? `/nodes/${node}/${type}/${vmid}/termproxy`
			: `/nodes/${node}/${type}/${vmid}/vncproxy`;

	let accessTicket = '';
	let csrfToken = '';

	try {
		if (type === 'lxc') {
			// Für LXC brauchen wir ein User Ticket (PVE ticket) für termproxy
			const { ticket: accessTicketFetch, csrfToken: accessCsrfTokenFetch } =
				await getAccessTicket();
			accessTicket = accessTicketFetch;
			csrfToken = accessCsrfTokenFetch;
			response = await pveFetch(
				proxyEndpoint,
				{
					method: 'POST'
				},
				{ ticket: accessTicket, csrfToken }
			);
		} else {
			// Für VMs (noVNC) bleibt alles beim Alten (API Token)
			response = await pveFetch(proxyEndpoint, {
				method: 'POST'
			});
		}
	} catch (err) {
		console.error('Fetch to PVE failed:', err);
		return json({ error: 'Connection to PVE Server failed (Network Error)' }, { status: 500 });
	}

	if (!response.ok) {
		const text = await response.text();
		console.error(`PVE API Error (${response.status}):`, text);
		return json(
			{ error: `PVE API Error: ${response.status} - ${text}` },
			{ status: response.status }
		);
	}

	const { data } = await response.json();

	// WSS URL must now address our SvelteKit/Vite Server, which acts as a proxy.
	const url = new URL(request.url);

	// Get Host from Browser (e.g. localhost:4173)
	const host = request.headers.get('host') || url.host;

	const referer = request.headers.get('referer') || '';
	let protocol = 'ws:';

	if (referer.startsWith('https://')) {
		protocol = 'wss:';
	}

	console.log(
		`[Protocol-Debug] URL-Referer: ${referer} -> Result: ${protocol}`,
		'Host: ' + host + '\n',
		`URL: ${url}\n\n`
	);

	const connectionUrl =
		type === 'lxc'
			? `${protocol}//${host}/api2/json/nodes/${node}/${type}/${vmid}/vncwebsocket?port=${data.port}&vncticket=${encodeURIComponent(data.ticket)}&tmpTicket=${encodeURIComponent(accessTicket)}`
			: `${protocol}//${host}/api2/json/nodes/${node}/${type}/${vmid}/vncwebsocket?node=${node}&port=${data.port}&vmid=${vmid}&vncticket=${encodeURIComponent(data.ticket)}`;

	console.log(
		'[Connection] URL: ' + connectionUrl + '\n',
		//'Data: ' + JSON.stringify(data) + '\n',
		/* 'Ticket: ' + data.ticket + '\n', */
		'User: ' + data.user + '\n',
		'Proxy Type: ' + type + '\n\n'
	);

	return json({
		url: connectionUrl,
		ticket: data.ticket,
		user: data.user,
		proxyType: type === 'lxc' ? 'term' : 'vnc'
	});
};
