<svelte:head>
	<meta charset="UTF-8" />
	<title>Zugangsdaten / Credentials</title>
	<style>
		body { font-family: Arial, sans-serif; padding: 2rem; color: #000; background: #fff; }
		h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
		p { font-size: 0.8rem; color: #555; margin-bottom: 1.5rem; }
		table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
		th { background: #f0f0f0; text-align: left; padding: 8px 12px; border: 1px solid #ccc; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
		td { padding: 8px 12px; border: 1px solid #ddd; }
		tr:nth-child(even) td { background: #fafafa; }
		.pw { font-family: monospace; letter-spacing: 0.05em; }
	</style>
</svelte:head>

<script lang="ts">
interface Credentials {
	firstName: string;
	lastName: string;
	username: string;
	password: string;
	role: string;
}

function printCredentials(createdCredentials:Credentials[]) {
		const rows = createdCredentials
			.map(
				(c) => `
			<tr>
				<td>${c.firstName} ${c.lastName}</td>
				<td>${c.username}</td>
				<td>${c.password}</td>
				<td>${c.role}</td>
			</tr>`
			)
			.join('');


		
		const win = window.open('', '_blank', 'width=800,height=600');
		if (win) {
			win.document.open();
			win.document.write(htmlPrintPage);
			win.document.close();
			// Give browser time to render before triggering print dialog
			win.addEventListener('load', () => {
				win.focus();
				win.print();
			});
		}
	}
</script>

<h1>User Credentials</h1>
<p>Created {new Date().toLocaleString('de-DE')} &bull; Please change password after first login.</p>
<table>
	<thead>
		<tr>
			<th>Full Name</th>
			<th>Username</th>
			<th>Password</th>
			<th>Role</th>
		</tr>
	</thead>
	<tbody>{rows}</tbody>
</table>