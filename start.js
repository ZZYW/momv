#!/usr/bin/env node
const { spawn } = require('child_process');
const open = require('open');

function runProcess(name, cmd, args, options = {}) {
    console.log(`Starting ${name}: ${cmd} ${args.join(' ')}`);
    const child = spawn(cmd, args, { stdio: 'inherit', ...options });
    child.on('close', (code) => {
        console.log(`${name} process exited with code ${code}`);
    });
    return child;
}

function runDev() {
    // Start DB/AI server
    runProcess('DB/AI Server', 'node', ['db/index.js']);

    // Start Station 1 (Twine app)
    runProcess('Station 1', 'npx', ['http-server', 'station1', '-p', '8001']);

    // Start Station 2 (Twine app)
    runProcess('Station 2', 'npx', ['http-server', 'station2', '-p', '8002']);

    // After a short delay, open the URLs in the default browser.
    setTimeout(() => {
        console.log('Opening URLs in default browser...');
        open('http://localhost:3000'); // For testing the DB/AI API if needed
        open('http://localhost:8001'); // Station 1
        open('http://localhost:8002'); // Station 2
    }, 3000);
}

function runSingle(stationId) {
    if (stationId === 'db') {
        runProcess('DB/AI Server', 'node', ['db/index.js']);
    } else if (stationId === 'station1') {
        runProcess('Station 1', 'npx', ['http-server', 'station1', '-p', '8001']);
    } else if (stationId === 'station2') {
        runProcess('Station 2', 'npx', ['http-server', 'station2', '-p', '8002']);
    } else {
        console.error('Unknown STATION_ID:', stationId);
        process.exit(1);
    }
}

if (process.env.STATION_ID) {
    console.log('Running in production mode for station:', process.env.STATION_ID);
    runSingle(process.env.STATION_ID);
} else {
    console.log('Running in development mode: starting all stations...');
    runDev();
}