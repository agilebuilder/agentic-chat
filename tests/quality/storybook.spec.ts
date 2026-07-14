import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const storyIds = {
  empty: 'p2-quality-agenticchat-states--empty',
  running: 'p2-quality-agenticchat-states--running',
  completed: 'p2-quality-agenticchat-states--completed',
  failed: 'p2-quality-agenticchat-states--failed',
  cancelled: 'p2-quality-agenticchat-states--cancelled',
  workspace: 'p2-quality-agenticchat-states--workspace-primitives',
} as const

async function openStory(page: Page, id: string) {
  await page.goto(`/iframe.html?id=${id}&viewMode=story`)
  await expect(page.locator('.ac-root')).toBeVisible()
}

for (const [state, id] of Object.entries(storyIds)) {
  test(`${state} state has no automatically detectable accessibility violations`, async ({ page }) => {
    await openStory(page, id)
    const results = await new AxeBuilder({ page }).include('.ac-root').analyze()
    expect(results.violations).toEqual([])
  })
}

test('running state visual baseline', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 760 })
  await openStory(page, storyIds.running)
  await expect(page).toHaveScreenshot('running-desktop.png', { animations: 'disabled', fullPage: true })
})

test('completed state remains usable at a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 })
  await openStory(page, storyIds.completed)
  await expect(page).toHaveScreenshot('completed-narrow.png', { animations: 'disabled', fullPage: true })
})

test('failed state visual baseline in dark color scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1024, height: 760 })
  await openStory(page, storyIds.failed)
  await expect(page).toHaveScreenshot('failed-dark.png', { animations: 'disabled', fullPage: true })
})

test('tool details can be expanded with the keyboard', async ({ page }) => {
  await openStory(page, storyIds.running)
  const details = page.locator('.ac-tool-details')
  const summary = details.locator('summary')
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(details).toHaveAttribute('open', '')
})

test('primary intervention action is first in the workspace tab order', async ({ page }) => {
  await openStory(page, storyIds.workspace)
  await page.locator('body').focus()
  await page.keyboard.press('Tab')
  await expect(page.locator('.ac-intervention button').first()).toBeFocused()
})
