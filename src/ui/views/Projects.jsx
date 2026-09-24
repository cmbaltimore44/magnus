import { useState } from 'react';
import { C } from '../../lib/theme.js';
import { Box, Text } from 'ink';
import { useAppCtx, useHints, useLoader, useViewInput } from '../context.js';
import * as projectsApi from '../../lib/data/projects.js';
import * as projectTasksApi from '../../lib/data/projectTasks.js';
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  DUE_COLORS,
  dueStatus,
  formatDue,
  plural,
  truncate,
} from '../../lib/display.js';
import { Form } from '../components/Form.jsx';
import { Prompt, Confirm } from '../components/Prompt.jsx';
import { windowRange, moveIndex, swapped } from '../components/layout.js';

const LIST_HINTS = '↑↓ move · enter open · n new · s cycle status · d delete · R refresh · esc home';
const DETAIL_HINTS =
  '↑↓ item · space toggle · n add item · d delete item · K/J reorder · e edit project · s cycle status · D delete project · esc back';

function computeTaskCounts(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const counts = map.get(row.project_id) || { total: 0, done: 0 };
    counts.total += 1;
    if (row.done) counts.done += 1;
    map.set(row.project_id, counts);
  });
  return map;
}

function ProgressBar({ done, total, width = 10 }) {
  if (!total) return <Text color={C.muted}>{' '.repeat(width + 6)}</Text>;
  const filled = Math.round((done / total) * width);
  return (
    <Text>
      <Text color={C.success}>{'█'.repeat(filled)}</Text>
      <Text color={C.muted}>{'░'.repeat(width - filled)}</Text>
      <Text color={C.muted}> {`${done}/${total}`.padEnd(5)}</Text>
    </Text>
  );
}

function TargetDate({ project }) {
  if (!project.target_date) return null;
  const status = dueStatus({ due_date: project.target_date, status: project.status });
  return (
    <Text color={status ? C[DUE_COLORS[status]] : C.muted}>
      {status === 'overdue' ? 'Overdue · ' : ''}
      {formatDue(project.target_date)}
    </Text>
  );
}

const projectFields = () => [
  { key: 'name', label: 'Name', type: 'text', required: true },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s], color: C[PROJECT_STATUS_COLORS[s]] })),
  },
  { key: 'target_date', label: 'Target date', type: 'date' },
  { key: 'notes', label: 'Notes', type: 'longtext' },
];

const nextStatus = (s) => PROJECT_STATUSES[(PROJECT_STATUSES.indexOf(s) + 1) % PROJECT_STATUSES.length];

