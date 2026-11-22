import { inspect } from 'node:util';
import type request from 'supertest';
import type { ConsoleSpies } from '../../../core/tests/console-spies.test-support.js';
import type { FakeWorkersService } from '../../../workers/tests/support/fake-workers.service.js';

/**
 * A response as one searchable string: status, headers and body.
 * @param response - The response.
 * @returns The text.
 */
export function serializeResponse(response: request.Response): string {
  return `${response.status}\n${JSON.stringify(response.headers)}\n${response.text}\n${JSON.stringify(response.body)}`;
}

/**
 * Every captured log line (every level, attributes included) as one string.
 * @param spies - The console spies `LoggerService` writes through.
 * @returns The text.
 */
export function serializeLogs(spies: ConsoleSpies): string {
  return inspect(Object.values(spies).flatMap((spy) => spy.mock.calls), { depth: 10, maxStringLength: null, breakLength: Infinity });
}

/**
 * Every enqueued job's name and params, and every line the job logger received.
 * @param workers - The recording workers double.
 * @returns The text.
 */
export function serializeJobs(workers: FakeWorkersService): string {
  return `${JSON.stringify(workers.enqueued)}\n${JSON.stringify(workers.logger.calls)}\n${inspect(workers.errors, { depth: 5 })}`;
}

/**
 * Asserts that none of the canaries appears in any haystack. The failure names the canary and the
 * haystack's position and shows a short excerpt around the hit, never the whole text.
 * @param haystacks - Serialised response bodies, headers, log lines and recorded job params.
 * @param canaries - The strings that must never appear (a secret, an error body, a title...).
 */
export function expectNoCanary(haystacks: string[], canaries: string[]): void {
  const hits: string[] = [];

  haystacks.forEach((haystack, index) => {
    for (const canary of canaries) {
      const at = haystack.indexOf(canary);

      if (at >= 0) hits.push(`haystack #${index} holds "${canary}": ...${haystack.slice(Math.max(0, at - 40), at + canary.length + 40)}...`);
    }
  });

  expect(hits).toEqual([]);
}
