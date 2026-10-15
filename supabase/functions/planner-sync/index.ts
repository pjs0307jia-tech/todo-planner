import { createClient } from 'npm:@supabase/supabase-js@2.95.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const encoder = new TextEncoder()

async function sha256(input: string) {
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(input))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function adminClient() {
  const secretJson = Deno.env.get('SUPABASE_SECRET_KEYS')
  const secret = secretJson ? JSON.parse(secretJson)['default'] : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!secret) throw new Error('Missing Supabase secret key')
  return createClient(Deno.env.get('SUPABASE_URL')!, secret, { auth: { persistSession: false } })
}

function timeMs(value: any) {
  const ms = Date.parse(String(value || ''))
  return Number.isFinite(ms) ? ms : 0
}

function normalizeState(raw: any) {
  const state = raw && typeof raw === 'object' && !Array.isArray(raw) ? structuredClone(raw) : {}
  if (!state.todos || typeof state.todos !== 'object') state.todos = {}
  if (!state.todos.job || typeof state.todos.job !== 'object') state.todos.job = {}
  if (!state.todos.work || typeof state.todos.work !== 'object') state.todos.work = {}
  if (!Array.isArray(state._deletedTodoIds)) state._deletedTodoIds = []
  return state
}

function cleanupEmptyTodoDates(state: any) {
  for (const mode of ['job', 'work']) {
    for (const date of Object.keys(state.todos?.[mode] || {})) {
      const arr = state.todos[mode][date]
      if (!Array.isArray(arr) || arr.length === 0) delete state.todos[mode][date]
    }
  }
}

function applyVaultRow(state: any, row: any) {
  if (!row) return
  const id = String(row.todo_id || row.payload?.id || '')
  if (!id) return
  if (!row.deleted_at && (state._deletedTodoIds || []).map(String).includes(id)) return

  const targetMode = row.mode === 'work' ? 'work' : row.mode === 'job' ? 'job' : null
  const targetDate = String(row.todo_date || '')
  let targetIndex = -1

  for (const mode of ['job', 'work']) {
    const byDate = state.todos?.[mode] || {}
    for (const date of Object.keys(byDate)) {
      const arr = Array.isArray(byDate[date]) ? byDate[date] : []
      const idx = arr.findIndex((x: any) => String(x?.id || '') === id)
      if (idx >= 0 && mode === targetMode && date === targetDate && targetIndex < 0) targetIndex = idx
      const next = arr.filter((x: any) => String(x?.id || '') !== id)
      if (next.length) byDate[date] = next
      else delete byDate[date]
    }
  }

  const deletedIds = new Set((state._deletedTodoIds || []).map(String))
  if (row.deleted_at) {
    deletedIds.add(id)
    state._deletedTodoIds = Array.from(deletedIds).slice(-1000)
    return
  }

  deletedIds.delete(id)
  state._deletedTodoIds = Array.from(deletedIds).slice(-1000)

  const payload = row.payload
  if (!targetMode || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || !payload || typeof payload !== 'object') return
  if (!Array.isArray(state.todos[targetMode][targetDate])) state.todos[targetMode][targetDate] = []
  const arr = state.todos[targetMode][targetDate]
  const insertAt = targetIndex >= 0 ? Math.min(targetIndex, arr.length) : arr.length
  arr.splice(insertAt, 0, payload)
}

function mergeVaultRowsIntoState(rawState: any, rows: any[]) {
  const state = normalizeState(rawState)
  for (const row of rows || []) applyVaultRow(state, row)
  cleanupEmptyTodoDates(state)
  applySavedOrders(state)
  return state
}

function collectTodoItems(state: any) {
  const out: { todo_id: string, mode: string, todo_date: string, payload: any }[] = []
  const todos = state?.todos && typeof state.todos === 'object' ? state.todos : {}
  for (const mode of ['job', 'work']) {
    const byDate = todos?.[mode]
    if (!byDate || typeof byDate !== 'object') continue
    for (const [todoDate, arr] of Object.entries(byDate)) {
      if (!Array.isArray(arr)) continue
      for (const item of arr as any[]) {
        const todoId = String(item?.id || '')
        if (!todoId) continue
        out.push({ todo_id: todoId, mode, todo_date: todoDate, payload: item })
      }
    }
  }
  return out
}

