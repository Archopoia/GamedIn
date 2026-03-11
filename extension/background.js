/**
 * GamedIn extension background script.
 * Receives apply events from LinkedIn content script and stores them for the game to consume.
 */

const LOG = (...args) => console.log('[GamedIn Background]', ...args)

const STORAGE_KEY = 'gamedin.pendingLogs'

LOG('Background script loaded')

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  LOG('onMessage received', { type: message?.type, sender: sender?.tab?.url || sender?.url })
  if (message.type === 'GAMEDIN_APPLY_DETECTED') {
    const { title, company, source } = message.payload
    LOG('GAMEDIN_APPLY_DETECTED: fetching current pending')
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const pending = result[STORAGE_KEY] || []
      const entry = { title, company, source: source || 'linkedin', timestamp: Date.now() }
      pending.push(entry)
      LOG('GAMEDIN_APPLY_DETECTED: storing', { pendingCount: pending.length, entry })
      chrome.storage.local.set({ [STORAGE_KEY]: pending }, () => {
        LOG('GAMEDIN_APPLY_DETECTED: stored successfully')
        sendResponse({ ok: true })
      })
    })
    return true
  }
})
