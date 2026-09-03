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

```bash
bun -e 'console.log(await Bun.password.hash(prompt("clave: ")))'
```

Ese hash empieza con `$argon2id$...` y **tiene varios `$` adentro**. Si se pega
sin comillas en un `.env` o en una línea de shell, el shell expande `$argon2id`,
`$v` y `$m` como variables vacías y la clave deja de coincidir sin dar ningún
error claro. En la unidad de systemd va entre comillas simples:

```ini
Environment='ADMIN_PASSWORD_HASH=$argon2id$v=19$m=65536,t=2,p=1$...'
```

Sin esa variable el panel queda apagado entero y `/api/admin` contesta 404, así
que un despliegue al que se le olvidó configurarla se queda sin admin en vez de
con un admin abierto.

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
15 */6 * * * cd /srv/jobit && /usr/local/bin/bun run scrape
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