async function hydrateFromVault(supabase: any, ownerHash: string, state: any) {
  const { data, error } = await supabase
    .from('planner_todo_items')
    .select('todo_id,mode,todo_date,payload,deleted_at,server_updated_at')
    .eq('owner_hash', ownerHash)
    .order('server_updated_at', { ascending: true })
  if (error) throw error
  return mergeVaultRowsIntoState(state, data || [])
}

async function mirrorMissingTodosToVault(supabase: any, ownerHash: string, state: any) {
  const incoming = collectTodoItems(state)
  const { data: existing, error: existingError } = await supabase
    .from('planner_todo_items')
    .select('todo_id,deleted_at')
    .eq('owner_hash', ownerHash)
  if (existingError) throw existingError

  const existingMap = new Map((existing || []).map((x: any) => [String(x.todo_id), x]))
  const sourceTs = state?._updatedAt ? new Date(state._updatedAt).toISOString() : new Date().toISOString()
  const rows = incoming
    .filter(item => !existingMap.has(item.todo_id))
    .map(item => ({
      owner_hash: ownerHash,
      todo_id: item.todo_id,
      mode: item.mode,
      todo_date: item.todo_date,
      payload: item.payload,
      source_client_updated_at: sourceTs,
      server_updated_at: new Date().toISOString(),
      deleted_at: null,
    }))
  if (rows.length) {
    const { error } = await supabase.from('planner_todo_items').insert(rows)
    if (error) throw error
  }

  const deletedIds = Array.isArray(state?._deletedTodoIds)
    ? [...new Set(state._deletedTodoIds.map((x: any) => String(x)).filter(Boolean))]
    : []
  if (deletedIds.length) {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('planner_todo_items')
      .update({ deleted_at: now, source_client_updated_at: now, server_updated_at: now })
      .eq('owner_hash', ownerHash)
      .in('todo_id', deletedIds)
    if (error) throw error
  }
}

async function stateHasTombstone(supabase: any, ownerHash: string, todoId: string) {
  const { data, error } = await supabase
    .from('planner_state')
    .select('state')
    .eq('owner_hash', ownerHash)
    .maybeSingle()
  if (error) throw error
  const ids = Array.isArray(data?.state?._deletedTodoIds) ? data.state._deletedTodoIds.map(String) : []
  return ids.includes(todoId)
}

async function persistDeleteTombstone(supabase: any, ownerHash: string, todoId: string, mutationAt: string) {
  const { data: existing, error: existingError } = await supabase
    .from('planner_todo_items')
    .select('source_client_updated_at,deleted_at')
    .eq('owner_hash', ownerHash)
    .eq('todo_id', todoId)
    .maybeSingle()
  if (existingError) throw existingError

  if (existing && timeMs(existing.source_client_updated_at) > timeMs(mutationAt)) {
    return { applied: false, reason: 'stale_delete' }
  }

  const now = new Date().toISOString()
  if (existing) {
    const { error: vaultError } = await supabase
      .from('planner_todo_items')
      .update({ deleted_at: now, source_client_updated_at: mutationAt, server_updated_at: now })
      .eq('owner_hash', ownerHash)
      .eq('todo_id', todoId)
    if (vaultError) throw vaultError
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const { data: current, error } = await supabase.from('planner_state').select('state,updated_at').eq('owner_hash', ownerHash).maybeSingle()
    if (error) throw error
    const next = normalizeState(current?.state || {})
    for (const mode of ['job', 'work']) for (const date of Object.keys(next.todos[mode])) {
      next.todos[mode][date] = (next.todos[mode][date] || []).filter((x: any) => String(x?.id) !== todoId)
    }
    next._deletedTodoIds = [...new Set([...next._deletedTodoIds, todoId])].slice(-1000)
    const updated_at = new Date(Math.max(Date.now(), timeMs(current?.updated_at) + 1)).toISOString()
    const result = current
      ? await supabase.from('planner_state').update({ state: next, updated_at }).eq('owner_hash', ownerHash).eq('updated_at', current.updated_at).select('updated_at')
      : await supabase.from('planner_state').insert({ owner_hash: ownerHash, state: next, updated_at }).select('updated_at')
    if (result.error?.code === '23505') continue
    if (result.error) throw result.error
    if (result.data?.length) return { applied: true }
  }
  throw new Error('Concurrent delete; retry required')
}

