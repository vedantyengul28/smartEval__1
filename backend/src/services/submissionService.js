const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database/db');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');
const assessmentService = require('./assessmentService');
const questionService = require('./questionService');
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

async function createSubmission(studentId, data, uploadedFiles = {}) {
  console.log('[Submission] Creating submission for student:', studentId, 'assessment:', data.assessmentId);
  console.log('[Submission] Answers count:', data.answers?.length);
  console.log('[Submission] Uploaded files:', Object.keys(uploadedFiles));

  const assessment = await assessmentService.getAssessmentById(data.assessmentId);
  if (assessment.status !== 'published') {
    throw new BadRequestError('Assessment is not published');
  }

  const existing = await dbGet(
    'SELECT id, status FROM submissions WHERE assessment_id = ? AND student_id = ?',
    [data.assessmentId, studentId]
  );
  if (existing) {
    throw new BadRequestError('You have already submitted this assessment');
  }

  const submissionId = uuidv4();
  await dbRun(
    'INSERT INTO submissions (id, assessment_id, student_id, status) VALUES (?, ?, ?, ?)',
    [submissionId, data.assessmentId, studentId, 'pending']
  );
  console.log('[Submission] Created submission:', submissionId);

  const questions = await questionService.listQuestionsByAssessment(data.assessmentId);
  const qById = new Map(questions.map((q) => [q.id, q]));

  for (const ans of data.answers) {
    const question = qById.get(ans.questionId);
    if (!question) {
      console.log('[Submission] Question not found:', ans.questionId);
      continue;
    }

    const answerId = uuidv4();
    let filePath = null;
    const fileKey = `file_${ans.questionId}`;
    if (uploadedFiles && uploadedFiles[fileKey] && uploadedFiles[fileKey][0]) {
      filePath = uploadedFiles[fileKey][0].path;
      console.log('[Submission] File uploaded for question:', ans.questionId, 'path:', filePath);
    }

    // Handle programming answers separately
    if (ans.questionType === 'programming') {
      await dbRun(
        `INSERT INTO programming_submissions (id, submission_id, question_id, source_code, programming_language, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [answerId, submissionId, ans.questionId, ans.sourceCode || '', ans.programmingLanguage || 'python', 'submitted']
      );
      console.log('[Submission] Created programming submission:', answerId, 'for question:', ans.questionId);
    } else {
      // Only create answer if there's text OR a file
      if (ans.textAnswer || filePath) {
        await dbRun(
          `INSERT INTO answers (id, submission_id, question_id, answer_text, file_path)
           VALUES (?, ?, ?, ?, ?)`,
          [answerId, submissionId, ans.questionId, ans.textAnswer || null, filePath]
        );
        console.log('[Submission] Created answer:', answerId, 'for question:', ans.questionId, 'with text:', !!ans.textAnswer, 'with file:', !!filePath);
      } else {
        console.log('[Submission] Skipping empty answer for question:', ans.questionId);
      }
    }
  }

  const submission = await dbGet(
    'SELECT * FROM submissions WHERE id = ?',
    [submissionId]
  );

  console.log('[Submission] Submission created successfully:', submissionId);

  // Invalidate teacher's submissions cache
  await redis.invalidatePattern(`submissions:teacher:${assessment.teacher_id}:*`);

  return submission;
}

async function getSubmissionById(id, userId, role) {
  // Try Redis cache first
  const cacheKey = `submission:${id}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log('[Submission] Cache hit for:', id);
    return cached;
  }

  const submission = await dbGet(
    `SELECT s.*, a.title as assessment_title,
      u.name as student_name, u.email as student_email
     FROM submissions s
     JOIN assessments a ON a.id = s.assessment_id
     JOIN users u ON u.id = s.student_id
     WHERE s.id = ?`,
    [id]
  );

  if (!submission) {
    throw new NotFoundError('Submission not found');
  }

  if (role === 'student' && submission.student_id !== userId) {
    throw new ForbiddenError('You cannot access this submission');
  }

  if (role === 'teacher') {
    const assessment = await assessmentService.getAssessmentById(submission.assessment_id);
    if (assessment.teacher_id !== userId) {
      throw new ForbiddenError('You cannot access this submission');
    }
  }

  const answers = await dbAll(
    `SELECT ans.*, q.question_text, q.marks, q.model_answer, q.question_number, q.question_type
     FROM answers ans
     JOIN questions q ON q.id = ans.question_id
     WHERE ans.submission_id = ?`,
    [id]
  );

  const programmingSubmissions = await dbAll(
    `SELECT ps.*, q.question_text, q.marks, q.question_number, q.question_type
     FROM programming_submissions ps
     JOIN questions q ON q.id = ps.question_id
     WHERE ps.submission_id = ?`,
    [id]
  );

  const evaluations = await dbAll(
    `SELECT eval.*, ans.question_id
     FROM evaluations eval
     JOIN answers ans ON ans.id = eval.answer_id
     WHERE ans.submission_id = ?`,
    [id]
  );

  // Combine answers and programming submissions
  submission.answers = answers;
  submission.programming_submissions = programmingSubmissions;
  submission.evaluations = evaluations;

  console.log('[Submission] Retrieved submission:', id, 'with', answers.length, 'answers and', programmingSubmissions.length, 'programming submissions');

  // Cache for 1 hour
  await redis.set(cacheKey, submission, 3600);

  return submission;
}

async function listSubmissionsForTeacher(teacherId, assessmentId) {
  console.log('[Submission] Listing submissions for teacher:', teacherId, 'assessment:', assessmentId);
  let query = `
    SELECT s.*, a.title as assessment_title,
      u.name as student_name, u.email as student_email
    FROM submissions s
    JOIN assessments a ON a.id = s.assessment_id
    JOIN users u ON u.id = s.student_id
    WHERE a.teacher_id = ?`;
  const params = [teacherId];

  if (assessmentId) {
    query += ' AND a.id = ?';
    params.push(assessmentId);
  }

  query += ' ORDER BY s.submitted_at DESC';

  const submissions = await dbAll(query, params);
  console.log('[Submission] Found submissions:', submissions.length);
  return submissions;
}

async function listSubmissionsForStudent(studentId) {
  const submissions = await dbAll(
    `SELECT s.*, a.title as assessment_title, u.name as teacher_name
     FROM submissions s
     JOIN assessments a ON a.id = s.assessment_id
     JOIN users u ON u.id = a.teacher_id
     WHERE s.student_id = ?
     ORDER BY s.submitted_at DESC`,
    [studentId]
  );

  // Calculate grades and totals for each submission
  for (const submission of submissions) {
    const evaluations = await dbAll(
      `SELECT e.*, q.marks
       FROM evaluations e
       JOIN answers a ON a.id = e.answer_id
       JOIN questions q ON q.id = a.question_id
       WHERE a.submission_id = ? AND e.status = 'approved'`,
      [submission.id]
    );

    const totalMarksAwarded = evaluations.reduce((sum, e) => sum + (e.final_marks || e.ai_marks || 0), 0);
    const totalMarksMax = evaluations.reduce((sum, e) => sum + (e.marks || 0), 0);
    const percentage = totalMarksMax > 0 ? (totalMarksAwarded / totalMarksMax) * 100 : 0;

    let grade;
    if (percentage >= 90) grade = 'A';
    else if (percentage >= 80) grade = 'B';
    else if (percentage >= 70) grade = 'C';
    else if (percentage >= 60) grade = 'D';
    else grade = 'F';

    submission.total_marks_awarded = totalMarksAwarded;
    submission.total_marks_max = totalMarksMax;
    submission.percentage = percentage;
    submission.grade = grade;
    submission.released_at = submission.submitted_at;
  }

  return submissions;
}

module.exports = {
  createSubmission,
  getSubmissionById,
  listSubmissionsForTeacher,
  listSubmissionsForStudent,
};
