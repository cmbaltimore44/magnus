// `magnus notify`: the morning brief, close-the-day nudge and planning
// reminder. Supabase sends them (schema_007: pg_cron → ntfy.sh), so the phone
// gets them while the Mac sleeps; the Mac shows them through a small launchd
// agent (curl streaming the topic → osascript), installed only if you say so.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { supabase } from './lib/supabase.js';
import { unwrap } from './lib/data/_unwrap.js';
import { isMissingSchema } from './lib/data/logs.js';

export const NOTIFY_HELP = `magnus notify — morning brief, close-the-day nudge, planning reminder

  magnus notify setup    times, a private ntfy topic for your phone, the Mac receiver
  magnus notify test     send a test notification now
  magnus notify status   what's set up and what was sent today
  magnus notify off      stop all notifications (setup turns them back on)
`;

const LABEL = 'com.magnus.notify';
const CONFIG = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'magnus');
const SCRIPT = path.join(CONFIG, 'notify-listen.sh');
// The topic is a bearer secret: it lives in a curl config file only you can
// read, never in curl's command line (which other accounts can see with ps).
const CURL_CONFIG = path.join(CONFIG, 'notify-curl.conf');
const PLIST = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);

export function newTopic() {
  return `magnus-${randomBytes(24).toString('base64url')}`;
}

export function parseTime(raw, fallback) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return fallback;
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(s);
  if (!m) throw new Error(`can't read "${raw}" as a time (try 8:00, 7:30am, 22:00)`);
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) throw new Error(`"${raw}" isn't a time of day`);
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

const hm = (t) => String(t || '').slice(0, 5);
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// "sun 6pm", "Sunday 18:00", "off" → { plan_day, plan_time } (plan_day null = off).
export function parsePlanReminder(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (/^(off|no|none|never)$/.test(s)) return { plan_day: null, plan_time: null };
  const m = /^([a-z]+)\s+(.+)$/.exec(s);
  const dayIdx = m ? DAY_KEYS.findIndex((d) => m[1].startsWith(d)) : -1;
  if (dayIdx < 0) throw new Error(`can't read "${raw}" (try "sun 6pm", "Sunday 18:00" or "off")`);
  return { plan_day: dayIdx, plan_time: parseTime(m[2], '18:00') };
}

const planLabel = (s) => (s?.plan_day == null ? 'off' : `${DAY_KEYS[s.plan_day][0].toUpperCase()}${DAY_KEYS[s.plan_day].slice(1)} ${hm(s.plan_time)}`);

// curl -K config: the topic's stream URL.
export function curlConfig(topic) {
  return `url = "https://ntfy.sh/${topic}/json"\n`;
}

// The receiver: one curl stream, a notification per message. Runs under launchd.
export function listenerScript(configPath = CURL_CONFIG) {
  return `#!/bin/zsh
# Magnus notifications on this Mac: streams your ntfy topic (its URL is in
# ${configPath}) and shows each message as a macOS notification. Run by launchd
# (${LABEL}); written by \`magnus notify setup\`. If the stream drops, launchd
# starts it again.
curl -sfN -K "${configPath}" | while IFS= read -r line; do
  [[ "$(print -r -- "$line" | plutil -extract event raw -o - - 2>/dev/null)" == message ]] || continue
  title="$(print -r -- "$line" | plutil -extract title raw -o - - 2>/dev/null || echo Magnus)"
  msg="$(print -r -- "$line" | plutil -extract message raw -o - - 2>/dev/null)"
  osascript -e 'on run argv' -e 'display notification (item 2 of argv) with title (item 1 of argv)' -e 'end run' -- "$title" "$msg"
done
`;
}

export function launchAgentPlist() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>${SCRIPT}</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>ProcessType</key><string>Background</string>
  <key>LowPriorityIO</key><true/>
</dict>
</plist>
`;
}

function launchctl(args) {
  try {
    execFileSync('launchctl', args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const domain = () => `gui/${process.getuid()}`;
export function receiverRunning() {
  return launchctl(['print', `${domain()}/${LABEL}`]);
}

function installReceiver(topic) {
  fs.mkdirSync(CONFIG, { recursive: true });
  fs.writeFileSync(CURL_CONFIG, curlConfig(topic), { mode: 0o600 });
  fs.chmodSync(CURL_CONFIG, 0o600); // an existing file keeps its old mode otherwise
  fs.writeFileSync(SCRIPT, listenerScript(), { mode: 0o700 });
  fs.chmodSync(SCRIPT, 0o700);
  fs.mkdirSync(path.dirname(PLIST), { recursive: true });
  fs.writeFileSync(PLIST, launchAgentPlist());
  launchctl(['bootout', `${domain()}/${LABEL}`]);
  // Right after a bootout, bootstrap can briefly fail ("Input/output error"): retry.
  for (let i = 0; ; i++) {
    if (launchctl(['bootstrap', domain(), PLIST])) return;
    if (i >= 5) throw new Error(`launchctl couldn't load ${PLIST}`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400);
  }
}

function removeReceiver() {
  launchctl(['bootout', `${domain()}/${LABEL}`]);
  fs.rmSync(PLIST, { force: true });
  fs.rmSync(SCRIPT, { force: true });
  fs.rmSync(CURL_CONFIG, { force: true });
}

