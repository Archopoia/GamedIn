/**
 * Job parser for multi-site apply detection.
 * Uses site registry to detect site, extract job info, and detect apply success.
 */

(function (global) {
  const SITES = global.GAMEDIN_SITES || []

  function detectSite(url) {
    try {
      const host = new URL(url).hostname.toLowerCase()
      for (const site of SITES) {
        for (const h of site.hosts) {
          if (host.includes(h)) return site
        }
      }
    } catch (_) {}
    return null
  }

  function extractFirst(doc, selectors, label, skipSet) {
    for (const sel of selectors) {
      try {
        const el = doc.querySelector(sel)
        if (el) {
          const t = (el.textContent || '').trim()
          if (t && t.length >= 2 && t.length <= 200) {
            if (skipSet && skipSet.has(t.toLowerCase())) continue
            return t
          }
        }
      } catch (_) {}
    }
    return null
  }

  function extractJobInfo(doc, site) {
    if (!site) return { title: null, company: null }
    const skipCompany = new Set(site.skipCompany || [])
    const title = extractFirst(doc, site.titleSelectors, 'title', null)
    const company = extractFirst(doc, site.companySelectors, 'company', skipCompany)
    return { title, company }
  }

  function hasApplySuccess(node, site) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false
    const text = (node.textContent || '').toLowerCase()
    for (const pattern of site.successText) {
      if (text.includes(pattern)) return true
    }
    return false
  }

  function extractFromSuccessContext(successNode, site) {
    if (site.id !== 'linkedin') return null
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
              break
            }
          }
        }
        if (!result.company) {
          const companyLinks = modal.querySelectorAll('a[href*="/company/"]')
          for (const a of companyLinks) {
            const t = (a.textContent || '').trim()
            if (t && t.length >= 2 && t.length <= 80) {
              result.company = t
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
        if (h) result.title = (h.textContent || '').trim()
        const sub = jobCard.querySelector('.base-search-card__subtitle, [class*="company"]')
        if (sub) result.company = (sub.textContent || '').trim()
      }
    }
    const rightRail = document.querySelector('.jobs-search__right-rail, .scaffold-layout__main, [class*="job-details"], .jobs-details')
    if (rightRail) {
      if (!result.title) {
        const h1 = rightRail.querySelector('h1')
        if (h1) result.title = (h1.textContent || '').trim()
      }
      if (!result.company) {
        const companyLinks = rightRail.querySelectorAll('a[href*="/company/"]')
        for (const a of companyLinks) {
          const t = (a.textContent || '').trim()
          if (t && t.length >= 2 && t.length <= 80) {
            result.company = t
            break
          }
        }
      }
    }
    return Object.keys(result).length ? result : null
  }

  global.GAMEDIN_JOB_PARSER = {
    detectSite,
    extractJobInfo,
    hasApplySuccess,
    extractFromSuccessContext,
  }
})(typeof window !== 'undefined' ? window : this)
