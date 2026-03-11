/**
 * GamedIn LinkedIn content script.
 * Detects Easy Apply success via MutationObserver and extracts job title/company.
 */

(function () {
  const LOG = (...args) => console.log('[GamedIn LinkedIn]', ...args)

  LOG('Content script loaded', { url: window.location.href })

  const JOB_TITLE_SELECTORS = [
    '.job-details-jobs-unified-top-card__job-title',
    '.job-details-top-card__job-title',
    '.jobs-unified-top-card__job-title',
    '.jobs-top-card__job-title',
    '.topcard__title',
    'h1.t-24',
    '[data-job-title]',
    '.base-search-card__title',
    '.job-card-list__title',
    'h1[class*="job"]',
    'h1[class*="title"]',
    '.jobs-details-top-card__job-title',
    'h1',
  ]

  const COMPANY_SELECTORS = [
    '.job-details-jobs-unified-top-card__company-name',
    '.job-details-top-card__company-url',
    '.job-details-top-card__company-info a',
    '.jobs-unified-top-card__company-name',
    '.jobs-top-card__company-url',
    '.topcard__org-name-link',
    '.base-search-card__subtitle',
    '[data-company-name]',
    'a[href*="/company/"]',
    '.job-details-top-card__company-url',
    '.jobs-details-top-card__company-name',
  ]

  function hasApplySentText(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false
    const text = (node.textContent || '').toLowerCase()
    const match =
      text.includes('application sent') ||
      text.includes('your application was sent') ||
      text.includes('application submitted')
    if (match) LOG('hasApplySentText: matched', { textPreview: text.slice(0, 80) })
    return match
  }

  const SKIP_COMPANY = new Set([
    'company', 'see company', 'view company', 'learn more', 'companies',
    'see company page', 'view all jobs',
  ])

  function extractFirst(selectors, label) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel)
        if (el) {
          const t = (el.textContent || '').trim()
          if (t && t.length >= 2 && t.length <= 200) {
            if (label === 'company' && SKIP_COMPANY.has(t.toLowerCase())) continue
            LOG(`extractFirst(${label}): found via ${sel}`, { value: t })
            return t
          }
        }
      } catch (_) {}
    }
    LOG(`extractFirst(${label}): no match`)
    return null
  }

  let lastSentAt = 0
  const DEBOUNCE_MS = 3000

  function onApplySuccess(successNode) {
    const now = Date.now()
    if (now - lastSentAt < DEBOUNCE_MS) {
      LOG('onApplySuccess: debounced (skip)', { elapsed: now - lastSentAt, debounceMs: DEBOUNCE_MS })
      return
    }
    lastSentAt = now
    LOG('onApplySuccess: detected apply success, extracting job info')

    let title = extractFirst(JOB_TITLE_SELECTORS, 'title')
    let company = extractFirst(COMPANY_SELECTORS, 'company')

    if ((!title || !company) && successNode) {
      const ctx = extractFromSuccessContext(successNode)
      if (ctx) {
        if (ctx.title && !title) {
          title = ctx.title
          LOG('extractFromSuccessContext: title', { value: title, from: ctx.titleFrom })
        }
        if (ctx.company && !company) {
          company = ctx.company
          LOG('extractFromSuccessContext: company', { value: company, from: ctx.companyFrom })
        }
      }
    }

    title = title || 'Unknown Role'
    company = company || 'Unknown Company'

    const payload = {
      title: title.substring(0, 80),
      company: company.substring(0, 80),
      source: 'linkedin',
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

  function extractFromSuccessContext(successNode) {
    const skip = new Set([
      'application sent', 'application submitted', 'your application was sent',
      'application status', 'done', 'close', 'dismiss', 'now',
    ])
    const result = {}
    let el = successNode
    while (el && el !== document.body) {
      const modal = el.closest?.('.artdeco-modal, [role="dialog"]')
      if (modal) {
        if (!result.title) {
          const headings = modal.querySelectorAll('h1, h2, h3, .t-24, .t-20')
          for (const h of headings) {
            const t = (h.textContent || '').trim()
            if (t && t.length >= 3 && t.length <= 120 && !skip.has(t.toLowerCase())) {
              result.title = t
              result.titleFrom = 'modal-heading'
              break
            }
          }
        }
        if (!result.company) {
          const skipCompany = new Set(['company', 'see company', 'view company', 'learn more'])
          const companyLinks = modal.querySelectorAll('a[href*="/company/"]')
          for (const a of companyLinks) {
            const t = (a.textContent || '').trim()
            if (t && t.length >= 2 && t.length <= 80 && !skipCompany.has(t.toLowerCase())) {
              result.company = t
              result.companyFrom = 'modal-company-link'
              break
            }
          }
        }
        if (result.title && result.company) return result
      }
      el = el.parentElement
    }
    const jobIdMatch = window.location.href.match(/currentJobId=(\d+)/)
    if (jobIdMatch && !result.title) {
      const jobId = jobIdMatch[1]
      const jobCard = document.querySelector(`[data-job-id="${jobId}"], [data-occludable-job-id="${jobId}"]`)
      if (jobCard) {
        const h = jobCard.querySelector('h2, h3, h1, .base-search-card__title, .job-card-list__title')
        if (h) {
          const t = (h.textContent || '').trim()
          if (t && t.length >= 3 && t.length <= 120) {
            result.title = t
            result.titleFrom = 'job-card-by-id'
          }
        }
        if (!result.company) {
          const sub = jobCard.querySelector('.base-search-card__subtitle, [class*="company"]')
          if (sub) {
            const t = (sub.textContent || '').trim()
            if (t && t.length >= 2 && t.length <= 80) {
              result.company = t
              result.companyFrom = 'job-card-by-id'
            }
          }
        }
      }
    }

    const rightRail = document.querySelector('.jobs-search__right-rail, .scaffold-layout__main, [class*="job-details"], .jobs-details')
    if (rightRail) {
      if (!result.title) {
        const h1 = rightRail.querySelector('h1')
        if (h1) {
          const t = (h1.textContent || '').trim()
          if (t && t.length >= 3 && t.length <= 120 && !skip.has(t.toLowerCase())) {
            result.title = t
            result.titleFrom = 'right-rail-h1'
          }
        }
      }
      if (!result.company) {
        const skipCompany = new Set(['company', 'see company', 'view company'])
        const companyLinks = rightRail.querySelectorAll('a[href*="/company/"]')
        for (const a of companyLinks) {
          const t = (a.textContent || '').trim()
          if (t && t.length >= 2 && t.length <= 80 && !skipCompany.has(t.toLowerCase())) {
            result.company = t
            result.companyFrom = 'right-rail-company'
            break
          }
        }
      }
    }
    return Object.keys(result).length ? result : null
  }

  function checkNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return
    if (hasApplySentText(node)) {
      onApplySuccess(node)
      return
    }
    for (const child of node.children || []) {
      if (hasApplySentText(child)) {
        onApplySuccess(child)
        return
      }
    }
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        checkNode(node)
      }
    }
  })

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true })
    LOG('MutationObserver started on document.body')
  } else {
    LOG('Waiting for DOMContentLoaded (no body yet)')
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true })
      LOG('MutationObserver started on document.body (after DOMContentLoaded)')
    })
  }
})()
