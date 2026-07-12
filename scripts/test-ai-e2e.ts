import assert from "assert";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

import Account from "../src/modules/accounts/account.model";
import ApplicantProfile from "../src/modules/applicantProfiles/applicantProfile.model";
import CVDocument from "../src/modules/cvs/cvDocument.model";
import AIResult from "../src/modules/ai/aiResult.model";
import { generateScore } from "../src/modules/ai/ai.service";

const buildFixturePdf = () => {
  const stream = "BT /F1 12 Tf 72 720 Td (CVBuddy AI E2E Test Backend Developer) Tj ET\n";
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
    "4 0 obj\n<< /Length " + Buffer.byteLength(stream) + " >>\nstream\n" + stream + "endstream\nendobj\n",
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += object;
  }

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += "xref\n0 " + (objects.length + 1) + "\n";
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += String(offsets[index]).padStart(10, "0") + " 00000 n \n";
  }
  pdf += "trailer\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\n";
  pdf += "startxref\n" + xrefOffset + "\n%%EOF\n";

  return Buffer.from(pdf);
};

const run = async () => {
  const mongoUri = process.env.AI_E2E_MONGODB_URI
    || "mongodb://127.0.0.1:27017/cvbuddy_ai_e2e";
  const aiServiceUrl = process.env.AI_SERVICE_URL || "http://localhost:8001";

  const isLocalMongo = mongoUri.startsWith("mongodb://localhost")
    || mongoUri.startsWith("mongodb://127.0.0.1");

  if (!process.env.AI_E2E_ALLOW_REMOTE && !isLocalMongo) {
    throw new Error("Refusing non-local MongoDB URI. Set AI_E2E_ALLOW_REMOTE=true only for an intentional test database.");
  }

  process.env.AI_SERVICE_ENABLED = "true";
  process.env.AI_SERVICE_URL = aiServiceUrl;
  process.env.UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";
  process.env.AI_DEFAULT_INDUSTRY_SLUG = "language";

  const suffix = Date.now() + "-" + Math.random().toString(16).slice(2);
  const email = "ai-e2e-" + suffix + "@example.test";
  const filename = "ai-e2e-" + suffix + ".pdf";
  const uploadDirectory = path.join(process.cwd(), process.env.UPLOAD_DIR, "cvs");
  const filePath = path.join(uploadDirectory, filename);

  let account;
  let profile;
  let cv;
  let connected = false;

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    connected = true;

    await Account.deleteOne({ email });
    account = await Account.create({
      email,
      passwordHash: "e2e-only-not-a-real-password",
      role: "APPLICANT",
      status: "ACTIVE"
    });
    profile = await ApplicantProfile.create({
      accountId: account._id,
      fullName: "CVBuddy AI E2E Fixture"
    });

    fs.mkdirSync(uploadDirectory, { recursive: true });
    const bytes = buildFixturePdf();
    fs.writeFileSync(filePath, bytes);

    cv = await CVDocument.create({
      applicantProfileId: profile._id,
      title: "AI E2E Fixture CV",
      fileUrl: "/uploads/cvs/" + filename,
      fileType: "pdf",
      fileSize: bytes.length,
      language: "EN",
      extractedText: "",
      status: "ACTIVE"
    });

    const result = await generateScore(
      account._id.toString(),
      cv._id.toString(),
      { industrySlug: "language" }
    );

    assert.equal(result.status, "COMPLETED");
    assert.equal(typeof result.score, "number");
    assert.equal(result.result.overall_score, result.score);

    const stored = await AIResult.findById(result.id).lean();
    assert.ok(stored);
    assert.equal(stored.status, "COMPLETED");
    assert.equal(stored.cvDocumentId.toString(), cv._id.toString());
    assert.equal(JSON.parse(stored.resultText).overall_score, result.score);

    console.log(JSON.stringify({
      status: "passed",
      aiResultId: result.id,
      score: result.score,
      mongoDatabase: mongoose.connection.name,
      aiServiceUrl
    }));
  } finally {
    if (cv?._id) await CVDocument.deleteOne({ _id: cv._id });
    if (profile?._id) await ApplicantProfile.deleteOne({ _id: profile._id });
    if (account?._id) await Account.deleteOne({ _id: account._id });
    fs.rmSync(filePath, { force: true });
    if (connected) await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});