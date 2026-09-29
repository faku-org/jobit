import { db } from "./db.ts";
import * as users from "./users.ts";
import type { Result } from "./types.ts";

/**
 * Quiénes de JobIt forman parte de la empresa.
 *
 * Es la designación y nada más: la persona queda asociada a la empresa —para
 * mostrarla en su ficha y para que la empresa sepa quién es— pero no entra al
 * panel ni publica por estar acá. Por eso no hay roles: estar o no estar.
 */
export interface CompanyMember {
  user_id: string;
  handle: string;
  display_name: string;
  created_at: string;
}

const MAX_MEMBERS = 200;

export function list(companyId: string): CompanyMember[] {
  return db()
    .query<CompanyMember, [string]>(
      `SELECT m.user_id, u.handle, u.display_name, m.created_at
         FROM company_members m JOIN users u ON u.id = m.user_id
        WHERE m.company_id = ?
        ORDER BY u.display_name COLLATE NOCASE`,
    )
    .all(companyId);
}

function count(companyId: string): number {
  return (
    db()
      .query<{ n: number }, [string]>(
        "SELECT COUNT(*) AS n FROM company_members WHERE company_id = ?",
      )
      .get(companyId)?.n ?? 0
  );
}

export function add(
  companyId: string,
  handle: string,
  now: Date = new Date(),
): Result<CompanyMember> {
  const user = users.byHandle(handle);
  if (!user) return { ok: false, error: "no hay ninguna cuenta de JobIt con ese handle" };

  const existing = db()
    .query<{ user_id: string }, [string, string]>(
      "SELECT user_id FROM company_members WHERE company_id = ? AND user_id = ?",
    )
    .get(companyId, user.id);
  if (existing) return { ok: false, error: "esa persona ya figura en la empresa" };

  if (count(companyId) >= MAX_MEMBERS) {
    return { ok: false, error: `una empresa no puede tener más de ${MAX_MEMBERS} miembros` };
  }

  const stamp = now.toISOString();
  db().run("INSERT INTO company_members (company_id, user_id, created_at) VALUES (?, ?, ?)", [
    companyId,
    user.id,
    stamp,
  ]);

  return {
    ok: true,
    value: {
      user_id: user.id,
      handle: user.handle,
      display_name: user.display_name,
      created_at: stamp,
    },
  };
}

export function remove(companyId: string, userId: string): boolean {
  return (
    db().run("DELETE FROM company_members WHERE company_id = ? AND user_id = ?", [
      companyId,
      userId,
    ]).changes > 0
  );
}
