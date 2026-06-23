import fs from "fs";
import path from "path";

const removeFileIfExists = async (filePath) => {
  if (!filePath) {
    return;
  }

  const resolvedPath = path.resolve(filePath);

  await fs.promises.unlink(resolvedPath).catch((error) => {
    if (error.code !== "ENOENT") {
      throw error;
    }
  });
};

export {
  removeFileIfExists
};
