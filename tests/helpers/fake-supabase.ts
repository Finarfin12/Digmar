/**
 * Supabase client palsu (in-memory) untuk unit test. Mendukung subset query builder yang dipakai
 * route & lib: select/insert/update/upsert/delete + eq/neq/in/is/lt/lte/gte/order/limit/single/maybeSingle,
 * filter relasi `business_units.user_id`, dan embed `business_units(...)` lewat business_unit_id.
 */
type Row = Record<string, unknown>
type Filter = (row: Row) => boolean

let idCounter = 0
const nextId = () => `id-${++idCounter}`

export class FakeDb {
  tables: Record<string, Row[]> = {}

  constructor(initial: Record<string, Row[]> = {}) {
    for (const [name, rows] of Object.entries(initial)) this.tables[name] = rows.map(r => ({ ...r }))
  }

  table(name: string) {
    if (!this.tables[name]) this.tables[name] = []
    return this.tables[name]
  }

  resolve(row: Row, path: string): unknown {
    if (!path.includes('.')) return row[path]
    const [relation, field] = path.split('.')
    if (relation === 'business_units') {
      const unit = this.table('business_units').find(u => u.id === row.business_unit_id)
      return unit?.[field]
    }
    return undefined
  }
}

type Op = 'select' | 'insert' | 'update' | 'upsert' | 'delete'

class FakeQuery implements PromiseLike<{ data: unknown; error: unknown; count?: number | null }> {
  private op: Op = 'select'
  private payload: Row | Row[] | null = null
  private filters: Filter[] = []
  private selectCols: string | null = null
  private returnRows = false
  private mode: 'many' | 'single' | 'maybeSingle' = 'many'
  private limitN: number | null = null
  private orderBy: { col: string; ascending: boolean } | null = null
  private countMode = false
  private headOnly = false

  constructor(private db: FakeDb, private tableName: string) {}

  select(cols = '*', opts?: { count?: string; head?: boolean }) {
    if (this.op === 'select') this.selectCols = cols
    else this.returnRows = true
    if (opts?.count) this.countMode = true
    if (opts?.head) this.headOnly = true
    this.selectCols = cols
    return this
  }
  insert(rows: Row | Row[]) { this.op = 'insert'; this.payload = rows; return this }
  upsert(rows: Row | Row[]) { this.op = 'upsert'; this.payload = rows; return this }
  update(values: Row) { this.op = 'update'; this.payload = values; return this }
  delete() { this.op = 'delete'; return this }

  eq(col: string, v: unknown) { this.filters.push(r => this.db.resolve(r, col) === v); return this }
  neq(col: string, v: unknown) { this.filters.push(r => this.db.resolve(r, col) !== v); return this }
  in(col: string, vs: unknown[]) { this.filters.push(r => vs.includes(this.db.resolve(r, col))); return this }
  is(col: string, v: unknown) { this.filters.push(r => (this.db.resolve(r, col) ?? null) === v); return this }
  lt(col: string, v: string | number) { this.filters.push(r => (this.db.resolve(r, col) as string | number) < v); return this }
  lte(col: string, v: string | number) { this.filters.push(r => (this.db.resolve(r, col) as string | number) <= v); return this }
  gte(col: string, v: string | number) { this.filters.push(r => (this.db.resolve(r, col) as string | number) >= v); return this }
  order(col: string, opts?: { ascending?: boolean }) { this.orderBy = { col, ascending: opts?.ascending !== false }; return this }
  limit(n: number) { this.limitN = n; return this }
  single() { this.mode = 'single'; return this }
  maybeSingle() { this.mode = 'maybeSingle'; return this }

  private embed(row: Row): Row {
    if (this.selectCols?.includes('business_units') && row.business_unit_id !== undefined) {
      const unit = this.db.table('business_units').find(u => u.id === row.business_unit_id) || null
      return { ...row, business_units: unit }
    }
    return { ...row }
  }

  private execute() {
    const rows = this.db.table(this.tableName)
    let result: Row[] = []

    if (this.op === 'insert' || this.op === 'upsert') {
      const incoming = Array.isArray(this.payload) ? this.payload : [this.payload as Row]
      result = incoming.map(r => {
        const row = { id: nextId(), ...r }
        rows.push(row)
        return row
      })
    } else {
      const matched = rows.filter(r => this.filters.every(f => f(r)))
      if (this.op === 'update') {
        matched.forEach(r => Object.assign(r, this.payload))
        result = matched
      } else if (this.op === 'delete') {
        this.db.tables[this.tableName] = rows.filter(r => !matched.includes(r))
        result = matched
      } else {
        result = matched
      }
    }

    if (this.orderBy) {
      const { col, ascending } = this.orderBy
      result = [...result].sort((a, b) => {
        const av = a[col] as string | number, bv = b[col] as string | number
        return (av < bv ? -1 : av > bv ? 1 : 0) * (ascending ? 1 : -1)
      })
    }
    if (this.limitN !== null) result = result.slice(0, this.limitN)

    const count = this.countMode ? result.length : null
    const wantsRows = this.op === 'select' || this.returnRows
    const data = result.map(r => this.embed(r))

    if (this.headOnly) return { data: null, error: null, count }
    if (this.mode === 'single') {
      return data.length === 1
        ? { data: data[0], error: null }
        : { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } }
    }
    if (this.mode === 'maybeSingle') return { data: data[0] ?? null, error: null }
    return { data: wantsRows ? data : null, error: null, count }
  }

  then<T1 = { data: unknown; error: unknown }, T2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown; count?: number | null }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected)
  }
}

export function createFakeSupabase(db: FakeDb, user: { id: string; email?: string } | null = null) {
  return {
    from: (table: string) => new FakeQuery(db, table),
    auth: {
      getUser: async () => ({ data: { user }, error: user ? null : { message: 'not logged in' } }),
    },
  }
}
