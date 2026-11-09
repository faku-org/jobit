import { Loader2, Trash2, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { type Company, type CompanyMember, addMember, removeMember } from "./api.ts";

const input =
  "w-full rounded-lg border border-sky/70 bg-mist px-2.5 py-2 text-sm text-ink outline-none focus:border-brand";

export function Members({
  company,
  onUpdated,
  onFail,
}: {
  company: Company;
  onUpdated: (company: Company) => void;
  onFail: (cause: unknown) => void;
}) {
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);

  const run = (task: () => Promise<void>) => {
    setBusy(true);
    task()
      .catch(onFail)
      .finally(() => setBusy(false));
  };

  const add = () => {
    if (handle.trim() === "") return;
    run(async () => {
      const result = await addMember(handle.trim().replace(/^@/, ""));
      onUpdated({ ...company, members: result.members });
      setHandle("");
    });
  };

  const remove = (member: CompanyMember) =>
    run(async () => {
      const result = await removeMember(member.user_id);
      onUpdated({ ...company, members: result.members });
    });

  return (
    <section>
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Miembros</h2>
      <p className="mt-1.5 text-xs leading-relaxed text-faint">
        Quiénes de JobIt forman parte de tu empresa. Figuran en la ficha; no entran al panel ni
        publican por estar acá.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <input
          className={input}
          placeholder="@handle de JobIt"
          value={handle}
          onChange={(event) => setHandle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <button
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-panel px-3 py-2 text-xs font-medium text-onpanel disabled:opacity-60"
          disabled={busy || handle.trim() === ""}
          type="button"
          onClick={add}
        >
          <UserPlus aria-hidden className="size-3.5" />
          Designar
        </button>
      </div>

      {company.members.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-sky/70 px-3 py-6 text-center text-xs text-muted">
          Todavía no hay nadie designado.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-sky/40 overflow-hidden rounded-xl border border-sky/60">
          {company.members.map((member) => (
            <li key={member.user_id} className="flex items-center gap-2.5 bg-surface px-3 py-2.5">
              <Users aria-hidden className="size-3.5 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{member.display_name}</p>
                <p className="text-[11px] text-faint">@{member.handle}</p>
              </div>
              <button
                aria-label={`Quitar a ${member.display_name}`}
                className="shrink-0 rounded-lg p-2 text-muted hover:bg-mist hover:text-red-600"
                disabled={busy}
                type="button"
                onClick={() => remove(member)}
              >
                {busy ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Trash2 aria-hidden className="size-3.5" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