async function loadSettings(userId) {
  try {
    return unwrap(await supabase.from('assistant_settings').select('*').eq('user_id', userId).maybeSingle());
  } catch (err) {
    if (isMissingSchema(err)) throw new Error('notifications need supabase/schema_007.sql (Magnus Web repo) to be run first');
    throw err;
  }
}

async function publish(topic, title, message) {
  const r = await fetch('https://ntfy.sh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ topic, title, message, tags: ['bell'] }),
  });
  if (!r.ok) throw new Error(`ntfy.sh answered ${r.status}`);
}

export async function runNotify(args, { userId }) {
  const [cmd] = args;
  if (!cmd || cmd === '--help' || cmd === 'help') {
    process.stdout.write(NOTIFY_HELP);
    return 0;
  }
  const out = (s) => process.stdout.write(s);

  if (cmd === 'status') {
    const s = await loadSettings(userId);
    if (!s) {
      out('Not set up yet: run magnus notify setup\n');
      return 0;
    }
    out(`${s.enabled ? 'On' : 'Off'} · ${s.timezone}\n`);
    out(`  Morning brief   ${hm(s.brief_time)} (${s.push_detail === 'full' ? 'full brief' : 'counts only'})\n`);
    out(`  Close the day   ${s.nudge_enabled ? hm(s.nudge_time) : 'off'}\n`);
    out(`  Plan your week  ${planLabel(s)}\n`);
    out(`  Mac receiver    ${receiverRunning() ? 'running' : 'not installed'}\n`);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: s.timezone });
    const d = unwrap(await supabase.from('assistant_days').select('*').eq('user_id', userId).eq('day', today).maybeSingle());
    const when = (t) => (t ? new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '—');
    out(`  Today           brief ${when(d?.brief_sent_at)} · nudge ${when(d?.nudge_sent_at)} · closed ${when(d?.closed_at)}\n`);
    out(`  Phone           subscribe to https://ntfy.sh/${s.ntfy_topic} in the ntfy app\n`);
    return 0;
  }

  if (cmd === 'test') {
    const s = await loadSettings(userId);
    if (!s) throw new Error('not set up yet: run magnus notify setup');
    await publish(s.ntfy_topic, 'Magnus', 'Test notification: phone and Mac are both listening.');
    out('Sent. It should show up on your phone (ntfy app) and, if the receiver is installed, on this Mac.\n');
    return 0;
  }

  if (cmd === 'off') {
    const s = await loadSettings(userId);
    if (s) unwrap(await supabase.from('assistant_settings').update({ enabled: false, updated_at: new Date().toISOString() }).eq('user_id', userId));
    const had = fs.existsSync(PLIST);
    removeReceiver();
    out(`Notifications off${had ? '; Mac receiver removed' : ''}. magnus notify setup turns them back on.\n`);
    return 0;
  }

  if (cmd === 'setup') {
    if (!process.stdin.isTTY) throw new Error('magnus notify setup asks a few questions: run it in a terminal');
    const existing = await loadSettings(userId);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      const ask = async (q, def) => (await rl.question(`${q} [${def}] `)).trim() || def;
      const brief = parseTime(await ask('Morning brief at', hm(existing?.brief_time) || '08:00'), '08:00');
      const nudgeRaw = await ask('Close-the-day nudge at (or "off")', existing && !existing.nudge_enabled ? 'off' : hm(existing?.nudge_time) || '22:00');
      const nudgeOff = /^off$/i.test(nudgeRaw);
      const detail = (await ask('Brief on the lock screen: full or counts', existing?.push_detail || 'full')).toLowerCase().startsWith('c') ? 'counts' : 'full';
      // Suggested: what's set now, else Sunday 6 pm.
      const planDefault = existing?.plan_day != null ? planLabel(existing) : 'Sun 18:00';
      const planReminder = parsePlanReminder(await ask('"Plan your week" reminder: day and time, or off', planDefault));
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const topic = existing?.ntfy_topic || newTopic(); // keep the topic so the phone stays subscribed
      const row = {
        user_id: userId,
        enabled: true,
        ntfy_topic: topic,
        timezone,
        brief_time: brief,
        nudge_enabled: !nudgeOff,
        nudge_time: nudgeOff ? existing?.nudge_time || '22:00' : parseTime(nudgeRaw, '22:00'),
        push_detail: detail,
        plan_day: planReminder.plan_day,
        ...(planReminder.plan_time ? { plan_time: planReminder.plan_time } : {}),
        updated_at: new Date().toISOString(),
      };
      unwrap(await supabase.from('assistant_settings').upsert(row).select().single());
      out(`\nSaved: brief ${brief}, nudge ${nudgeOff ? 'off' : row.nudge_time}, planning reminder ${planLabel(row)}, ${timezone}.\n\n`);
      out('On your iPhone: install "ntfy" from the App Store, tap +, and subscribe to this topic\n');
      out(`(server ntfy.sh; keep the name private, it works like a password):\n\n    ${topic}\n\n`);
      const mac = await ask('Show them on this Mac too (installs a small launchd agent)? y/n', receiverRunning() ? 'y' : 'n');
      if (/^y/i.test(mac)) {
        installReceiver(topic);
        out(`Mac receiver running (${PLIST}). magnus notify off removes it.\n`);
      }
      out('Try it: magnus notify test\n');
    } finally {
      rl.close();
    }
    return 0;
  }
  throw new Error(`unknown notify command "${cmd}" (see magnus notify --help)`);
}
