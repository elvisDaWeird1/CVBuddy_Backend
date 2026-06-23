const asyncHandler = require("../../utils/asyncHandler");
const { successResponse } = require("../../utils/apiResponse");
const cvService = require("./cv.service");

const uploadCv = asyncHandler(async (req, res) => {
  const cv = await cvService.createCv({
    accountId: req.user._id,
    file: req.file,
    payload: req.body
  });

  return successResponse(res, "CV uploaded successfully", { cv }, 201);
});

const getMyCvs = asyncHandler(async (req, res) => {
  const cvs = await cvService.getMyCvs(req.user._id);

  return successResponse(res, "CV list fetched successfully", { cvs });
});

const getMyCvById = asyncHandler(async (req, res) => {
  const cv = await cvService.getMyCvById(req.user._id, req.params.id);

  return successResponse(res, "CV fetched successfully", { cv });
});

const deleteMyCvById = asyncHandler(async (req, res) => {
  await cvService.deleteMyCvById(req.user._id, req.params.id);

  return successResponse(res, "CV deleted successfully");
});

module.exports = {
  uploadCv,
  getMyCvs,
  getMyCvById,
  deleteMyCvById
};
