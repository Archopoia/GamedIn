/**
 * GamedIn multi-site job content script.
 * Detects apply success on LinkedIn, Indeed, Glassdoor, Greenhouse, Lever.
 * Tracks activity (search, job_list, job_clicked, job_viewed) on all supported sites.
 */

(function () {
  const LOG = (...args) => console.log('[GamedIn Job Sites]', ...args)
  let parser
  try {
    parser = (typeof window !== 'undefined' && window.GAMEDIN_JOB_PARSER) || {}
  } catch (_) {
    parser = {}
  }
  const { detectSite, extractJobInfo, hasApplySuccess, extractFromSuccessContext } = parser

  if (!detectSite || !extractJobInfo || !hasApplySuccess) {
    LOG('Job parser not loaded, exiting')
    return
  }

  const site = detectSite(window.location.href)
  if (!site) {
    LOG('Not a supported job site, exiting', { url: window.location.href })
    return
  }

  LOG('Content script loaded', { site: site.id, url: window.location.href })

  function injectWidget() {
    try {
      if (document.getElementById('gamedin-widget-container')) return
      const wrap = document.createElement('div')
      wrap.id = 'gamedin-widget-container'
      wrap.style.cssText = 'position:fixed;bottom:0;left:0;right:0;width:100%;height:180px;z-index:2147483647;pointer-events:none;'
      const iframe = document.createElement('iframe')
      iframe.id = 'gamedin-widget-iframe'
      const isUnpacked = !chrome.runtime.getManifest().update_url
      iframe.src = chrome.runtime.getURL('widget/widget.html' + (isUnpacked ? '?dev=1' : ''))
      iframe.style.cssText = 'position:absolute;bottom:0;left:0;width:100%;height:100%;border:none;pointer-events:auto;'
      wrap.appendChild(iframe)
      document.body.appendChild(wrap)

      let extOrigin = ''
      try {
        extOrigin = new URL(chrome.runtime.getURL('')).origin
      } catch (_) {
        extOrigin = ''
      }
      window.addEventListener('message', (e) => {
        try {
          if (extOrigin && e.origin !== extOrigin) return
          const data = e.data
          if (data && typeof data === 'object' && data.type === 'GAMEDIN_WIDGET_RESIZE' && typeof data.height === 'number') {
            wrap.style.height = data.height + 'px'
          }
        } catch (_) {
          /* ignore */
        }
      })
    } catch (err) {
      LOG('injectWidget error', err?.message || err)
    }
  }

  if (document.body) {
    injectWidget()
  } else {
    document.addEventListener('DOMContentLoaded', injectWidget)
  }

  let lastSentAt = 0
  const DEBOUNCE_MS = 3000

  function onApplySuccess(successNode) {
    const now = Date.now()
    if (now - lastSentAt < DEBOUNCE_MS) {
      LOG('onApplySuccess: debounced (skip)')
      return
    }
    lastSentAt = now
    LOG('onApplySuccess: detected apply success', { site: site.id })

    let { title, company } = extractJobInfo(document, site)

    if ((!title || !company) && successNode && extractFromSuccessContext) {
      const ctx = extractFromSuccessContext(successNode, site)
      if (ctx) {
        if (ctx.title && !title) title = ctx.title
        if (ctx.company && !company) company = ctx.company
      }
    }

    title = title || 'Unknown Role'
    company = company || 'Unknown Company'

    const payload = {
      title: title.substring(0, 80),
      company: company.substring(0, 80),
      source: site.source,
    }
    LOG('onApplySuccess: sending to background', payload)

    try {
      chrome.runtime.sendMessage(
        { type: 'GAMEDIN_APPLY_DETECTED', payload },
        (response) => {
          if (chrome.runtime.lastError) {
            LOG('onApplySuccess: sendMessage error', chrome.runtime.lastError.message)
          } else {
            LOG('onApplySuccess: sent successfully', response)
          }
        },
      )
    } catch (err) {
      LOG('onApplySuccess: sendMessage threw', err?.message || err)
    }
  }

  function checkNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return
    if (hasApplySuccess(node, site)) {
      onApplySuccess(node)
      return
    }
    for (const child of node.children || []) {
      if (hasApplySuccess(child, site)) {
        onApplySuccess(child)
        return
      }
    }
  }

  function sendActivity(eventType, payload) {
    try {
      chrome.runtime.sendMessage({
        type: 'GAMEDIN_ACTIVITY',
        payload: { event: eventType, site: site.id, ...payload, timestamp: Date.now() },
      })
    } catch (_) {}
  }

  const act = site.activity || {}
  let jobListDebounce = null
  let lastJobListKey = ''

  function captureJobList() {
    const cfg = act.jobList
    if (!cfg) return
    const cards = document.querySelectorAll(cfg.cardSelector)
    if (cards.length < 2) return
    const jobs = []
    cards.forEach((card) => {
      const jobId = cfg.idAttr ? (card.getAttribute(cfg.idAttr) || card.getAttribute('data-jk') || card.getAttribute('data-job-id') || '') : ''
      const tEl = card.querySelector(cfg.titleSelector)
      const cEl = card.querySelector(cfg.companySelector)
      const title = tEl ? (tEl.textContent || '').trim().slice(0, 80) : ''
      const company = cEl ? (cEl.textContent || '').trim().slice(0, 80) : ''
      if (title || jobId) jobs.push({ jobId, title, company })
    })
    if (jobs.length > 0) {
      const key = jobs.map((j) => j.jobId).join(',')
      if (key !== lastJobListKey) {
        lastJobListKey = key
        LOG('Activity: job_list', { site: site.id, count: jobs.length })
        sendActivity('job_list', { count: jobs.length, jobs: jobs.slice(0, 50) })
      }
    }
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        checkNode(node)
      }
    }
    if (act.jobList) {
      clearTimeout(jobListDebounce)
      jobListDebounce = setTimeout(captureJobList, 800)
    }
  })

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true })
    LOG('MutationObserver started')
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true })
      LOG('MutationObserver started (after DOMContentLoaded)')
    })
  }

  if (act.search || act.jobViewed || act.jobClicked) {
    let lastUrl = window.location.href
    const lastActivitySent = {}
    const ACTIVITY_DEBOUNCE_MS = 3000

    function onUrlChange() {
      const url = window.location.href
      if (url === lastUrl) return
      lastUrl = url

      if (act.search) {
        const sc = act.search
        if (!sc.urlMatch || url.includes(sc.urlMatch)) {
          let keywords = null
          let location = null
          let jobId = null
          try {
            const u = new URL(url)
            if (sc.paramKeywords) keywords = u.searchParams.get(sc.paramKeywords) || null
            if (sc.paramLocation) location = u.searchParams.get(sc.paramLocation) || null
            if (sc.paramJobId) jobId = u.searchParams.get(sc.paramJobId) || null
            if (sc.pathKeywords && !keywords) {
              const m = url.match(/\/Job\/([^/]+)-jobs/);
              if (m) keywords = decodeURIComponent(m[1].replace(/-/g, ' '))
            }
          } catch (_) {}
          if (keywords && keywords !== lastActivitySent.search_keyword) {
            lastActivitySent.search_keyword = keywords
            LOG('Activity: search', { site: site.id, keywords })
            sendActivity('search', { keywords, location })
          }
          if (jobId && jobId !== lastActivitySent.job_viewed) {
            lastActivitySent.job_viewed = jobId
            LOG('Activity: job_viewed', { site: site.id, jobId })
            sendActivity('job_viewed', { jobId })
          }
        }
      }

      if (act.jobViewed && act.jobViewed.urlPattern && !act.search?.paramJobId) {
        const m = url.match(act.jobViewed.urlPattern)
        if (m) {
          const jobId = m[1] || m[2] || ''
          if (jobId && jobId !== lastActivitySent.job_viewed) {
            lastActivitySent.job_viewed = jobId
            LOG('Activity: job_viewed', { site: site.id, jobId })
            sendActivity('job_viewed', { jobId })
          }
        }
      }
    }

    if (act.search || act.jobViewed) {
      setInterval(onUrlChange, 1500)
      onUrlChange()
    }

    if (act.jobClicked) {
      const jc = act.jobClicked
      document.addEventListener(
        'click',
        (e) => {
          const link = e.target.closest?.(jc.linkSelector)
          if (!link) return
          const href = link.getAttribute('href') || ''
          const jobIdMatch = href.match(jc.jobIdPattern || /$/)
          const jobId = jobIdMatch ? (jobIdMatch[1] || jobIdMatch[2] || '') : ''
          const card = link.closest?.(jc.cardSelector)
          let title = ''
          let company = ''
          if (card) {
            const tEl = card.querySelector(jc.titleSelector)
            const cEl = card.querySelector(jc.companySelector)
            if (tEl) title = (tEl.textContent || '').trim().slice(0, 80)
            if (cEl) company = (cEl.textContent || '').trim().slice(0, 80)
          }
          if (jobId || title) {
            const key = `click-${jobId || title}`
            const now = Date.now()
            if (!lastActivitySent[key] || now - lastActivitySent[key] > ACTIVITY_DEBOUNCE_MS) {
              lastActivitySent[key] = now
              LOG('Activity: job_clicked', { site: site.id, jobId, title, company })
              sendActivity('job_clicked', { jobId, title, company })
            }
          }
        },
        true,
      )
    }

    LOG('Activity tracking started', { site: site.id })
  }

  // --- Page element capture (shared across sites) ---
  const PAGE_STATE_INTERVAL_MS = 2000
  const SCROLL_THROTTLE_MS = 300

  let lastUrlChangeTime = Date.now()
  let lastUrl = window.location.href
  let maxScrollReached = 0
  let lastCardHovered = null
  let lastCardHoverStart = 0
  let lastCardHoverDurationSec = 0
  let cardsScrolledPast = new Set()
  let cardsInViewport = new Set()
  let applyBtnInView = false

  function isOnDetailPage() {
    const url = window.location.href
    const act = site.activity || {}
    if (act.search?.paramJobId) {
      try {
        const u = new URL(url)
        const jobId = u.searchParams.get(act.search.paramJobId)
        if (jobId) return true
      } catch (_) {}
    }
    if (act.jobViewed?.urlPattern && url.match(act.jobViewed.urlPattern)) {
      return true
    }
    return false
  }

  function sendPageState() {
    const now = Date.now()
    const url = window.location.href
    const onDetail = isOnDetailPage()
    const timeOnPageSec = Math.round((now - lastUrlChangeTime) / 1000)

    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
    const scrollDepth = scrollHeight > 0 ? Math.round((window.scrollY / scrollHeight) * 100) : 0
    if (scrollDepth > maxScrollReached) maxScrollReached = scrollDepth

    const hoverDurationSec = lastCardHoverStart > 0 ? Math.round((now - lastCardHoverStart) / 1000) : lastCardHoverDurationSec

    try {
      chrome.runtime.sendMessage({
        type: 'GAMEDIN_PAGE_STATE',
        payload: {
          site: site.id,
          timestamp: now,
          timeOnDetailSec: onDetail ? timeOnPageSec : 0,
          timeOnListSec: onDetail ? 0 : timeOnPageSec,
          tabVisible: document.visibilityState === 'visible',
          scrollDepthPercent: scrollDepth,
          maxScrollReached,
          cardsInViewCount: cardsInViewport.size,
          cardsInViewIds: Array.from(cardsInViewport).slice(0, 20),
          lastCardHovered,
          lastCardHoverDurationSec: lastCardHovered ? hoverDurationSec : lastCardHoverDurationSec,
          cardsScrolledPastCount: cardsScrolledPast.size,
          applyBtnInView,
        },
      })
    } catch (_) {}
  }

  // URL change → reset time
  const origPushState = history.pushState
  const origReplaceState = history.replaceState
  function onUrlChangeForPageState() {
    const url = window.location.href
    if (url !== lastUrl) {
      lastUrl = url
      lastUrlChangeTime = Date.now()
    }
  }
  history.pushState = function (...args) {
    origPushState.apply(this, args)
    onUrlChangeForPageState()
  }
  history.replaceState = function (...args) {
    origReplaceState.apply(this, args)
    onUrlChangeForPageState()
  }
  window.addEventListener('popstate', onUrlChangeForPageState)
  lastUrl = window.location.href
  lastUrlChangeTime = Date.now()

  // Tab visibility
  document.addEventListener('visibilitychange', () => {
    sendPageState()
  })

  // Scroll (throttled)
  let scrollThrottle = null
  window.addEventListener(
    'scroll',
    () => {
      if (scrollThrottle) return
      scrollThrottle = setTimeout(() => {
        scrollThrottle = null
        sendPageState()
      }, SCROLL_THROTTLE_MS)
    },
    { passive: true },
  )

  // IntersectionObserver for cards + scroll-past
  const act = site.activity || {}
  const idAttrsForCards = [act.jobList?.idAttr, 'data-occludable-job-id', 'data-jk', 'data-job-id'].filter(Boolean)
  function getCardId(el) {
    for (const a of idAttrsForCards) {
      const v = el.getAttribute?.(a)
      if (v) return v
    }
    return ''
  }
  if (act.jobList?.cardSelector) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = getCardId(entry.target)
          if (!id) continue
          if (entry.isIntersecting) {
            cardsInViewport.add(id)
          } else {
            cardsInViewport.delete(id)
            if (entry.boundingClientRect.top < 0) {
              cardsScrolledPast.add(id)
            }
          }
        }
        sendPageState()
      },
      { root: null, rootMargin: '0px', threshold: 0.1 },
    )
    function observeCards() {
      document.querySelectorAll(act.jobList.cardSelector).forEach((card) => {
        if (!card.dataset?.gamedinObserved) {
          card.dataset.gamedinObserved = '1'
          observer.observe(card)
        }
      })
    }
    observeCards()
    const mo = new MutationObserver(observeCards)
    if (document.body) mo.observe(document.body, { childList: true, subtree: true })
  }

  // Card hover
  if (act.jobClicked?.cardSelector) {
    const jc = act.jobClicked
    const idAttrs = [act.jobList?.idAttr, 'data-occludable-job-id', 'data-jk', 'data-job-id'].filter(Boolean)
    document.addEventListener(
      'mouseenter',
      (e) => {
        const card = e.target.closest?.(jc.cardSelector)
        if (!card) return
        let id = ''
        for (const a of idAttrs) {
          id = card.getAttribute?.(a) || ''
          if (id) break
        }
        const tEl = card.querySelector?.(jc.titleSelector)
        const cEl = card.querySelector?.(jc.companySelector)
        lastCardHovered = { jobId: id, title: (tEl?.textContent || '').trim().slice(0, 40), company: (cEl?.textContent || '').trim().slice(0, 40) }
        lastCardHoverStart = Date.now()
        lastCardHoverDurationSec = 0
      },
      true,
    )
    document.addEventListener(
      'mouseleave',
      (e) => {
        const card = e.target.closest?.(jc.cardSelector)
        if (card && lastCardHoverStart > 0) {
          lastCardHoverDurationSec = Math.round((Date.now() - lastCardHoverStart) / 1000)
          lastCardHoverStart = 0
          sendPageState()
        }
      },
      true,
    )
  }

  // Apply button visibility (generic: look for common apply button patterns)
  const applySelectors = ['button[aria-label*="Apply"]', 'button[aria-label*="apply"]', 'a[href*="apply"]', '[data-testid*="apply"]', '.apply-button', '.jobs-apply-button', 'button[data-test-id*="apply"]']
  function checkApplyButton() {
    let found = false
    for (const sel of applySelectors) {
      try {
        const btns = document.querySelectorAll(sel)
        for (const btn of btns) {
          const rect = btn.getBoundingClientRect()
          if (rect.top >= 0 && rect.top < window.innerHeight && rect.left >= 0 && rect.left < window.innerWidth) {
            found = true
            break
          }
        }
        if (found) break
      } catch (_) {}
    }
    applyBtnInView = found
  }
  setInterval(checkApplyButton, 1000)

  // Periodic page state send
  setInterval(sendPageState, PAGE_STATE_INTERVAL_MS)
  sendPageState()

  LOG('Page element capture started', { site: site.id })
})()
