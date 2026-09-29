const assessmentService = require('../services/assessmentService');
const { asyncHandler, sendResponse, parseNumber } = require('../utils/helpers');

const create = asyncHandler(async (req, res) => {
  const data = req.validatedBody || req.body;
  const result = await assessmentService.createAssessment(req.user.id, data);
  sendResponse(res, 201, result, 'Assessment created');
});

const list = asyncHandler(async (req, res) => {
  if (req.user.role === 'teacher') {
    const status = req.query.status || null;
    const result = await assessmentService.listForTeacher(req.user.id, status);
    return sendResponse(res, 200, result);
  } else {
    const result = await assessmentService.listForStudent(req.user.id);
    return sendResponse(res, 200, result);
  }
});

const getById = asyncHandler(async (req, res) => {
  const includeQuestions = req.query.includeQuestions === 'true';
  const result = await assessmentService.getAssessmentById(req.params.id, includeQuestions);

  if (req.user.role === 'teacher') {
    if (result.teacher_id !== req.user.id) {
      return sendResponse(res, 403, null, 'Forbidden');
    }
  } else if (req.user.role === 'student') {
    if (result.status !== 'published') {
      return sendResponse(res, 403, null, 'Assessment not available');
    }
    if (includeQuestions && result.questions) {
      for (const q of result.questions) {
        delete q.model_answer;
      }
    }
  }

  sendResponse(res, 200, result);
});

const update = asyncHandler(async (req, res) => {
  const data = req.validatedBody || req.body;
  const result = await assessmentService.updateAssessment(req.params.id, req.user.id, data);
  sendResponse(res, 200, result, 'Assessment updated');
});

const remove = asyncHandler(async (req, res) => {
  await assessmentService.deleteAssessment(req.params.id, req.user.id);
  sendResponse(res, 200, null, 'Assessment deleted');
});

const publish = asyncHandler(async (req, res) => {
  const result = await assessmentService.publishAssessment(req.params.id, req.user.id);
  sendResponse(res, 200, result, 'Assessment published successfully');
});

module.exports = {
  create,
  list,
  getById,
  update,
  remove,
  publish,
};
