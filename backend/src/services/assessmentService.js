const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database/db');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');

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

async function createAssessment(teacherId, data) {
  const id = uuidv4();
  
  await dbRun(
    `INSERT INTO assessments (id, title, description, teacher_id, status)
     VALUES (?, ?, ?, ?, 'draft')`,
    [id, data.title, data.description || null, teacherId]
  );
  
  const assessment = await dbGet(
    'SELECT * FROM assessments WHERE id = ?',
    [id]
  );
  return assessment;
}

async function getAssessmentById(id, includeQuestions = false) {
  const assessment = await dbGet(
    'SELECT * FROM assessments WHERE id = ?',
    [id]
  );
  
  if (!assessment) {
    throw new NotFoundError('Assessment not found');
  }

  if (includeQuestions) {
    const questions = await dbAll(
      'SELECT * FROM questions WHERE assessment_id = ?',
      [id]
    );
    assessment.questions = questions;
  }

  return assessment;
}

async function ensureTeacherOwns(assessmentId, teacherId) {
  const assessment = await getAssessmentById(assessmentId);
  if (assessment.teacher_id !== teacherId) {
    throw new ForbiddenError('You do not own this assessment');
  }
  return assessment;
}

async function listForTeacher(teacherId, status) {
  let query = 'SELECT * FROM assessments WHERE teacher_id = ?';
  const params = [teacherId];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  const list = await dbAll(query, params);

  for (const a of list) {
    const questionCount = await dbGet(
      'SELECT COUNT(*) as count FROM questions WHERE assessment_id = ?',
      [a.id]
    );
    const submissionCount = await dbGet(
      'SELECT COUNT(*) as count FROM submissions WHERE assessment_id = ?',
      [a.id]
    );
    const totalMarks = await dbGet(
      'SELECT SUM(marks) as total FROM questions WHERE assessment_id = ?',
      [a.id]
    );
    
    a.question_count = questionCount?.count || 0;
    a.submission_count = submissionCount?.count || 0;
    a.total_marks = totalMarks?.total || 0;
  }

  return list;
}

async function listForStudent(studentId) {
  const assessments = await dbAll(
    'SELECT * FROM assessments WHERE status = ? ORDER BY created_at DESC',
    ['published']
  );

  const list = [];
  for (const a of assessments) {
    const teacher = await dbGet(
      'SELECT name FROM users WHERE id = ?',
      [a.teacher_id]
    );
    
    const questionCount = await dbGet(
      'SELECT COUNT(*) as count FROM questions WHERE assessment_id = ?',
      [a.id]
    );
    const totalMarks = await dbGet(
      'SELECT SUM(marks) as total FROM questions WHERE assessment_id = ?',
      [a.id]
    );
    const submission = await dbGet(
      'SELECT id FROM submissions WHERE assessment_id = ? AND student_id = ?',
      [a.id, studentId]
    );
    
    list.push({
      ...a,
      teacher_name: teacher?.name || 'Unknown',
      question_count: questionCount?.count || 0,
      total_marks: totalMarks?.total || 0,
      has_submitted: !!submission,
      submission_id: submission?.id || null,
    });
  }

  return list;
}

async function updateAssessment(id, teacherId, data) {
  await ensureTeacherOwns(id, teacherId);

  const fields = [];
  const values = [];

  if (data.title !== undefined) {
    fields.push('title = ?');
    values.push(data.title);
  }
  if (data.description !== undefined) {
    fields.push('description = ?');
    values.push(data.description);
  }
  if (data.status !== undefined) {
    fields.push('status = ?');
    values.push(data.status);
  }

  if (fields.length === 0) {
    return getAssessmentById(id);
  }

  values.push(id);

  await dbRun(
    `UPDATE assessments SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return getAssessmentById(id);
}

async function publishAssessment(id, teacherId) {
  await ensureTeacherOwns(id, teacherId);

  const qCount = await dbGet(
    'SELECT COUNT(*) as count FROM questions WHERE assessment_id = ?',
    [id]
  );
  if (qCount.count === 0) {
    throw new BadRequestError('Cannot publish assessment without questions');
  }

  await dbRun(
    'UPDATE assessments SET status = ? WHERE id = ?',
    ['published', id]
  );

  return getAssessmentById(id);
}

async function deleteAssessment(id, teacherId) {
  await ensureTeacherOwns(id, teacherId);
  await dbRun('DELETE FROM assessments WHERE id = ?', [id]);
}

module.exports = {
  createAssessment,
  getAssessmentById,
  listForTeacher,
  listForStudent,
  updateAssessment,
  publishAssessment,
  deleteAssessment,
  ensureTeacherOwns,
};
