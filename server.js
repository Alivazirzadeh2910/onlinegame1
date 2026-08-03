const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;

const server = new WebSocket.Server({ port: PORT });

console.log(`Server started on port ${PORT}`);

server.on("connection", (socket) => {
    console.log("A player connected!");

    socket.on("message", (message) => {
        console.log("Received:", message.toString());

        server.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message.toString());
            }
        });
    });

    socket.on("close", () => {
        console.log("A player disconnected.");
    });
});
