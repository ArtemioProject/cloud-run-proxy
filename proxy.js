/**
 * WebSocket TCP Proxy para Cloud Run
 * Compatible con payload HTTP Injector antiguo.
 * Autor: ChatGPT para Artemio
 */

const http = require("http");
const net = require("net");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;

// tu VPS destino
const DHOST = process.env.DHOST || "127.0.0.1";

// destinos permitidos
const ALLOWED_PORTS = {
    "80": 80,
    "443": 443
};

console.log("[INFO] WebSocket Proxy CloudRun");
console.log("[INFO] Permitidos: 80 y 443");
console.log("[INFO] VPS destino:", DHOST);

// Cloud Run necesita responder a GET /
const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("CloudRun WS Proxy OK\n");
});

// Evento WS Upgrade
server.on("upgrade", (req, socket) => {
    const key = req.headers["sec-websocket-key"];
    if (!key) return socket.destroy();

    // --- HANDSHAKE WEBSOCKET OFICIAL ---
    const accept = crypto
        .createHash("sha1")
        .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
        .digest("base64");

    socket.write(
        "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );

    const remotePort = ALLOWED_PORTS[req.headers["x-port"]] || 80;

    console.log(`[INFO] Cliente conectado → redirigiendo al VPS ${DHOST}:${remotePort}`);

    const remote = net.connect({
        host: DHOST,
        port: remotePort
    });

    // WS → TCP
    socket.on("data", frame => {
        if (frame[0] === 0x81 || frame[0] === 0x82) {
            const len = frame[1] & 0x7f;
            const mask = frame.slice(2, 6);
            const payload = frame.slice(6);

            for (let i = 0; i < payload.length; i++)
                payload[i] ^= mask[i % 4];

            remote.write(payload);
        }
    });

    // TCP → WS
    remote.on("data", chunk => {
        const header = Buffer.from([0x82, chunk.length]);
        socket.write(Buffer.concat([header, chunk]));
    });

    remote.on("error", () => socket.destroy());
    socket.on("error", () => remote.destroy());
    socket.on("close", () => remote.destroy());
});

server.listen(PORT, () => {
    console.log("[READY] Servicio Cloud Run escuchando en : " + PORT);
});
