import type { RepositoriesDbHarness } from './repositories-db-harness.js';
import type { IntegrationRef } from '../../../integrations/integrations-github.public.js';
import type { FakeCall } from '../../../integrations/tests/support/fake-integrations-github.service.js';
import { HandleReconciler } from '../../handle-reconciler.js';
import { SyncRunner } from '../../sync-runner.js';
import { SyncStateStore } from '../../sync-state.store.js';

/**
 * Claims a run for the user, reconciling (and creating the row) as a request entry point would.
 * @param harness - The DB harness.
 * @param userId - The user.
 * @returns The run id.
 */
export async function claimRun(harness: RepositoriesDbHarness, userId: number): Promise<string> {
  const reconciled = await harness.get(HandleReconciler).forRequest(userId);

  if (reconciled.kind !== 'ok') throw new Error('claimRun: no user');
  const outcome = await harness.get(SyncStateStore).claim(userId, 'refresh');

  if (outcome.kind !== 'started') throw new Error(`claimRun: ${outcome.kind}`);
  return outcome.runId;
}

/**
 * Claims and runs a whole sync through the runner's launched task.
 * @param harness - The DB harness.
 * @param userId - The user.
 * @returns The run id.
 */
export async function runSync(harness: RepositoriesDbHarness, userId: number): Promise<string> {
  const runId = await claimRun(harness, userId);

  await harness.get(SyncRunner).task(userId, runId)();
  return runId;
}

/**
 * Advances the clock past the cooldown, so the next `runSync` can claim.
 * @param harness - The DB harness.
 */
export function pastCooldown(harness: RepositoriesDbHarness): void {
  harness.clock.advance(6 * 60_000);
}

/**
 * An integration reference for the fake.
 * @param id - The integration id.
 * @param type - Its type.
 * @returns The reference.
 */
export function ref(id: number, type: IntegrationRef['type'] = 'pat'): IntegrationRef {
  return { id, uuid: `uuid-${id}`, label: `label-${id}`, type };
}

/**
 * Reconciles the user's handle as a request would, so rows seeded next
 * belong to the current handle.
 * @param harness - The DB harness.
 * @param userId - The user.
 */
export async function reconcile(harness: RepositoriesDbHarness, userId: number): Promise<void> {
  await harness.get(HandleReconciler).forRequest(userId);
}

/**
 * Lets the paused run reach a fake GitHub call: yields to the event loop
 * until the fake logged a call matching `predicate` (the run is then parked
 * on a held answer). Throws after many turns, so a wrong script fails fast.
 * @param harness - The DB harness.
 * @param predicate - Which call to wait for.
 */
export async function reachCall(harness: RepositoriesDbHarness, predicate: (call: FakeCall) => boolean): Promise<void> {
  for (let turn = 0; turn < 10_000; turn += 1) {
    if (harness.github.calls.some(predicate)) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error('reachCall: the run never made the expected GitHub call');
}
