const express = require('express');
const questionController = require('../controllers/questionController');
const { authenticate, requireTeacher } = require('../middleware/auth');
const {
  validateRequest,
  questionSchemas,
  rubricSchemas,
} = require('../utils/validators');

const router = express.Router();

router.post(
  '/',
  authenticate,
  requireTeacher,
  validateRequest(questionSchemas.create),
  questionController.createQuestion
);

router
  .route('/:id')
  .get(authenticate, questionController.getQuestion)
  .put(
    authenticate,
    requireTeacher,
    validateRequest(questionSchemas.update),
    questionController.updateQuestion
  )
  .delete(authenticate, requireTeacher, questionController.deleteQuestion);

router.post(
  '/rubrics',
  authenticate,
  requireTeacher,
  validateRequest(rubricSchemas.create),
  questionController.createRubric
);

module.exports = router;
