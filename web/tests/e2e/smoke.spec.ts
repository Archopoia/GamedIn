import { expect, test } from '@playwright/test'

test('shows core gamedin panels', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'GamedIn' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Extension' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Profile' })).toBeVisible()
})
