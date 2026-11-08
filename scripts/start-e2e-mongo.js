const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { MongoMemoryServer } = require("mongodb-memory-server");

const DEFAULT_PORT = Number.parseInt(process.env.MONGO_PORT || "27017", 10);
const DEFAULT_HOST = "127.0.0.1";
const DB_PATH = path.join(os.tmpdir(), "cvbuddy-e2e-mongo");

function isPortReachable(port, host = DEFAULT_HOST, timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (reachable) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(reachable);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

async function waitForPort(port, host = DEFAULT_HOST, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortReachable(port, host)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for MongoDB on ${host}:${port}`);
}

function isProcessAlive(pid) {
  if (!pid || pid <= 1) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error && error.code === "EPERM";
  }
}

function removeDbPathSync() {
  try {
    fs.rmSync(DB_PATH, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  } catch {
    // Best-effort cleanup on Windows file locks
  }
}

async function startMongoDaemon() {
  if (await isPortReachable(DEFAULT_PORT, DEFAULT_HOST)) {
    console.log(
      `[start-e2e-mongo] Port ${DEFAULT_PORT} is already in use; reusing existing MongoDB listener.`
    );
    const keepAlive = setInterval(() => {}, 60000);
    const stopReuse = () => {
      clearInterval(keepAlive);
      process.exit(0);
    };
    process.once("SIGINT", stopReuse);
    process.once("SIGTERM", stopReuse);
    return;
  }

  removeDbPathSync();
  fs.mkdirSync(DB_PATH, { recursive: true });

  const parentPid = process.ppid;
  let mongod = null;
  let shuttingDown = false;

  const shutdown = async (exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;

    try {
      if (mongod) {
        await mongod.stop({ doCleanup: true, force: true });
        mongod = null;
      }
    } catch {
      // Ignore stop errors during teardown
    } finally {
      removeDbPathSync();
      process.exit(exitCode);
    }
  };

  process.once("SIGINT", () => void shutdown(0));
  process.once("SIGTERM", () => void shutdown(0));
  process.once("SIGHUP", () => void shutdown(0));
  process.once("disconnect", () => void shutdown(0));
  process.once("exit", () => {
    removeDbPathSync();
  });

  mongod = await MongoMemoryServer.create({
    instance: {
      port: DEFAULT_PORT,
      ip: DEFAULT_HOST,
      dbPath: DB_PATH,
    },
  });

  console.log(`[start-e2e-mongo] MongoMemoryServer listening at ${mongod.getUri()}`);

  const watchdog = setInterval(() => {
    if (!isProcessAlive(parentPid)) {
      clearInterval(watchdog);
      void shutdown(0);
    }
  }, 1000);
}

async function waitAndRunServer() {
  await waitForPort(DEFAULT_PORT, DEFAULT_HOST);
  require(path.resolve(__dirname, "../dist/server.js"));
}

async function main() {
  if (process.argv.includes("--wait-and-run-server")) {
    await waitAndRunServer();
    return;
  }
  await startMongoDaemon();
}

main().catch((error) => {
  console.error("[start-e2e-mongo] Failed:", error);
  removeDbPathSync();
  process.exit(1);
});
