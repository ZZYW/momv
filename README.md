# @ Mountain of Many Voices 众鸣山 @ official code repo

This repository contains a multi-service project that includes:

- A **DB/AI Server**: A Node.js Express server acting as a proxy to an AI API and handling simple data storage (`/db/index.js`).
- **Station 1**: A Twine-based web application served from the `/station1` directory.
- **Station 2**: A second Twine-based web application served from the `/station2` directory.
- A **Node.js Bootstrapper**: A root-level script (`start.js`) that starts the appropriate service(s) based on the environment.

In development, you can run all three services on a single machine. In production, you can deploy the entire repository to three different machines and start only the desired service by setting an environment variable.

---

## Project Structure

```
momv/
├── db/
│   └── index.js         # Express server (DB/AI service)
├── station1/
│   ├── index.html       # Twine app for Station 1
│   └── sugarcube.css    # CSS file for Twine (ensure this file exists)
├── station2/
│   ├── index.html       # Twine app for Station 2
│   └── sugarcube.css    # CSS file for Twine (ensure this file exists)
├── start.js             # Node bootstrapper script
├── package.json         # NPM scripts and dependency definitions
└── README.md            # This file
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) (v14+ recommended)
- npm (comes with Node.js)
- [npx](https://www.npmjs.com/package/npx)

---

## Installation

1. **Clone the repository:**

   ```bash
   git clone <repository_url>
   cd momv
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

   This installs the required dependencies such as:
   - [open](https://www.npmjs.com/package/open) — used to open URLs in your default browser.
   - [http-server](https://www.npmjs.com/package/http-server) — used to serve your static files.

---

## Environment Variables

- **DASHSCOPE_API_KEY**:  
  The DB/AI server requires this API key to authenticate with the AI backend. Set this variable before starting the server:

  ```bash
  export DASHSCOPE_API_KEY=your-api-key-here
  ```

- **STATION_ID**:  
  Used in production to determine which service should run. Allowed values are:
  - `db` – for the DB/AI server
  - `station1` – for Station 1 (Twine app)
  - `station2` – for Station 2 (Twine app)

  In development, leave this variable unset to start all services simultaneously.

---

## Scripts & Usage

### Development Mode (All Services)

Run all services on one development machine:

```bash
npm run dev
```

This command will:
- Start the DB/AI server on port **3000**
- Start Station 1 on port **8001**
- Start Station 2 on port **8002**
- Open the corresponding URLs in your default browser

### Production Mode (Single Service per Machine)

In production each machine will clone the entire `momv` repo but only run the required service by setting the `STATION_ID` variable:

- **For DB/AI Server:**

  ```bash
  npm run db
  ```

- **For Station 1:**

  ```bash
  npm run station1
  ```

- **For Station 2:**

  ```bash
  npm run station2
  ```

> **Note for Windows users:**  
> If you encounter issues setting environment variables on Windows, consider using the [cross-env](https://www.npmjs.com/package/cross-env) package. For example, update your `package.json` scripts like:
> ```json
> "station1": "cross-env STATION_ID=station1 node start.js",
> ```

---

## Accessing the Services

- **DB/AI Server:**  
  [http://localhost:3000](http://localhost:3000) – for API usage or debugging.

- **Station 1 (Twine App):**  
  [http://localhost:8001](http://localhost:8001)

- **Station 2 (Twine App):**  
  [http://localhost:8002](http://localhost:8002)

---

## Troubleshooting

- **CORS Issues:**  
  If you encounter CORS issues when your static files try to reach the DB/AI server, consider enabling [CORS](https://www.npmjs.com/package/cors) in your Express app (in `db/index.js`). For example:
  ```js
  const cors = require('cors');
  app.use(cors());
  ```
