const express = require('express');
const assessmentController = require('../controllers/assessmentController');
const { authenticate, requireTeacher } = require('../middleware/auth');
const { validateRequest, assessmentSchemas } = require('../utils/validators');

const router = express.Router();

router
  .route('/')
  .get(authenticate, assessmentController.list)
  .post(authenticate, requireTeacher, validateRequest(assessmentSchemas.create), assessmentController.create);

router
  .route('/:id')
  .get(authenticate, assessmentController.getById)
  .put(authenticate, requireTeacher, validateRequest(assessmentSchemas.update), assessmentController.update)
  .delete(authenticate, requireTeacher, assessmentController.remove);

router.post('/:id/publish', authenticate, requireTeacher, assessmentController.publish);

module.exports = router;
