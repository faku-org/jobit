# Deploy

El workflow de `.github/workflows/deploy.yml` corre en un runner self-hosted
cuando entra algo a `main`, o a mano con `workflow_dispatch`. Sube el estático a
`/var/www/jobs.wefaber.net/`, sincroniza el repo a `/srv/jobit/`, reinstala
dependencias y reinicia la API.

Todo lo de acá es de una sola vez, en el VPS.

## Usuario y carpetas

```bash
sudo useradd --system --home /srv/jobit --shell /usr/sbin/nologin jobit
sudo mkdir -p /srv/jobit/data /srv/jobit/worker/output /var/www/jobs.wefaber.net
sudo chown -R jobit:jobit /srv/jobit

El servicio corre como `jobit` con `ProtectHome=true`: necesita un bun propio,
fuera de `/home` (el de hermes vive en `~/.bun` y jobit no puede ejecutarlo):

```bash
sudo mkdir -p /opt/bun && sudo cp /home/hermes/.bun/bin/bun /opt/bun/bun
```
```

El usuario del runner necesita poder escribir en las dos rutas que sincroniza:

```bash
sudo setfacl -R -m u:<runner>:rwx /srv/jobit /var/www/jobs.wefaber.net
sudo setfacl -R -d -m u:<runner>:rwx /srv/jobit /var/www/jobs.wefaber.net
```

## Servicio

```bash
sudo cp deploy/jobit-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now jobit-api
systemctl status jobit-api
```

El workflow reinicia el servicio, así que el usuario del runner necesita esa
única orden sin contraseña. Con `visudo`:

```
<runner> ALL=(root) NOPASSWD: /bin/systemctl restart jobit-api, /bin/systemctl status jobit-api
```

## El panel de admin

Vive en `https://jobs.wefaber.net/admin` y la credencial es un hash argon2id en
el entorno del servicio. No hay tabla de usuarios ni clave en texto plano en
ningún lado.

El hash empieza con `$argon2id$` y **tiene varios `$` adentro**, que es
justamente lo que casi todo interpola en el camino: el shell expande
`$argon2id` y `$v` como variables vacías, y el parser de `.env` de Bun hace lo
mismo, con comillas simples, dobles o sin ninguna. El valor queda en
`=19=65536,t=2,p=1...` y la clave deja de coincidir sin dar un solo error que
lo explique.

Por eso va a un archivo, que nadie interpola:

```bash
sudo -u jobit /opt/bun/bun -e 'await Bun.write("/srv/jobit/data/admin.hash", await Bun.password.hash(prompt("clave: ")))'
sudo chmod 600 /srv/jobit/data/admin.hash
```

La unidad ya trae `Environment=ADMIN_PASSWORD_HASH_FILE=/srv/jobit/data/admin.hash`.
Sin ese archivo, o si no se puede leer, el panel queda apagado entero y
`/api/admin` contesta 404: un despliegue mal configurado se queda sin admin en
vez de con un admin abierto.

Para cambiar la clave alcanza con reescribir el archivo y reiniciar el
servicio. `ADMIN_PASSWORD_HASH` con el hash inline sigue funcionando para
desarrollo, escapando cada `$` como `\$`.

Para cerrar todas las sesiones abiertas, por ejemplo si se cambia la clave:

```bash
sqlite3 /srv/jobit/data/jobit.db 'DELETE FROM admin_sessions;'
```

