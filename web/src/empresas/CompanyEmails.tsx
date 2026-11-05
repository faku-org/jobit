import { BadgeCheck, Loader2, Mail, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  type Company,
  type CompanyEmail,
  type CompanyEmailKind,
  EMAIL_KINDS,
  EMAIL_KIND_HINT,
  EMAIL_KIND_LABEL,
  removeEmail,
  resendEmail,
  setEmail,
} from "./api.ts";

const input =
  "w-full rounded-lg border border-sky/70 bg-mist px-2.5 py-2 text-sm text-ink outline-none focus:border-brand";

export function CompanyEmails({
  company,
  onUpdated,
  onFail,
}: {
  company: Company;
  onUpdated: (company: Company) => void;
  onFail: (cause: unknown) => void;
}) {
  const [version, setVersion] = useState(0);

  const apply = (emails: CompanyEmail[]) => {
    onUpdated({ ...company, emails });
    setVersion((current) => current + 1);
  };

  return (
    <section>
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Correos</h2>
      <p className="mt-1.5 text-xs leading-relaxed text-faint">
        Cada uno cumple una función distinta. Se confirman por mail: hasta que no se verifica, el
        panel lo marca.
      </p>

      <div className="mt-3 space-y-3" key={version}>
        {EMAIL_KINDS.map((kind) => (
          <EmailRow
            key={kind}
            entry={company.emails.find((item) => item.kind === kind)}
            kind={kind}
            onApply={apply}
            onFail={onFail}
          />
        ))}
      </div>
    </section>
  );
}

function EmailRow({
  kind,
  entry,
  onApply,
  onFail,
}: {
  kind: CompanyEmailKind;
  entry: CompanyEmail | undefined;
  onApply: (emails: CompanyEmail[]) => void;
  onFail: (cause: unknown) => void;
}) {
  const [value, setValue] = useState(entry?.email ?? "");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const run = (task: () => Promise<void>) => {
    setBusy(true);
    setSent(false);
    task()
      .catch(onFail)
      .finally(() => setBusy(false));
  };

  const save = () => {
    if (value.trim() === (entry?.email ?? "")) return;
    run(async () => {
      const result = await setEmail(kind, value.trim());
      onApply(result.emails);
      setSent(true);
    });
  };

  const resend = () =>
    run(async () => {
      await resendEmail(kind);
      setSent(true);
    });

  const remove = () =>
    run(async () => {
      const result = await removeEmail(kind);
      onApply(result.emails);
      setValue("");
    });

  return (
    <div className="rounded-xl border border-sky/60 bg-surface p-3">
      <div className="flex items-center gap-2">
        <Mail aria-hidden className="size-3.5 shrink-0 text-muted" />
        <span className="text-xs font-medium text-ink">{EMAIL_KIND_LABEL[kind]}</span>
        {entry?.email ? (
          entry.verified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
              <BadgeCheck aria-hidden className="size-3" />
              Verificado
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
              Sin verificar
            </span>
          )
        ) : null}
      </div>
      <p className="mt-1 text-[11px] text-faint">{EMAIL_KIND_HINT[kind]}</p>

      <div className="mt-2 flex items-center gap-2">
        <input
          className={input}
          placeholder="correo@empresa.com"
          type="email"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button
          className="shrink-0 rounded-lg bg-panel px-2.5 py-2 text-xs font-medium text-onpanel disabled:opacity-60"
          disabled={busy || value.trim() === ""}
          type="button"
          onClick={save}
        >
          Guardar
        </button>
        {entry?.email && !entry.verified ? (
          <button
            className="shrink-0 rounded-lg border border-sky/70 px-2.5 py-2 text-xs font-medium text-ink hover:bg-mist disabled:opacity-60"
            disabled={busy}
            type="button"
            onClick={resend}
          >
            Reenviar
          </button>
        ) : null}
        {entry?.email ? (
          <button
            aria-label={`Quitar ${EMAIL_KIND_LABEL[kind]}`}
            className="shrink-0 rounded-lg p-2 text-muted hover:bg-mist hover:text-red-600 disabled:opacity-60"
            disabled={busy}
            type="button"
            onClick={remove}
          >
            {busy ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Trash2 aria-hidden className="size-3.5" />}
          </button>
        ) : null}
      </div>

      {sent ? <p className="mt-2 text-[11px] text-emerald-700">Listo. Revisá ese correo.</p> : null}
    </div>
  );
}
