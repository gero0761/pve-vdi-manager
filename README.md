<div align="center" width="100%">
    <img src="/static/pve-vdi-logo.svg" width="660" />
</div>

<div align="center" width="100%">
    <h2>PVE VDI Manager</h2>
    <p>A lightweight, web-based VDI solution to manage and access Proxmox LXC containers and VMs with ease.</p>
    <a target="_blank" href="https://github.com/gero0761/pve-vdi-manager/stargazers"><img src="https://img.shields.io/github/stars/gero0761/pve-vdi-manager" /></a>
    <a target="_blank" href="https://github.com/gero0761/pve-vdi-manager/releases"><img src="https://img.shields.io/github/v/release/gero0761/pve-vdi-manager?display_name=tag" /></a>
    <a target="_blank" href="https://github.com/gero0761/pve-vdi-manager/commits/main"><img src="https://img.shields.io/github/last-commit/gero0761/pve-vdi-manager" /></a>
</div>

## ✨ Features

- **Instant Terminal Access:** Integrated Xterm.js console for LXC containers and VMs via Proxmox `termproxy`.
- **Automated Lifecycle:** Quick creation and management of VDI environments.
- **Smart Proxying:** Built-in Vite/Node.js proxy to handle Proxmox ticket authentication and WebSocket upgrades seamlessly.
- **Secure Auth:** Uses Proxmox Ticket system (PVEAuthCookie) for secure, session-based access without long-lived credentials in the frontend.
- **Modern UI:** Built with Svelte for a reactive and fast user experience.
- **VDI Focus:** Optimized for "throwaway" or persistent development environments on your Proxmox cluster.
- **User Management:** Manage users and groups for the VDI environments to deploy Instances and manage Access to specific groups.

## 🤔 Why?

Proxmox is a powerful hypervisor, but its default web interface can be overkill for end-users who just need a terminal or a quick desktop session. The **PVE VDI Manager** bridges this gap by providing a simplified interface for VDI (Virtual Desktop Infrastructure) use cases. Furthermore it can be utilized to grant specific user groups access to a testing environments for students or other users.

Whether you need a clean environment for testing kernel modules, a sandboxed development shell, or a simple way to provide users with Linux environments without giving them full access to the Proxmox Datacenter UI – this manager handles the heavy lifting of authentication and console proxying.

## 🔧 Prerequisites

- **Proxmox VE Server:** Access to a PVE cluster (tested with PVE 9.x).
- **Service Account:** A locally created Proxmox user (e.g., `svcVDIManager@pam`) with appropriate permissions (`VM.Console`, `VM.Audit`, etc) and with a set password.
- **Node.js:** Version 18 or higher for the development and proxy server.

## 🚀 Quick Start

### 1. Configuration

Create a `.env` file in the root directory:

```bash
# Application Configuration
APP_HOST=0.0.0.0
APP_PORT=3000

# Proxmox API Configuration

PVE_API_URL=https://PVE01:8006,https://PVE02:8006,https://PVE03:8006
PVE_TOKEN_ID=YOUR_SERVICE_USER_TOKEN_ID
PVE_SECRET=YOUR_TOKEN_SECRET
PVE_PASSWORD=YOUR_SERVICE_USER_PAM_PASSWORD

# Optional PVE Args:
PVE_POOL=vdi # In which pool should the VMs be added (must be manually created)
PVE_START_ID=1000 # The starting ID of the VMs (default: 1000)

# Database Configuration
# DB_TYPE: sqlite | mysql (default: sqlite)
DB_TYPE=sqlite

# How often should the sync between PVE and Database run (in minutes)
DB_SYNC_INTERVAL=10

# MySQL Settings (Only needed if DB_TYPE=mysql)
# Use MYSQL_ variables OR DB_CONNECTION_STRING -> Connection String is prioritized
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=pve_vdi
# DB_CONNECTION_STRING=mysql://root:password@localhost:3306/pve_vdi
```

### 2. Install & Run

#### 2.1 NPM Node installation

```bash
# Install dependencies
npm install

# Build Project
npm run build

# Start Node Server
npm run start
```

In Dev Mode the application will be available at `http://localhost:5173`. Keyboard inputs and terminal output are forwarded in real-time via the configured WebSocket tunnel to the Proxmox host.
In Normal Mode the application will be available at `http://localhost` and the specified port in your `.env` File.

#### 2.2 Docker installation

At first you need to build the docker image (it will be uploaded later).

```bash
docker build -t pve-vdi-manager:latest .
```

Then you can run the docker container using your environment variables.

```bash
# Run Docker container
docker run -d \
  -p 3000:3000 \
  --env-file ./.env \
  --name pve-vdi-manager \
  pve-vdi-manager:latest
```

Alternatively, you can use the `compose.yml` file to run the application:

```yaml
# compose.yml
services:
  mysql:
    image: mysql:latest
    container_name: mysql
    env_file:
      - .env
    ports:
      - '3306:3306'
    volumes:
      - /home/server/mySQL-Data:/var/lib/mysql
    healthcheck:
      test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost']
      timeout: 20s
      retries: 10

  pve-vdi-manager:
    image: pve-vdi-manager:latest
    container_name: pve-vdi-manager
    ports:
      - '${APP_PORT}:${APP_PORT}'
    env_file:
      - .env
    depends_on:
      mysql:
        condition: service_healthy
        restart: true
```

To start both the mySQL Instance and the PVE-VDI-Manager with the compose file run:

```bash
docker compose up -d
```

## 🏗️ Architecture

The project uses a proxy-logic to bypass common WebSocket authentication hurdles.

1. **Auth-Bridge:** The backend fetches a `PVEAuthCookie` and a `PVEVNC` ticket.
2. **WebSocket Tunneling:** The Vite proxy intercepts the WebSocket upgrade request, injects the required cookies, and cleans the URL parameters for Proxmox compatibility.
3. **Stream Handling:** Raw terminal data is encoded as `Uint8Array` and prefixed according to the Proxmox `termproxy` protocol. So the end user doesn't need to have access or knowledge of the Proxmox API/Server.

## 🛠️ Development Commands

```bash
# To start the Svelte/Vite development server with proxy
npm run dev

# Build for production
npm run build

# Build for docker image
docker build -t pve-vdi-manager:latest .
```