## nginx

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/jobs.wefaber.net
sudo ln -s /etc/nginx/sites-available/jobs.wefaber.net /etc/nginx/sites-enabled/
sudo certbot --nginx -d jobs.wefaber.net
sudo nginx -t && sudo systemctl reload nginx
```

El archivo ya apunta a los certificados donde los deja certbot, así que si
certbot reescribe el bloque conviene revisar que no haya duplicado el
`ssl_certificate` ni pisado los headers.

`location = /` distingue el navegador de curl: si el User-Agent es curl (o
pide `text/plain`) nginx manda la query a `/api/cli` y el tablero sale en
texto. Un cambio de esa lista hay que repetirlo en `web/vite.config.ts`.

## Las ofertas

La API sirve lo que el worker haya dejado en `worker/output/jobs.json`, y ese
archivo queda fuera del deploy a propósito. La API relee el archivo cuando le
cambia el mtime, así que no hay que reiniciarla después de escribirlo.

### Desde dónde sale el scrapeo

BuscoJobs contesta 403 a la IP del VPS (es IP de datacenter). Su sitio es
Next.js detrás de Istio y el scrapeo pega a `/_next/data/*.json`, que es JSON
plano: desde una IP limpia entra sin navegador. Así que **el scrapeo corre en el
VPS y sale a internet por la PC**, que presta su IP con un proxy mínimo
(`worker/src/egress.ts`, solo CONNECT).

Dos piezas:

**En la PC**, el egress:

```bash
EGRESS_HOST=<ip-del-tailnet-de-la-pc> EGRESS_PORT=8787 EGRESS_TOKEN=<clave> \
  bun run egress
```

Se ata al tailnet para que el VPS lo alcance sin abrir nada a internet, y
conviene dejarlo arrancando solo (una tarea programada de Windows, o el servicio
que uses). Si la PC se apaga no se rompe nada: la corrida siguiente igual
refresca Uruguay Concursa y BuscoJobs conserva lo último que trajo
(`worker/src/keep.ts`).

**En el VPS**, la salida apunta al egress. Va en `worker/.env`, que es el que
Bun carga cuando el service corre con `WorkingDirectory=/srv/jobit/worker`:

```
JOBIT_SCRAPE_PROXY=http://:<clave>@<ip-del-tailnet-de-la-pc>:8787
JOBIT_HEARTBEAT_URL=https://hc-ping.com/...
```

`JOBIT_HEARTBEAT_URL` se pinguea **solo cuando BuscoJobs vino fresco**: es el
canario de que el egress sigue vivo. Si la señal deja de llegar, el monitor
avisa. Si algún día se contrata un proxy residencial pago, `JOBIT_SCRAPE_PROXY`
pasa a apuntar ahí y la PC deja de hacer falta: es cambiar una variable.

### La agenda

`deploy/jobit-scrape.timer` corre `jobit-scrape.service` cada seis horas
(00:15, 06:15, 12:15 y 18:15) y recupera la corrida si el VPS estuvo apagado.
systemd no solapa dos corridas del mismo unit, así que no hace falta un lock.

```bash
sudo cp deploy/jobit-scrape.service deploy/jobit-scrape.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now jobit-scrape.timer
systemctl list-timers jobit-scrape.timer
journalctl -u jobit-scrape.service -n 50
```

Con cron sería la misma corrida, con el `cd` a `worker/` para que Bun cargue
`worker/.env`:

```
15 */6 * * * cd /srv/jobit/worker && PATH=/opt/bun:$PATH /opt/bun/bun run src/index.ts
```

### La ingesta sigue existiendo

`POST /api/ingest/jobs` queda para corridas sueltas desde otra máquina
(`bun run scrape:push`). Del lado del servidor la credencial es un token en un
archivo, por la misma razón que el hash del panel:

```bash
sudo -u jobit /opt/bun/bun -e 'await Bun.write("/srv/jobit/data/ingest.token", crypto.randomUUID() + crypto.randomUUID())'
sudo chmod 600 /srv/jobit/data/ingest.token
```

La unidad ya trae `Environment=INGEST_TOKEN_FILE=/srv/jobit/data/ingest.token`.
Sin ese archivo la ruta contesta 404, igual que `/api/admin`. Ese mismo valor va
en el `worker/.env` de la máquina que scrapea, junto con la URL; del otro lado
el comando es `bun run scrape:push`.

Dos cosas del servicio de la API existen por esto: `ReadWritePaths` incluye
`/srv/jobit/worker/output`, porque con `ProtectSystem=strict` la API no podría
escribir ahí, y `MemoryMax` subió a 768M, que es el pico de descomprimir y
parsear cinco megas de JSON. Y en nginx, `/api/ingest/jobs` tiene su propio
`location` con `client_max_body_size 4m`: el bloque general corta en 16k.

## Comprobar

```bash
curl -fsS https://jobs.wefaber.net/health
curl -fsS https://jobs.wefaber.net/api/meta | head -c 200
```

Que la API no conteste de afuera es lo correcto: escucha en `127.0.0.1` y solo
se llega por nginx. Eso es también lo que hace confiable el `x-forwarded-for`
con el que el limitador cuenta las peticiones.
