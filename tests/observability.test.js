const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const express = require("express");

const { errorHandler, notFoundHandler } = require("../src/middlewares/error.middleware");
const { successResponse } = require("../src/utils/apiResponse");
const {
  accessLogger,
  getSafeRequestId,
  requestContext,
  REQUEST_ID_HEADER
} = require("../src/middlewares/requestContext.middleware");

const request = (port, path, headers = {}) => new Promise((resolve, reject) => {
  const req = http.request({ hostname: "127.0.0.1", port, path, headers }, (res) => {
    const chunks = [];
    res.on("data", (chunk) => chunks.push(chunk));
    res.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      resolve({ res, body: body ? JSON.parse(body) : undefined });
    });
  });
  req.on("error", reject);
  req.end();
});

test("request context returns a safe request ID in headers and response envelopes", async () => {
  const app = express();
  app.use(requestContext);
  app.get("/ok", (req, res) => successResponse(res, "OK"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));

  try {
    const suppliedId = "support-case-20260912";
    const response = await request(server.address().port, "/ok", { [REQUEST_ID_HEADER]: suppliedId });
    assert.equal(response.res.headers["x-request-id"], suppliedId);
    assert.equal(response.body.requestId, suppliedId);
    assert.notEqual(getSafeRequestId("bad\nheader"), "bad\nheader");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("error responses use stable codes and never expose unexpected error messages", async () => {
  const app = express();
  app.use(requestContext);
  app.get("/boom", () => { throw new Error("password=do-not-log-or-return"); });
  app.use(notFoundHandler);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));

  try {
    const boom = await request(server.address().port, "/boom");
    assert.equal(boom.res.statusCode, 500);
    assert.equal(boom.body.code, "INTERNAL_ERROR");
    assert.equal(boom.body.message, "Internal server error");
    assert.equal(JSON.stringify(boom.body).includes("do-not-log-or-return"), false);

    const missing = await request(server.address().port, "/missing?token=do-not-reflect");
    assert.equal(missing.res.statusCode, 404);
    assert.equal(missing.body.code, "ROUTE_NOT_FOUND");
    assert.equal(JSON.stringify(missing.body).includes("do-not-reflect"), false);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("access logging records only request metadata", async () => {
  const logs = [];
  const originalLog = console.log;
  console.log = (line) => logs.push(line);
  const app = express();
  app.use(requestContext);
  app.use(accessLogger);
  app.get("/health", (req, res) => res.sendStatus(204));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));

  try {
    await request(server.address().port, "/health?cvText=never-log-this");
    const accessLog = JSON.parse(logs.find((line) => line.includes('"event":"http_request"')));
    assert.equal(accessLog.event, "http_request");
    assert.equal(accessLog.path, "/health");
    assert.equal(JSON.stringify(accessLog).includes("never-log-this"), false);
  } finally {
    console.log = originalLog;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
