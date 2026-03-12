import { expect, test } from '@playwright/test'

test('shows core gamedin widget', async ({ page }) => {
  await page.goto('/widget.html')
  await expect(page.getByText('GamedIn')).toBeVisible()
  await page.getByRole('button', { name: 'Hopium Config' }).click()
  await expect(page.getByRole('heading', { name: 'Hopium Config' })).toBeVisible()
})
