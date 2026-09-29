const questionService = require('../services/questionService');
const assessmentService = require('../services/assessmentService');
const judge0Service = require('../services/judge0Service');
const { db } = require('../../database/db');
const { asyncHandler, sendResponse } = require('../utils/helpers');
const { ServiceUnavailableError, BadRequestError } = require('../utils/errors');

function dbRun(sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbGet(sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

const submitCode = asyncHandler(async (req, res) => {
  const data = req.validatedBody || req.body;
  const question = await questionService.getQuestionById(data.questionId, true);

  if (question.question_type !== 'programming') {
    throw new BadRequestError('This is not a programming question');
  }

  if (req.user.role === 'teacher') {
    await assessmentService.ensureTeacherOwns(question.assessment_id, req.user.id);
  }

  const testCases = question.test_cases || [];
  if (testCases.length === 0) {
    throw new BadRequestError('No test cases available for this question');
  }

  const visibleTestCases = testCases.filter((tc) => !tc.is_hidden);

  let runResult;
  try {
    runResult = await judge0Service.runTestCases(data.sourceCode, data.programmingLanguage, visibleTestCases);
  } catch (err) {
    throw new ServiceUnavailableError('Programming evaluator is currently unavailable');
  }

  if (data.submissionId) {
    const status = runResult.compilationError
      ? 'compilation_error'
      : runResult.results.some((r) => r.status === 'runtime_error')
      ? 'runtime_error'
      : runResult.passedCount === runResult.totalTestCases
      ? 'accepted'
      : 'wrong_answer';

    // Check if record exists
    const existing = await dbGet(
      'SELECT id FROM programming_submissions WHERE submission_id = ? AND question_id = ?',
      [data.submissionId, data.questionId]
    );

    if (existing) {
      await dbRun(
        'UPDATE programming_submissions SET source_code = ?, programming_language = ?, status = ? WHERE id = ?',
        [data.sourceCode, data.programmingLanguage, status, existing.id]
      );
    } else {
      const { v4: uuidv4 } = require('uuid');
      const id = uuidv4();
      await dbRun(
        'INSERT INTO programming_submissions (id, submission_id, question_id, source_code, programming_language, status) VALUES (?, ?, ?, ?, ?, ?)',
        [id, data.submissionId, data.questionId, data.sourceCode, data.programmingLanguage, status]
      );
    }
  }

  sendResponse(res, 200, runResult, 'Code executed');
});

const runSingleTestCase = asyncHandler(async (req, res) => {
  const { sourceCode, programmingLanguage, inputData, expectedOutput } = req.body;

  if (!sourceCode || !programmingLanguage) {
    throw new BadRequestError('Source code and language are required');
  }

  const fakeTestCase = [
    {
      id: 'temp',
      input_data: inputData || '',
      expected_output: expectedOutput || '',
      marks: 1,
      test_case_number: 1,
      timeout_ms: 5000,
    },
  ];

  let result;
  try {
    result = await judge0Service.runTestCases(sourceCode, programmingLanguage, fakeTestCase);
  } catch (err) {
    throw new ServiceUnavailableError('Programming evaluator unavailable');
  }

  sendResponse(res, 200, result.results[0], 'Test case completed');
});

module.exports = {
  submitCode,
  runSingleTestCase,
};
