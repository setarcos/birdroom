# Room Temperature Monitor

A serverless IoT application built with **Cloudflare Workers** and **D1 (SQLite)** to track and visualize temperature data. It serves a responsive dashboard using **Chart.js** and handles data ingestion via a secured API.

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange?style=flat-square&logo=cloudflare)
![Cloudflare D1](https://img.shields.io/badge/Cloudflare-D1-orange?style=flat-square&logo=sqlite)
![Chart.js](https://img.shields.io/badge/Chart.js-F57878?style=flat-square&logo=chartdotjs)

## Features

*   **Serverless Architecture:** Hosted entirely on Cloudflare’s edge network (Workers + D1).
*   **Data Visualization:** Interactive line chart to view temperature trends over time.
*   **Filtering:** Filter data by specific dates and specific rooms (Room 1 - Room 26).
*   **Timezone Aware:** Frontend calculates local time ranges and queries the database using portable UTC timestamps.
*   **Secure Ingestion:** Data writing is protected by an API Key.
*   **Responsive UI:** Mobile-friendly dashboard with centered controls.

---

## Prerequisites

*   [Node.js](https://nodejs.org/) (v16.13.0 or later)
*   [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) CLI (`npm install -g wrangler`)
*   A Cloudflare account.

---

## Setup & Installation

### 1. Clone the Repository
```bash
git clone https://github.com/setarcos/birdroom.git
cd birdroom
npm install
```

### 2. Delopy to Cloudflare
```bash
npm run deploy
npx wrangler d1 create temperature
npx wrangler d1 execute temperature --file=temperature.sql --remote
npx wrangler secret put BIRD_API_KEY
```
