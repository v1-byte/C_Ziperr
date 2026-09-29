#!/usr/bin/env node
import { createJobRepository } from '../core/jobs/sqlite.mjs';
const db = process.env.CZIPERR_JOBS_DB || '.c-ziperr/jobs.sqlite';
const repo = createJobRepository(db);
const [command = 'list', id] = process.argv.slice(2);
try {
  if (command === 'list') console.log(JSON.stringify(repo.list(), null, 2));
  else if (command === 'show' && id) console.log(JSON.stringify({ job: repo.get(id), events: repo.events(id), artifacts: repo.artifacts(id) }, null, 2));
  else if (command === 'resume' && id) console.log(JSON.stringify(repo.resume(id), null, 2));
  else { console.error('Usage: npm run jobs -- [list|show <id>|resume <id>]'); process.exitCode = 2; }
} finally { repo.close(); }
