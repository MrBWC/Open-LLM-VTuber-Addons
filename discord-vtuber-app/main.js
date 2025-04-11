const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const WebSocket = require('ws');

let botProcess = null;
let wsClient = null;
let latestPrompt = null;
let latestWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    }
  });

  win.loadFile('dc.html');
  latestWindow = win;
}

app.whenReady().then(() => {
  createWindow();

  // WebSocket Connection to Open-LLM-VTuber
  wsClient = new WebSocket('ws://127.0.0.1:12393/client-ws'); // ✅ Change if needed

  wsClient.on('open', () => {
    console.log('[WS] Connected to Open-LLM-VTuber backend');
  });

  wsClient.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'response.text.delta' && latestPrompt) {
      latestWindow.webContents.send('ai-response', msg.delta.text);
      latestPrompt = null;
    }
  });

  wsClient.on('error', (err) => {
    console.error('[WS] Error:', err.message);
  });

  wsClient.on('close', () => {
    console.log('[WS] Connection closed');
  });
});


ipcMain.handle('start-bot', () => {
  if (botProcess) return 'Bot already running.';

  botProcess = spawn('node', ['bot.js'], {
    stdio: ['inherit', 'pipe', 'pipe'] // catch stdout/stderr
  });

  // log stdout
  botProcess.stdout.on('data', (data) => {
    console.log(`[BOT STDOUT] ${data}`);
    if (latestWindow) {
      latestWindow.webContents.send('bot-log', data.toString());
    }
  });

  // log errors
  botProcess.stderr.on('data', (data) => {
    console.error(`[BOT STDERR] ${data}`);
    if (latestWindow) {
      latestWindow.webContents.send('bot-log', data.toString());
    }
  });

  botProcess.on('exit', (code) => {
    console.log(`[BOT EXITED] with code ${code}`);
    if (latestWindow) {
      latestWindow.webContents.send('bot-log', `Bot exited with code ${code}`);
    }
  });

  return 'Bot started!';
});

ipcMain.handle('stop-bot', () => {
  if (botProcess) {
    botProcess.kill();
    botProcess = null;
    return 'Bot stopped';
  }
  return 'Bot was not running';
});

// IPC: Config Save/Load
ipcMain.handle('save-config', (e, config) => {
  fs.writeFileSync('discord-config.json', JSON.stringify(config, null, 2));
  return 'Saved';
});
ipcMain.handle('load-config', () => {
  return fs.existsSync('discord-config.json')
    ? JSON.parse(fs.readFileSync('discord-config.json'))
    : {};
});

// IPC: Bot → VTuber Prompt
ipcMain.on('send-message-to-vtuber', (event, message) => {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    const msg = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: message }]
      }
    };
    latestPrompt = message;
    wsClient.send(JSON.stringify(msg));
  }
});
