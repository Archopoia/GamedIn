/**
 * GamedIn content script for the game page.
 * Reads pending logs from extension storage and dispatches CustomEvents for the game to consume.
 * Uses polling instead of storage.onChanged to avoid "Extension context invalidated" errors
 * when the extension is reloaded while the page is open.
 */

const LOG = (...args) => console.log('[GamedIn Game]', ...args)

const STORAGE_KEY = 'gamedin.pendingLogs'
const ACTIVITY_KEY = 'gamedin.activity'
const EVENT_NAME = 'gamedin-apply-logged'
const READY_EVENT = 'gamedin-extension-ready'
const GET_ACTIVITY_EVENT = 'gamedin-get-activity'
const ACTIVITY_EVENT = 'gamedin-activity'
const POLL_INTERVAL_MS = 2000

LOG('Content script loaded', { url: window.location.href })

function fetchActivity() {
  try {
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) return
    chrome.storage.local.get(ACTIVITY_KEY, (result) => {
      const activity = result?.[ACTIVITY_KEY] || []
      window.dispatchEvent(new CustomEvent(ACTIVITY_EVENT, { detail: { activity } }))
    })
  } catch (_) {}
}

function dispatchLogs(logs) {
  LOG('dispatchLogs', { count: logs.length, logs })
  for (const log of logs) {
    const detail = {
      title: log.title || 'Unknown Role',
      company: log.company || 'Unknown Company',
      source: log.source || 'linkedin',
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }))
    LOG('dispatchLogs: dispatched', detail)
  }
}

function processPending() {
  try {
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
      LOG('processPending: chrome.storage not available')
      return
    }
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      try {
        const pending = result?.[STORAGE_KEY] || []
        if (pending.length > 0) {
          LOG('processPending: found pending', { count: pending.length })
          dispatchLogs(pending)
          chrome.storage.local.set({ [STORAGE_KEY]: [] })
          LOG('processPending: cleared storage')
        }
      } catch (err) {
        LOG('processPending: callback error', err?.message || err)
        if (pollId) clearInterval(pollId)
      }
    })
  } catch (err) {
    LOG('processPending: error', err?.message || err)
    if (pollId) clearInterval(pollId)
  }
}

let pollId = null

function onReady() {
  LOG('onReady: received gamedin-extension-ready')
  processPending()
  if (!pollId) {
    pollId = setInterval(processPending, POLL_INTERVAL_MS)
    LOG('onReady: started polling', { intervalMs: POLL_INTERVAL_MS })
  }
}

window.addEventListener(READY_EVENT, onReady)
window.addEventListener(GET_ACTIVITY_EVENT, fetchActivity)
LOG('Listening for', READY_EVENT)
