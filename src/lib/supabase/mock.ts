/* eslint-disable @typescript-eslint/no-explicit-any -- Dev-only Supabase shim;
   must structurally match the schema-less `any`-typed @supabase/supabase-js client. */
import { DEV_SESSION_COOKIE, DEV_CREDENTIALS, DEV_ADMIN_ID, DEV_STAFF_ID } from "./dev";

// ---------------------------------------------------------------------------
// Local in-memory Supabase stand-in for dev mode (DEV_BYPASS_MODE=true).
// Implements exactly the API surface this app uses:
//   - tables: users, products, sales, sale_items, settings, daily_closing,
//     audit_log, staff_day_stats
//   - RPCs: get_today_summary, get_staff_profit_summary
//   - auth (session cookie based on the server) + admin auth helpers
//   - storage (no-op, returns placeholder URLs)
//   - realtime (no-op)
// ---------------------------------------------------------------------------

type Row = Record<string, any>;
type ErrorResult = {
  error: {
    message: string;
    code: string;
    details: string;
    hint: string;
  } | null;
};
type Result = { data: any; count?: number } & ErrorResult;

type MockCookieAdapter = {
  getAll: () => { name: string; value: string }[];
  setAll: (cookies: { name: string; value: string; options?: Record<string, any> }[]) => void;
};

function uuid(seed: string): string {
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  let h = "";
  for (let i = 0; i < seed.length; i++) h += hex(seed.charCodeAt(i) & 0xff);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(12, 15)}-${h
    .slice(15, 18)
    .replace(/^./, "a")}-${h.slice(18, 30)}`;
}

const ADMIN_ID = DEV_ADMIN_ID;
const STAFF_ID = DEV_STAFF_ID;

function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const iso = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  d.setHours(10 + (offsetDays % 8), 30, 0, 0);
  return d.toISOString();
};

let idCounter = 0;
function newId(): string {
  // crypto.randomUUID() is unavailable on non-secure contexts (plain http on
  // a LAN IP), and the mock also runs client-side via the realtime hook — use
  // a runtime-agnostic generator instead.
  idCounter += 1;
  return `${Date.now().toString(36)}-dev-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// SEED DATA
// ---------------------------------------------------------------------------
type Store = { [table: string]: Row[] };

function buildStore(): Store {
  return {
    users: [
      {
        id: ADMIN_ID, name: "Admin User", email: DEV_CREDENTIALS.adminEmail,
        role: "admin", status: "active", created_at: iso(40),
      },
      {
        id: STAFF_ID, name: "Staff User", email: DEV_CREDENTIALS.staffEmail,
        role: "staff", status: "active", created_at: iso(30),
      },
    ],
    products: [],
    sales: [],
    sale_items: [],
    settings: [
      {
        id: uuid("dev+settings"),
        business_name: "Demo Store",
        business_phone: null,
        business_address: null,
        currency: "INR",
        staff_can_view_profit: true,
        low_stock_threshold: 5,
        updated_at: iso(1),
      },
    ],
    daily_closing: [],
    audit_log: [],
    staff_day_stats: [],
  };
}

const store: Store = buildStore();

function findUserByEmail(email: string): Row | undefined {
  return store.users.find((u) => u.email === email.toLowerCase());
}

// ---------------------------------------------------------------------------
// QUERY BUILDER
// ---------------------------------------------------------------------------
type Filter = (row: Row) => boolean;

function parseSelect(columns: string | undefined): {
  cols: string[] | null;
  relations: { alias: string; fk: string; refTable: string; refCols: string[] }[];
} {
  if (!columns || columns.trim() === "*") return { cols: null, relations: [] };
  const cols: string[] = [];
  let allCols = false;
  const relations: { alias: string; fk: string; refTable: string; refCols: string[] }[] = [];
  for (const raw of columns.split(",")) {
    const part = raw.trim();
    if (!part) continue;
    if (part === "*") {
      allCols = true;
      continue;
    }
    if (part.includes(":")) {
      const suffix = part.split(":")[1];
      const fk = suffix.includes("(") ? suffix.slice(0, suffix.indexOf("(")) : suffix;
      const refColsRaw = suffix.match(/\(([^)]*)\)/)?.[1];
      const refCols = refColsRaw
        ? refColsRaw.split(",").map((c) => c.trim()).filter(Boolean)
        : [];
      const alias = part.split(":")[0].trim();
      relations.push({ alias, fk: fk.trim(), refTable: alias, refCols });
    } else {
      cols.push(part);
    }
  }
  return { cols: allCols ? null : cols, relations };
}

