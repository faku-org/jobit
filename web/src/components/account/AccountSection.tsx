import {
  Fingerprint,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MailCheck,
  ShieldCheck,
  ShieldOff,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AccountSync } from "../../hooks/useAccountSync.ts";
import { formatDay } from "../../lib/format.ts";
import {
  type MailLanding,
  type Passkey,
  type SessionUser,
  currentUser,
  listPasskeys,
  logout,
  resendVerification,
} from "../../lib/session.ts";
import { AccountDialog, type AccountAction, type AccountContext } from "./AccountDialog.tsx";
import { accountDangerClass, accountPrimaryClass, accountQuietClass } from "./controls.ts";

interface AccountSectionProps {
  /** Quién está adentro, leído por la isla, que ya está montada cuando esto se
   * abre. Pedirlo acá adentro cambiaba el alto del panel a mitad de la
   * animación y la isla saltaba. */
  user: SessionUser | null;
  ready: boolean;
  onUser: (user: SessionUser | null) => void;
  /** El estado del sync de la cuenta, manejado arriba con el resto del panel. */
  sync: AccountSync;
  /** Si se llegó desde un enlace de correo, qué traía. */
  landing?: MailLanding | null;
}

const LANDING_NOTE: Record<"verified" | "expired", string> = {
  verified: "Listo: tu correo quedó confirmado.",
  expired: "Ese enlace ya venció o se usó. Pedí uno nuevo desde tu cuenta.",
};

/**
 * La cuenta de quien publica. Es lo único de la app que vive en el servidor,
 * así que tiene su propia pestaña: el resto del panel guarda en este navegador,
 * esto no. Cada trámite (alta, ingreso, contraseña, 2FA, borrado) abre el mismo
 * modal, con una pantalla distinta.
 */
export function AccountSection({ user, ready, onUser, sync, landing }: AccountSectionProps) {
  /** Un enlace de reset abre directo la pantalla de contraseña nueva. */
  const [action, setAction] = useState<AccountAction | null>(
    landing?.kind === "reset" ? "reset" : null,
  );
  const [context, setContext] = useState<AccountContext>(
    landing?.kind === "reset" ? { token: landing.token } : {},
  );
  const [note, setNote] = useState(
    landing && landing.kind !== "reset" ? LANDING_NOTE[landing.kind] : "",
  );

  const open = (next: AccountAction, extra: AccountContext = {}): void => {
    setContext(extra);
    setAction(next);
  };

  /** Vuelve a leer la cuenta después de un cambio, para no adivinar el estado. */
  const refresh = async (): Promise<void> => {
    try {
      onUser(await currentUser());
    } catch {
      /* Si la API no contesta, se queda con lo que ya sabía. */
    }
  };

  /** Recién verificado: la sesión que ya estaba cargada todavía dice que no.
   * El ref la relee una sola vez aunque StrictMode monte el efecto dos. */
  const reread = useRef(false);
  useEffect(() => {
    if (reread.current || landing?.kind !== "verified") return;
    reread.current = true;
    currentUser()
      .then(onUser)
      .catch(() => {
        /* Si la API no contesta, el aviso igual dice que quedó confirmado. */
      });
  }, [landing, onUser]);

  if (!ready) {
    return <p className="px-4 text-[11px] text-onpanel-faint">Cargando tu cuenta…</p>;
  }

  return (
    <div className="space-y-4 px-4 pt-1 pb-4">
      {note ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-onpanel-wash px-3 py-2.5">
          <MailCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-sky" />
          <p className="flex-1 text-[11px] leading-relaxed text-onpanel/80">{note}</p>
          <button
            aria-label="Cerrar aviso"
            className="text-onpanel/50 transition-colors hover:text-onpanel"
            type="button"
            onClick={() => setNote("")}
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </div>
      ) : null}

      {user ? (
        <SignedIn
          user={user}
          sync={sync}
          onAction={open}
          onLogout={() => void logout().then(() => onUser(null))}
        />
      ) : (
        <SignedOut onAction={open} />
      )}

      {action ? (
        <AccountDialog
          key={action}
          action={action}
          context={context}
          user={user}
          onClose={() => setAction(null)}
          onUser={onUser}
          onRefresh={refresh}
        />
      ) : null}
    </div>
  );
}

/** Sin cuenta: decir qué es y ofrecer las tres puertas, con la de recuperar al
 * mismo nivel que las otras. Antes era un renglón subrayado que no se leía. */
