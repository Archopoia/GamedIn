/**
 * GamedIn extension background script.
 * Receives apply events and activity from LinkedIn content script; stores for game.
 */

const STORAGE_KEY = 'gamedin.pendingLogs'
const ACTIVITY_KEY = 'gamedin.activity'
const PAGE_STATE_KEY = 'gamedin.pageState'
const ACTIVITY_MAX = 200
function pushActivity(entry) {
  chrome.storage.local.get(ACTIVITY_KEY, (result) => {
    const activity = result[ACTIVITY_KEY] || []
    activity.push(entry)
    chrome.storage.local.set({ [ACTIVITY_KEY]: activity.slice(-ACTIVITY_MAX) })
  })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GAMEDIN_APPLY_DETECTED') {
    const { title, company, source } = message.payload
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const pending = result[STORAGE_KEY] || []
      const entry = { title, company, source: source || 'linkedin', timestamp: Date.now() }
      pending.push(entry)
      chrome.storage.local.set({ [STORAGE_KEY]: pending }, () => {
        sendResponse({ ok: true })
      })
    })
    return true
  }
  if (message.type === 'GAMEDIN_ACTIVITY') {
    const payload = message.payload || {}
    pushActivity({ type: payload.event, ...payload })
    return false
  }
  if (message.type === 'GAMEDIN_PAGE_STATE') {
    const payload = message.payload || {}
    chrome.storage.local.set({ [PAGE_STATE_KEY]: { ...payload, receivedAt: Date.now() } })
    return false
  }
})
