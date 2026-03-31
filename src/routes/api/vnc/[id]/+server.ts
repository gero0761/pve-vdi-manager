import { json, type RequestHandler } from '@sveltejs/kit';
import { pveFetch } from '$lib/server/pve';
import { db } from '$lib/server/db';

export const POST: RequestHandler = async ({ params, request }) => {
	const { id } = params;

	if (!id) {
		return json({ error: 'Missing ID parameter' }, { status: 400 });
	}

	const instance = db.getInstanceById(id);
	if (!instance) {
		return json({ error: 'Provided ID is invalid or instance does not exist' }, { status: 404 });
	}

	const { vmid, node, type } = instance;

	let response;
	const proxyEndpoint = type === 'lxc' ? `/nodes/${node}/${type}/${vmid}/termproxy` : `/nodes/${node}/${type}/${vmid}/vncproxy`;
	try {
		response = await pveFetch(proxyEndpoint, {
			method: 'POST'
		});
	} catch (err) {
		console.error('Fetch to PVE failed:', err);
		return json({ error: 'Verbindung zum PVE Server fehlgeschlagen (Netzwerkfehler)' }, { status: 500 });
	}

	if (!response.ok) {
		const text = await response.text();
		console.error(`PVE API Error (${response.status}):`, text);
		return json({ error: `PVE API Fehler: ${response.status} - ${text}` }, { status: response.status });
	}

	const { data } = await response.json();

	// WSS-URL muss nun unseren SvelteKit/Vite Server ansprechen, der als Proxy fungiert.
	// Das umgeht die Browser-Zertifikatwarnung komplett!
	const url = new URL(request.url);
	const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	const wsUrl = `${protocol}//${url.host}/api2/json/nodes/${node}/${type}/${vmid}/vncwebsocket?port=${data.port}&vncticket=${encodeURIComponent(data.ticket)}`;

	return json({ url: wsUrl, password: data.ticket, user: data.user, proxyType: type === 'lxc' ? 'term' : 'vnc' });
};