import { openDB, type IDBPDatabase } from 'idb'
import type { Task, TaskComment } from './types'

const DB_NAME = 'projectflow'
const DB_VERSION = 1

export interface OutboxEntry {
  id: string
  userId: string
  workspaceId: string
  entityType: 'task' | 'comment'
  recordId: string
  operationType: 'create' | 'update' | 'delete'
  payload: Partial<Task & { version?: number }> | Partial<TaskComment & { version?: number }>
  baseSnapshot: Partial<Task & { version?: number }> | Partial<TaskComment & { version?: number }> | null
  baseVersion: number | null
  createdAt: string
  attemptCount: number
  nextAttemptAt: string
  status: 'pending' | 'syncing' | 'failed' | 'done'
  lastError: string | null
}

export interface ConflictEntry {
  id: string
  outboxId: string
  entityType: 'task' | 'comment'
  recordId: string
  localSnapshot: Record<string, unknown>
  remoteSnapshot: Record<string, unknown>
  createdAt: string
  resolved: boolean
}

export interface SyncMeta {
  key: string
  lastSyncedAt: string
}

type CachedTask = Task & { version?: number }
type CachedComment = TaskComment & { version?: number }

interface PFDatabase {
  tasks: { key: string; value: CachedTask; indexes: { 'by-project': string } }
  comments: { key: string; value: CachedComment; indexes: { 'by-task': string } }
  outbox: { key: string; value: OutboxEntry; indexes: { 'by-status': string } }
  conflicts: { key: string; value: ConflictEntry }
  sync_meta: { key: string; value: SyncMeta }
}

let _db: IDBPDatabase<PFDatabase> | null = null

export async function getDB(): Promise<IDBPDatabase<PFDatabase>> {
  if (_db) return _db
  _db = await openDB<PFDatabase>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const taskStore = db.createObjectStore('tasks', { keyPath: 'id' })
      taskStore.createIndex('by-project', 'project_id')

      const commentStore = db.createObjectStore('comments', { keyPath: 'id' })
      commentStore.createIndex('by-task', 'task_id')

      const outboxStore = db.createObjectStore('outbox', { keyPath: 'id' })
      outboxStore.createIndex('by-status', 'status')

      db.createObjectStore('conflicts', { keyPath: 'id' })
      db.createObjectStore('sync_meta', { keyPath: 'key' })
    },
  })
  return _db
}

export async function clearUserData(): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['tasks', 'comments', 'outbox', 'conflicts', 'sync_meta'], 'readwrite')
  await Promise.all([
    tx.objectStore('tasks').clear(),
    tx.objectStore('comments').clear(),
    tx.objectStore('outbox').clear(),
    tx.objectStore('conflicts').clear(),
    tx.objectStore('sync_meta').clear(),
  ])
  await tx.done
}

export async function getCachedTasks(projectId: string): Promise<CachedTask[]> {
  const db = await getDB()
  return db.getAllFromIndex('tasks', 'by-project', projectId)
}

export async function putTask(task: CachedTask): Promise<void> {
  const db = await getDB()
  await db.put('tasks', task)
}

export async function putTasks(tasks: CachedTask[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('tasks', 'readwrite')
  await Promise.all(tasks.map(t => tx.store.put(t)))
  await tx.done
}

export async function removeTask(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('tasks', id)
}

export async function getCachedComments(taskId: string): Promise<CachedComment[]> {
  const db = await getDB()
  return db.getAllFromIndex('comments', 'by-task', taskId)
}

export async function putComment(c: CachedComment): Promise<void> {
  const db = await getDB()
  await db.put('comments', c)
}

export async function putComments(cs: CachedComment[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('comments', 'readwrite')
  await Promise.all(cs.map(c => tx.store.put(c)))
  await tx.done
}

export async function removeComment(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('comments', id)
}

export async function queueOutboxEntry(entry: OutboxEntry): Promise<void> {
  const db = await getDB()
  await db.put('outbox', entry)
}

export async function getPendingOutbox(): Promise<OutboxEntry[]> {
  const db = await getDB()
  return db.getAllFromIndex('outbox', 'by-status', 'pending')
}

export async function updateOutboxEntry(entry: OutboxEntry): Promise<void> {
  const db = await getDB()
  await db.put('outbox', entry)
}

export async function removeOutboxEntry(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('outbox', id)
}

export async function getOpenConflicts(): Promise<ConflictEntry[]> {
  const db = await getDB()
  const all = await db.getAll('conflicts')
  return all.filter(c => !c.resolved)
}

export async function putConflict(c: ConflictEntry): Promise<void> {
  const db = await getDB()
  await db.put('conflicts', c)
}

export async function resolveConflict(id: string): Promise<void> {
  const db = await getDB()
  const c = await db.get('conflicts', id)
  if (c) await db.put('conflicts', { ...c, resolved: true })
}
