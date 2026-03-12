/**
 * Site registry for multi-site job tracking.
 * Per-site: host match, title/company selectors, apply-success text patterns.
 * Maps to GamedIn ApplicationSource: linkedin | indeed | glassdoor | other
 */

const SITES = [
  {
    id: 'linkedin',
    source: 'linkedin',
    hosts: ['linkedin.com'],
    titleSelectors: [
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
    ],
    companySelectors: [
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
      '.job-details-top-card__company-name',
    ],
    successText: [
      'application sent',
      'your application was sent',
      'application submitted',
    ],
    skipCompany: ['company', 'see company', 'view company', 'learn more', 'companies', 'see company page', 'view all jobs'],
    activity: {
      search: { paramKeywords: 'keywords', paramLocation: 'location', paramJobId: 'currentJobId', urlMatch: '/jobs' },
      jobList: {
        cardSelector: '.job-card-container, .base-card, .job-search-card, .scaffold-layout__list-item, .jobs-search-results__list-item, li[data-occludable-job-id], div[data-occludable-job-id], [data-occludable-job-id]',
        titleSelector: '.base-search-card__title, .job-card-list__title, h3, [class*="title"]',
        companySelector: '.base-search-card__subtitle, [class*="company"]',
        idAttr: 'data-occludable-job-id',
      },
      pageState: {
        scrollContainerSelectors: ['.jobs-search-results__list', '.scaffold-layout__list', '.jobs-search-results', '.jobs-search__job-details', '[class*="jobs-search-results"]', '[class*="scaffold-layout__list"]', '[class*="job-details"]'],
        applySelectors: ['button[aria-label*="Apply"]', 'button[aria-label*="Easy Apply"]', 'button[aria-label*="apply"]', '.jobs-apply-button', 'button.jobs-apply-button', '[data-test-id*="apply"]', 'a[href*="apply"]'],
      },
      jobClicked: {
        linkSelector: 'a[href*="/jobs/view/"], a[href*="currentJobId="], .job-card-container a, .base-card a, [data-occludable-job-id] a',
        cardSelector: '.job-card-container, .base-card, .job-search-card, [data-occludable-job-id], [data-job-id], .scaffold-layout__list-item, .jobs-search-results__list-item',
        titleSelector: '.base-search-card__title, .job-card-list__title, h3, [class*="job-title"], [class*="title"]',
        companySelector: '.base-search-card__subtitle, [class*="company"], [class*="subtitle"]',
        jobIdPattern: /currentJobId=(\d+)|(\d{8,})/,
      },
      jobViewed: { paramJobId: 'currentJobId', urlPattern: /currentJobId=(\d+)/ },
    },
  },
  {
    id: 'indeed',
    source: 'indeed',
    hosts: ['indeed.com', 'indeed.co.uk', 'indeed.ca', 'au.indeed.com', 'ch.indeed.com', 'de.indeed.com', 'fr.indeed.com'],
    titleSelectors: [
      '.jobsearch-JobInfoHeader-title',
      '[data-testid="jobsearch-JobInfoHeader-title"]',
      'h1.jobsearch-JobInfoHeader-title',
      '.jobsearch-ViewJob h1',
      'h1[class*="JobInfoHeader"]',
      '.jcs-JobTitle',
      'h1',
    ],
    companySelectors: [
      '[data-testid="inlineHeader-companyName"]',
      '.companyName',
      '[data-testid="company-name"]',
      '[data-company-name]',
      'a[data-tn-element="companyName"]',
      '.jobsearch-CompanyInfoContainer a',
      'div[class*="companyName"]',
      'h2 + div a',
    ],
    successText: [
      'application submitted',
      'you applied',
      'application sent',
      'your application has been submitted',
      'thank you for applying',
    ],
    skipCompany: ['company', 'see company', 'view company', 'learn more'],
    activity: {
      search: { paramKeywords: 'q', paramLocation: 'l', urlMatch: '/jobs' },
      jobList: {
        cardSelector: '.job_seen_beacon, [data-jobkey], div[data-jk], .jobsearch-SerpJobCard, .jobCard, [data-jk]',
        titleSelector: 'h2.jobTitle span, .jobTitle, .jcs-JobTitle span, .jcs-JobTitle, [data-testid="jobsearch-JobInfoHeader-title"]',
        companySelector: 'span.companyName, [data-testid="company-name"], [data-testid="inlineHeader-companyName"], .companyName',
        idAttr: 'data-jk',
      },
      pageState: {
        scrollContainerSelectors: ['.jobsearch-ResultsList', '.jobsearch-Results', '#resultsCol', '[class*="jobsearch-Results"]'],
        applySelectors: ['button[data-testid="apply-button"]', '#apply-button', 'a[data-tn-element="applyButton"]', '.jobsearch-ApplyButton', 'button[aria-label*="Apply"]', 'a[href*="apply"]'],
      },
      jobClicked: {
        linkSelector: 'a.tapItem, a[data-jk], a[href*="/viewjob"], a[href*="/rc/clk"], a[href*="jk="], a[href*="vjk="], a.jcs-JobTitle, [data-jk] a',
        cardSelector: '.job_seen_beacon, [data-jobkey], [data-jk], .jobsearch-SerpJobCard, .jobCard',
        titleSelector: 'h2.jobTitle span, .jobTitle, .jcs-JobTitle span, .jcs-JobTitle, a.jcs-JobTitle span',
        companySelector: 'span.companyName, [data-testid="company-name"], .companyName',
        jobIdPattern: /[?&]vjk=([^&]+)|[?&]jk=([^&]+)|viewjob\?jk=([^&]+)/,
      },
      jobViewed: { paramJobId: 'jk', urlPattern: /viewjob\?jk=([^&]+)|[?&]jk=([^&]+)|[?&]vjk=([^&]+)/ },
    },
  },
  {
    id: 'glassdoor',
    source: 'glassdoor',
    hosts: ['glassdoor.com', 'glassdoor.co.uk'],
    titleSelectors: [
      '[data-test="job-detail-header-title"]',
      '.jobDetailsHeader h1',
      '.JobDetails_jobDetailsHeader__title',
      'h1[class*="job"]',
      '.job-title',
      'h1',
    ],
    companySelectors: [
      '[data-test="job-detail-header-company"]',
      '.EmployerInfo__EmployerInfoHeader',
      'a[data-test="job-detail-header-company-link"]',
      '[class*="EmployerInfo"] a',
      '.jobEmpolyerName',
      '.jobEmployerName',
      'a[href*="/Overview/"]',
    ],
    successText: [
      'application submitted',
      'applied',
      'application sent',
      'thank you for applying',
      'your application has been submitted',
    ],
    skipCompany: ['company', 'see company', 'view company', 'learn more'],
    activity: {
      search: { urlMatch: '/Job/', pathKeywords: true },
      jobList: {
        cardSelector: '.react-job-listing, [data-test="job-listing"], .JobCard, .jobCard',
        titleSelector: '.jobLink, [data-test="job-listing-title"], .job-title, h2',
        companySelector: '.jobEmpolyerName, .jobEmployerName, [data-test="job-listing-company"]',
        idAttr: 'data-job-id',
      },
      pageState: {
        scrollContainerSelectors: ['#MainCol', '.JobsList', '[class*="JobsList"]', '[class*="job-list"]'],
        applySelectors: ['button[data-test="apply-button"]', 'a[data-test="apply-button"]', 'button[aria-label*="Apply"]', 'a[href*="apply"]'],
      },
      jobClicked: {
        linkSelector: 'a.jobLink, a[href*="/job-details"], a[href*="/Job/"], [data-test="job-listing"] a',
        cardSelector: '.react-job-listing, [data-test="job-listing"], .JobCard, .jobCard',
        titleSelector: '.jobLink, [data-test="job-listing-title"], .job-title, h2',
        companySelector: '.jobEmpolyerName, .jobEmployerName, [data-test="job-listing-company"]',
        jobIdPattern: /\/job-details\/([^/?]+)|Job\/([^/?]+)/,
      },
      jobViewed: { urlPattern: /\/job-details\/|Job\/[^/]+\d/ },
    },
  },
  {
    id: 'greenhouse',
    source: 'other',
    hosts: ['greenhouse.io', 'boards.greenhouse.io', 'jobs.greenhouse.io'],
    titleSelectors: [
      '.app-title',
      'h1.app-title',
      '[class*="app-title"]',
      '.job-title',
      'h1',
    ],
    companySelectors: [
      '.company-name',
      '[class*="company-name"]',
      '.company_name',
      'a[href*="/company/"]',
      'h2',
    ],
    successText: [
      'thank you',
      'application received',
      'application submitted',
      'your application has been submitted',
      'we have received your application',
    ],
    skipCompany: ['company', 'see company', 'view company'],
    activity: {
      jobList: {
        cardSelector: '.posting, .posting-card, [class*="posting"]',
        titleSelector: '.posting-headline, .posting-title, h4, h5',
        companySelector: '.posting-categories, .company-name',
        idAttr: 'data-gh-id',
      },
      jobClicked: {
        linkSelector: 'a.posting-title, a[href*="/jobs/"], a[href*="/job/"], .posting a',
        cardSelector: '.posting, .posting-card, [class*="posting"]',
        titleSelector: '.posting-headline, .posting-title, h4, h5',
        companySelector: '.posting-categories, .company-name',
        jobIdPattern: /\/jobs?\/([^/?]+)/,
      },
      jobViewed: { urlPattern: /\/jobs?\/([^/?]+)/ },
    },
  },
  {
    id: 'lever',
    source: 'other',
    hosts: ['jobs.lever.co', 'lever.co'],
    titleSelectors: [
      '.posting-headline',
      'h2.posting-headline',
      '[class*="posting-headline"]',
      '.posting-header h2',
      'h1',
    ],
    companySelectors: [
      '.posting-categories',
      'a[href*="/company/"]',
      '.main-header-logo',
      '[class*="company"]',
      'h1',
    ],
    successText: [
      'thank you',
      'application received',
      'application submitted',
      'your application has been submitted',
      'we have received your application',
    ],
    skipCompany: ['company', 'see company', 'view company'],
    activity: {
      jobList: {
        cardSelector: '.posting, .posting-card, [class*="posting"]',
        titleSelector: '.posting-headline, .posting-title, h4, h5',
        companySelector: '.posting-categories, .company-name',
        idAttr: 'data-posting-id',
      },
      jobClicked: {
        linkSelector: 'a.posting-title, a[href*="/jobs/"], a[href*="/job/"], .posting a',
        cardSelector: '.posting, .posting-card, [class*="posting"]',
        titleSelector: '.posting-headline, .posting-title, h4, h5',
        companySelector: '.posting-categories, .company-name',
        jobIdPattern: /\/jobs?\/([^/?]+)/,
      },
      jobViewed: { urlPattern: /\/jobs?\/([^/?]+)/ },
    },
  },
]

// Expose for jobParser (loaded after this script)
try {
  if (typeof window !== 'undefined') {
    window.GAMEDIN_SITES = SITES
  }
} catch (_) {
  /* page may restrict window (e.g. LinkedIn) */
}