function mapSelect(row: Row, select: string | undefined): Row {
  const { cols, relations } = parseSelect(select);
  const out: Row = {};
  if (cols === null) {
    Object.assign(out, row);
  } else {
    for (const c of cols) if (c in row) out[c] = row[c];
  }
  for (const rel of relations) {
    const fkVal = row[rel.fk];
    const ref = typeof fkVal === "string"
      ? store[rel.refTable]?.find((r) => r.id === fkVal)
      : undefined;
    if (!ref) {
      out[rel.alias] = null;
      continue;
    }
    const subset: Row = {};
    for (const c of rel.refCols) if (c in ref) subset[c] = ref[c];
    out[rel.alias] = subset;
  }
  return out;
}

const PGRST_NONE: ErrorResult["error"] = null;

function errResult(message: string, code = "PGRST116"): Result {
  return { data: null, error: { message, code, details: "", hint: "" } };
}

class MockBuilder {
  private filters: Filter[] = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private selectCols: string | undefined;
  private countExact = false;
  private head = false;
  private singleMode: "none" | "single" | "maybe" = "none";
  private insertPayload: Row | Row[] | null = null;
  private updatePayload: Row | null = null;
  private deleteMode = false;
  private insertSelectCols: string | undefined;
  private afterInsertSelect = false;

  constructor(private table: string) {}

  private eqValue(v: unknown): string {
    if (typeof v === "number") return String(v);
    return String(v);
  }

  eq(column: string, value: unknown): this {
    const s = this.eqValue(value);
    this.filters.push((row) => String(row[column]) === s);
    return this;
  }

  in(column: string, values: (string | number)[]): this {
    const set = new Set(values.map((v) => String(v)));
    this.filters.push((row) => set.has(String(row[column])));
    return this;
  }

  gte(column: string, value: unknown): this {
    const s = String(value);
    this.filters.push((row) => String(row[column]) >= s);
    return this;
  }

  lte(column: string, value: unknown): this {
    const s = String(value);
    this.filters.push((row) => String(row[column]) <= s);
    return this;
  }

  ilike(column: string, pattern: string): this {
    const needle = pattern.replace(/%/g, "").toLowerCase();
    this.filters.push((row) =>
      needle === "" ? true : String(row[column]).toLowerCase().includes(needle)
    );
    return this;
  }

  order(column: string, opts: { ascending?: boolean }): this {
    this.orderCol = column;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }

  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  insert(payload: Row | Row[]): this {
    this.insertPayload = payload;
    return this;
  }

  update(payload: Row): this {
    this.updatePayload = payload;
    return this;
  }

  delete(): this {
    this.deleteMode = true;
    return this;
  }

  single(): this {
    this.singleMode = "single";
    return this;
  }

  maybeSingle(): this {
    this.singleMode = "maybe";
    return this;
  }

