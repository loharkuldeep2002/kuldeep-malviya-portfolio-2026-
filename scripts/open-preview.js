'use strict';
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const root = path.resolve(__dirname, '..');
const address = 'http://127.0.0.1:3000';

function ready() {
  return new Promise(resolve => {
    const request = http.get(address + '/api/site', response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try {
          const site = JSON.parse(body);
          resolve(response.statusCode === 200 && Array.isArray(site.projects) && Array.isArray(site.services));
        } catch { resolve(false); }
      });
    });
    request.setTimeout(1000, () => request.destroy());
    request.on('error', () => resolve(false));
  });
}

(async () => {
  if (!(await ready())) {
    const server = spawn(process.execPath, [path.join(root, 'server.js')], {
      cwd: root, detached: true, windowsHide: true, stdio: 'ignore'
    });
    server.on('error', error => { console.error('Could not start website:', error.message); });
    server.unref();
  }
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await ready()) {
      console.log('Portfolio ready: ' + address);
      if (!process.argv.includes('--no-open')) {
        const browser = spawn('cmd.exe', ['/c', 'start', '', address], { windowsHide: true, stdio: 'ignore' });
        browser.on('error', () => console.log('Open this address in your browser: ' + address));
      }
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  console.error('Website could not start. Open start_server.bat to see the error, then visit ' + address);
  process.exitCode = 1;
})();
