const { spawn } = require("child_process");

process.env.PATH = "/usr/local/bin:" + (process.env.PATH || "");

const child = spawn("/usr/local/bin/node", ["node_modules/.bin/next", "dev", "--webpack", "--port", "3001"], {
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code || 0));
