import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error === undefined ? {} : { error }) });

const NORMAL =
  [
    line('2026-03-01T01:00:00+01:00', 'zeta-sync', 'ok', 'ana'),
    line('2026-03-01T01:05:00+01:00', 'alpha-backup', 'retry', null, 'timeout'),
    line('2026-03-01T01:06:00+01:00', 'alpha-backup', 'retry', null),
    line('2026-03-01T01:07:00+01:00', 'alpha-backup', 'retry', null),
    line('2026-03-01T01:08:00+01:00', 'alpha-backup', 'ok', null),
    line('2026-03-01T02:00:00+01:00', 'mid-report', 'fail', 'bo', 'disk full'),
  ].join('\n') + '\n';

const BAD =
  [
    line('2026-03-03T01:00:00+01:00', 'beta-job', 'ok', 'cy'),
    'this is not json',
    line('2026-03-03T01:10:00+01:00', 'aaa-job', 'ok', 'di'),
  ].join('\n') + '\n';

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  writeFileSync(join(dir, '2026-03-01.jsonl'), NORMAL);
  writeFileSync(join(dir, '2026-03-02.jsonl'), '');
  writeFileSync(join(dir, '2026-03-03.jsonl'), BAD);
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir: dir,
  });
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

// Job names from the page, in order: the first cell of each table row.
function pageJobs(html: string): string[] {
  const jobs: string[] = [];
  for (const m of html.matchAll(/<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>/g)) {
    jobs.push((m[1] ?? '').replace(/<[^>]*>/g, '').trim());
  }
  return jobs;
}

async function getJson(night: string): Promise<{ status: number; body: Night }> {
  const res = await app.request(`/api/digest/${night}`);
  return { status: res.status, body: (await res.json()) as Night };
}

describe('GET /digest/:night', () => {
  it('renders 200 with one table, rows sorted by job, and — for missing values', async () => {
    const res = await app.request('/digest/2026-03-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html.match(/<table/g)).toHaveLength(1);
    expect(pageJobs(html)).toEqual(['alpha-backup', 'mid-report', 'zeta-sync']);
    expect(html).toContain('—');
  });

  it('marks retries >= 3 and fail with class warn', async () => {
    const html = await (await app.request('/digest/2026-03-01')).text();
    expect(html).toContain('warn');
  });

  it('returns 404 for a night with no file', async () => {
    const res = await app.request('/digest/2026-03-09');
    expect(res.status).toBe(404);
  });

  it('says "nothing ran" for the empty night', async () => {
    const res = await app.request('/digest/2026-03-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders 200 with the good rows when a line is bad', async () => {
    const res = await app.request('/digest/2026-03-03');
    expect(res.status).toBe(200);
    expect(pageJobs(await res.text())).toEqual(['aaa-job', 'beta-job']);
  });
});

describe('GET /api/digest/:night', () => {
  it('returns 200 JSON { night, rows, badLines }', async () => {
    const { status, body } = await getJson('2026-03-01');
    expect(status).toBe(200);
    expect(body.night).toBe('2026-03-01');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha-backup', 'mid-report', 'zeta-sync']);
  });

  it('returns 404 for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-03-09');
    expect(res.status).toBe(404);
  });

  it('returns rows [] for the empty night', async () => {
    const { status, body } = await getJson('2026-03-02');
    expect(status).toBe(200);
    expect(body.rows).toEqual([]);
  });

  it('counts the bad line and keeps the good rows', async () => {
    const { status, body } = await getJson('2026-03-03');
    expect(status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['aaa-job', 'beta-job']);
  });
});

describe('page and JSON agree', () => {
  it.each(['2026-03-01', '2026-03-02', '2026-03-03'])('%s lists the same jobs in the same order', async (night) => {
    const html = await (await app.request(`/digest/${night}`)).text();
    const { body } = await getJson(night);
    expect(pageJobs(html)).toEqual(body.rows.map((r) => r.job));
  });
});
