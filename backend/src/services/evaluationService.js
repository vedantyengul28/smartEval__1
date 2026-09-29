const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database/db');
const { BadRequestError, NotFoundError, ForbiddenError, ServiceUnavailableError } = require('../utils/errors');
const questionService = require('./questionService');
const aiService = require('./aiServiceClient');
const redis = require('../config/redis');

// Helper to promisify db operations
function dbGet(sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbRun(sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function evaluateAnswer(answerId, question, studentAnswer, filePath = null) {
  console.log('[Evaluation] Evaluating answer:', answerId, 'for question:', question.id);
  const rubrics = await dbAll('SELECT * FROM rubrics WHERE question_id = ?', [question.id]);
  console.log('[Evaluation] Found rubrics:', rubrics.length);

  let extractedText = null;
  if (filePath) {
    try {
      const fileType = filePath.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';
      const ocrResult = await aiService.ocrImage({ filePath, fileType });
      extractedText = ocrResult.extractedText || '';
      console.log(`[OCR] Extracted ${extractedText.length} characters from ${filePath}`);
    } catch (err) {
      console.error('[OCR] Failed:', err.message);
      if (!(err instanceof ServiceUnavailableError)) {
        throw err;
      }
    }
  }

  const finalAnswer = extractedText || studentAnswer;
  console.log('[Evaluation] Final answer length:', finalAnswer?.length);

  let aiResult;
  try {
    aiResult = await aiService.evaluateAnswer({
      question: question.question_text,
      referenceAnswer: question.model_answer || '',
      studentAnswer: finalAnswer,
      rubricCriteria: rubrics.map(r => ({
        name: r.criterion,
        maxMarks: r.marks,
        keywords: r.keywords
      })),
      extractedText
    });
    console.log('[Evaluation] AI result:', aiResult);
  } catch (err) {
    console.error('[Evaluation] AI service failed, using fallback:', err.message);
    if (err instanceof ServiceUnavailableError) {
      aiResult = fallbackEvaluate(question, finalAnswer, rubrics);
    } else {
      throw err;
    }
  }

  // Check if evaluation already exists
  const existing = await dbGet('SELECT id FROM evaluations WHERE answer_id = ?', [answerId]);

  if (existing) {
    await dbRun(
      `UPDATE evaluations SET ai_marks = ?, ai_feedback = ?, extracted_text = ?, status = 'pending' WHERE id = ?`,
      [aiResult.totalMarks, aiResult.feedback, extractedText, existing.id]
    );
    return await dbGet('SELECT * FROM evaluations WHERE id = ?', [existing.id]);
  }

  const evaluationId = uuidv4();
  await dbRun(
    `INSERT INTO evaluations (id, answer_id, ai_marks, ai_feedback, status, extracted_text)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
    [evaluationId, answerId, aiResult.totalMarks, aiResult.feedback, extractedText]
  );

  return await dbGet('SELECT * FROM evaluations WHERE id = ?', [evaluationId]);
}

function fallbackEvaluate(question, studentAnswer, rubrics) {
  const refWords = new Set(
    (question.model_answer || '').toLowerCase().split(/[\s,.;:!?()]+/).filter(Boolean)
  );
  const studentWords = studentAnswer.toLowerCase().split(/[\s,.;:!?()]+/).filter(Boolean);

  let matchCount = 0;
  for (const w of studentWords) {
    if (refWords.has(w)) matchCount++;
  }
  const keywordRatio = studentWords.length > 0 ? matchCount / studentWords.length : 0;

  let totalMarks = 0;
  const wordCount = studentWords.length;

  // If no rubrics, use simple semantic matching
  if (!rubrics || rubrics.length === 0) {
    const semanticScore = Math.min(1, keywordRatio * 2 + (wordCount > 5 ? 0.2 : 0));
    totalMarks = Math.round(question.marks * semanticScore * 10) / 10;
    totalMarks = Math.min(question.marks, Math.max(0, totalMarks));
  } else {
    for (const rubric of rubrics) {
      const keywordList = (rubric.keywords || '').toLowerCase().split(/[\s,;]+/).filter(Boolean);
      let matched = 0;
      for (const kw of keywordList) {
        if (studentAnswer.toLowerCase().includes(kw)) matched++;
      }
      const kwRatio = keywordList.length > 0 ? matched / keywordList.length : 0;
      const lengthFactor = Math.min(1, wordCount / 25);
      const scoreFactor = Math.min(1, keywordRatio * 0.4 + kwRatio * 0.4 + lengthFactor * 0.2);
      const awarded = Math.round(rubric.marks * scoreFactor * 10) / 10;
      const clamped = Math.min(rubric.marks, Math.max(0, awarded));
      totalMarks += clamped;
    }
  }

  totalMarks = Math.round(totalMarks * 10) / 10;
  const pct = question.marks > 0 ? totalMarks / question.marks : 0;
  let feedback;
  if (pct >= 0.85) feedback = 'Strong answer. Excellent understanding demonstrated.';
  else if (pct >= 0.7) feedback = 'Good answer. Improve coverage of some criteria.';
  else if (pct >= 0.5) feedback = 'Satisfactory. Significant room for improvement.';
  else feedback = 'Needs significant work. Review the key concepts and try again.';
  feedback += ` (Keyword match ratio: ${Math.round(keywordRatio * 100)}%, Word count: ${wordCount})`;

  return {
    totalMarks,
    feedback,
    _fallback: true,
  };
}

async function evaluateSubmission(submissionId, teacherId) {
  const submission = await dbGet(
    'SELECT s.*, a.teacher_id FROM submissions s JOIN assessments a ON a.id = s.assessment_id WHERE s.id = ?',
    [submissionId]
  );

  if (!submission) {
    throw new NotFoundError('Submission not found');
  }
  if (submission.teacher_id !== teacherId) {
    throw new ForbiddenError('Not your assessment');
  }

  const answers = await dbAll(
    `SELECT ans.*, q.question_text, q.marks, q.model_answer
     FROM answers ans
     JOIN questions q ON q.id = ans.question_id
     WHERE ans.submission_id = ?`,
    [submissionId]
  );

  let evaluatedCount = 0;
  for (const answer of answers) {
    const question = {
      id: answer.question_id,
      question_text: answer.question_text,
      marks: answer.marks,
      model_answer: answer.model_answer
    };
    const studentAnswer = answer.answer_text || '';
    const filePath = answer.file_path || null;

    if (studentAnswer.trim() || filePath) {
      await evaluateAnswer(answer.id, question, studentAnswer, filePath);
      evaluatedCount++;
    }
  }

  await dbRun(
    'UPDATE submissions SET status = ? WHERE id = ?',
    ['pending', submissionId]
  );

  return { submissionId, status: 'evaluated', evaluatedCount };
}

async function reviewEvaluation(evaluationId, teacherId, data) {
  const evaluation = await dbGet('SELECT * FROM evaluations WHERE id = ?', [evaluationId]);
  if (!evaluation) {
    throw new NotFoundError('Evaluation not found');
  }

  await dbRun(
    `UPDATE evaluations
     SET final_marks = ?, teacher_feedback = ?, status = 'reviewed'
     WHERE id = ?`,
    [data.finalMarks || evaluation.ai_marks, data.teacherFeedback, evaluationId]
  );

  // Invalidate related submission cache
  const answer = await dbGet('SELECT submission_id FROM answers WHERE id = ?', [evaluation.answer_id]);
  if (answer) {
    await redis.del(`submission:${answer.submission_id}`);
  }

  return await dbGet('SELECT * FROM evaluations WHERE id = ?', [evaluationId]);
}

async function approveEvaluation(evaluationId, teacherId) {
  const evaluation = await dbGet('SELECT * FROM evaluations WHERE id = ?', [evaluationId]);
  if (!evaluation) {
    throw new NotFoundError('Evaluation not found');
  }

  await dbRun(
    'UPDATE evaluations SET status = ? WHERE id = ?',
    ['approved', evaluationId]
  );

  // Invalidate related submission cache
  const answer = await dbGet('SELECT submission_id FROM answers WHERE id = ?', [evaluation.answer_id]);
  if (answer) {
    await redis.del(`submission:${answer.submission_id}`);
  }

  return await dbGet('SELECT * FROM evaluations WHERE id = ?', [evaluationId]);
}

module.exports = {
  evaluateAnswer,
  evaluateSubmission,
  reviewEvaluation,
  approveEvaluation,
  fallbackEvaluate,
};
