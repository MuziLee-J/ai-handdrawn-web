import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { imageSize } from 'image-size';
import { createMockArtwork } from '../src/lib/ai/mock-png';

const sourcePath = path.resolve('test-results', 'e2e-source.png');

test.beforeAll(() => {
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  const { buffer } = createMockArtwork(900, 700, 'watercolor');
  fs.writeFileSync(sourcePath, buffer);
});

test('full creation flow on desktop and mobile', async ({ page }, testInfo) => {
  const project = testInfo.project.name;
  const screenshots = path.resolve('test-results', 'screenshots');
  fs.mkdirSync(screenshots, { recursive: true });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /把照片，\s*画成一张作品/ }),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(screenshots, `home-${project}.png`),
    fullPage: true,
  });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, '首页不应出现横向溢出').toBeLessThanOrEqual(1);

  await page.getByRole('link', { name: /上传照片，开始创作/ }).click();
  await expect(page.getByRole('heading', { name: '新建手绘作品' })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(sourcePath);
  await expect(page.getByRole('button', { name: /使用这张照片/ })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole('button', { name: /使用这张照片/ }).click();
  await expect(page.getByText('已上传')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: /下一步：选择风格/ }).click();
  await expect(page.getByRole('heading', { name: '与原图的接近程度' })).toBeVisible();

  await page.getByRole('button', { name: /彩铅绘画/ }).click();
  await page.getByTestId('composition-sketchbook').click();
  await expect(page.getByTestId('composition-sketchbook')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: /更艺术化/ }).click();
  await page.screenshot({
    path: path.join(screenshots, `style-${project}.png`),
    fullPage: true,
  });

  await page.getByRole('button', { name: /开始生成手绘图/ }).click();
  await expect(page.getByText('生成完成')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText('构图：手账留白')).toBeVisible();
  await page.screenshot({
    path: path.join(screenshots, `result-${project}.png`),
    fullPage: true,
  });

  await page.getByRole('button', { name: /进入排版编辑器/ }).click();
  await expect(page).toHaveURL(/\/editor\//);
  await page.locator('canvas').first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1200);

  await page.screenshot({
    path: path.join(screenshots, `editor-${project}.png`),
    fullPage: true,
  });

  // 添加中文标题，验证文字由排版模块绘制而不是 AI。
  await page.getByRole('button', { name: '文字', exact: true }).first().click();
  await page.getByRole('button', { name: '标题', exact: true }).click();
  await page.getByRole('button', { name: '图层', exact: true }).first().click();

  // 桌面与移动端面板同时存在于 DOM，移动端断言必须限定在可见抽屉内，
  // 否则会命中带 hidden 类的桌面图层列表。
  const desktopProject = project === 'desktop-chromium';
  const layerScope = desktopProject
    ? page
    : page.getByTestId('mobile-tool-sheet');
  await expect(layerScope.getByText('在这里写下标题').first()).toBeVisible();

  // 修改背景并验证撤销/重做按钮可用。
  if (desktopProject) {
    await page.getByRole('button', { name: '画布', exact: true }).first().click();
    await page.getByRole('button', { name: '背景颜色 #EEF1EA' }).click();
  } else {
    // 关闭刚才的图层抽屉，再通过底部工具栏打开画布面板。
    await page.getByTestId('close-mobile-tool-sheet').click();
    await page
      .locator('nav.fixed')
      .getByRole('button', { name: '画布', exact: true })
      .click();
    const sheet = page.getByTestId('mobile-tool-sheet');
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: '背景颜色 #EEF1EA' }).click();
    await page.getByTestId('close-mobile-tool-sheet').click();
  }
  await page.getByRole('button', { name: '撤销' }).click();
  await page.getByRole('button', { name: '重做' }).click();

  // 导出 PNG，检查真实像素尺寸为 2× 设计尺寸。
  const exportPath = path.resolve(
    'test-results',
    `export-${project}.png`,
  );
  const downloadPromise = page.waitForEvent('download', { timeout: 45_000 });
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const download = await downloadPromise;
  await download.saveAs(exportPath);
  const exported = fs.readFileSync(exportPath);
  const dimensions = imageSize(exported);
  expect(dimensions.width).toBe(2400);
  expect(dimensions.height).toBe(3200);
  expect(exported.length).toBeGreaterThan(20_000);

  await page.getByRole('button', { name: '保存', exact: true }).click();
  // 保存状态胶囊在窄屏隐藏，用用户可见的 toast 验证保存成功。
  await expect(page.getByText('作品已保存。', { exact: true })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole('link', { name: '作品集' }).click();
  await expect(page).toHaveURL(/\/works/);
  await expect(page.getByText('未命名作品').first()).toBeVisible();
  await page.screenshot({
    path: path.join(screenshots, `works-${project}.png`),
    fullPage: true,
  });

  // 重新打开作品，确认排版文档已持久化、编辑状态可以恢复。
  await page.getByRole('link', { name: /未命名作品/ }).first().click();
  await expect(page).toHaveURL(/\/editor\//);
  await page.locator('canvas').first().waitFor({ timeout: 30_000 });
  if (desktopProject) {
    await page.getByRole('button', { name: '图层', exact: true }).first().click();
    await expect(page.getByText('在这里写下标题').first()).toBeVisible();
  } else {
    await page
      .locator('nav.fixed')
      .getByRole('button', { name: '图层', exact: true })
      .click();
    await expect(
      page
        .getByTestId('mobile-tool-sheet')
        .getByText('在这里写下标题')
        .first(),
    ).toBeVisible();
  }

  const worksOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(worksOverflow, '作品集不应出现横向溢出').toBeLessThanOrEqual(1);
});
