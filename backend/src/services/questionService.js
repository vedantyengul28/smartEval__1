const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database/db');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');
const assessmentService = require('./assessmentService');

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

async function createQuestion(teacherId, data) {
  await assessmentService.ensureTeacherOwns(data.assessmentId, teacherId);

  const id = uuidv4();
  const questionNumber = data.questionNumber || 1;

  await dbRun(
    `INSERT INTO questions (id, assessment_id, question_text, question_type, marks, model_answer, question_number)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.assessmentId,
      data.questionText,
      data.questionType || 'subjective',
      data.marks,
      data.modelAnswer || null,
      questionNumber,
    ]
  );

  const question = await dbGet('SELECT * FROM questions WHERE id = ?', [id]);
  return question;
}

async function getQuestionById(id, includeDetails = false) {
  const question = await dbGet('SELECT * FROM questions WHERE id = ?', [id]);
  
  if (!question) {
    throw new NotFoundError('Question not found');
  }

  if (includeDetails) {
    const rubrics = await dbAll('SELECT * FROM rubrics WHERE question_id = ?', [id]);
    question.rubrics = rubrics;
  }

  return question;
}

async function ensureTeacherOwnsQuestion(questionId, teacherId) {
  const question = await getQuestionById(questionId);
  const assessment = await assessmentService.ensureTeacherOwns(question.assessment_id, teacherId);
  return { question, assessment };
}

async function listQuestionsByAssessment(assessmentId) {
  const questions = await dbAll(
    'SELECT * FROM questions WHERE assessment_id = ?',
    [assessmentId]
  );
  return questions;
}

async function updateQuestion(id, teacherId, data) {
  const { question } = await ensureTeacherOwnsQuestion(id, teacherId);

  const fields = [];
  const values = [];

  if (data.questionText !== undefined) {
    fields.push('question_text = ?');
    values.push(data.questionText);
  }
  if (data.questionType !== undefined) {
    fields.push('question_type = ?');
    values.push(data.questionType);
  }
  if (data.marks !== undefined) {
    fields.push('marks = ?');
    values.push(data.marks);
  }
  if (data.modelAnswer !== undefined) {
    fields.push('model_answer = ?');
    values.push(data.modelAnswer);
  }

  if (fields.length === 0) return question;

  values.push(id);

  await dbRun(
    `UPDATE questions SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return getQuestionById(id);
}

async function deleteQuestion(id, teacherId) {
  await ensureTeacherOwnsQuestion(id, teacherId);
  await dbRun('DELETE FROM questions WHERE id = ?', [id]);
}

async function createRubric(teacherId, data) {
  const { question } = await ensureTeacherOwnsQuestion(data.questionId, teacherId);

  const rubricId = uuidv4();
  await dbRun(
    'INSERT INTO rubrics (id, question_id, criterion, keywords, marks) VALUES (?, ?, ?, ?, ?)',
    [rubricId, data.questionId, data.criterion, data.keywords || null, data.marks]
  );

  const rubric = await dbGet('SELECT * FROM rubrics WHERE id = ?', [rubricId]);
  return rubric;
}

module.exports = {
  createQuestion,
  getQuestionById,
  listQuestionsByAssessment,
  updateQuestion,
  deleteQuestion,
  createRubric,
  ensureTeacherOwnsQuestion,
};
