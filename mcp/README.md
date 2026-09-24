# @jobit/mcp

Servidor [MCP](https://modelcontextprotocol.io) que expone la búsqueda de JobIt
para que un agente encuentre ofertas de trabajo de Uruguay contra su propia
memoria y de forma automatizada.

Es un proceso aparte que habla MCP por **stdio** y llama a la API por HTTP. No
importa el código de la API: se apunta a producción o a un self-host con una
variable de entorno.

## Herramientas

| Herramienta | Llama a | Qué devuelve |
|---|---|---|
| `search_jobs` | `GET /api/jobs` | Ofertas filtradas y paginadas: `{ total, offset, limit, jobs }`. |
| `get_job` | `GET /api/jobs/:id` | Una oferta completa, con su descripción y su enlace. |
| `market_overview` | `GET /api/market` | El tablero resumido: puestos, rubros, zonas y sueldos. |
| `list_filters` | `GET /api/meta` | Rubros, departamentos, fuentes y total. |

Todas son de lectura. El MCP no escribe nada y no toca lo guardado en el
navegador de nadie, que vive del lado del cliente.

## Uso

```bash
# Con la API de producción (por defecto)
bun run --cwd mcp start

# Contra un JobIt local
JOBIT_API_URL=http://127.0.0.1:3000 bun run --cwd mcp start
```

`JOBIT_API_URL` es la única variable. Por defecto apunta a
`https://jobs.wefaber.net`.

## Configuración en un cliente MCP

En Claude Desktop, Cursor o cualquier cliente que lea `mcpServers`:

```json
{
  "mcpServers": {
    "jobit": {
      "command": "bun",
      "args": ["run", "--cwd", "/ruta/a/jobit/mcp", "start"],
      "env": { "JOBIT_API_URL": "https://jobs.wefaber.net" }
    }
  }
}
```

Sin clonar el repo, el paquete va con su ruta absoluta al entrypoint:

```json
{
  "mcpServers": {
    "jobit": { "command": "bun", "args": ["/ruta/a/jobit/mcp/src/index.ts"] }
  }
}
```

## Por qué importa decidirlo temprano

Un servidor MCP es un canal de distribución que no pasa por el buscador. Si la
mayor parte del tráfico va a venir por agentes, baja la prioridad del trabajo de
indexado (SEO), y al revés. Son dos apuestas que tiran para lados distintos; este
paquete existe para poder medir la primera sin comprometer la segunda, porque
reutiliza exactamente la misma API que sirve a la web.

## Desarrollo

```bash
bun run --cwd mcp typecheck
bun test mcp/src             # o, desde mcp/: bun test
```

Los tests no tocan la red: inyectan un `fetch` falso y conectan el servidor a un
transporte en memoria.
