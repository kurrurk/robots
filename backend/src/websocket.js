const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 3001 });

function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

module.exports = { broadcast };