export function Projects({ params }) {
  const { userId, navigate, notify, columns, contentHeight } = useAppCtx();
  const [index, setIndex] = useState(0);
  const [openId, setOpenId] = useState(params?.projectId || null);
  const [mode, setMode] = useState(null);

  const { data, setData, reload } = useLoader(async () => {
    const [projects, taskRows] = await Promise.all([projectsApi.listProjects(), projectTasksApi.listTaskCounts()]);
    return { projects, counts: computeTaskCounts(taskRows) };
  });

  const replaceProject = (updated) =>
    setData((d) => ({ ...d, projects: d.projects.map((p) => (p.id === updated.id ? updated : p)) }));

  const cycleProjectStatus = async (project) => {
    try {
      replaceProject(await projectsApi.updateProject(project.id, { status: nextStatus(project.status) }));
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const create = async (name) => {
    setMode(null);
    if (!name.trim()) return;
    try {
      const created = await projectsApi.createProject(
        userId,
        { name: name.trim(), status: 'not_started' },
        data.projects.length
      );
      setData((d) => ({ ...d, projects: [created, ...d.projects] }));
      setIndex(0);
      setOpenId(created.id);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const remove = async (project) => {
    setMode(null);
    try {
      await projectsApi.deleteProject(project.id);
      setData((d) => ({ ...d, projects: d.projects.filter((p) => p.id !== project.id) }));
      setOpenId(null);
      notify('Project deleted.', 'success');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const projects = data?.projects || [];
  const selected = projects[Math.min(index, projects.length - 1)];

  useHints(openId ? DETAIL_HINTS : LIST_HINTS);

  useViewInput(
    (input, key) => {
      if (!data) return;
      if (key.escape) return navigate('home');
      if (input === 'R') return reload();
      if (key.upArrow || input === 'k') return setIndex((i) => moveIndex(i, -1, projects.length));
      if (key.downArrow || input === 'j') return setIndex((i) => moveIndex(i, 1, projects.length));
      if (input === 'n') return setMode({ type: 'new' });
      if (!selected) return;
      if (key.return) return setOpenId(selected.id);
      if (input === 's') return cycleProjectStatus(selected);
      if (input === 'd') return setMode({ type: 'confirm', project: selected });
    },
    mode === null && !openId
  );

  if (!data) return <Text color={C.muted}>Loading…</Text>;

  if (openId) {
    return (
      <ProjectDetail
        projectId={openId}
        cached={projects.find((p) => p.id === openId)}
        onBack={() => {
          setOpenId(null);
          reload();
        }}
        onUpdated={replaceProject}
        onDelete={remove}
        onCounts={(id, counts) => setData((d) => ({ ...d, counts: new Map(d.counts).set(id, counts) }))}
      />
    );
  }

  const listBudget = contentHeight - 3 - (mode ? 4 : 0);
  const [start, end] = windowRange(projects.length, index, Math.max(3, listBudget));
  const nameWidth = Math.max(12, Math.min(40, columns - 60));

  return (
    <Box flexDirection="column" height={contentHeight}>
      <Text>
        <Text bold>Projects</Text>
        <Text color={C.muted}> · {plural(projects.length, 'project')}</Text>
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {projects.length === 0 ? <Text color={C.muted}>No projects yet — press n to create one.</Text> : null}
        {projects.slice(start, end).map((p, i) => {
          const isSel = start + i === index;
          const counts = data.counts.get(p.id);
          return (
            <Text key={p.id} wrap="truncate-end">
              <Text color={C.accent}>{isSel ? '› ' : '  '}</Text>
              <Text bold={isSel} inverse={isSel}>
                {truncate(p.name, nameWidth).padEnd(nameWidth)}
              </Text>{' '}
              <Text color={C[PROJECT_STATUS_COLORS[p.status]]}>{PROJECT_STATUS_LABELS[p.status].padEnd(12)}</Text>{' '}
              <ProgressBar done={counts?.done || 0} total={counts?.total || 0} /> <TargetDate project={p} />
            </Text>
          );
        })}
      </Box>
      {mode?.type === 'new' ? <Prompt label="New project name:" onSubmit={create} onCancel={() => setMode(null)} /> : null}
      {mode?.type === 'confirm' ? (
        <Confirm
          message={`Delete project “${mode.project.name}” and its checklist?`}
          onYes={() => remove(mode.project)}
          onNo={() => setMode(null)}
        />
      ) : null}
    </Box>
  );
}

function ProjectDetail({ projectId, cached, onBack, onUpdated, onDelete, onCounts }) {
  const { userId, notify, contentHeight } = useAppCtx();
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState(null);

  const { data, setData } = useLoader(async () => {
    const [project, checklist] = await Promise.all([
      cached ? Promise.resolve(cached) : projectsApi.getProject(projectId),
      projectTasksApi.listProjectTasks(projectId),
    ]);
    return { project, checklist };
  });

  const setChecklist = (checklist) => {
    setData((d) => ({ ...d, checklist }));
    onCounts(projectId, { total: checklist.length, done: checklist.filter((c) => c.done).length });
  };

  const setProject = (project) => {
    setData((d) => ({ ...d, project }));
    onUpdated(project);
  };

  const items = data?.checklist || [];
  const item = items[Math.min(index, items.length - 1)];

  const toggleItem = async (it) => {
    setChecklist(items.map((c) => (c.id === it.id ? { ...c, done: !c.done } : c)));
    try {
      await projectTasksApi.updateProjectTask(it.id, { done: !it.done });
    } catch (err) {
      setChecklist(items);
      notify(err.message, 'error');
    }
  };

  const addItem = async (title) => {
    setMode(null);
    if (!title.trim()) return;
    try {
      const created = await projectTasksApi.createProjectTask(userId, projectId, title.trim(), items.length);
      setChecklist([...items, created]);
      setIndex(items.length);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const deleteItem = async (it) => {
    try {
      await projectTasksApi.deleteProjectTask(it.id);
      setChecklist(items.filter((c) => c.id !== it.id));
      notify('Checklist item deleted.', 'success');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const reorder = async (delta) => {
    const next = swapped(items, index, delta);
    if (!next) return;
    setChecklist(next.map((c, i) => ({ ...c, sort_order: i })));
    setIndex(index + delta);
    try {
      await projectTasksApi.reorderProjectTasks(next.map((c) => c.id));
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const cycleStatus = async () => {
    try {
      setProject(await projectsApi.updateProject(projectId, { status: nextStatus(data.project.status) }));
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const saveProject = async (fields) => {
    const updated = await projectsApi.updateProject(projectId, {
      ...fields,
      name: fields.name || 'Untitled Project',
    });
    setProject(updated);
    setMode(null);
  };

  useViewInput(
    (input, key) => {
      if (!data) return;
      if (key.escape) return onBack();
      if (key.upArrow || input === 'k') return setIndex((i) => moveIndex(i, -1, items.length));
      if (key.downArrow || input === 'j') return setIndex((i) => moveIndex(i, 1, items.length));
      if (input === 'n' || input === 'a') return setMode({ type: 'add' });
      if (input === 'e') return setMode({ type: 'edit' });
      if (input === 's') return cycleStatus();
      if (input === 'D') return setMode({ type: 'confirm' });
      if (!item) return;
      if (input === ' ' || key.return) return toggleItem(item);
      if (input === 'd') return deleteItem(item);
      if (input === 'K') return reorder(-1);
      if (input === 'J') return reorder(1);
    },
    mode === null
  );

  if (!data) return <Text color={C.muted}>Loading…</Text>;
  const { project } = data;

  if (mode?.type === 'edit') {
    return (
      <Form title="Edit Project" fields={projectFields()} initial={project} onSubmit={saveProject} onCancel={() => setMode(null)} />
    );
  }

  const noteLines = (project.notes || '').split('\n');
  const maxNoteLines = Math.max(2, Math.floor(contentHeight / 4));
  const shownNotes = noteLines.slice(0, maxNoteLines);
  const doneCount = items.filter((c) => c.done).length;
  const listBudget = contentHeight - 7 - shownNotes.length - (mode ? 4 : 0);
  const [start, end] = windowRange(items.length, index, Math.max(3, listBudget));

  return (
    <Box flexDirection="column" height={contentHeight}>
      <Text wrap="truncate-end">
        <Text bold color={C.accent}>
          {project.name}
        </Text>
        {'  '}
        <Text color={C[PROJECT_STATUS_COLORS[project.status]]}>{PROJECT_STATUS_LABELS[project.status]}</Text>
        {project.target_date ? (
          <Text>
            {'  '}
            <Text color={C.muted}>target </Text>
            <TargetDate project={project} />
          </Text>
        ) : null}
      </Text>
      <Box flexDirection="column" borderStyle="round" borderColor={C.border} paddingX={1} marginTop={1}>
        {project.notes ? (
          shownNotes.map((line, i) => <Text key={i}>{line || ' '}</Text>)
        ) : (
          <Text color={C.muted}>No notes — press e to edit the project.</Text>
        )}
        {noteLines.length > shownNotes.length ? (
          <Text color={C.muted}>… {noteLines.length - shownNotes.length} more lines (e to edit)</Text>
        ) : null}
      </Box>
      <Text bold>
        Checklist <Text color={C.muted}>{items.length ? `${doneCount}/${items.length}` : ''}</Text>
      </Text>
      {items.length === 0 ? <Text color={C.muted}>  No items — press n to add one.</Text> : null}
      {items.slice(start, end).map((c, i) => {
        const isSel = start + i === index;
        return (
          <Text key={c.id} wrap="truncate-end">
            <Text color={C.accent}>{isSel ? '› ' : '  '}</Text>
            <Text color={c.done ? C.success : undefined}>{c.done ? '[✓]' : '[ ]'}</Text>{' '}
            <Text bold={isSel} inverse={isSel} color={c.done && !isSel ? C.muted : undefined}>
              {c.title}
            </Text>
          </Text>
        );
      })}
      {mode?.type === 'add' ? <Prompt label="New checklist item:" onSubmit={addItem} onCancel={() => setMode(null)} /> : null}
      {mode?.type === 'confirm' ? (
        <Confirm
          message={`Delete project “${project.name}” and its checklist?`}
          onYes={() => onDelete(project)}
          onNo={() => setMode(null)}
        />
      ) : null}
    </Box>
  );
}