function SignedOut({ onAction }: { onAction: (action: AccountAction) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2.5 rounded-xl bg-onpanel-wash px-3 py-2.5">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-sky" />
        <p className="text-[11px] leading-relaxed text-onpanel/75">
          Esta cuenta es lo único del panel que vive en el servidor; todo lo demás queda en este
          navegador. Se guarda lo mínimo y se puede borrar entero cuando quieras.
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold tracking-wide text-onpanel-muted uppercase">
          Para publicar
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-onpanel/70">
          Publicar servicios pide una cuenta: un handle, tu nombre visible y una contraseña. Para
          mandar un servicio a revisión hace falta además un correo confirmado, que es por donde te
          llegan los avisos y la recuperación.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className={accountPrimaryClass}
            type="button"
            onClick={() => onAction("register")}
          >
            Crear cuenta
          </button>
          <button className={accountQuietClass} type="button" onClick={() => onAction("login")}>
            Entrar
          </button>
        </div>
      </div>

      <div className="border-t border-onpanel/10 pt-3">
        <p className="text-[11px] font-semibold tracking-wide text-onpanel-muted uppercase">
          ¿No podés entrar?
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-onpanel/70">
          Con un correo confirmado te mandamos un enlace para cambiar la contraseña. Sin correo, se
          entra con un código de respaldo.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className={accountQuietClass} type="button" onClick={() => onAction("forgot")}>
            <Mail aria-hidden className="size-4 text-sky" />
            Olvidé mi contraseña
          </button>
          <button className={accountQuietClass} type="button" onClick={() => onAction("recover")}>
            <KeyRound aria-hidden className="size-4 text-sky" />
            Tengo un código de respaldo
          </button>
        </div>
      </div>
    </div>
  );
}

