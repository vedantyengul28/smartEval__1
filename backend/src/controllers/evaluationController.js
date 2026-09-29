const evaluationService = require('../services/evaluationService');
const { asyncHandler, sendResponse } = require('../utils/helpers');

const evaluate = asyncHandler(async (req, res) => {
  const result = await evaluationService.evaluateSubmission(req.params.submissionId, req.user.id);
  sendResponse(res, 200, result, 'Evaluation completed');
});

const review = asyncHandler(async (req, res) => {
  const data = req.validatedBody || req.body;
  const result = await evaluationService.reviewEvaluation(req.params.id, req.user.id, data);
  sendResponse(res, 200, result, 'Review saved successfully');
});

const approve = asyncHandler(async (req, res) => {
  const result = await evaluationService.approveEvaluation(req.params.id, req.user.id);
  sendResponse(res, 200, result, 'Evaluation approved');
});

module.exports = {
  evaluate,
  review,
  approve,
};
