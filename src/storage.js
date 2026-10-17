const database = () => new Promise((resolve, reject) => {
  const request = indexedDB.open('still-studies', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('studies', { keyPath: 'id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
export async function studyStore(action, value) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('studies', action === 'list' ? 'readonly' : 'readwrite');
      const store = transaction.objectStore('studies');
      const request = action === 'list' ? store.getAll() : action === 'save' ? store.put(value) : store.delete(value);
      let result;
      request.onsuccess = () => { result = request.result; };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Storage transaction was interrupted.'));
    });
  } finally { db.close(); }
}