  select(columns?: string, opts?: { count?: "exact"; head?: boolean }): this {
    this.selectCols = columns;
    if (this.insertPayload !== null) {
      this.afterInsertSelect = true;
      this.insertSelectCols = columns;
    }
    if (opts?.count === "exact") this.countExact = true;
    if (opts?.head) this.head = true;
    return this;
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: ErrorResult) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    let result: Result;
    try {
      result = this.exec();
    } catch (e) {
      const err = e as Error;
      return Promise.resolve(onrejected?.({ error: { message: err.message, code: "MOCK", details: "", hint: "" } }) as TResult2);
    }
    return Promise.resolve(onfulfilled?.(result) as TResult1);
  }

  private matched(): Row[] {
    return store[this.table].filter((row) => this.filters.every((f) => f(row)));
  }

  private ordered(rows: Row[]): Row[] {
    if (!this.orderCol) return rows;
    const col = this.orderCol;
    const asc = this.orderAsc;
    return [...rows].sort((a, b) => {
      const av = a[col], bv = b[col];
      if (av == null && bv == null) return 0;
      if (av == null) return asc ? -1 : 1;
      if (bv == null) return asc ? 1 : -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return asc ? cmp : -cmp;
    });
  }

  private exec(): Result {
    const t = this.table;
    if (!store[t]) store[t] = [];

    if (this.insertPayload !== null) {
      const payloads = Array.isArray(this.insertPayload) ? this.insertPayload : [this.insertPayload];
      const inserted: Row[] = payloads.map((p) => {
        const row: Row = { ...p };
        if (!row.id) row.id = newId();
        if (!row.created_at) row.created_at = new Date().toISOString();
        if (t === "products" && !row.updated_at) row.updated_at = row.created_at;
        store[t].push(row);
        return row;
      });
      if (this.afterInsertSelect) {
        const mapped = inserted.map((r) => mapSelect(r, this.insertSelectCols));
        if (this.singleMode === "single") return { data: mapped[0] ?? null, error: PGRST_NONE };
        if (this.singleMode === "maybe") return { data: mapped[0] ?? null, error: PGRST_NONE };
        return { data: mapped, error: PGRST_NONE };
      }
      return { data: null, error: PGRST_NONE };
    }

    let rows = this.matched();

    if (this.deleteMode) {
      const ids = new Set(rows.map((r) => (r.id as string) ?? ""));
      store[t] = store[t].filter((r) => !ids.has(r.id as string));
      return { data: null, error: PGRST_NONE };
    }

    if (this.updatePayload !== null) {
      for (const row of rows) Object.assign(row, this.updatePayload);
      if (this.selectCols !== undefined) {
        const mapped = rows.map((r) => mapSelect(r, this.selectCols));
        if (this.singleMode === "single") {
          if (mapped.length === 0) return errResult("0 rows returned");
          return { data: mapped[0], error: PGRST_NONE };
        }
        return { data: mapped, error: PGRST_NONE };
      }
      return { data: null, error: PGRST_NONE };
    }

    // select
    rows = this.ordered(rows);
    if (this.limitN != null) rows = rows.slice(0, this.limitN);

    if (this.head) {
      return { data: null, count: rows.length, error: PGRST_NONE };
    }
    if (this.countExact && this.selectCols === undefined) {
      return { data: null, count: rows.length, error: PGRST_NONE };
    }

    const mapped = rows.map((r) => mapSelect(r, this.selectCols));

    if (this.singleMode === "single") {
      if (mapped.length === 0) return errResult("JSON object requested, multiple (or no) rows returned");
      if (mapped.length > 1) return errResult("JSON object requested, multiple (or no) rows returned");
      return { data: mapped[0], error: PGRST_NONE };
    }
    if (this.singleMode === "maybe") {
      return { data: mapped[0] ?? null, error: PGRST_NONE };
    }

    const result: Result = { data: mapped, error: PGRST_NONE };
    if (this.countExact) result.count = rows.length;
    return result;
  }
}

function from(table: string) {
  return new MockBuilder(table);
}

// ---------------------------------------------------------------------------
// RPC
// ---------------------------------------------------------------------------
function rpc(name: string, params: Row): Result {
  const day = String(params.day ?? params.business_date ?? dateKey());
  const stfId = String(params.p_staff_id ?? "");

  if (name === "get_today_summary") {
    const rows = store.sales.filter((s) => s.sale_date === day);
    return {
      data: {
        total_sale: +rows.reduce((s, r) => s + Number(r.total_sale), 0).toFixed(2),
        total_cost: +rows.reduce((s, r) => s + Number(r.total_cost), 0).toFixed(2),
        total_profit: +rows.reduce((s, r) => s + Number(r.total_profit), 0).toFixed(2),
        products_sold: rows.reduce((s, r) => s + Number(r.item_count), 0),
        transactions: rows.length,
      },
      error: PGRST_NONE,
    };
  }

  if (name === "get_staff_profit_summary") {
    const staffSaleIds = new Set(
      store.sales.filter((s) => s.staff_id === stfId && s.sale_date === day).map((s) => s.id as string)
    );
    const items = store.sale_items.filter((i) => staffSaleIds.has(i.sale_id as string));
    return {
      data: {
        total_cost: +items.reduce((s, i) => s + Number(i.total_cost), 0).toFixed(2),
        total_profit: +items.reduce((s, i) => s + Number(i.total_profit), 0).toFixed(2),
      },
      error: PGRST_NONE,
    };
  }

  return { data: null, error: { message: `RPC "${name}" not mocked`, code: "MOCK", details: "", hint: "" } };
}

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------
function sessionUser(userId: string | null) {
  if (!userId) return { data: { user: null }, error: PGRST_NONE as ErrorResult["error"] };
  const profile = store.users.find((u) => u.id === userId);
  if (!profile) return { data: { user: null }, error: PGRST_NONE as ErrorResult["error"] };
  return {
    data: {
      user: {
        id: profile.id,
        email: profile.email,
        user_metadata: { name: profile.name },
      },
    },
    error: PGRST_NONE as ErrorResult["error"],
  };
}

