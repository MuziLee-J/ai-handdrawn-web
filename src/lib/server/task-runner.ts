import { getProvider } from '../ai';
import { applyComposition } from '../ai/composition';
import { ProviderError } from '../ai/errors';
import { getConfig } from './config';
import { createAsset, deleteAsset, getAssetRow, readAssetBuffer } from './assets';
import {
  finishTaskFailure,
  finishTaskSuccess,
  getTaskRow,
  markTaskProcessing,
  recoverStaleTasks,
} from './tasks';

interface RunnerState {
  queue: string[];
  running: Set<string>;
  controllers: Map<string, AbortController>;
}

const globalForRunner = globalThis as unknown as {
  __handdrawnRunner?: RunnerState;
};

function state(): RunnerState {
  if (!globalForRunner.__handdrawnRunner) {
    globalForRunner.__handdrawnRunner = {
      queue: [],
      running: new Set(),
      controllers: new Map(),
    };
  }
  return globalForRunner.__handdrawnRunner;
}

async function runTask(taskId: string): Promise<void> {
  const runner = state();
  const controller = new AbortController();
  runner.controllers.set(taskId, controller);

  try {
    const task = getTaskRow(taskId);
    if (task.status !== 'queued') return;
    if (!markTaskProcessing(taskId)) return;

    const processingTask = getTaskRow(taskId);
    const source = getAssetRow(processingTask.source_asset_id, processingTask.session_id);
    const sourceBuffer = readAssetBuffer(source);

    const provider = getProvider();
    if (provider.id !== processingTask.provider) {
      throw new ProviderError(
        'INVALID_INPUT',
        'AI 供应商配置已变更，无法继续原任务。请重新生成。',
      );
    }

    const result = await provider.generateStyledImage({
      source: {
        buffer: sourceBuffer,
        mime: source.mime,
        width: source.width,
        height: source.height,
      },
      prompt: processingTask.prompt,
      styleId: processingTask.style_id,
      fidelity: processingTask.fidelity,
      signal: controller.signal,
    });

    const composed = await applyComposition(
      result.buffer,
      processingTask.composition,
    );
    const asset = await createAsset({
      sessionId: processingTask.session_id,
      kind: 'generated',
      buffer: composed,
    });

    const config = getConfig();
    const accepted = finishTaskSuccess({
      taskId,
      resultAssetId: asset.id,
      providerRequestId: result.providerRequestId,
      usage: result.usage,
      costCents: provider.isMock ? 0 : config.costCentsPerImage,
    });

    if (!accepted) {
      // 任务在生成期间被取消（当前 Ark 不支持取消，实际很少发生）。
      await deleteAsset(asset);
    }
  } catch (error) {
    const providerError =
      error instanceof ProviderError ? error : null;
    const task = (() => {
      try {
        return getTaskRow(taskId);
      } catch {
        return null;
      }
    })();

    if (task && task.status !== 'cancelled') {
      finishTaskFailure({
        taskId,
        code: providerError?.code ?? 'INTERNAL_ERROR',
        message: providerError?.message ?? '生成过程中发生未知错误。',
        retryable: providerError?.retryable ?? false,
      });
    }
  } finally {
    runner.controllers.delete(taskId);
    runner.running.delete(taskId);
    pump();
  }
}

function pump(): void {
  const runner = state();
  const config = getConfig();
  while (runner.running.size < config.taskConcurrency && runner.queue.length > 0) {
    const taskId = runner.queue.shift();
    if (!taskId || runner.running.has(taskId)) continue;
    runner.running.add(taskId);
    void runTask(taskId);
  }
}

export function enqueueTask(taskId: string): void {
  recoverStaleTasks();
  const runner = state();
  if (runner.running.has(taskId) || runner.queue.includes(taskId)) return;
  runner.queue.push(taskId);
  pump();
}
