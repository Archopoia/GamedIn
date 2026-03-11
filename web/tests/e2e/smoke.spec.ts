import { expect, test } from '@playwright/test'

test('shows core gamedin panels', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'GamedIn MVP' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Log Application' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'I applied' })).toBeVisible()
})
