import { Disposable, StatusBarAlignment } from "../hostEditor/EditorTypes";
import type { StatusBarItem } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Cmd } from "../core/commands";

/**
 * Simple Pomodoro timer in the status bar.
 *
 * Commands:
 *   lotion.pomodoroStart — start a 25-minute work session
 *   lotion.pomodoroBreak — start a 5-minute break
 *   lotion.pomodoroStop  — stop the timer
 *
 * Clicking the status bar item cycles through start → break → stop.
 */

let statusBarItem: StatusBarItem | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let endTime = 0;
let mode: "idle" | "work" | "break" = "idle";

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function update(): void {
  if (!statusBarItem) {
    return;
  }
  const remaining = endTime - Date.now();

  if (remaining <= 0) {
    // Timer finished
    if (mode === "work") {
      hostEditor.showInformation("🍅 Pomodoro complete! Time for a break.");
      statusBarItem.text = "$(coffee) Break?";
      statusBarItem.tooltip = "Click to start a 5-minute break";
      statusBarItem.command = Cmd.pomodoroBreak;
    } else if (mode === "break") {
      hostEditor.showInformation("☕ Break over! Ready for another session?");
      statusBarItem.text = "$(play) Pomodoro";
      statusBarItem.tooltip = "Click to start a 25-minute work session";
      statusBarItem.command = Cmd.pomodoroStart;
    }
    mode = "idle";
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
    return;
  }

  const icon = mode === "work" ? "$(clock)" : "$(coffee)";
  const label = mode === "work" ? "Work" : "Break";
  statusBarItem.text = `${icon} ${label} ${formatRemaining(remaining)}`;
  statusBarItem.tooltip = `Pomodoro ${label} — click to stop`;
  statusBarItem.command = Cmd.pomodoroStop;
}

function startTimer(durationMin: number, newMode: "work" | "break"): void {
  if (timer) {
    clearInterval(timer);
  }
  mode = newMode;
  endTime = Date.now() + durationMin * 60 * 1000;
  update();
  timer = setInterval(update, 1000);
}

export function pomodoroStart(): void {
  startTimer(25, "work");
}

export function pomodoroBreak(): void {
  startTimer(5, "break");
}

export function pomodoroStop(): void {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
  mode = "idle";
  if (statusBarItem) {
    statusBarItem.text = "$(play) Pomodoro";
    statusBarItem.tooltip = "Click to start a 25-minute work session";
    statusBarItem.command = Cmd.pomodoroStart;
  }
}

export function createPomodoroStatusBar(): Disposable {
  statusBarItem = hostEditor.createStatusBarItem(StatusBarAlignment.Right, 97);
  statusBarItem.text = "$(play) Pomodoro";
  statusBarItem.tooltip = "Click to start a 25-minute work session";
  statusBarItem.command = Cmd.pomodoroStart;
  statusBarItem.show();

  return new Disposable(() => {
    if (timer) {
      clearInterval(timer);
    }
    statusBarItem?.dispose();
  });
}
