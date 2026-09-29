const axios = require('axios');
const config = require('../config');
const { ServiceUnavailableError, AppError } = require('../utils/errors');

const client = axios.create({
  baseURL: config.aiService.url,
  timeout: config.aiService.timeout,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[AI] Request failed:', error.message);
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      throw new ServiceUnavailableError(
        'AI evaluation service is currently unavailable. Please try again later.'
      );
    }
    if (error.code === 'ECONNABORTED') {
      throw new AppError('AI evaluation timed out. Please try again.', 504);
    }
    if (error.response) {
      throw new AppError(
        error.response.data?.message || 'AI service request failed',
        error.response.status >= 500 ? 502 : 400,
        error.response.data
      );
    }
    throw error;
  }
);

async function health() {
  try {
    const res = await client.get('/ai/health');
    return res.data;
  } catch (err) {
    return { status: 'unavailable', error: err.message };
  }
}

async function evaluateAnswer({ question, referenceAnswer, studentAnswer, rubricCriteria, extractedText }) {
  const res = await client.post('/ai/evaluate-answer', {
    question,
    referenceAnswer,
    studentAnswer,
    rubricCriteria,
    extractedText: extractedText || null,
  });
  return res.data;
}

async function ocrImage({ filePath, fileType }) {
  const res = await client.post('/ai/ocr', {
    filePath,
    fileType,
  });
  return res.data;
}

async function semanticSimilarity({ text1, text2 }) {
  const res = await client.post('/ai/semantic-similarity', {
    text1,
    text2,
  });
  return res.data;
}

module.exports = {
  health,
  evaluateAnswer,
  ocrImage,
  semanticSimilarity,
};
