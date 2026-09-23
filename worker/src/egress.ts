import { type Socket, connect, createServer } from "node:net";

/**
 * Un proxy HTTP mínimo, solo CONNECT, para prestar la IP de esta máquina.
 *
 * BuscoJobs le contesta 403 a la IP del VPS. En vez de scrapear acá, la PC
 * presta su salida: esto se levanta en la máquina con IP limpia, el VPS lo
 * alcanza por Tailscale (o por un túnel SSH) y el worker sale a internet por
 * acá. El cache, la lógica y la agenda siguen viviendo en el VPS.
 *
 * Es CONNECT y nada más porque lo único que cruza es tráfico HTTPS, y HTTPS por
 * un proxy HTTP se negocia con CONNECT. No hace falta un paquete: son unas
 * pocas líneas de `node:net`.
 *
 * Se ata a `EGRESS_HOST` (por defecto 127.0.0.1). Para que el VPS lo alcance
 * por Tailscale, poné la IP del tailnet. Si además hay `EGRESS_TOKEN`, exige la
 * credencial.
 */
const HOST = process.env.EGRESS_HOST ?? "127.0.0.1";
const PORT = Number(process.env.EGRESS_PORT ?? 8787);
const TOKEN = (process.env.EGRESS_TOKEN ?? "").trim();

/** Un encabezado CONNECT no llega ni de lejos acá; más que esto es un ataque. */
const HEADER_LIMIT = 8 * 1024;

function authorized(header: string): boolean {
  if (!TOKEN) return true;

  const value = /^proxy-authorization:\s*(.+)$/im.exec(header)?.[1]?.trim() ?? "";
  const [scheme, ...rest] = value.split(" ");
  const credential = rest.join(" ").trim();
  if (!scheme || !credential) return false;

  if (scheme.toLowerCase() === "bearer") return credential === TOKEN;

  if (scheme.toLowerCase() === "basic") {
    // `usuario:clave` o solo `clave`: el usuario es indistinto, lo que importa
    // es la clave, así que apuntar la URL con cualquier nombre sirve.
    const decoded = Buffer.from(credential, "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    return (separator === -1 ? decoded : decoded.slice(separator + 1)) === TOKEN;
  }

  return false;
}

function refuse(socket: Socket, status: string, extra = ""): void {
  socket.end(`HTTP/1.1 ${status}\r\n${extra}Connection: close\r\n\r\n`);
}

function tunnel(socket: Socket, target: string): void {
  const separator = target.lastIndexOf(":");
  const host = separator > 0 ? target.slice(0, separator) : "";
  const port = Number(target.slice(separator + 1));

  if (!host || !Number.isInteger(port) || port <= 0 || port > 65_535) {
    refuse(socket, "400 Bad Request");
    return;
  }

  const upstream = connect(port, host, () => {
    socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    socket.pipe(upstream);
    upstream.pipe(socket);
  });

  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
}

const server = createServer((socket) => {
  let buffer = "";

  const onData = (chunk: Buffer): void => {
    buffer += chunk.toString("latin1");
    if (buffer.length > HEADER_LIMIT) {
      socket.destroy();
      return;
    }

    const end = buffer.indexOf("\r\n\r\n");
    if (end === -1) return;

    socket.off("data", onData);
    const header = buffer.slice(0, end);
    const [requestLine = ""] = header.split("\r\n");
    const [method, target] = requestLine.split(" ");

    if (!authorized(header)) {
      refuse(socket, "407 Proxy Authentication Required", 'Proxy-Authenticate: Basic realm="jobit"\r\n');
      return;
    }
    if (method !== "CONNECT" || !target) {
      refuse(socket, "405 Method Not Allowed");
      return;
    }

    tunnel(socket, target);
  };

  socket.on("data", onData);
  socket.on("error", () => socket.destroy());
});

server.listen(PORT, HOST, () => {
  console.log(`egress escuchando en ${HOST}:${PORT}`);
  console.log(TOKEN ? "con credencial" : "sin credencial (atá esto a una red de confianza)");
});