function readSession(cookieStore?: MockCookieAdapter): string | null {
  if (!cookieStore) return null;
  const cookie = cookieStore.getAll().find((c) => c.name === DEV_SESSION_COOKIE);
  return cookie && cookie.value ? cookie.value : null;
}

// ---------------------------------------------------------------------------
// FACTORY
// ---------------------------------------------------------------------------
export function createMockClient(opts?: { cookieStore?: MockCookieAdapter }) {
  const cookieStore = opts?.cookieStore;

  const auth = {
    async getUser() {
      return sessionUser(readSession(cookieStore));
    },
    async getSession() {
      const userId = readSession(cookieStore);
      if (!userId) return { data: { session: null }, error: PGRST_NONE as ErrorResult["error"] };
      const u = sessionUser(userId).data.user;
      return { data: { session: { user: u, access_token: "dev", expires_at: 0 } }, error: PGRST_NONE as ErrorResult["error"] };
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const user = findUserByEmail(email);
      if (!user || user.status !== "active") {
        return { data: { user: null, session: null }, error: { message: "Invalid login credentials", code: "invalid_credentials", details: "", hint: "" } };
      }
      if (!password || password.length < 6) {
        return { data: { user: null, session: null }, error: { message: "Password is too short", code: "weak_password", details: "", hint: "" } };
      }
      if (cookieStore) {
        cookieStore.setAll([
          { name: DEV_SESSION_COOKIE, value: user.id as string, options: { path: "/", maxAge: 60 * 60 * 24 * 30 } },
        ]);
      }
      return { data: { user: { id: user.id, email: user.email }, session: { user } }, error: PGRST_NONE as ErrorResult["error"] };
    },
    async signUp({ email }: { email: string }) {
      const existing = findUserByEmail(email);
      if (existing) return { data: { user: null, session: null }, error: { message: "User already registered", code: "user_exists", details: "", hint: "" } };
      const id = newId();
      return { data: { user: { id, email } }, error: PGRST_NONE as ErrorResult["error"] };
    },
    async signOut() {
      if (cookieStore) {
        cookieStore.setAll([
          { name: DEV_SESSION_COOKIE, value: "", options: { path: "/", maxAge: 0 } },
        ]);
      }
      return { data: {}, error: PGRST_NONE as ErrorResult["error"] };
    },
    async updateUser() {
      const userId = readSession(cookieStore);
      return sessionUser(userId);
    },
    async resetPasswordForEmail() {
      return { data: {}, error: PGRST_NONE as ErrorResult["error"] };
    },
    async exchangeCodeForSession() {
      return { data: { session: null }, error: PGRST_NONE as ErrorResult["error"] };
    },
    admin: {
      async createUser({ email }: { email: string; user_metadata?: { name?: string } }) {
        const id = newId();
        return { data: { user: { id, email } }, error: null as ErrorResult["error"] };
      },
      async deleteUser(id: string) {
        store.users = store.users.filter((u) => u.id !== id);
        return { data: {}, error: null as ErrorResult["error"] };
      },
      async updateUserById(id: string, opts: { ban_duration?: string }) {
        const user = store.users.find((u) => u.id === id);
        if (user) user.status = opts.ban_duration === "none" ? "active" : "disabled";
        return { data: { user: user ?? null }, error: null as ErrorResult["error"] };
      },
    },
  };

  const storageFrom = (bucket: string) => ({
    async upload(path: string) {
      return { data: { path, Bucket: bucket }, error: null as ErrorResult["error"] };
    },
    getPublicUrl() {
      return { data: { publicUrl: `https://placehold.co/600x400/png?text=%F0%9F%93%A6&font=roboto` }, error: null as ErrorResult["error"] };
    },
    async remove() {
      return { data: {}, error: null as ErrorResult["error"] };
    },
  });

  const channel = () => {
    const handlers: ((payload: unknown) => void)[] = [];
    return {
      on(_type: string, _config: unknown, callback: (payload: unknown) => void) {
        handlers.push(callback);
        return this;
      },
      subscribe() {
        return this;
      },
      unsubscribe() {
        return this;
      },
    };
  };

  return {
    auth,
    from,
    rpc,
    storage: { from: storageFrom },
    channel,
    async removeChannel() {
      return;
    },
  };
}

export const mockIds = { ADMIN_ID, STAFF_ID };