#!/usr/bin/env node
// Turns this project's Claude Code session logs into readable Markdown in ai-history/.
//   node scripts/export-ai-history.mjs
//
// Keeps: your prompts, Claude's replies, one line per tool call (what it ran or edited),
// and failed tool calls in full (those are where the AI was wrong and got corrected).
// Drops: model "thinking", injected system/skill text, successful tool output (that's
// what the git history shows). Redacts: emails and the home directory.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const LOGS = join(homedir(), '.claude/projects', ROOT.replace(/[^a-zA-Z0-9]/g, '-'));
const OUT = join(ROOT, 'ai-history');

// Session id prefix → file name and title, in the order they happened.
const SESSIONS = [
  ['834c5e69', '01-design-brainstorm', 'Design brainstorm: the brief, the product idea, the plan'],
  ['ad719865', '02-scaffold-and-ui', 'Scaffold, then the UI on a mock API'],
  ['456b5591', '03-ui-review-backend-and-wiring', 'UI review rounds, the backend, wiring the UI to it'],
];

const HOME = homedir();
const USER_SLUG = HOME.replace(/[^a-zA-Z0-9]/g, '-'); // how ~ appears inside ~/.claude/projects names
const redact = (s) =>
  s
    .replaceAll(HOME, '~')
    .replaceAll(USER_SLUG, '-~')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (m) => (m.endsWith('anthropic.com') ? m : '[email]'))
    .replace(REPLY_PHRASES, '[phrase from the private reply]');

/**
 * Private messages pasted into a prompt, published as a summary instead of verbatim. The
 * transcripts are otherwise faithful; ai-history/README.md says what was replaced.
 */
const PARAPHRASED = [
  [
    /Their answ\w*\s*\n\s*On AI:[\s\S]*?go for what appeals to you for style points\./,
    "*[The company's reply, paraphrased: use AI the way you would on the job. They grade the " +
      'judgement around it (what you used it for, what you did not trust it with, where it was wrong ' +
      'and how you caught it), not hand-written vs. generated code, and including the AI transcript ' +
      "is welcome. On focus: the brief's \"What We'll Look For\" list is in priority order (domain " +
      'model, migration and SQL first, then the API contract, then how the two halves fit); scale and ' +
      'breadth are not scored, and anything beyond that is style points.]*',
  ],
];

/** Phrases from that reply, wherever they turn up later (e.g. as search terms in a command). */
const REPLY_PHRASES = /We are grading the judgement|Another thing applicants|Use it the way you would on the job/g;

/** Strips harness-injected blocks from a user message; returns '' if nothing human is left. */
function humanText(text) {
  if (text.startsWith('Base directory for this skill:')) {
    const name = text.match(/skills\/([^/\s]+)/)?.[1] ?? 'a skill';
    return `*[skill instructions loaded: ${name}]*`;
  }
  for (const [pattern, summary] of PARAPHRASED) text = text.replace(pattern, summary);
  return text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/<(ide_selection|ide_opened_file|command-[a-z]+|local-command-[a-z]+)>[\s\S]*?<\/\1>/g, '')
    .trim();
}

function toolLine(b) {
  const i = b.input ?? {};
  const one = (s) => redact(String(s).split('\n')[0]).slice(0, 160);
  if (b.name === 'Bash') return `\`Bash\` ${i.description ? `— ${i.description}` : ''}\n  \`$ ${one(i.command ?? '')}\``;
  if (['Write', 'Edit', 'Read'].includes(b.name)) return `\`${b.name}\` ${redact(String(i.file_path ?? '').replace(ROOT + '/', ''))}`;
  if (b.name === 'Skill') return `\`Skill\` ${i.skill}`;
  if (b.name === 'AskUserQuestion') {
    return `\`AskUserQuestion\`\n${(i.questions ?? []).map((q) => `  - ${q.question} (${q.options.map((o) => o.label).join(' / ')})`).join('\n')}`;
  }
  return `\`${b.name}\` ${one(JSON.stringify(i)).slice(0, 120)}`;
}

function resultText(c) {
  const text = typeof c === 'string' ? c : (c ?? []).map((x) => x.text ?? '').join('\n');
  return redact(text).slice(0, 900);
}

function render(file, title) {
  const rows = readFileSync(join(LOGS, file), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const out = [`# ${title}`, ''];
  const first = rows.find((r) => r.timestamp)?.timestamp;
  if (first) out.push(`*Session started ${first.slice(0, 16).replace('T', ' ')} UTC.*`, '');
  let lastRole = '';

  for (const r of rows) {
    if (r.isSidechain || r.isMeta || !r.message) continue;
    const { role, content } = r.message;
    const blocks = typeof content === 'string' ? [{ type: 'text', text: content }] : (content ?? []);

    for (const b of blocks) {
      if (role === 'user' && b.type === 'text') {
        const t = humanText(b.text);
        if (!t || t.startsWith('[Request interrupted')) {
          if (t) out.push(`> *${t}*`, '');
          continue;
        }
        out.push('---', '', '## 🧑 Prompt', '', redact(t), '');
        lastRole = 'user';
      } else if (role === 'assistant' && b.type === 'text' && b.text.trim()) {
        if (lastRole !== 'assistant') out.push('### 🤖 Claude', '');
        out.push(redact(b.text.trim()), '');
        lastRole = 'assistant';
      } else if (role === 'assistant' && b.type === 'tool_use') {
        if (lastRole !== 'assistant') out.push('### 🤖 Claude', '');
        out.push(`- ${toolLine(b)}`);
        lastRole = 'assistant';
      } else if (role === 'user' && b.type === 'tool_result' && b.is_error) {
        out.push('', `  > ⚠️ tool error: ${resultText(b.content).replace(/\n/g, '\n  > ')}`, '');
      }
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

const files = readdirSync(LOGS).filter((f) => f.endsWith('.jsonl'));
for (const [prefix, name, title] of SESSIONS) {
  const file = files.find((f) => f.startsWith(prefix));
  if (!file) {
    console.warn(`no log for ${name} (${prefix})`);
    continue;
  }
  const md = render(file, title);
  writeFileSync(join(OUT, `${name}.md`), md);
  console.log(`${name}.md  ${(md.length / 1024).toFixed(0)} KB`);
}
