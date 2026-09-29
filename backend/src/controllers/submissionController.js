const submissionService = require('../services/submissionService');
const { asyncHandler, sendResponse } = require('../utils/helpers');

const create = asyncHandler(async (req, res) => {
  console.log('[Controller] Creating submission for user:', req.user.id);
  console.log('[Controller] Request body keys:', Object.keys(req.body));
  console.log('[Controller] Uploaded files:', Object.keys(req.files || {}));
  console.log('[Controller] Uploaded files detail:', req.files);

  const data = req.validatedBody || req.body;
  const uploadedFiles = req.files || {};
  const result = await submissionService.createSubmission(req.user.id, data, uploadedFiles);
  sendResponse(res, 201, result, 'Submission received');
});

const getById = asyncHandler(async (req, res) => {
  const result = await submissionService.getSubmissionById(req.params.id, req.user.id, req.user.role);
  sendResponse(res, 200, result);
});

const listForTeacher = asyncHandler(async (req, res) => {
  const assessmentId = req.query.assessmentId || null;
  const result = await submissionService.listSubmissionsForTeacher(req.user.id, assessmentId);
  sendResponse(res, 200, result);
});

const listForStudent = asyncHandler(async (req, res) => {
  const result = await submissionService.listSubmissionsForStudent(req.user.id);
  sendResponse(res, 200, result);
});

module.exports = {
  create,
  getById,
  listForTeacher,
  listForStudent,
};
