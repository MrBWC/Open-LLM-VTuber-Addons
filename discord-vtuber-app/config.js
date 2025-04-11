function saveConfig() {
  const config = {
    botToken: document.getElementById('botToken').value,
    channelId: document.getElementById('channelId').value,
    prefix: document.getElementById('prefix').value,
    mentionUser: document.getElementById('mentionUser').checked
  };
  window.electronAPI.saveConfig(config).then(() => alert("✅ Config saved"));
}

function startBot() {
  window.electronAPI.startBot().then(msg => {
    document.getElementById('status').innerText = "Bot Status: AI-READY";
    alert(msg);
  });
}

function stopBot() {
  window.electronAPI.stopBot().then(msg => {
    document.getElementById('status').innerText = "Bot Status: OFF";
    alert(msg);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  window.electronAPI.loadConfig().then(config => {
    document.getElementById('botToken').value = config.botToken || '';
    document.getElementById('channelId').value = config.channelId || '';
    document.getElementById('prefix').value = config.prefix || '!';
    document.getElementById('mentionUser').checked = config.mentionUser || false;
  });

  window.electronAPI.onAIResponse((text) => {
    document.getElementById('lastAiResponse').innerText = `🧠 AI: ${text}`;
  });
});
window.electronAPI?.onBotLog?.((msg) => {
  const logBox = document.getElementById('consoleLog');
  if (logBox) {
    logBox.textContent += msg + '\n';
    logBox.scrollTop = logBox.scrollHeight;
  }
});
