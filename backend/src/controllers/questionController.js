const questionService = require('../services/questionService');
const { asyncHandler, sendResponse } = require('../utils/helpers');

const createQuestion = asyncHandler(async (req, res) => {
  const data = req.validatedBody || req.body;
  const result = await questionService.createQuestion(req.user.id, data);
  sendResponse(res, 201, result, 'Question created');
});

const getQuestion = asyncHandler(async (req, res) => {
  const includeDetails = req.query.includeDetails === 'true';
  const result = await questionService.getQuestionById(req.params.id, includeDetails);
  if (req.user.role === 'student') {
    delete result.model_answer;
  }
  sendResponse(res, 200, result);
});

const updateQuestion = asyncHandler(async (req, res) => {
  const data = req.validatedBody || req.body;
  const result = await questionService.updateQuestion(req.params.id, req.user.id, data);
  sendResponse(res, 200, result, 'Question updated');
});

const deleteQuestion = asyncHandler(async (req, res) => {
  await questionService.deleteQuestion(req.params.id, req.user.id);
  sendResponse(res, 200, null, 'Question deleted');
});

const createRubric = asyncHandler(async (req, res) => {
  const data = req.validatedBody || req.body;
  const result = await questionService.createRubric(req.user.id, data);
  sendResponse(res, 201, result, 'Rubric created');
});

const createTestCase = asyncHandler(async (req, res) => {
  const data = req.validatedBody || req.body;
  const result = await questionService.createTestCase(req.user.id, data);
  sendResponse(res, 201, result, 'Test case created');
});

module.exports = {
  createQuestion,
  getQuestion,
  updateQuestion,
  deleteQuestion,
  createRubric,
  createTestCase,
};
