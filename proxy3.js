/*
 * Proxy Bridge - Cloud Run Compatible
 * Versión A: Fake WebSocket 101 handshake + WebSocket real interno
 */

const http = require("http");
const crypto = require("crypto");
const net = require("net");

const dhost = process.env.DHOST || "127.0.0.1";
const dport = parseInt(process.env.DPORT || "40000");
const mainPort = process.env.PORT || 8080;

console.log(`[INFO] CloudRun FakeWS Proxy`);
console.log(`[INFO] Destino: ${dhost}:${dport}`);
console.log(`[INFO] Puerto: ${mainPort}`);

const server = http.createServer();

/*
 * Esta función responde al payload tipo:
 * GET /algo HTTP/1.1
 * Upgrade: websocket
 * Connection: Upgrade
 */
function sendFake101(socket) {
    const key = crypto.randomBytes(16).toString("base64");

    const headers =
        "HTTP/1.1 101 Switching Protocols\r\n" +
        "Connection: Upgrade\r\n" +
        "Upgrade: websocket\r\n" +
        "Sec-WebSocket-Accept: " + key + "\r\n" +
        "Server: p7ws-cloudrun/1.0\r\n\r\n";

    socket.write(headers);
}

server.on("upgrade", (req, socket, head) => {
    console.log(`[INFO] Upgrade recibido desde ${socket.remoteAddress}`);

    // Enviamos handshake falso (exactamente como tu script viejo)
    sendFake101(socket);

    // Pasamos a WebSocket real para Cloud Run
    const wsKey = req.headers["sec-websocket-key"];
    if (!wsKey) {
        console.log("[ERROR] No hay clave WebSocket. Cancelado.");
        socket.destroy();
        return;
    }

    const acceptKey = crypto
        .createHash("sha1")
        .update(wsKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
        .digest("base64");

    // WebSocket real handshake para Cloud Run
    socket.write(
        "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        "Sec-WebSocket-Accept: " + acceptKey + "\r\n\r\n"
    );

    // Conectar al VPS destino
    const remote = net.connect({ host: dhost, port: dport }, () => {
        console.log(`[INFO] Conectado al VPS ${dhost}:${dport}`);
    });

    socket.on("data", (data) => {
        remote.write(data);
    });

    remote.on("data", (data) => {
        socket.write(data);
    });

    socket.on("close", () => {
        remote.destroy();
    });

    remote.on("close", () => {
        socket.destroy();
    });

    socket.on("error", () => remote.destroy());
    remote.on("error", () => socket.destroy());
});

server.listen(mainPort, () => {
    console.log(`[INFO] Servidor escuchando en puerto ${mainPort}`);
});
