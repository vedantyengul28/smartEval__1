const { z } = require('zod');
const { AppError } = require('./errors');

function validateRequest(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const data = schema.parse(req[source]);
      const key = 'validated' + source.charAt(0).toUpperCase() + source.slice(1);
      req[key] = data;
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const details = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        next(new AppError('Validation failed', 400, details));
      } else {
        next(err);
      }
    }
  };
}

const authSchemas = {
  register: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    name: z.string().min(1, 'Name is required').max(200),
    role: z.enum(['teacher', 'student']),
  }),
  login: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),
};

const assessmentSchemas = {
  create: z.object({
    title: z.string().min(1, 'Title is required').max(255),
    description: z.string().max(2000).optional().nullable(),
  }),
  update: z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).optional().nullable(),
    status: z.enum(['draft', 'published']).optional(),
  }),
};

const questionSchemas = {
  create: z.object({
    assessmentId: z.string().uuid('Invalid assessment ID'),
    questionText: z.string().min(1, 'Question text is required'),
    questionType: z.enum(['subjective']).default('subjective'),
    marks: z.number().int().min(1, 'Marks must be positive'),
    modelAnswer: z.string().optional().nullable(),
  }),
  update: z.object({
    questionText: z.string().min(1).optional(),
    questionType: z.enum(['subjective']).optional(),
    marks: z.number().int().min(1).optional(),
    modelAnswer: z.string().optional().nullable(),
  }),
};

const rubricSchemas = {
  create: z.object({
    questionId: z.string().uuid('Invalid question ID'),
    criterion: z.string().min(1, 'Criterion is required'),
    keywords: z.string().optional().nullable(),
    marks: z.number().int().min(0, 'Marks must be non-negative'),
  }),
};

const submissionSchemas = {
  create: z.object({
    assessmentId: z.string().uuid('Invalid assessment ID'),
    answers: z
      .array(
        z.object({
          questionId: z.string().uuid('Invalid question ID'),
          textAnswer: z.string().optional().nullable(),
        })
      )
      .min(1, 'At least one answer is required'),
  }),
};

const evaluationSchemas = {
  review: z.object({
    finalMarks: z.number().min(0).optional(),
    teacherFeedback: z.string().optional().nullable(),
  }),
};

const codeSchemas = {
  submit: z.object({
    questionId: z.string().uuid('Invalid question ID'),
    sourceCode: z.string().min(1, 'Source code is required'),
    programmingLanguage: z.enum(['java', 'python', 'cpp']),
    submissionId: z.string().uuid('Submission ID is required'),
  }),
};

module.exports = {
  validateRequest,
  authSchemas,
  assessmentSchemas,
  questionSchemas,
  rubricSchemas,
  submissionSchemas,
  evaluationSchemas,
  codeSchemas,
};
