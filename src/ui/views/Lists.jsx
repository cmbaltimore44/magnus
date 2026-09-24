import { useState } from 'react';
import { execFile } from 'node:child_process';
import { C } from '../../lib/theme.js';
import { Box, Text } from 'ink';
import { useAppCtx, useHints, useLoader, useViewInput } from '../context.js';
import * as listsApi from '../../lib/data/lists.js';
import { isMissingSchema } from '../../lib/data/logs.js';
import { deleteWithUndo } from '../../lib/undo.js';
import { getPref, setPref } from '../../lib/prefs.js';
import { Prompt, Confirm } from '../components/Prompt.jsx';
import { Form } from '../components/Form.jsx';
import { moveIndex, swapped, windowRange } from '../components/layout.js';
import { truncate } from '../../lib/display.js';

// Lists (groceries, wish list, …): lists on the left, the open list's items
// on the right (on narrow windows, enter opens a list and esc goes back).
// Unchecked items first in your order, then the checked ones, dimmed.
const LIST_HINTS = '↑↓ list · enter open · n new list · e rename · d delete · K/J reorder · esc home';
const ITEM_HINTS = '↑↓ item · space check · n add · e edit · d delete · c clear checked · o open link · K/J reorder · esc back';

const money = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, '')}`;

export function Lists() {
  const { userId, navigate, notify, offerUndo, columns, contentHeight } = useAppCtx();
  const [listIndex, setListIndex] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);
  const [focus, setFocus] = useState('lists');
  const [mode, setMode] = useState(null); // newList | rename | add | edit | confirm
  useHints(mode ? null : focus === 'lists' ? LIST_HINTS : ITEM_HINTS);

  const { data, setData, reload } = useLoader(async () => {
    try {
      const [lists, items] = await Promise.all([listsApi.listLists(), listsApi.listAllItems()]);
      return { lists, items, missing: false };
    } catch (err) {
      if (isMissingSchema(err)) return { lists: [], items: [], missing: true };
      throw err;
    }
  });

  // Reopen the list you had open last time (per device).
  const [restored, setRestored] = useState(false);
  if (data && !restored) {
    setRestored(true);
    const i = data.lists.findIndex((l) => l.id === getPref('lists.open', null));
    if (i >= 0) setListIndex(i);
  }

  const lists = data?.lists || [];
  const list = lists[Math.min(listIndex, lists.length - 1)];
  const all = list ? data.items.filter((i) => i.list_id === list.id) : [];
  const open = all.filter((i) => !i.done).sort((a, b) => a.sort_order - b.sort_order);
  const checked = all.filter((i) => i.done).sort((a, b) => a.sort_order - b.sort_order);
  const items = [...open, ...checked];
  const item = items[Math.min(itemIndex, items.length - 1)];
  const wide = columns >= 90;

  const patchItems = (fn) => setData((d) => ({ ...d, items: fn(d.items) }));
  const run = async (fn) => {
    try {
      await fn();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const openList = (i) => {
    setListIndex(i);
    setItemIndex(0);
    if (lists[i]) setPref('lists.open', lists[i].id);
  };

  const addItem = (text) =>
    run(async () => {
      const t = text.trim();
      if (!t) return setMode(null);
      const next = all.reduce((m, i) => Math.max(m, i.sort_order + 1), 0);
      const created = await listsApi.createItem(userId, list.id, t, next);
      patchItems((its) => [...its, created]);
      setMode({ type: 'add', key: Date.now() }); // stay open for the next item
    });

  const toggle = (it) =>
    run(async () => {
      patchItems((its) => its.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)));
      await listsApi.updateItem(it.id, { done: !it.done });
    });

  const saveItem = async (fields) => {
    const price = fields.price == null || fields.price === '' ? null : Number(String(fields.price).replace(/[$,\s]/g, ''));
    if (price != null && (!Number.isFinite(price) || price < 0)) throw new Error('Price: a number, e.g. 24.99');
    const updated = await listsApi.updateItem(mode.item.id, { text: fields.text, url: listsApi.cleanUrl(fields.url), price });
    patchItems((its) => its.map((x) => (x.id === updated.id ? updated : x)));
    setMode(null);
  };

  const removeItem = (it) =>
    run(async () => {
      const restore = await deleteWithUndo('list_items', it.id);
      patchItems((its) => its.filter((x) => x.id !== it.id));
      offerUndo(`Deleted “${it.text}”`, restore);
    });

  const clearChecked = () =>
    run(async () => {
      if (!checked.length) return notify('Nothing checked', 'info');
      const restores = [];
      for (const it of checked) restores.push(await deleteWithUndo('list_items', it.id));
      const ids = new Set(checked.map((c) => c.id));
      patchItems((its) => its.filter((x) => !ids.has(x.id)));
      setItemIndex(0);
      offerUndo(`Cleared ${checked.length} checked`, () => Promise.all(restores.map((r) => r())));
    });

  const reorderItems = (delta) =>
    run(async () => {
      if (!item || item.done) return;
      const i = open.indexOf(item);
      const next = swapped(open, i, delta);
      if (!next) return;
      const orders = new Map(next.map((x, k) => [x.id, k]));
      patchItems((its) => its.map((x) => (orders.has(x.id) ? { ...x, sort_order: orders.get(x.id) } : x)));
      setItemIndex(i + delta);
      await listsApi.reorder('list_items', next.map((x) => x.id));
    });

  const reorderLists = (delta) =>
    run(async () => {
      const next = swapped(lists, listIndex, delta);
      if (!next) return;
      setData((d) => ({ ...d, lists: next.map((l, k) => ({ ...l, sort_order: k })) }));
      setListIndex(listIndex + delta);
      await listsApi.reorder('lists', next.map((l) => l.id));
    });

  const openLink = (it) => {
    if (!it?.url) return notify('This item has no link', 'info');
    try {
      execFile('open', [listsApi.cleanUrl(it.url)]);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  useViewInput(
    (input, key) => {
      if (!data || data.missing) return key.escape ? navigate('home') : undefined;
      if (focus === 'lists') {
        if (key.escape) return navigate('home');
        if (key.upArrow || input === 'k') return openList(moveIndex(listIndex, -1, lists.length));
        if (key.downArrow || input === 'j') return openList(moveIndex(listIndex, 1, lists.length));
        if (input === 'n') return setMode({ type: 'newList' });
        if (!list) return;
        if (key.return || key.rightArrow || input === 'l') return setFocus('items');
        if (input === 'e') return setMode({ type: 'rename' });
        if (input === 'd') return setMode({ type: 'confirm' });
        if (input === 'K') return reorderLists(-1);
        if (input === 'J') return reorderLists(1);
        return;
      }
      if (key.escape || key.leftArrow || input === 'h') return setFocus('lists');
      if (key.upArrow || input === 'k') return setItemIndex((i) => moveIndex(i, -1, items.length));
      if (key.downArrow || input === 'j') return setItemIndex((i) => moveIndex(i, 1, items.length));
      if (input === 'n') return setMode({ type: 'add', key: 0 });
      if (input === 'c') return clearChecked();
      if (!item) return;
      if (input === ' ') return toggle(item);
      if (input === 'e' || key.return) return setMode({ type: 'edit', item });
      if (input === 'd') return removeItem(item);
      if (input === 'o') return openLink(item);
      if (input === 'K') return reorderItems(-1);
      if (input === 'J') return reorderItems(1);
    },
    mode === null
  );

  if (!data) return <Text color={C.muted}>Loading…</Text>;
  if (data.missing) {
    return (
      <Box flexDirection="column">
        <Text bold>Lists</Text>
        <Text color={C.soon}>Lists need the new tables: run supabase/schema_004.sql in the Supabase SQL editor.</Text>
      </Box>
    );
  }

  if (mode?.type === 'edit') {
    return (
      <Form
        title="Edit Item"
        fields={[
          { key: 'text', label: 'Item', type: 'text', required: true },
          { key: 'url', label: 'Link', type: 'text' },
          { key: 'price', label: 'Price', type: 'text' },
        ]}
        initial={{ ...mode.item, price: mode.item.price == null ? '' : String(Number(mode.item.price)) }}
        onSubmit={saveItem}
        onCancel={() => setMode(null)}
      />
    );
  }

  const countOpen = (l) => data.items.filter((i) => i.list_id === l.id && !i.done).length;
  const listWidth = wide ? Math.min(30, Math.max(16, ...lists.map((l) => l.name.length + 8))) : columns - 4;
  const itemWidth = wide ? columns - 4 - listWidth - 3 : columns - 4;
  const total = open.filter((i) => i.price != null).reduce((n, i) => n + Number(i.price), 0);
  const hasPrices = open.some((i) => i.price != null);
  const promptRows = mode ? 4 : 0;

  const listPane = (
    <Box flexDirection="column" width={listWidth} flexShrink={0}>
      {lists.length === 0 ? <Text color={C.muted}>No lists yet — press n to make one (Groceries, Wish list…).</Text> : null}
      {lists.map((l, i) => {
        const sel = i === Math.min(listIndex, lists.length - 1);
        const active = sel && focus === 'lists';
        return (
          <Text key={l.id} wrap="truncate-end">
            <Text color={C.accent}>{active ? '› ' : sel ? '· ' : '  '}</Text>
            <Text bold={sel} inverse={active} color={sel && !active ? C.accent : undefined}>
              {truncate(l.name, listWidth - 8)}
            </Text>
            <Text color={C.muted}> {countOpen(l)}</Text>
          </Text>
        );
      })}
    </Box>
  );

  // Items: unchecked, then a "Checked" header and the checked ones.
  const lines = [...open.map((it) => ({ it })), ...(checked.length ? [{ header: `Checked ${checked.length}` }] : []), ...checked.map((it) => ({ it }))];
  const selLine = lines.findIndex((l) => l.it && l.it === item);
  const [start, end] = windowRange(lines.length, Math.max(0, selLine), Math.max(3, contentHeight - 3 - promptRows));
  const itemPane = list ? (
    <Box flexDirection="column" flexGrow={1}>
      <Text bold wrap="truncate-end">
        {list.name} <Text color={C.muted}>{open.length} to go{hasPrices ? ` · ${money(total)}` : ''}</Text>
      </Text>
      {items.length === 0 ? <Text color={C.muted}>Empty — press n to add items.</Text> : null}
      {lines.slice(start, end).map((line, k) => {
        if (line.header) {
          return (
            <Text key="hdr" color={C.muted} bold>
              {line.header}
            </Text>
          );
        }
        const it = line.it;
        const active = it === item && focus === 'items';
        const tail = `${it.url ? ' ↗' : ''}${it.price != null ? `  ${money(it.price)}` : ''}`;
        return (
          <Text key={it.id} wrap="truncate-end" color={it.done ? C.muted : undefined}>
            <Text color={C.accent}>{active ? '› ' : '  '}</Text>
            <Text color={it.done ? C.success : undefined}>{it.done ? '[✓]' : '[ ]'}</Text>{' '}
            <Text inverse={active} strikethrough={it.done && !active}>
              {truncate(it.text, Math.max(8, itemWidth - 8 - tail.length))}
            </Text>
            <Text color={C.muted}>{tail}</Text>
          </Text>
        );
      })}
    </Box>
  ) : null;

  const prompt =
    mode?.type === 'newList' ? (
      <Prompt
        label="New list:"
        placeholder="Groceries"
        onSubmit={(v) =>
          run(async () => {
            setMode(null);
            if (!v.trim()) return;
            const created = await listsApi.createList(userId, v.trim(), lists.length);
            setData((d) => ({ ...d, lists: [...d.lists, created] }));
            openList(lists.length);
          })
        }
        onCancel={() => setMode(null)}
      />
    ) : mode?.type === 'rename' ? (
      <Prompt
        label="Rename list:"
        initial={list.name}
        onSubmit={(v) =>
          run(async () => {
            setMode(null);
            if (!v.trim()) return;
            const updated = await listsApi.renameList(list.id, v.trim());
            setData((d) => ({ ...d, lists: d.lists.map((l) => (l.id === updated.id ? updated : l)) }));
          })
        }
        onCancel={() => setMode(null)}
      />
    ) : mode?.type === 'add' ? (
      <Prompt key={mode.key} label={`Add to ${list.name}:`} hint="enter adds and stays open for the next one · esc done" onSubmit={addItem} onCancel={() => setMode(null)} />
    ) : mode?.type === 'confirm' ? (
      <Confirm
        message={`Delete “${list.name}” and its ${all.length} item${all.length === 1 ? '' : 's'}? (u undoes it)`}
        onYes={() =>
          run(async () => {
            setMode(null);
            const restore = await deleteWithUndo('lists', list.id);
            setData((d) => ({ ...d, lists: d.lists.filter((l) => l.id !== list.id), items: d.items.filter((i) => i.list_id !== list.id) }));
            setListIndex((i) => Math.max(0, Math.min(i, lists.length - 2)));
            offerUndo(`Deleted “${list.name}”`, restore);
          })
        }
        onNo={() => setMode(null)}
      />
    ) : null;

  return (
    <Box flexDirection="column" height={contentHeight} overflow="hidden">
      {!wide && focus === 'items' ? null : <Text bold>Lists</Text>}
      <Box flexDirection="row" marginTop={!wide && focus === 'items' ? 0 : 1} flexGrow={1} overflow="hidden">
        {wide || focus === 'lists' ? listPane : null}
        {wide ? <Box width={3} flexShrink={0} /> : null}
        {wide || focus === 'items' ? itemPane : null}
      </Box>
      {prompt}
    </Box>
  );
}
