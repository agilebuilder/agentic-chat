import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const storyIds = {
  empty: 'p2-quality-agenticchat-states--empty',
  running: 'p2-quality-agenticchat-states--running',
  completed: 'p2-quality-agenticchat-states--completed',
  failed: 'p2-quality-agenticchat-states--failed',
  cancelled: 'p2-quality-agenticchat-states--cancelled',
  workspace: 'p2-quality-agenticchat-states--workspace-primitives',
  subagents: 'p2-quality-agenticchat-states--parallel-subagents',
  hitl: 'p2-quality-agenticchat-states--human-in-the-loop',
  artifacts: 'p2-quality-agenticchat-states--artifact-workspace',
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

test('subagent children can be expanded with the keyboard', async ({ page }) => {
  await openStory(page, storyIds.subagents)
  const details = page.locator('.ac-subagent > details').first()
  const summary = details.locator(':scope > summary')
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(details).toHaveAttribute('open', '')
  await expect(details.locator('.ac-activity-children')).toContainText('run_tests')
})

test('primary intervention action is first in the workspace tab order', async ({ page }) => {
  await openStory(page, storyIds.workspace)
  await page.locator('body').focus()
  await page.keyboard.press('Tab')
  await expect(page.locator('.ac-intervention button').first()).toBeFocused()
})

test('HITL choice is keyboard operable and approval cannot be submitted twice', async ({ page }) => {
  await openStory(page, storyIds.hitl)
  const approval = page.locator('.ac-intervention').filter({ hasText: '允许发布报告吗？' })
  const approve = approval.getByRole('button', { name: '批准' })
  await approve.click()
  await expect(approve).toBeDisabled()
  await expect(approval).toContainText('响应已接收')

  const choice = page.locator('.ac-intervention').filter({ hasText: '选择导出格式' })
  const pdf = choice.getByRole('radio', { name: /PDF/ })
  await pdf.focus()
  await page.keyboard.press('Space')
  await expect(pdf).toBeChecked()
  await choice.getByRole('button', { name: '提交选择' }).click()
  await expect(choice).toContainText('响应已接收')
})

test('HITL form reports permission errors and keeps retry available', async ({ page }) => {
  await openStory(page, storyIds.hitl)
  const form = page.locator('.ac-intervention').filter({ hasText: '补充发布信息' })
  await form.getByLabel('标题 *').fill('季度报告')
  await form.getByLabel('可见范围 *').selectOption('team')
  await form.getByRole('button', { name: '提交表单' }).click()
  await expect(form.getByRole('alert')).toContainText('没有权限执行此操作')
  await expect(form.getByRole('button', { name: '提交表单' })).toBeEnabled()
})

test('HITL restored terminal records remain visible but inert', async ({ page }) => {
  await openStory(page, storyIds.hitl)
  const resolved = page.locator('.ac-intervention[data-state="resolved"]')
  const expired = page.locator('.ac-intervention[data-state="expired"]')
  await expect(resolved).toContainText('已恢复的确认记录')
  await expect(resolved).toContainText('已处理')
  await expect(expired).toContainText('已过期的补充说明')
  await expect(expired).toContainText('已过期')
  await expect(resolved.getByRole('button')).toHaveCount(0)
  await expect(expired.getByRole('button')).toHaveCount(0)
})

test('Artifact provenance links connect the Activity and Artifact', async ({ page }) => {
  await openStory(page, storyIds.artifacts)
  const activityLink = page.locator('#ac-activity-report-step .ac-activity-artifacts a').first()
  const sourceLink = page.locator('#ac-artifact-report-v1 .ac-artifact-source')
  await expect(activityLink).toHaveAttribute('href', '#ac-artifact-report-v1')
  await expect(sourceLink).toHaveAttribute('href', '#ac-activity-report-step')
  await expect(page.locator('#ac-artifact-report-v2')).toContainText('生成失败')
  await expect(page.locator('#ac-artifact-dataset')).toContainText('生成中')
  await expect(page.locator('#ac-artifact-old-export')).toContainText('已过期')
})

test('Artifact iframe preview mounts only after keyboard expansion with sandboxing', async ({ page }) => {
  await openStory(page, storyIds.artifacts)
  const preview = page.locator('#ac-artifact-report-v1 .ac-artifact-preview')
  await expect(preview.locator('iframe')).toHaveCount(0)
  await preview.locator('summary').focus()
  await page.keyboard.press('Enter')
  const frame = preview.locator('iframe')
  await expect(frame).toBeVisible()
  await expect(frame).toHaveAttribute('sandbox', '')
  await expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer')
})
