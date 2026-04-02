/**
 * Local Backup Service using File System Access API
 * Mirrors StudyMate data to a physical folder on the user's computer.
 */

const BACKUP_DB_NAME = 'studymate_backup_db';
const BACKUP_STORE_NAME = 'handles';

// ── IndexedDB Helpers ────────────────────────────────────────────────────────
async function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BACKUP_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(BACKUP_STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveHandle(handle) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE_NAME, 'readwrite');
    tx.objectStore(BACKUP_STORE_NAME).put(handle, 'backup_root');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getHandle() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE_NAME, 'readonly');
    const request = tx.objectStore(BACKUP_STORE_NAME).get('backup_root');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function requestFolderAccess() {
  try {
    if (!window.showDirectoryPicker) {
      throw new Error('Your browser does not support the File System Access API.');
    }
    const handle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents'
    });
    await saveHandle(handle);
    return handle;
  } catch (e) {
    console.error('Folder access error:', e);
    return null;
  }
}

export async function verifyPermission(handle, withPrompt = false) {
  if (!handle) return false;
  const options = { mode: 'readwrite' };
  if ((await handle.queryPermission(options)) === 'granted') return true;
  if (withPrompt && (await handle.requestPermission(options)) === 'granted') return true;
  return false;
}

export async function getExistingHandle() {
    try { return await getHandle(); } catch(e) { return null; }
}

export async function syncToFolder(storeData) {
  const handle = await getExistingHandle();
  if (!handle) return;
  
  const isReady = await verifyPermission(handle);
  if (!isReady) return; // Silent skip if no permission currently

  try {
    const { notes = [], tasks = [], timerSessions = [] } = storeData;

    // 1. Write Notes
    const notesDir = await handle.getDirectoryHandle('notes', { create: true });
    for (const note of notes) {
      const fileName = `${(note.title || 'Untitled').replace(/[/\\?%*:|"<>]/g, '-')}_${note.id}.md`;
      const fileHandle = await notesDir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      
      const mdContent = `# ${note.title || 'Untitled'}\n\n${note.content || ''}\n\n---\nLast Updated: ${note.updated_at || new Date().toISOString()}`;
      await writable.write(mdContent);
      await writable.close();
    }

    // 2. Write Tasks
    const tasksFile = await handle.getFileHandle('tasks_backup.json', { create: true });
    const tasksWritable = await tasksFile.createWritable();
    await tasksWritable.write(JSON.stringify(tasks, null, 2));
    await tasksWritable.close();

    // 3. Write Sessions
    const sessFile = await handle.getFileHandle('sessions_backup.json', { create: true });
    const sessWritable = await sessFile.createWritable();
    await sessWritable.write(JSON.stringify(timerSessions, null, 2));
    await sessWritable.close();

  } catch (e) {
    console.warn('[StudyMate] Local backup failed:', e);
  }
}
