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

## Las ofertas

La API sirve lo que el worker haya dejado en `worker/output/jobs.json`, y ese
archivo queda fuera del deploy a propósito. El scrapeo va por cron, con el
usuario del servicio:

```
15 */6 * * * cd /srv/jobit && /opt/bun/bun run scrape
```

La API relee el archivo cuando le cambia el mtime, así que no hay que
reiniciarla después de scrapear.

## Comprobar

```bash
curl -fsS https://jobs.wefaber.net/health
curl -fsS https://jobs.wefaber.net/api/meta | head -c 200
```

Que la API no conteste de afuera es lo correcto: escucha en `127.0.0.1` y solo
se llega por nginx. Eso es también lo que hace confiable el `x-forwarded-for`
con el que el limitador cuenta las peticiones.
