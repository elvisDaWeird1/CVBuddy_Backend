const fs = require("fs");
const path = require("path");

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

module.exports = {
  removeFileIfExists
};
