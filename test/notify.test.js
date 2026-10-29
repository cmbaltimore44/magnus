// `magnus notify` helpers: time parsing, the ntfy topic, the Mac receiver.
import './_demo.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTime, newTopic, listenerScript, launchAgentPlist, curlConfig } from '../src/notifyCommand.js';

test('parseTime reads 24-hour and am/pm times', () => {
  assert.equal(parseTime('8', '00:00'), '08:00');
  assert.equal(parseTime('7:30am', '00:00'), '07:30');
  assert.equal(parseTime('10pm', '00:00'), '22:00');
  assert.equal(parseTime('12am', '00:00'), '00:00');
  assert.equal(parseTime('12:15 pm', '00:00'), '12:15');
  assert.equal(parseTime('', '08:00'), '08:00');
  assert.throws(() => parseTime('25:00', '08:00'));
  assert.throws(() => parseTime('soon', '08:00'));
});

test('new topics are long, random and fit the schema check', () => {
  const a = newTopic();
  assert.match(a, /^[A-Za-z0-9_-]{24,64}$/);
  assert.notEqual(a, newTopic());
});

test('the receiver reads its topic from a private curl config, and passes text as arguments', () => {
  const s = listenerScript('/x/notify-curl.conf');
  assert.match(s, /curl -sfN -K "\/x\/notify-curl\.conf"/);
  assert.doesNotMatch(s, /ntfy\.sh\/magnus/, 'no topic in the script or on the command line');
  assert.equal(curlConfig('magnus-abc'), 'url = "https://ntfy.sh/magnus-abc/json"\n');
  assert.match(s, /-- "\$title" "\$msg"/);
  assert.match(launchAgentPlist(), /<key>KeepAlive<\/key><true\/>/);
});

test('magnus day close / open mark the day in assistant_days', async () => {
  const { runDay, notifyDay } = await import('../src/dayCommand.js');
  const { supabase } = await import('../src/lib/supabase.js');
  const user = '00000000-0000-4000-8000-000000000000';
  const said = [];
  const out = (t) => said.push(t);
  {
    await runDay(['close'], { userId: user, out });
    const day = await notifyDay(user);
    let row = (await supabase.from('assistant_days').select('*').eq('user_id', user).eq('day', day).maybeSingle()).data;
    assert.ok(row.closed_at);
    await runDay(['open'], { userId: user, out });
    row = (await supabase.from('assistant_days').select('*').eq('user_id', user).eq('day', day).maybeSingle()).data;
    assert.equal(row.closed_at, null);
    const rows = (await supabase.from('assistant_days').select('*')).data;
    assert.equal(rows.length, 1, 'upsert updates the same row');
    assert.match(said[0], /no close-the-day nudge tonight/);
  }
});

test('the day follows the notification time zone', async () => {
  const { notifyDay } = await import('../src/dayCommand.js');
  const { supabase } = await import('../src/lib/supabase.js');
  const user = '00000000-0000-4000-8000-000000000000';
  await supabase.from('assistant_settings').upsert({ user_id: user, ntfy_topic: 'magnus-xxxxxxxxxxxxxxxxxxxxxxxx', timezone: 'Pacific/Kiritimati' });
  // 2026-10-29 20:00 UTC is already Oct 30 in Kiritimati (UTC+14).
  assert.equal(await notifyDay(user, new Date('2026-10-29T20:00:00Z')), '2026-10-30');
});

test('the planning reminder reads a day and a time, or off', async () => {
  const { parsePlanReminder } = await import('../src/notifyCommand.js');
  assert.deepEqual(parsePlanReminder('Sun 18:00'), { plan_day: 0, plan_time: '18:00' });
  assert.deepEqual(parsePlanReminder('sunday 6pm'), { plan_day: 0, plan_time: '18:00' });
  assert.deepEqual(parsePlanReminder('fri 4:30pm'), { plan_day: 5, plan_time: '16:30' });
  assert.deepEqual(parsePlanReminder('off'), { plan_day: null, plan_time: null });
  assert.throws(() => parsePlanReminder('someday'));
});
