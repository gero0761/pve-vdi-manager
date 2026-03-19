import { json, type RequestHandler } from '@sveltejs/kit';
import { PVE_API_URL, PVE_TOKEN_ID, PVE_SECRET } from '$env/static/private';

export const POST: RequestHandler = async ({ params, request }) => {
	const { id } = params;

	// Wichtig: Proxmox nutzt oft selbstsignierte SSL-Zertifikate,
	// die Node.js standardmäßig strikt ablehnt.
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

	let response;
	try {
		response = await fetch(`${PVE_API_URL}/nodes/pve01/qemu/${id}/vncproxy`, {
			method: 'POST',
			headers: { 'Authorization': `PVEAPIToken=${PVE_TOKEN_ID}=${PVE_SECRET}` }
		});
	} catch (err) {
		console.error('Fetch to PVE failed:', err);
		return json({ error: 'Verbindung zum PVE Server fehlgeschlagen (Netzwerkfehler)' }, { status: 500 });
	}

	if (!response.ok) {
		const text = await response.text();
		console.error(`PVE API Error (${response.status}):`, text);
		return json({ error: `PVE API Fehler: ${response.status}` }, { status: response.status });
	}

	const { data } = await response.json();

	// WSS-URL muss nun unseren SvelteKit/Vite Server ansprechen, der als Proxy fungiert.
	// Das umgeht die Browser-Zertifikatwarnung komplett!
	const url = new URL(request.url);
	const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	const wsUrl = `${protocol}//${url.host}/api2/json/nodes/pve01/qemu/${id}/vncwebsocket?port=${data.port}&vncticket=${encodeURIComponent(data.ticket)}`;

	return json({ url: wsUrl, password: data.ticket });
};