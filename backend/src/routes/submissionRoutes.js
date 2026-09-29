const express = require('express');
const submissionController = require('../controllers/submissionController');
const evaluationController = require('../controllers/evaluationController');
const { authenticate, requireTeacher, requireStudent } = require('../middleware/auth');
const { validateRequest, submissionSchemas, evaluationSchemas } = require('../utils/validators');
const { upload, handleMulterError } = require('../middleware/upload');

const router = express.Router();

router.post(
  '/',
  authenticate,
  requireStudent,
  upload.any(),
  handleMulterError,
  (req, res, next) => {
    try {
      if (req.body && typeof req.body.answers === 'string') {
        req.body.answers = JSON.parse(req.body.answers);
      }
      next();
    } catch (err) {
      next(err);
    }
  },
  validateRequest(submissionSchemas.create),
  submissionController.create
);

router.get('/teacher/all', authenticate, requireTeacher, submissionController.listForTeacher);

router.get('/student/my', authenticate, requireStudent, submissionController.listForStudent);

router.get('/:id', authenticate, submissionController.getById);

router.post(
  '/:submissionId/evaluate',
  authenticate,
  requireTeacher,
  evaluationController.evaluate
);

router.put(
  '/evaluations/:id/review',
  authenticate,
  requireTeacher,
  validateRequest(evaluationSchemas.review),
  evaluationController.review
);

router.post(
  '/evaluations/:id/approve',
  authenticate,
  requireTeacher,
  evaluationController.approve
);

module.exports = router;
