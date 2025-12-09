import http from "http";
import net from "net";
import url from "url";

const PORT = process.env.PORT || 8080;

// ---------- WebSocket Proxy ----------
const server = http.createServer();

server.on("upgrade", (req, socket, head) => {
  const pathname = url.parse(req.url).pathname;

  if (!req.url.includes("?")) {
    socket.destroy();
    return;
  }

  const [, target] = req.url.split("?");
  const [host, port] = target.split(":");

  const outbound = net.connect(port, host, () => {
    socket.write("HTTP/1.1 101 Switching Protocols\r\n\r\n");
    outbound.write(head);
    socket.pipe(outbound).pipe(socket);
  });

  outbound.on("error", () => socket.destroy());
});

server.listen(PORT, () => console.log("WS Proxy listening on " + PORT));
