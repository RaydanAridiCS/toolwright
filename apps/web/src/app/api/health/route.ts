import { checkDatabase } from "@toolwright/db";
import { json } from "../../../lib/api";

export const dynamic = "force-dynamic";

/**
 * For the owner's deploy checks (`npm run check:deploy`) and uptime monitors. It says whether the server is up and
 * whether the request board's database answers. It never includes a connection string, host or error text.
 * 200 means visitors can use the whole site; 503 means the board cannot reach its database.
 */
export async function GET() {
  const database = await checkDatabase();
  const ok = database.state === "ok";
  return json({ ok, database: { ...database, persistent: database.mode === "postgres" } }, { status: ok ? 200 : 503 });
}
