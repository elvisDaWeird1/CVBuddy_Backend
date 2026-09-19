import dotenv from "dotenv";
import mongoose from "mongoose";
import readline from "readline";

dotenv.config();

import connectDB from "../src/config/db";
import { provisionAdmin } from "../src/modules/admin/adminProvisioning.service";

const args = process.argv.slice(2);

const getArgumentValue = (name: string) => {
  const inlinePrefix = `${name}=`;
  const inlineValue = args.find((argument) => argument.startsWith(inlinePrefix));
  if (inlineValue) return inlineValue.slice(inlinePrefix.length);

  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const readPipedSecret = async () => {
  process.stdin.setEncoding("utf8");
  let value = "";

  for await (const chunk of process.stdin) value += chunk;
  return value.replace(/[\r\n]+$/, "");
};

const readHiddenSecret = () => new Promise<string>((resolve, reject) => {
  const input = process.stdin;
  const output = process.stdout;
  const wasRaw = input.isRaw;
  let value = "";

  const cleanup = () => {
    input.removeListener("keypress", onKeypress);
    input.setRawMode(wasRaw ?? false);
    input.pause();
  };

  const onKeypress = (character: string, key: readline.Key) => {
    if (key.ctrl && key.name === "c") {
      output.write("\n");
      cleanup();
      reject(new Error("Admin provisioning cancelled."));
      return;
    }

    if (key.name === "return" || key.name === "enter") {
      output.write("\n");
      cleanup();
      resolve(value);
      return;
    }

    if (key.name === "backspace") {
      if (value) {
        value = value.slice(0, -1);
        output.write("\b \b");
      }
      return;
    }

    if (character && !key.ctrl && !key.meta) {
      value += character;
      output.write("*");
    }
  };

  readline.emitKeypressEvents(input);
  input.setRawMode(true);
  input.resume();
  input.on("keypress", onKeypress);
  output.write("Admin password: ");
});

const readAdminPassword = async () => {
  if (!process.stdin.isTTY) return readPipedSecret();
  return readHiddenSecret();
};

const run = async () => {
  if (args.includes("--help")) {
    console.log("Usage: npm run provision:admin -- --email <address> [--promote-existing]");
    return;
  }

  if (args.some((argument) => argument === "--password" || argument.startsWith("--password="))) {
    throw new Error("Do not pass passwords through command-line arguments. Use the hidden prompt or stdin.");
  }

  const email = getArgumentValue("--email");
  if (!email) {
    throw new Error("Usage: npm run provision:admin -- --email <address> [--promote-existing]");
  }

  await connectDB();
  const password = await readAdminPassword();
  const result = await provisionAdmin({
    email,
    password,
    promoteExisting: args.includes("--promote-existing")
  });

  console.log("Admin provisioning completed", result);
};

run()
  .catch((error) => {
    console.error("Admin provisioning failed", {
      message: error instanceof Error ? error.message : "Unknown provisioning error"
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