/** Con sesión: quién es, qué se guarda y los botones que cambian cada cosa. */
function SignedIn({
  user,
  sync,
  onAction,
  onLogout,
}: {
  user: SessionUser;
  sync: AccountSync;
  onAction: (action: AccountAction, context?: AccountContext) => void;
  onLogout: () => void;
}) {
  const [keys, setKeys] = useState<Passkey[]>([]);
  const [resent, setResent] = useState("");

  /** La lista se relee cuando cambia cuántas hay: después de agregar o sacar. */
  useEffect(() => {
    if (user.passkeys === 0) {
      setKeys([]);
      return;
    }
    void listPasskeys().then((result) => {
      if (result.ok) setKeys(result.value.passkeys);
    });
  }, [user.passkeys]);

  const resend = async (): Promise<void> => {
    const result = await resendVerification();
    setResent(
      !result.ok
        ? result.error
        : result.value.verified
          ? "Ya estaba confirmado."
          : "Te mandamos el enlace. Si no llega, fijate en spam o esperá diez minutos para pedir otro.",
    );
  };

  const secondStep =
    user.passkeys > 0
      ? "Llave de acceso"
      : user.totp_enabled
        ? "Códigos (de salida)"
        : "Sin segundo paso";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 rounded-xl bg-onpanel-wash px-3 py-2.5">
        <UserRound aria-hidden className="size-4 shrink-0 text-onpanel/60" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-onpanel">{user.display_name}</p>
          <p className="text-[11px] text-onpanel-faint">
            @{user.handle} · cuenta desde {formatDay(user.created_at)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            user.passkeys > 0 || user.totp_enabled
              ? "bg-sky text-ink"
              : "bg-onpanel-wash text-onpanel-faint"
          }`}
        >
          {user.passkeys > 0 || user.totp_enabled ? "2FA activo" : "Sin 2FA"}
        </span>
      </div>

      <div>
        <p className="text-[11px] font-semibold tracking-wide text-onpanel-muted uppercase">
          Datos guardados en el servidor
        </p>
        <dl className="mt-2 divide-y divide-onpanel/10 overflow-hidden rounded-xl border border-onpanel/10">
          <Row label="Handle" value={`@${user.handle}`} />
          <Row label="Nombre visible" value={user.display_name} />
          <Row
            label="Correo"
            value={
              !user.has_email ? "Sin cargar" : user.email_verified ? "Confirmado" : "Sin confirmar"
            }
          />
          <Row label="Segundo paso" value={secondStep} />
          <Row label="Códigos de respaldo" value={`${user.recovery_codes_left} sin usar`} />
          <Row label="Creada" value={formatDay(user.created_at)} />
        </dl>
        <p className="mt-2 text-[11px] leading-relaxed text-onpanel-faint">
          Nada de IP, user agent ni historial de inicios: las filas se estampan con el día y nunca
          con la hora. El correo va cifrado. De las llaves se guarda solo la parte pública: con una
          copia de la base no se entra a ninguna cuenta.
        </p>
      </div>

      {user.has_email && !user.email_verified ? (
        <div className="rounded-xl border border-sky/30 px-3 py-2.5">
          <p className="text-[11px] leading-relaxed text-onpanel/80">
            Tu correo todavía no está confirmado. Hasta que lo esté no te llegan avisos ni podés
            mandar un servicio a revisión.
          </p>
          <button
            className="mt-1.5 text-[11px] font-medium text-sky underline underline-offset-2 transition-colors hover:text-onpanel"
            type="button"
            onClick={() => void resend()}
          >
            Mandarme el enlace de nuevo
          </button>
          {resent ? <p className="mt-1 text-[11px] text-onpanel/70">{resent}</p> : null}
        </div>
      ) : null}

      {user.totp_enabled && user.passkeys === 0 ? (
        <div className="rounded-xl border border-sky/30 px-3 py-2.5">
          <p className="text-[11px] leading-relaxed text-onpanel/80">
            Tu segundo paso usa códigos de seis dígitos, que ya no se activan: para verificarlos el
            servidor tiene que guardar una clave con la que podría generarlos. Agregá una llave de
            acceso y esa clave se borra sola.
          </p>
        </div>
      ) : null}

      <div className="border-t border-onpanel/10 pt-3">
        <p className="text-[11px] font-semibold tracking-wide text-onpanel-muted uppercase">
          Llaves de acceso
        </p>
        {keys.length > 0 ? (
          <ul className="mt-2 divide-y divide-onpanel/10 overflow-hidden rounded-xl border border-onpanel/10">
            {keys.map((key) => (
              <li key={key.id} className="flex items-center gap-2.5 px-3 py-2">
                <Fingerprint aria-hidden className="size-3.5 shrink-0 text-sky" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-onpanel">{key.name}</p>
                  <p className="text-[10px] text-onpanel-faint">
                    desde {formatDay(key.created_on)}
                  </p>
                </div>
                <button
                  className="text-[11px] text-onpanel/60 underline underline-offset-2 transition-colors hover:text-red-400"
                  type="button"
                  onClick={() =>
                    onAction("passkey-remove", { passkeyId: key.id, passkeyName: key.name })
                  }
                >
                  Sacar
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[11px] leading-relaxed text-onpanel/70">
            La huella, la cara o el PIN de tu dispositivo como segundo paso, además de la
            contraseña.
          </p>
        )}
        <div className="mt-2">
          <ActionButton
            icon={Fingerprint}
            label={keys.length > 0 ? "Agregar otra llave" : "Agregar una llave de acceso"}
            onClick={() => onAction("passkey-add")}
          />
        </div>
      </div>

      <div className="border-t border-onpanel/10 pt-3">
        <p className="text-[11px] font-semibold tracking-wide text-onpanel-muted uppercase">
          Seguridad y acceso
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <ActionButton
            icon={Lock}
            label="Cambiar contraseña"
            onClick={() => onAction("password")}
          />
          <ActionButton
            icon={Mail}
            label={user.has_email ? "Cambiar correo" : "Cargar correo"}
            onClick={() => onAction("email")}
          />
          {user.totp_enabled ? (
            <ActionButton
              icon={ShieldOff}
              label="Apagar los códigos"
              onClick={() => onAction("totp-off")}
            />
          ) : null}
          <ActionButton icon={LogOut} label="Cerrar sesión" onClick={onLogout} />
        </div>
      </div>

      <div className="border-t border-onpanel/10 pt-3">
        <p className="text-[11px] font-semibold tracking-wide text-onpanel-muted uppercase">
          Sincronización
        </p>
        <label className="mt-2 flex cursor-pointer items-start gap-2.5">
          <input
            checked={sync.enabled}
            className="mt-0.5 size-3.5 shrink-0 accent-sky"
            disabled={!sync.known || sync.busy}
            type="checkbox"
            onChange={(event) => void (event.target.checked ? sync.enable() : sync.disable())}
          />
          <span className="text-[11px] leading-relaxed text-onpanel/75">
            Llevar mis datos entre navegadores. Guarda en tu cuenta lo que marcaste, tus
            postulaciones, tus preferencias y tu perfil, para tenerlos en cualquier navegador donde
            entres. Apagarlo lo borra. Hoy va cifrado con una clave{" "}
            <strong className="font-medium text-onpanel">del servidor</strong>, no tuya: frena a
            quien se lleve una copia de la base, no a nosotros. Pasarlo a una clave que solo abra tu
            contraseña es lo próximo.
          </span>
        </label>
        {sync.error ? (
          <p className="mt-1.5 text-[11px] leading-relaxed text-red-400">{sync.error}</p>
        ) : null}
      </div>

      <div className="border-t border-red-400/20 pt-3">
        <p className="text-[11px] font-semibold tracking-wide text-red-400 uppercase">
          Zona peligrosa
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-onpanel/70">
          Borrar la cuenta se lleva del servidor tu usuario, tus sesiones, tus códigos y lo que
          hayas publicado. No se puede deshacer.
        </p>
        <button
          className={`${accountDangerClass} mt-2`}
          type="button"
          onClick={() => onAction("delete")}
        >
          <TriangleAlert aria-hidden className="size-4" />
          Borrar mi cuenta
        </button>
      </div>

      {/* Las legales también acá: es donde alguien mira qué se guarda de su
          cuenta y puede querer leer el detalle. */}
      <p className="border-t border-onpanel/10 pt-3 text-[11px] text-onpanel/50">
        <a
          className="underline underline-offset-2 transition-colors hover:text-onpanel"
          href="/privacidad"
          rel="noopener"
          target="_blank"
        >
          Política de privacidad
        </a>
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2">
      <dt className="shrink-0 text-[11px] text-onpanel-faint">{label}</dt>
      <dd className="min-w-0 truncate text-[12px] font-medium text-onpanel">{value}</dd>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Lock;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex items-center gap-2 rounded-xl border border-onpanel/15 px-3 py-2 text-left text-[12px] font-medium text-onpanel/80 transition-colors hover:border-sky hover:text-onpanel"
      type="button"
      onClick={onClick}
    >
      <Icon aria-hidden className="size-3.5 shrink-0 text-sky" />
      {label}
    </button>
  );
}
