import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLine } from './digest/read.js';
import type { RigConfig } from './config.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightSummary[];
};

export type NightSummary = { night: string; ok: number; retry: number; fail: number };

// Counts of parsed run lines by status. Lines that do not parse are not counted.
export function countLines(text: string): Omit<NightSummary, 'night'> {
  const c = { ok: 0, retry: 0, fail: 0 };
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const l = parseLine(raw);
    if (l) c[l.status]++;
  }
  return c;
}

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): NightSummary[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse()
      .map((night) => {
        let text = '';
        try {
          text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
        } catch {
          // unreadable file: counts stay 0
        }
        return { night, ...countLines(text) };
      });
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir),
  };
}
