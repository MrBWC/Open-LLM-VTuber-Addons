// paste this in /frontend/libs and edit the .html and add the twitch_chat_conn.js

// Twitch IRC settings
const CHANNEL = '#'; // Channel name must be lowercase and prefixed with #
const NICKNAME = ''; // Your Twitch username
const OAUTH_TOKEN = 'oauth:'; // Get this from Twitch

// WebSocket URL for Twitch IRC
const TWS_URL = 'wss://irc-ws.chat.twitch.tv'; // WebSocket URL for Twitch IRC

// WebSocket connection to Twitch IRC
let tws = new WebSocket(TWS_URL);

// WebSocket connection to your local WebSocket server
let ws = new WebSocket('ws://127.0.0.1:12393/client-ws');

// Function to connect to Twitch IRC
function connectToTwitch() {
  tws.onopen = () => {
    console.log('Connected to Twitch IRC');
    tws.send(`PASS ${OAUTH_TOKEN}\r\n`);
    tws.send(`NICK ${NICKNAME}\r\n`);
    tws.send(`JOIN ${CHANNEL}\r\n`);
  };

  tws.onmessage = (event) => {
    const message = event.data;
    console.log('Received:', message);
    handleWebSocketMessage(message); // Process incoming messages
  };

  tws.onerror = (error) => {
    console.error('Error connecting to Twitch IRC:', error);
  };
   
  tws.onclose = () => {
    console.log('Connection to Twitch IRC closed');
    setTimeout(() => {
        connectToTwitch(); // Reconnect
        })}
  }

// Function to handle incoming WebSocket messages from Twitch IRC
function handleWebSocketMessage(message) {
  // IRC messages from Twitch follow the format: :username!username@username.tmi.twitch.tv PRIVMSG #channel :message
  const messageParts = message.split(' ');

  // Check if the message is a PRIVMSG type (regular chat message)
  if (messageParts[1] === 'PRIVMSG') {
    const username = messageParts[0].split('!')[0].substring(1); // Extract the username
    const channel = messageParts[2]; // The channel the message was sent to
    const text = messageParts.slice(3).join(' ').substring(1); // The actual message (ignores the ":" symbol)

    // Log the received chat message
    console.log(`Message from ${username} in channel ${channel}: ${text}`);

    // Check if the message starts with !AI
    if (text.startsWith('!AI ')) {
      // Get the message after the !AI command (skip the !AI part)
      const aiMessage = text.substring(4);

      // Format the message for the WebSocket server
      const formattedMessage = {  type: "text-input", text: aiMessage, images: [] };

      // Send the formatted message to the local WebSocket server
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(formattedMessage));
        console.log('Sent to WebSocket server:', formattedMessage);
      } else {
        console.log('WebSocket is not open. Unable to send message.');
      }
    } else {
      console.log('Message does not start with !AI, ignoring...');
    }
  }
  // Handle other IRC message types here (e.g., PING, JOIN, PART, etc.)
  else if (messageParts[1] === 'PING') {
    // Respond to PING with PONG to maintain connection
    tws.send('PONG :tmi.twitch.tv\r\n');
  }
}


// WebSocket error handling for local WebSocket server
ws.onopen = () => {
  console.log('Connected to local WebSocket server');
  connectToTwitch(); // Start connecting to Twitch IRC
};

let audioQueue = []; // Queue for storing audio data
let isPlayingAudio = false; // Flag to check if audio is already playing

// Function to play the next audio in the queue
function playNextAudio() {
  if (audioQueue.length > 0 && !isPlayingAudio) {
    const audioData = audioQueue.shift(); // Get the first audio in the queue
    playAudio(audioData); // Play the audio
  }
}

// Function to play audio from base64 data
function playAudio(base64Data) {
  isPlayingAudio = true; // Mark that audio is being played
  console.log('Starting audio playback...'); // Debug log

  // Decode the base64 audio data into a binary Blob
  const byteCharacters = atob(base64Data); // Decode base64 to binary string
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);

    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  // Combine the byte arrays into a single Blob
  const blob = new Blob(byteArrays, { type: 'audio/wav' }); // Ensure this MIME type matches your audio format
  const audioUrl = URL.createObjectURL(blob); // Create a URL for the audio Blob

  const audio = new Audio(audioUrl); // Create an Audio object from the Blob URL

  audio.onerror = (error) => {
    console.error('Error playing audio:', error);
    isPlayingAudio = false; // If there's an error, mark audio as not playing
    playNextAudio(); // Proceed to the next audio in the queue
  };

  audio.onended = () => {
    console.log('Audio playback finished.');
    isPlayingAudio = false; // Mark that audio has finished playing
    playNextAudio(); // Play the next audio in the queue
  };

  audio.play()
    .then(() => {
      console.log('Audio is playing');
    })
    .catch((error) => {
      console.error('Error playing audio:', error);
      isPlayingAudio = false;
      playNextAudio(); // Try to play the next audio in case of error
    });
}

// WebSocket event listener to handle incoming messages
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received message from WebSocket server:', data);

  if (data.type === 'audio') {
    const audioData = data.audio; // Base64 encoded audio
    console.log('Received audio data, adding to queue');
    audioQueue.push(audioData); // Add the audio to the queue

    // Start playing the first audio if nothing is playing
    playNextAudio();
  }
};


ws.onerror = (error) => {
  console.error('Error connecting to WebSocket server:', error);
};

ws.onclose = () => {
  console.log('Connection to WebSocket server closed');
  setTimeout(() => {
    ws = new WebSocket('ws://127.0.0.1:12393/client-ws'); // Reconnect
    ws.onopen = () => {
      console.log('Reconnected to WebSocket server');
      connectToTwitch(); // Start connecting to Twitch IRC again
    };
  }, 5000);
};
