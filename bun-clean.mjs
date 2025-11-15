import { spawn } from "child_process";

process.env.BUN_TASKS_DISABLE_UI = "1";
process.env.BUN_TASKS_STDOUT_MODE = "inherit";

const child = spawn("bun", ["run", "desktop:dev"], {
  stdio: "inherit",
  shell: true,
});
child.on("exit", (code) => process.exit(code));
