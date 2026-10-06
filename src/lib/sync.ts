import { supabase } from './supabase'
import {
  getPendingOutbox, recoverStuckSyncingEntries, updateOutboxEntry, removeOutboxEntry,
  putTask, removeTask, putComment, removeComment, putConflict,
} from './idb'
import type { OutboxEntry, ConflictEntry } from './idb'

export type SyncStatus = 'idle' | 'online' | 'offline' | 'syncing' | 'error' | 'conflict'

type SyncListener = (status: SyncStatus, pendingCount: number) => void

class SyncManager {
  private listeners: SyncListener[] = []
  private _status: SyncStatus = 'idle'
  private _pending = 0
  private _running = false

  subscribe(fn: SyncListener): () => void {
    this.listeners.push(fn)
    return () => { this.listeners = this.listeners.filter(l => l !== fn) }
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this._status, this._pending)
  }

  setOffline(): void {
    this._status = 'offline'
    this.emit()
  }

  async sync(): Promise<void> {
    if (this._running) return
    this._running = true
    this._status = 'syncing'
    this.emit()

    try {
      // Recover any entries stuck in 'syncing' from a previous crash before processing.
      await recoverStuckSyncingEntries()
      const entries = await getPendingOutbox()
      this._pending = entries.length

      if (entries.length === 0) {
        this._status = navigator.onLine ? 'online' : 'offline'
        this.emit()
        return
      }

      for (const entry of entries) {
        await this.processEntry(entry)
      }

      const remaining = await getPendingOutbox()
      this._pending = remaining.length

      const hasConflicts = remaining.some(e => e.status === 'failed' && e.lastError?.startsWith('Conflict'))
      if (hasConflicts) {
        this._status = 'conflict'
      } else if (remaining.length > 0) {
        this._status = 'error'
      } else {
        this._status = navigator.onLine ? 'online' : 'offline'
      }
    } catch {
      this._status = 'error'
    } finally {
      this._running = false
      this.emit()
    }
  }

  private async processEntry(entry: OutboxEntry): Promise<void> {
    await updateOutboxEntry({ ...entry, status: 'syncing' })

    try {
      if (entry.entityType === 'task') {
        await this.syncTask(entry)
      } else {
        await this.syncComment(entry)
      }
      await removeOutboxEntry(entry.id)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      // Don't retry auth/permission errors
      if (msg.includes('401') || msg.includes('403') || msg.includes('RLS')) {
        await updateOutboxEntry({ ...entry, status: 'failed', lastError: msg })
        return
      }
      const attempts = entry.attemptCount + 1
      const delayMs = Math.min(30_000 * Math.pow(2, attempts - 1), 600_000)
      const jitter = Math.random() * 5_000
      await updateOutboxEntry({
        ...entry,
        status: 'pending',
        attemptCount: attempts,
        nextAttemptAt: new Date(Date.now() + delayMs + jitter).toISOString(),
        lastError: msg,
      })
    }
  }

  private async syncTask(entry: OutboxEntry): Promise<void> {
    const { operationType, recordId, payload, baseVersion } = entry

    if (operationType === 'create') {
      const { data, error } = await supabase
        .from('tasks')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert({ ...(payload as Record<string, unknown>), id: recordId } as any)
        .select()
        .single()
      if (error) {
        if (error.code === '23505') return // already exists — idempotent
        throw new Error(error.message)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (data) await putTask(data as any)
      return
    }

    if (operationType === 'delete') {
      const { error } = await supabase.from('tasks').delete().eq('id', recordId)
      if (error && error.code !== 'PGRST116') throw new Error(error.message)
      await removeTask(recordId)
      return
    }

    // update
    const { data: remote, error: fetchErr } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', recordId)
      .single()

    if (fetchErr) throw new Error(fetchErr.message)
    if (!remote) { await removeTask(recordId); return }

    const remoteVersion = (remote as Record<string, unknown>)['version'] as number | undefined

    if (baseVersion !== null && remoteVersion !== undefined && remoteVersion > baseVersion) {
      // Remote changed — attempt three-way merge
      await this.handleTaskConflict(entry, remote as Record<string, unknown>)
      return
    }

    const { data: updated, error: updateErr } = await supabase
      .from('tasks')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(payload as any)
      .eq('id', recordId)
      .select()
      .single()

    if (updateErr) throw new Error(updateErr.message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (updated) await putTask(updated as any)
  }

  private async syncComment(entry: OutboxEntry): Promise<void> {
    const { operationType, recordId, payload, baseVersion } = entry

    if (operationType === 'create') {
      const { data, error } = await supabase
        .from('task_comments')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert({ ...(payload as Record<string, unknown>), id: recordId } as any)
        .select()
        .single()
      if (error) {
        if (error.code === '23505') return
        throw new Error(error.message)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (data) await putComment(data as any)
      return
    }

    if (operationType === 'delete') {
      const { error } = await supabase.from('task_comments').delete().eq('id', recordId)
      if (error && error.code !== 'PGRST116') throw new Error(error.message)
      await removeComment(recordId)
      return
    }

    // update
    const { data: remote, error: fetchErr } = await supabase
      .from('task_comments')
      .select('*')
      .eq('id', recordId)
      .single()

    if (fetchErr) throw new Error(fetchErr.message)
    if (!remote) { await removeComment(recordId); return }

    const remoteVersion = (remote as Record<string, unknown>)['version'] as number | undefined

    if (baseVersion !== null && remoteVersion !== undefined && remoteVersion > baseVersion) {
      await this.handleCommentConflict(entry, remote as Record<string, unknown>)
      return
    }

    const { data: updated, error: updateErr } = await supabase
      .from('task_comments')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(payload as any)
      .eq('id', recordId)
      .select()
      .single()

    if (updateErr) throw new Error(updateErr.message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (updated) await putComment(updated as any)
  }

  private async handleTaskConflict(
    entry: OutboxEntry,
    remote: Record<string, unknown>,
  ): Promise<void> {
    const base = entry.baseSnapshot as Record<string, unknown> | null
    const local = entry.payload as Record<string, unknown>
    const merged: Record<string, unknown> = { ...remote }
    let hasConflict = false

    for (const [key, localVal] of Object.entries(local)) {
      const baseVal = base?.[key]
      const remoteVal = remote[key]
      if (remoteVal !== baseVal && String(localVal) !== String(remoteVal)) {
        hasConflict = true
      } else if (remoteVal === baseVal) {
        merged[key] = localVal
      }
    }

    if (!hasConflict) {
      const { data, error } = await supabase
        .from('tasks')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(merged as any)
        .eq('id', entry.recordId)
        .select()
        .single()
      if (error) throw new Error(error.message)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (data) await putTask(data as any)
      return
    }

    const conflict: ConflictEntry = {
      id: crypto.randomUUID(),
      outboxId: entry.id,
      entityType: 'task',
      recordId: entry.recordId,
      localSnapshot: local,
      remoteSnapshot: remote,
      createdAt: new Date().toISOString(),
      resolved: false,
    }
    await putConflict(conflict)
    await updateOutboxEntry({
      ...entry,
      status: 'failed',
      lastError: 'Conflict: same field changed by another user',
    })
    this._status = 'conflict'
  }

  private async handleCommentConflict(
    entry: OutboxEntry,
    remote: Record<string, unknown>,
  ): Promise<void> {
    const conflict: ConflictEntry = {
      id: crypto.randomUUID(),
      outboxId: entry.id,
      entityType: 'comment',
      recordId: entry.recordId,
      localSnapshot: entry.payload as Record<string, unknown>,
      remoteSnapshot: remote,
      createdAt: new Date().toISOString(),
      resolved: false,
    }
    await putConflict(conflict)
    await updateOutboxEntry({
      ...entry,
      status: 'failed',
      lastError: 'Conflict: comment edited by another user',
    })
    this._status = 'conflict'
  }

  async refreshPendingCount(): Promise<void> {
    const entries = await getPendingOutbox()
    this._pending = entries.length
    this.emit()
  }
}

export const syncManager = new SyncManager()

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void syncManager.sync() })
  window.addEventListener('offline', () => { syncManager.setOffline() })
}