// Field-level updates use optimistic concurrency. No schema or permissions change.
function operationKey(op: any) {
  return [op.field, op.mode || '', op.key].join(':')
}
function validOperation(op: any) {
  if (!op || !['moods', 'notes', 'events', 'deadlines', 'workItems', 'todoOrder'].includes(op.field)) return false
  if (typeof op.key !== 'string' || !op.key || op.key.length > 300 || ['__proto__', 'constructor', 'prototype'].includes(op.key)) return false
  if (!timeMs(op.mutation_at)) return false
  if (['moods', 'notes', 'todoOrder'].includes(op.field) && !['job', 'work'].includes(op.mode)) return false
  if (op.value === null) return op.field !== 'todoOrder'
  if (op.field === 'moods') return Number.isInteger(op.value) && op.value >= 0 && op.value <= 5
  if (op.field === 'notes') return typeof op.value === 'string' && op.value.length <= 30000
  if (op.field === 'events' || op.field === 'todoOrder') return Array.isArray(op.value) && op.value.length <= 1000
  return op.value && typeof op.value === 'object' && String(op.value.id) === op.key
}
function applySavedOrders(state: any) {
  for (const mode of ['job', 'work']) {
    for (const [date, ids] of Object.entries(state._todoOrder?.[mode] || {})) {
      if (!Array.isArray(ids) || !Array.isArray(state.todos?.[mode]?.[date])) continue
      const positions = new Map(ids.map((id: any, i: number) => [String(id), i]))
      state.todos[mode][date].sort((a: any, b: any) => (positions.get(String(a.id)) ?? ids.length) - (positions.get(String(b.id)) ?? ids.length))
    }
  }
}
function applyFieldOperation(state: any, op: any) {
  state._fieldUpdatedAt ??= {}
  const key = operationKey(op)
  if (timeMs(state._fieldUpdatedAt[key]) > timeMs(op.mutation_at)) return
  if (op.field === 'moods' || op.field === 'notes') {
    state[op.field] ??= { job: {}, work: {} }
    state[op.field][op.mode] ??= {}
    if (op.value === null) delete state[op.field][op.mode][op.key]
    else state[op.field][op.mode][op.key] = op.value
  } else if (op.field === 'events') {
    state.events ??= {}
    if (op.value === null) delete state.events[op.key]
    else state.events[op.key] = op.value
  } else if (op.field === 'todoOrder') {
    state._todoOrder ??= { job: {}, work: {} }
    state._todoOrder[op.mode] ??= {}
    state._todoOrder[op.mode][op.key] = op.value.map(String)
    applySavedOrders(state)
  } else {
    const list = (Array.isArray(state[op.field]) ? state[op.field] : []).filter((x: any) => String(x?.id) !== op.key)
    if (op.value !== null) list.push(op.value)
    state[op.field] = list
  }
  state._fieldUpdatedAt[key] = op.mutation_at
  if (timeMs(state._updatedAt) < timeMs(op.mutation_at)) state._updatedAt = op.mutation_at
}
function protectPatchedFields(next: any, current: any) {
  // Older cached apps still send full snapshots. Preserve fields acknowledged
  // through the new protocol rather than allowing those snapshots to undo them.
  for (const [key, stamp] of Object.entries(current?._fieldUpdatedAt || {})) {
    const [field, mode, ...rest] = key.split(':'); const id = rest.join(':')
    let value = null
    if (field === 'moods' || field === 'notes') value = current[field]?.[mode]?.[id] ?? null
    else if (field === 'events') value = current.events?.[id] ?? null
    else if (field === 'todoOrder') value = current._todoOrder?.[mode]?.[id] ?? []
    else value = (current[field] || []).find((x: any) => String(x?.id) === id) ?? null
    applyFieldOperation(next, { field, mode, key: id, value, mutation_at: stamp })
  }
}
async function patchFields(supabase: any, ownerHash: string, operations: any[]) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data: current, error } = await supabase.from('planner_state').select('state,updated_at').eq('owner_hash', ownerHash).maybeSingle()
    if (error) throw error
    const state = normalizeState(current?.state || {})
    for (const op of operations) applyFieldOperation(state, op)
    const now = new Date(Math.max(Date.now(), timeMs(current?.updated_at) + 1)).toISOString()
    if (!current) {
      const result = await supabase.from('planner_state').insert({ owner_hash: ownerHash, state, updated_at: now })
      if (result.error?.code === '23505') continue
      if (result.error) throw result.error
      return now
    }
    const result = await supabase.from('planner_state').update({ state, updated_at: now }).eq('owner_hash', ownerHash).eq('updated_at', current.updated_at).select('updated_at')
    if (result.error) throw result.error
    if (result.data?.length) return now
  }
  throw new Error('Concurrent update; retry required')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const code = String(body?.code ?? '').trim()
    const action = body?.action

    if (!/^\d{4,12}$/.test(code)) {
      return Response.json({ error: 'invalid_code' }, { status: 400, headers: corsHeaders })
    }

    const ownerHash = await sha256(code)
    const supabase = adminClient()

    if (action === 'patch') {
      const operations = body.operations
      if (!Array.isArray(operations) || operations.length > 2000 || !operations.every(validOperation) || JSON.stringify(operations).length > 500000) {
        return Response.json({ error: 'invalid_operations' }, { status: 400, headers: corsHeaders })
      }
      const updated_at = await patchFields(supabase, ownerHash, operations)
      return Response.json({ ok: true, updated_at }, { headers: corsHeaders })
    }

    if (action === 'load') {
      const { data, error } = await supabase
        .from('planner_state')
        .select('state,updated_at')
        .eq('owner_hash', ownerHash)
        .maybeSingle()
      if (error) throw error
      const hydrated = await hydrateFromVault(supabase, ownerHash, data?.state ?? {})
      return Response.json({ state: hydrated, updated_at: data?.updated_at ?? null }, { headers: corsHeaders })
    }

    if (action === 'todo_upsert') {
      const mode = body?.mode === 'work' ? 'work' : body?.mode === 'job' ? 'job' : null
      const todoDate = String(body?.date || '')
      const todo = body?.todo
      const todoId = String(todo?.id || '')
      if (!mode || !/^\d{4}-\d{2}-\d{2}$/.test(todoDate) || !todoId || !todo || typeof todo !== 'object') {
        return Response.json({ error: 'invalid_todo' }, { status: 400, headers: corsHeaders })
      }

      const clientTs = body?.client_updated_at ? new Date(body.client_updated_at).toISOString() : new Date().toISOString()
      const { data: existing, error: existingError } = await supabase
        .from('planner_todo_items')
        .select('source_client_updated_at,deleted_at')
        .eq('owner_hash', ownerHash)
        .eq('todo_id', todoId)
        .maybeSingle()
      if (existingError) throw existingError

      if (existing?.deleted_at) {
        return Response.json({ ok: true, ignored: true, reason: 'deleted' }, { headers: corsHeaders })
      }
      if (existing && timeMs(existing.source_client_updated_at) > timeMs(clientTs)) {
        return Response.json({ ok: true, ignored: true, reason: 'stale_update' }, { headers: corsHeaders })
      }
      if (!existing && await stateHasTombstone(supabase, ownerHash, todoId)) {
        return Response.json({ ok: true, ignored: true, reason: 'deleted' }, { headers: corsHeaders })
      }

      const values = {
        owner_hash: ownerHash, todo_id: todoId, mode, todo_date: todoDate,
        payload: { ...todo, _itemUpdatedAt: clientTs }, source_client_updated_at: clientTs,
        server_updated_at: new Date().toISOString(), deleted_at: null,
      }
      let result
      if (existing) result = await supabase.from('planner_todo_items').update(values).eq('owner_hash', ownerHash).eq('todo_id', todoId).is('deleted_at', null).lte('source_client_updated_at', clientTs)
      else {
        result = await supabase.from('planner_todo_items').insert(values)
        if (result.error?.code === '23505') result = await supabase.from('planner_todo_items').update(values).eq('owner_hash', ownerHash).eq('todo_id', todoId).is('deleted_at', null).lte('source_client_updated_at', clientTs)
      }
      const { error } = result
      if (error) throw error
      return Response.json({ ok: true }, { headers: corsHeaders })
    }

    if (action === 'todo_delete') {
      const todoId = String(body?.todo_id || '')
      if (!todoId) return Response.json({ error: 'invalid_todo_id' }, { status: 400, headers: corsHeaders })
      const mutationAt = body?.client_updated_at ? new Date(body.client_updated_at).toISOString() : new Date().toISOString()
      const result = await persistDeleteTombstone(supabase, ownerHash, todoId, mutationAt)
      return Response.json({ ok: true, ...result }, { headers: corsHeaders })
    }

    if (action === 'save') {
      const state = body?.state
      if (!state || typeof state !== 'object' || Array.isArray(state)) {
        return Response.json({ error: 'invalid_state' }, { status: 400, headers: corsHeaders })
      }
      const payload = JSON.stringify(state)
      if (payload.length > 500000) {
        return Response.json({ error: 'state_too_large' }, { status: 413, headers: corsHeaders })
      }

      await mirrorMissingTodosToVault(supabase, ownerHash, state)

      const { data: current, error: currentError } = await supabase
        .from('planner_state')
        .select('state,updated_at')
        .eq('owner_hash', ownerHash)
        .maybeSingle()
      if (currentError) throw currentError
      protectPatchedFields(state, current?.state)
      if (!state.todos && current?.state?.todos) state.todos = current.state.todos

      if (current?.state && JSON.stringify(current.state) !== payload) {
        const { error: historyError } = await supabase
          .from('planner_state_history')
          .insert({ owner_hash: ownerHash, state: current.state, created_at: new Date().toISOString() })
        if (historyError) throw historyError
      }

      const now = new Date(Math.max(Date.now(), timeMs(current?.updated_at) + 1)).toISOString()
      const result = current
        ? await supabase.from('planner_state').update({ state, updated_at: now }).eq('owner_hash', ownerHash).eq('updated_at', current.updated_at).select('updated_at')
        : await supabase.from('planner_state').insert({ owner_hash: ownerHash, state, updated_at: now }).select('updated_at')
      if (result.error) throw result.error
      if (!result.data?.length) return Response.json({ error: 'save_conflict' }, { status: 409, headers: corsHeaders })

      const { data: stale, error: staleError } = await supabase
        .from('planner_state_history')
        .select('id')
        .eq('owner_hash', ownerHash)
        .order('created_at', { ascending: false })
        .range(20, 199)
      if (staleError) throw staleError
      if (stale?.length) {
        const { error: deleteError } = await supabase
          .from('planner_state_history')
          .delete()
          .in('id', stale.map((x: any) => x.id))
        if (deleteError) throw deleteError
      }

      return Response.json({ ok: true, updated_at: now }, { headers: corsHeaders })
    }

    return Response.json({ error: 'invalid_action' }, { status: 400, headers: corsHeaders })
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'server_error' }, { status: 500, headers: corsHeaders })
  }
})

