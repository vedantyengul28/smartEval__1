const axios = require('axios');
const config = require('../config');
const { ServiceUnavailableError, BadRequestError } = require('../utils/errors');

const JUDGE0_LANGUAGE_IDS = {
  python: 71,
  java: 62,
  cpp: 54,
  c: 50,
  javascript: 63,
};

function getLanguageId(language) {
  const id = JUDGE0_LANGUAGE_IDS[language];
  if (!id) {
    throw new BadRequestError(`Unsupported programming language: ${language}`);
  }
  return id;
}

function buildStdinString(inputData) {
  if (!inputData) return '';
  return Buffer.from(inputData, 'utf-8').toString('base64');
}

function decodeFromBase64(encoded) {
  if (!encoded) return '';
  try {
    return Buffer.from(encoded, 'base64').toString('utf-8');
  } catch {
    return encoded || '';
  }
}

const JUDGE0_STATUS_MAP = {
  1: 'in_queue',
  2: 'processing',
  3: 'accepted',
  4: 'wrong_answer',
  5: 'time_limit_exceeded',
  6: 'compilation_error',
  7: 'runtime_error',
  9: 'memory_limit_exceeded',
  11: 'internal_error',
};

function mapStatus(id) {
  return JUDGE0_STATUS_MAP[id] || 'internal_error';
}

function normalizeWhitespace(str) {
  return (str || '').replace(/\r\n/g, '\n').replace(/\s+\n/g, '\n').trim();
}

async function createSubmission({ sourceCode, languageId, stdin, expectedOutput, timeoutMs }) {
  const headers = {};
  if (config.judge0.apiKey) {
    headers['X-Auth-Token'] = config.judge0.apiKey;
  }

  try {
    const res = await axios.post(
      `${config.judge0.apiUrl}/submissions/?base64_encoded=true&wait=false`,
      {
        source_code: Buffer.from(sourceCode, 'utf-8').toString('base64'),
        language_id: languageId,
        stdin: buildStdinString(stdin),
        expected_output: expectedOutput
          ? Buffer.from(expectedOutput, 'utf-8').toString('base64')
          : undefined,
        cpu_time_limit: timeoutMs ? timeoutMs / 1000 : 5,
      },
      {
        headers,
        timeout: config.judge0.timeout * 2,
      }
    );
    return res.data.token;
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
      throw new ServiceUnavailableError('Judge0 programming evaluator is unavailable');
    }
    throw err;
  }
}

async function getSubmission(token) {
  const headers = {};
  if (config.judge0.apiKey) {
    headers['X-Auth-Token'] = config.judge0.apiKey;
  }

  const res = await axios.get(
    `${config.judge0.apiUrl}/submissions/${token}?base64_encoded=true&fields=id,token,status_id,status,language_id,stdin,expected_output,stdout,stderr,compile_output,message,cpu_time,memory`,
    {
      headers,
      timeout: config.judge0.timeout * 2,
    }
  );
  return res.data;
}

async function waitForCompletion(token, maxAttempts = 30) {
  const waitTime = config.judge0.waitTime;
  for (let i = 0; i < maxAttempts; i++) {
    const result = await getSubmission(token);
    const status = result.status_id;
    if (status !== 1 && status !== 2) {
      return result;
    }
    await new Promise((r) => setTimeout(r, waitTime));
  }
  return { ...(await getSubmission(token)), timed_out: true };
}

async function runTestCases(sourceCode, language, testCases) {
  const languageId = getLanguageId(language);
  const tokens = [];

  for (const tc of testCases) {
    const token = await createSubmission({
      sourceCode,
      languageId,
      stdin: tc.input_data,
      expectedOutput: tc.expected_output,
      timeoutMs: tc.timeout_ms || 5000,
    });
    tokens.push({ token, testCase: tc });
  }

  const results = [];
  for (const { token, testCase } of tokens) {
    const raw = await waitForCompletion(token);
    const status = mapStatus(raw.status_id);
    const actualOutput = decodeFromBase64(raw.stdout);
    const stderr = decodeFromBase64(raw.stderr);
    const compileOutput = decodeFromBase64(raw.compile_output);

    const actualNorm = normalizeWhitespace(actualOutput);
    const expectedNorm = normalizeWhitespace(testCase.expected_output);

    let verdict;
    let marksAwarded = 0;
    if (status === 'accepted' && actualNorm === expectedNorm) {
      verdict = 'passed';
      marksAwarded = testCase.marks;
    } else if (status === 'accepted') {
      verdict = 'failed';
    } else if (status === 'compilation_error' || status === 'runtime_error') {
      verdict = 'error';
    } else {
      verdict = 'failed';
    }

    results.push({
      testCaseId: testCase.id,
      verdict,
      actualOutput,
      expectedOutput: testCase.expected_output,
      errorMessage: stderr || compileOutput || raw.message || '',
      executionTimeMs: raw.cpu_time ? Math.round(raw.cpu_time * 1000) : null,
      memoryUsedKb: raw.memory ? Math.round(raw.memory) : null,
      marksAwarded,
      marksMax: testCase.marks,
      status,
      testCaseNumber: testCase.test_case_number,
    });
  }

  const totalMarks = results.reduce((s, r) => s + r.marksAwarded, 0);
  const totalMax = testCases.reduce((s, t) => s + t.marks, 0);
  const passedCount = results.filter((r) => r.verdict === 'passed').length;

  return {
    results,
    totalMarks,
    totalMax,
    passedCount,
    totalTestCases: testCases.length,
    compilationError: results.find((r) => r.status === 'compilation_error')?.errorMessage || '',
    runtimeError: results.find((r) => r.status === 'runtime_error' && r.errorMessage)?.errorMessage || '',
  };
}

module.exports = {
  getLanguageId,
  createSubmission,
  getSubmission,
  waitForCompletion,
  runTestCases,
  mapStatus,
  JUDGE0_LANGUAGE_IDS,
};
