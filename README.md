<div align="center" width="100%">
    <img src="https://user-images.githubusercontent.com/30373916/227715640-22e0fa02-8f17-4fbd-a81d-4a010007972a.png" width="150" />
</div>

<div align="center" width="100%">
    <h2>PVE VDI Manager</h2>
    <p>A lightweight, web-based VDI solution to manage and access Proxmox LXC containers and VMs with ease.</p>
    <a target="_blank" href="https://github.com/ero0761/pve-vdi-manage/stargazers"><img src="https://img.shields.io/github/stars/ero0761/pve-vdi-manage" /></a>
    <a target="_blank" href="https://github.com/ero0761/pve-vdi-manage/releases"><img src="https://img.shields.io/github/v/release/ero0761/pve-vdi-manage?display_name=tag" /></a>
    <a target="_blank" href="https://github.com/ero0761/pve-vdi-manage/commits/master"><img src="https://img.shields.io/github/last-commit/ero0761/pve-vdi-manage" /></a>
</div>

## ✨ Features

- **Instant Terminal Access:** Integrated Xterm.js console for LXC containers and VMs via Proxmox `termproxy`.
- **Automated Lifecycle:** Quick creation and management of VDI environments.
- **Smart Proxying:** Built-in Vite/Node.js proxy to handle Proxmox ticket authentication and WebSocket upgrades seamlessly.
- **Secure Auth:** Uses Proxmox Ticket system (PVEAuthCookie) for secure, session-based access without long-lived credentials in the frontend.
- **Modern UI:** Built with Svelte for a reactive and fast user experience.
- **VDI Focus:** Optimized for "throwaway" or persistent development environments on your Proxmox cluster.

## 🤔 Why?

Proxmox is a powerful hypervisor, but its default web interface can be overkill for end-users who just need a terminal or a quick desktop session. The **PVE VDI Manager** bridges this gap by providing a simplified interface for VDI (Virtual Desktop Infrastructure) use cases.

Whether you need a clean environment for testing kernel modules, a sandboxed development shell, or a simple way to provide users with Linux environments without giving them full access to the Proxmox Datacenter UI – this manager handles the heavy lifting of authentication and console proxying.

## 🔧 Prerequisites

- **Proxmox VE Server:** Access to a PVE cluster (tested with PVE 9.x).
- **Service Account:** A locally created Proxmox user (e.g., `svcVDIManager@pam`) with appropriate permissions (`VM.Console`, `VM.Audit`) and with a set password.
- **Node.js:** Version 18 or higher for the development and proxy server.

## 🚀 Quick Start

### 1. Configuration

Create a `.env` file in the root directory:

```bash
# Application Configuration
APP_PORT=4173

# Proxmox API Configuration
PVE_HOST=192.168.1.100
PVE_PORT=8006
PVE_USER=svcVDIManager@pam
PVE_PASSWORD=your_secure_password
```

### 2. Install & Run

```bash
# Install dependencies
npm install

# Start development server with proxy
npm run dev
```

In Dev Mode the application will be available at `http://localhost:5173`. Keyboard inputs and terminal output are forwarded in real-time via the configured WebSocket tunnel to the Proxmox host.
In Normal Mode the application will be available at `http://localhost` and the specified port in your `.env` File.

## 🏗️ Architecture

The project uses a proxy-logic to bypass common WebSocket authentication hurdles.

1. **Auth-Bridge:** The backend fetches a `PVEAuthCookie` and a `PVEVNC` ticket.
2. **WebSocket Tunneling:** The Vite proxy intercepts the WebSocket upgrade request, injects the required cookies, and cleans the URL parameters for Proxmox compatibility.
3. **Stream Handling:** Raw terminal data is encoded as `Uint8Array` and prefixed according to the Proxmox `termproxy` protocol. So the end user doesn't need to have access or knowledge of the Proxmox API/Server.

## 🛠️ Development Commands

```bash
# Run Svelte/Vite in dev mode
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```
