const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const WebSocket = require('ws');

// Konfiguration laden
const config = JSON.parse(fs.readFileSync('discord-config.json', 'utf8'));

// Discord Bot Initialisierung
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// WebSocket Setup
let ws = new WebSocket('ws://127.0.0.1:12393/client-ws');
let messageBuffer = [];
let messageTimeout = null;

// WebSocket Verbindung und Nachrichtenbehandlung
ws.on('open', () => {
  console.log('[WS] Verbunden mit dem VTuber-Backend');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);

  // Überprüfen, ob die Antworttext vorhanden ist
  if (msg && msg.display_text && msg.display_text.text) {
    messageBuffer.push(msg.display_text.text);

    // Setze ein Timeout, um die gesammelten Nachrichten nach 2 Sekunden zu senden
    if (messageTimeout) clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => {
      // Wenn 2 Sekunden keine neuen Nachrichten empfangen wurden, sende alle gesammelten Nachrichten
      const combinedMessage = messageBuffer.join(' ');
      sendToDiscord(combinedMessage);
      messageBuffer = []; // Leere den Puffer
    }, 2000);
  }
});

// Discord Login Event
client.once('ready', () => {
  console.log(`🤖 Eingeloggt als ${client.user.tag}`);
  client.user.setActivity('AI-READY', { type: 'PLAYING' });  // Setze den Bot Status auf "AI-READY"
});

// Nachrichtenhandling in Discord
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(config.prefix)) return;

  // Admin-Only Befehle
  if (message.author.id === config.adminId) {
    if (message.content === `${config.prefix}ws-recon`) {
      reconnectWebSocket(message);
      return;
    }
    if (message.content === `${config.prefix}admode`) {
      message.reply('Admin-Modus aktiviert!');
      return;
    }
  }

  // Normale Befehlsverarbeitung
  const userInput = message.content.slice(config.prefix.length).trim();
  if (ws.readyState === WebSocket.OPEN) {
    const formattedInput = {
      type: "text-input",
      text: userInput
    };

    ws.send(JSON.stringify(formattedInput));
  } else {
    message.reply("⚠️ VTuber Backend nicht verbunden.");
  }
});

// Discord Login
client.login(config.botToken);

// WebSocket Reconnect-Funktion
function reconnectWebSocket(message) {
  if (ws.readyState === WebSocket.OPEN) {
    message.reply("WebSocket ist bereits verbunden.");
  } else {
    console.log('[WS] Wiederverbinden...');
    ws = new WebSocket('ws://127.0.0.1:12393/client-ws');
    
    ws.on('open', () => {
      console.log('[WS] Erfolgreich mit dem VTuber-Backend verbunden');
      message.reply("WebSocket erfolgreich wieder verbunden.");
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg && msg.display_text && msg.display_text.text) {
        messageBuffer.push(msg.display_text.text);
        if (messageTimeout) clearTimeout(messageTimeout);
        messageTimeout = setTimeout(() => {
          const combinedMessage = messageBuffer.join(' ');
          sendToDiscord(combinedMessage);
          messageBuffer = []; // Leere den Puffer
        }, 2000);
      }
    });
    
    ws.on('close', () => {
      console.log('[WS] WebSocket-Verbindung geschlossen');
    });

    ws.on('error', (error) => {
      console.error('[WS] WebSocket Fehler:', error);
    });
  }
}

// Funktion zum Senden der gesammelten Nachrichten an Discord
function sendToDiscord(message) {
  // Die gesammelten Nachrichten in einem einzigen Discord-Message senden
  client.channels.fetch(config.channelId)
    .then(channel => {
      if (channel) {
        channel.send(message);  // Sende die Nachricht an den angegebenen Kanal
      } else {
        console.error('Kanal konnte nicht gefunden werden');
      }
    })
    .catch(error => console.error('Fehler beim Abrufen des Kanals:', error));
}
