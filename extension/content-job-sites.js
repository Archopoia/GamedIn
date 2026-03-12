/**
 * GamedIn multi-site job content script.
 * Detects apply success on LinkedIn, Indeed, Glassdoor, Greenhouse, Lever.
 * Tracks activity (search, job_list, job_clicked, job_viewed) on all supported sites.
 */

(function () {
  const isDev = typeof chrome !== 'undefined' && chrome.runtime?.getManifest && !chrome.runtime.getManifest().update_url
  const LOG = (...args) => { if (isDev) console.log('[GamedIn Job Sites]', ...args) }
  const PAGE_STATE_DEBUG_INTERVAL_MS = 5000
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
      iframe.src = chrome.runtime.getURL('widget/widget.html' + (isUnpacked ? '?dev=1&v=2' : '?v=2'))
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
      const jobIdAttrs = [act.jobList?.idAttr, 'data-jk', 'data-jobkey', 'data-job-id', 'data-occludable-job-id'].filter(Boolean)
      function getJobIdFromEl(el) {
        if (!el) return ''
        for (const a of jobIdAttrs) {
          const v = el.getAttribute?.(a)
          if (v) return v
        }
        return ''
      }
      function getText(sel, root) {
        if (!root || !sel) return ''
        const parts = sel.split(',').map((s) => s.trim())
        for (const p of parts) {
          try {
            const el = root.querySelector(p)
            if (el) {
              const t = (el.textContent || '').trim().slice(0, 80)
              if (t) return t
            }
          } catch (_) {}
        }
        return ''
      }
      document.addEventListener(
        'click',
        (e) => {
          const link = e.target.closest?.(jc.linkSelector)
          if (!link) return
          const href = link.getAttribute('href') || ''
          let jobId = ''
          const jobIdMatch = href.match(jc.jobIdPattern || /$/)
          if (jobIdMatch) jobId = (jobIdMatch[1] || jobIdMatch[2] || jobIdMatch[3] || '').trim()
          const card = link.closest?.(jc.cardSelector) || link.closest?.('[data-jk]') || link.closest?.('[data-jobkey]') || link.closest?.('[data-occludable-job-id]') || link.parentElement?.closest?.(jc.cardSelector)
          if (!jobId && card) jobId = getJobIdFromEl(card)
          if (!jobId) jobId = getJobIdFromEl(link)
          const root = card || link.parentElement
          let title = getText(jc.titleSelector, root)
          if (!title && link) title = (link.textContent || '').trim().slice(0, 80)
          let company = getText(jc.companySelector, root)
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
  let totalTimeOnDetailSec = 0
  let totalScrollPx = 0
  let lastWindowScrollY = 0
  const scrollContainerLastTop = new WeakMap()
  let lastCardHovered = null
  let lastCardHoverStart = 0
  let lastCardHoverDurationSec = 0
  let cardsScrolledPast = new Set()
  let cardsInViewport = new Set()
  let applyBtnInView = false

  function isDetailUrl(url) {
    try {
      const act = site.activity || {}
      if (act.search?.paramJobId) {
        const u = new URL(url)
        if (u.searchParams.get(act.search.paramJobId)) return true
      }
      if (act.jobViewed?.urlPattern && url.match(act.jobViewed.urlPattern)) return true
    } catch (_) {}
    return false
  }

  function getCurrentJobId() {
    const url = window.location.href
    const act = site.activity || {}
    if (act.search?.paramJobId) {
      try {
        const u = new URL(url)
        const id = u.searchParams.get(act.search.paramJobId)
        if (id) return id
      } catch (_) {}
    }
    const m = url.match(act.jobViewed?.urlPattern || /$/)
    if (m) return (m[1] || m[2] || m[3] || '').trim()
    return ''
  }

  function isOnDetailPage() {
    return !!getCurrentJobId()
  }

  function getScrollDepth() {
    let maxDepth = 0
    const ps = act.pageState
    if (ps?.scrollContainerSelectors?.length) {
      for (const sel of ps.scrollContainerSelectors) {
        try {
          document.querySelectorAll(sel).forEach((el) => {
            if (el && el.scrollHeight > el.clientHeight) {
              const sh = el.scrollHeight - el.clientHeight
              const depth = sh > 0 ? Math.round((el.scrollTop / sh) * 100) : 0
              if (depth > maxDepth) maxDepth = depth
            }
          })
        } catch (_) {}
      }
      if (maxDepth > 0) return maxDepth
    }
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
    return scrollHeight > 0 ? Math.round((window.scrollY / scrollHeight) * 100) : 0
  }

  function debugPageState() {
    if (!isDev) return
    const ps = act.pageState
    const scrollContainers = []
    if (ps?.scrollContainerSelectors?.length) {
      for (const sel of ps.scrollContainerSelectors) {
        try {
          const els = document.querySelectorAll(sel)
          els.forEach((el) => {
            if (el && el.scrollHeight > el.clientHeight) {
              const sh = el.scrollHeight - el.clientHeight
              const depth = sh > 0 ? Math.round((el.scrollTop / sh) * 100) : 0
              scrollContainers.push({ sel, depth, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight })
            }
          })
        } catch (_) {}
      }
    }
    const cardSel = act.jobList?.cardSelector
    const cards = cardSel ? document.querySelectorAll(cardSel) : []
    const cardsWithId = []
    cards.forEach((c, i) => {
      if (i < 5) cardsWithId.push(getCardId(c))
    })
    const applySels = act.pageState?.applySelectors || ['button[aria-label*="Apply"]']
    let applyFound = false
    for (const sel of applySels) {
      try {
        const btns = document.querySelectorAll(sel)
        for (const btn of btns) {
          const rect = btn.getBoundingClientRect()
          if (rect.top >= 0 && rect.top < window.innerHeight) { applyFound = true; break }
        }
        if (applyFound) break
      } catch (_) {}
    }
    LOG('[PageState Debug]', {
      scrollContainers: scrollContainers.length ? scrollContainers : 'none found',
      windowScroll: { scrollY: window.scrollY, scrollHeight: document.documentElement.scrollHeight - window.innerHeight },
      cardsFound: cards.length,
      cardsWithIdSample: cardsWithId,
      cardsInViewport: cardsInViewport.size,
      cardsScrolledPast: cardsScrolledPast.size,
      applyBtnInView: applyFound,
      lastCardHovered: lastCardHovered ? (lastCardHovered.title || lastCardHovered.jobId || '—') : '—',
    })
  }

  function sendPageState() {
    const now = Date.now()
    const url = window.location.href
    const onDetail = isOnDetailPage()
    const timeOnPageSec = Math.round((now - lastUrlChangeTime) / 1000)

    const scrollDepth = getScrollDepth()
    const hoverDurationSec = lastCardHoverStart > 0 ? Math.round((now - lastCardHoverStart) / 1000) : lastCardHoverDurationSec

    try {
      chrome.runtime.sendMessage({
        type: 'GAMEDIN_PAGE_STATE',
        payload: {
          site: site.id,
          timestamp: now,
          timeOnDetailSec: onDetail ? timeOnPageSec : 0,
          currentJobId: onDetail ? getCurrentJobId() : '',
          totalTimeOnDetailSec: totalTimeOnDetailSec + (onDetail ? timeOnPageSec : 0),
          timeOnListSec: onDetail ? 0 : timeOnPageSec,
          tabVisible: document.visibilityState === 'visible',
          scrollDepthPercent: scrollDepth,
          totalScrollPx,
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

  // URL change → reset time, accumulate total when leaving a job detail
  const reScanCallbacks = []
  function onUrlChangeForPageState() {
    const url = window.location.href
    if (url !== lastUrl) {
      const wasOnDetail = !!lastUrl && isDetailUrl(lastUrl)
      if (wasOnDetail) {
        const elapsed = Math.round((Date.now() - lastUrlChangeTime) / 1000)
        totalTimeOnDetailSec += elapsed
        if (isDev) LOG('[URL] left job detail, added', elapsed, 's, total now:', totalTimeOnDetailSec)
      }
      lastUrl = url
      lastUrlChangeTime = Date.now()
      // Re-scan for elements when navigating (job detail panel, apply button, etc. load after URL change)
      reScanCallbacks.forEach((cb) => { try { cb() } catch (_) {} })
    }
  }
  const origPushState = history.pushState
  const origReplaceState = history.replaceState
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

  // Poll for URL changes (content script runs in isolated world; page's history.pushState doesn't trigger our wrapper)
  setInterval(onUrlChangeForPageState, 800)

  // Tab visibility
  document.addEventListener('visibilitychange', () => {
    sendPageState()
  })

  // Scroll (throttled) - window + site-specific scroll containers (e.g. LinkedIn split layout)
  let scrollThrottle = null
  function onScroll(e) {
    const target = e?.target
    if (target?.dataset?.gamedinScrollContainer) {
      const last = scrollContainerLastTop.get(target) ?? target.scrollTop
      const delta = target.scrollTop - last
      totalScrollPx += Math.abs(delta)
      scrollContainerLastTop.set(target, target.scrollTop)
    } else {
      const delta = window.scrollY - lastWindowScrollY
      totalScrollPx += Math.abs(delta)
      lastWindowScrollY = window.scrollY
    }
    if (scrollThrottle) return
    scrollThrottle = setTimeout(() => {
      scrollThrottle = null
      sendPageState()
    }, SCROLL_THROTTLE_MS)
  }
  lastWindowScrollY = window.scrollY
  window.addEventListener('scroll', onScroll, { passive: true })
  const ps = act.pageState
  if (ps?.scrollContainerSelectors?.length) {
    const observed = new WeakSet()
    let attachCount = 0
    function attachScroll(el) {
      if (!el || observed.has(el)) return
      observed.add(el)
      el.dataset.gamedinScrollContainer = '1'
      scrollContainerLastTop.set(el, el.scrollTop)
      el.addEventListener('scroll', onScroll, { passive: true })
      attachCount++
    }
    function observeScrollContainers() {
      const prev = attachCount
      for (const sel of ps.scrollContainerSelectors) {
        try {
          document.querySelectorAll(sel).forEach(attachScroll)
        } catch (_) {}
      }
      if (isDev && attachCount > prev) LOG('[Scroll] attached to', attachCount - prev, 'new container(s), total:', attachCount)
    }
    observeScrollContainers()
    const scrollMo = new MutationObserver(observeScrollContainers)
    if (document.body) scrollMo.observe(document.body, { childList: true, subtree: true })
    reScanCallbacks.push(observeScrollContainers)
    ;[2000, 5000, 10000, 20000].forEach((ms) => setTimeout(observeScrollContainers, ms))
  }

  // IntersectionObserver for cards + scroll-past (act already declared above)
  const idAttrsForCards = [act.jobList?.idAttr, 'data-occludable-job-id', 'data-jk', 'data-job-id'].filter(Boolean)
  function getCardId(el) {
    if (!el) return ''
    for (const a of idAttrsForCards) {
      let v = el.getAttribute?.(a)
      if (v) return v
      const child = el.querySelector?.(`[${a}]`)
      if (child) return child.getAttribute?.(a) || ''
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
      const cards = document.querySelectorAll(act.jobList.cardSelector)
      let observed = 0
      cards.forEach((card) => {
        if (!card.dataset?.gamedinObserved) {
          card.dataset.gamedinObserved = '1'
          observer.observe(card)
          observed++
        }
      })
      if (isDev && observed > 0) LOG('[Cards] observed', observed, 'new, total cards matched:', cards.length)
    }
    observeCards()
    const mo = new MutationObserver(observeCards)
    if (document.body) mo.observe(document.body, { childList: true, subtree: true })
    reScanCallbacks.push(observeCards)
    ;[2000, 5000, 10000, 20000].forEach((ms) => setTimeout(observeCards, ms))
  }

  // Card hover
  if (act.jobClicked?.cardSelector) {
    const jc = act.jobClicked
    document.addEventListener(
      'mouseenter',
      (e) => {
        const card = e.target.closest?.(jc.cardSelector)
        if (!card) return
        const tEl = card.querySelector?.(jc.titleSelector)
        const cEl = card.querySelector?.(jc.companySelector)
        const title = (tEl?.textContent || '').trim().slice(0, 40)
        const company = (cEl?.textContent || '').trim().slice(0, 40)
        lastCardHovered = { jobId: getCardId(card), title, company }
        if (isDev) LOG('[Hover] card', { jobId: lastCardHovered.jobId, title, company })
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

  // Apply button visibility (site-specific or generic)
  const applySelectors = act.pageState?.applySelectors || ['button[aria-label*="Apply"]', 'button[aria-label*="apply"]', 'a[href*="apply"]', '[data-testid*="apply"]', '.apply-button', '.jobs-apply-button', 'button[data-test-id*="apply"]']
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
  reScanCallbacks.push(checkApplyButton)

  // Periodic page state send
  setInterval(sendPageState, PAGE_STATE_INTERVAL_MS)
  sendPageState()

  if (isDev) {
    setInterval(debugPageState, PAGE_STATE_DEBUG_INTERVAL_MS)
    setTimeout(debugPageState, 3000)
  }

  LOG('Page element capture started', { site: site.id })
})()
