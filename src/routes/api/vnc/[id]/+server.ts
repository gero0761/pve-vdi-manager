import { json, type RequestHandler } from '@sveltejs/kit';
import { PVE_API_URL, PVE_TOKEN_ID, PVE_SECRET } from '$env/static/private';

export const POST: RequestHandler = async ({ params }) => {
	const { id } = params;

	const response = await fetch(`${PVE_API_URL}/nodes/pve/qemu/${id}/vncproxy`, {
		method: 'POST',
		headers: { 'Authorization': `PVEAPIToken=${PVE_TOKEN_ID}=${PVE_SECRET}` }
	});

	const { data } = await response.json();

	// Konstruktion der WSS-URL für noVNC
	// Port 8006 ist Standard für PVE
	const pveHost = PVE_API_URL.split('/api2')[0].replace('https://', '');
	const wsUrl = `wss://${pveHost}/api2/json/nodes/pve/qemu/${id}/vncwebsocket?port=${data.port}&vncticket=${encodeURIComponent(data.ticket)}`;

	return json({ url: wsUrl });
};