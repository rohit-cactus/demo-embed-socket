// File-based persistence layer
import fs from 'fs/promises'
import path from 'path'
import type { PersistenceData, AnnotationTransferItem, CommentThread } from './types'

const DATA_FILE = path.join(process.cwd(), 'data', 'persistence.json')
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups')

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
    await fs.mkdir(BACKUP_DIR, { recursive: true })
  } catch (error) {
    // Directory already exists
  }
}

// Load persistence data from file
export async function loadPersistence(): Promise<PersistenceData> {
  await ensureDataDir()

  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    // File doesn't exist or is invalid, return empty state
    return { documents: {} }
  }
}

// Save persistence data to file
export async function savePersistence(data: PersistenceData): Promise<void> {
  await ensureDataDir()

  // Create backup before saving (keep last 5 backups)
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFile = path.join(BACKUP_DIR, `persistence-${timestamp}.json`)

    // Try to read existing file to backup
    try {
      const existing = await fs.readFile(DATA_FILE, 'utf-8')
      await fs.writeFile(backupFile, existing)

      // Clean up old backups (keep only last 5)
      const backups = await fs.readdir(BACKUP_DIR)
      const sortedBackups = backups
        .filter(f => f.startsWith('persistence-'))
        .sort()
        .reverse()

      // Delete old backups beyond the last 5
      for (let i = 5; i < sortedBackups.length; i++) {
        await fs.unlink(path.join(BACKUP_DIR, sortedBackups[i]))
      }
    } catch (error) {
      // No existing file to backup
    }
  } catch (error) {
    console.error('Failed to create backup:', error)
  }

  // Save current state
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

// All mutations below do read-modify-write against the same JSON file with no
// file locking. Without serialization, concurrent calls (e.g. a burst of
// annotation events) race: each reads the same pre-mutation snapshot, and
// whichever write lands last silently overwrites the others' changes. Chaining
// every mutation through this queue forces them to run one at a time.
let mutationQueue: Promise<unknown> = Promise.resolve()
function enqueueMutation<T>(task: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(task, task)
  mutationQueue = result.then(() => undefined, () => undefined)
  return result
}

// Get annotations and threads for a specific document
export async function getDocumentData(documentId: string): Promise<{
  annotations: AnnotationTransferItem[]
  threads: CommentThread[]
}> {
  const data = await loadPersistence()
  const doc = data.documents[documentId]

  return {
    annotations: doc?.annotations || [],
    threads: doc?.threads || []
  }
}

// Update annotations for a document
export async function updateAnnotations(
  documentId: string,
  annotations: AnnotationTransferItem[]
): Promise<void> {
  return enqueueMutation(async () => {
    const data = await loadPersistence()

    if (!data.documents[documentId]) {
      data.documents[documentId] = {
        annotations: [],
        threads: [],
        lastModified: Date.now()
      }
    }

    data.documents[documentId].annotations = annotations
    data.documents[documentId].lastModified = Date.now()

    await savePersistence(data)
  })
}

// Update threads for a document
export async function updateThreads(
  documentId: string,
  threads: CommentThread[]
): Promise<void> {
  return enqueueMutation(async () => {
    const data = await loadPersistence()

    if (!data.documents[documentId]) {
      data.documents[documentId] = {
        annotations: [],
        threads: [],
        lastModified: Date.now()
      }
    }

    data.documents[documentId].threads = threads
    data.documents[documentId].lastModified = Date.now()

    await savePersistence(data)
  })
}

// Merge new annotation into existing annotations
export async function addAnnotation(
  documentId: string,
  annotation: AnnotationTransferItem
): Promise<void> {
  return enqueueMutation(async () => {
    const data = await loadPersistence()

    if (!data.documents[documentId]) {
      data.documents[documentId] = {
        annotations: [],
        threads: [],
        lastModified: Date.now()
      }
    }

    const existingIdx = data.documents[documentId].annotations.findIndex(
      item => item.annotation.id === annotation.annotation.id
    )
    if (existingIdx !== -1) {
      data.documents[documentId].annotations[existingIdx] = annotation
    } else {
      data.documents[documentId].annotations.push(annotation)
    }
    data.documents[documentId].lastModified = Date.now()

    await savePersistence(data)
  })
}

// Update a specific annotation
export async function updateAnnotation(
  documentId: string,
  annotationId: string,
  updates: Partial<AnnotationTransferItem['annotation']>
): Promise<void> {
  return enqueueMutation(async () => {
    const data = await loadPersistence()

    if (!data.documents[documentId]) return

    const idx = data.documents[documentId].annotations.findIndex(
      item => item.annotation.id === annotationId
    )

    if (idx !== -1) {
      data.documents[documentId].annotations[idx].annotation = {
        ...data.documents[documentId].annotations[idx].annotation,
        ...updates,
        modified: Date.now()
      }
      data.documents[documentId].lastModified = Date.now()
      await savePersistence(data)
    }
  })
}

// Delete a specific annotation
export async function deleteAnnotation(
  documentId: string,
  annotationId: string
): Promise<void> {
  return enqueueMutation(async () => {
    const data = await loadPersistence()

    if (!data.documents[documentId]) return

    data.documents[documentId].annotations = data.documents[documentId].annotations.filter(
      item => item.annotation.id !== annotationId
    )
    data.documents[documentId].lastModified = Date.now()

    await savePersistence(data)
  })
}

// Add a new thread
export async function addThread(
  documentId: string,
  thread: CommentThread
): Promise<void> {
  return enqueueMutation(async () => {
    const data = await loadPersistence()

    if (!data.documents[documentId]) {
      data.documents[documentId] = {
        annotations: [],
        threads: [],
        lastModified: Date.now()
      }
    }

    data.documents[documentId].threads.push(thread)
    data.documents[documentId].lastModified = Date.now()

    await savePersistence(data)
  })
}

// Add a reply to a thread
export async function addReply(
  documentId: string,
  threadId: string,
  message: CommentThread['messages'][0]
): Promise<void> {
  return enqueueMutation(async () => {
    const data = await loadPersistence()

    if (!data.documents[documentId]) return

    const idx = data.documents[documentId].threads.findIndex(t => t.id === threadId)

    if (idx !== -1) {
      data.documents[documentId].threads[idx].messages.push(message)
      data.documents[documentId].lastModified = Date.now()
      await savePersistence(data)
    }
  })
}
