import { saveMemory, getMemory, deleteMemory, listMemoryKeys } from "./memory.js";

interface ScheduledTask {
  name: string;
  intervalMs: number;
  lastRun: number;
  taskPrompt: string;
  enabled: boolean;
}

interface Heartbeat {
  name: string;
  intervalMs: number;
  fn: () => Promise<void>;
  lastRun: number;
}

const heartbeats: Map<string, Heartbeat> = new Map();
const scheduledTasks: Map<string, ScheduledTask> = new Map();
let tickInterval: ReturnType<typeof setInterval> | null = null;
let taskExecutor: ((prompt: string) => Promise<string>) | null = null;

const TICK_INTERVAL_MS = 60 * 1000;
const TASK_MEMORY_PREFIX = "scheduled_task:";

export function initHeartbeat(executor: (prompt: string) => Promise<string>) {
  taskExecutor = executor;

  const taskKeys = listMemoryKeys().filter(k => k.startsWith(TASK_MEMORY_PREFIX));
  for (const key of taskKeys) {
    const mem = getMemory(key);
    if (mem) {
      try {
        const task = JSON.parse(mem.content) as ScheduledTask;
        scheduledTasks.set(task.name, task);
      } catch {
        console.error(`Failed to parse scheduled task: ${key}`);
      }
    }
  }

  tickInterval = setInterval(() => tick(), TICK_INTERVAL_MS);
  console.log(`Heartbeat initialized with ${heartbeats.size} static heartbeats and ${scheduledTasks.size} scheduled tasks`);
}

export function stopHeartbeat() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

export function registerHeartbeat(name: string, intervalMs: number, fn: () => Promise<void>) {
  heartbeats.set(name, { name, intervalMs, fn, lastRun: 0 });
}

export function scheduleTask(name: string, intervalMs: number, taskPrompt: string): ScheduledTask {
  const task: ScheduledTask = {
    name,
    intervalMs,
    lastRun: 0,
    taskPrompt,
    enabled: true,
  };
  scheduledTasks.set(name, task);
  saveMemory(TASK_MEMORY_PREFIX + name, JSON.stringify(task), "context");
  return task;
}

export function cancelTask(name: string): boolean {
  const deleted = scheduledTasks.delete(name);
  if (deleted) {
    deleteMemory(TASK_MEMORY_PREFIX + name);
  }
  return deleted;
}

export function listTasks(): Array<{ name: string; intervalMs: number; enabled: boolean; lastRun: number }> {
  return Array.from(scheduledTasks.values()).map(t => ({
    name: t.name,
    intervalMs: t.intervalMs,
    enabled: t.enabled,
    lastRun: t.lastRun,
  }));
}

export function listHeartbeats(): Array<{ name: string; intervalMs: number; lastRun: number }> {
  return Array.from(heartbeats.values()).map(h => ({
    name: h.name,
    intervalMs: h.intervalMs,
    lastRun: h.lastRun,
  }));
}

async function tick() {
  const now = Date.now();

  for (const [name, heartbeat] of heartbeats) {
    if (now - heartbeat.lastRun >= heartbeat.intervalMs) {
      heartbeat.lastRun = now;
      try {
        await heartbeat.fn();
      } catch (err) {
        console.error(`Heartbeat ${name} failed:`, err);
      }
    }
  }

  for (const [name, task] of scheduledTasks) {
    if (task.enabled && now - task.lastRun >= task.intervalMs) {
      task.lastRun = now;
      saveMemory(TASK_MEMORY_PREFIX + name, JSON.stringify(task), "context");

      if (taskExecutor) {
        try {
          const result = await taskExecutor(task.taskPrompt);
          console.log(`Scheduled task ${name} completed:`, result.slice(0, 200));
        } catch (err) {
          console.error(`Scheduled task ${name} failed:`, err);
        }
      }
    }
  }
}

export const schedulerTools = [
  {
    type: "function" as const,
    function: {
      name: "schedule_task",
      description: "Schedule a recurring task. The agent will execute the prompt at the specified interval.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Unique name for this task" },
          interval_hours: { type: "number", description: "How often to run (in hours)" },
          task_prompt: { type: "string", description: "What the agent should do when this task runs" }
        },
        required: ["name", "interval_hours", "task_prompt"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "cancel_task",
      description: "Cancel a scheduled task.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the task to cancel" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "list_scheduled",
      description: "List all scheduled tasks.",
      parameters: { type: "object", properties: {} }
    }
  }
];
