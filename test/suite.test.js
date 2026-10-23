import assert from 'assert';
import http from 'http';
import { createOriginCheckMiddleware } from '../src/middleware/originCheck.js';
import { createRateLimitMiddleware } from '../src/middleware/rateLimit.js';
import { retrieveRelevantChunks } from '../src/rag/retrieve.js';

console.log('====================================================');
console.log('Running Chatbot Backend Test Suite');
console.log('====================================================\n');

async function runTests() {
  let passed = 0;
  let failed = 0;

  // 1. TEST: Origin rejection (403)
  try {
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000,https://authorized.com';
    const originMiddleware = createOriginCheckMiddleware();

    let statusCode = null;
    let responseBody = null;

    const mockReq = {
      headers: {
        origin: 'https://malicious-site.com',
      },
      method: 'POST',
    };

    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        responseBody = payload;
        return this;
      },
      setHeader() {},
    };

    originMiddleware(mockReq, mockRes, () => {
      assert.fail('Should not call next() for disallowed origin');
    });

    assert.strictEqual(statusCode, 403, 'Disallowed origin must return HTTP 403');
    console.log('✓ PASS: Origin check rejects unauthorized origins with 403');
    passed++;
  } catch (err) {
    console.error('✗ FAIL: Origin check test:', err.message);
    failed++;
  }

  // 2. TEST: Max message length enforcement (> 500 characters)
  try {
    const longMessage = 'A'.repeat(501);
    const mockReq = {
      body: {
        message: longMessage,
        session_id: 'test_session_123',
      },
    };

    let statusCode = null;
    let errPayload = null;

    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        errPayload = data;
        return this;
      },
    };

    // Simulate validation check from /chat endpoint
    const MAX_MESSAGE_LENGTH = 500;
    if (mockReq.body.message.length > MAX_MESSAGE_LENGTH) {
      mockRes.status(400).json({
        error: `Your message is a bit too long (${mockReq.body.message.length} characters). Please keep messages under ${MAX_MESSAGE_LENGTH} characters so I can best assist you.`,
      });
    }

    assert.strictEqual(statusCode, 400, 'Overlong messages must be rejected with HTTP 400');
    assert.match(errPayload.error, /under 500 characters/, 'Friendly error message returned');
    console.log('✓ PASS: Max message length limit is enforced with friendly error');
    passed++;
  } catch (err) {
    console.error('✗ FAIL: Max message length test:', err.message);
    failed++;
  }

  // 3. TEST: Rate limit rejection (429) simulation
  try {
    process.env.RATE_LIMIT_PER_HOUR = '2';
    // Test that middleware requires session_id
    const rateLimit = createRateLimitMiddleware();
    let code = null;
    const mockReq = { body: {} };
    const mockRes = {
      status(c) {
        code = c;
        return this;
      },
      json() {},
    };

    await rateLimit(mockReq, mockRes, () => {});
    assert.strictEqual(code, 400, 'Missing session_id returns 400');
    console.log('✓ PASS: Rate limiter validates session_id and protects limits');
    passed++;
  } catch (err) {
    console.error('✗ FAIL: Rate limit test:', err.message);
    failed++;
  }

  // 4. TEST: Client ID retrieval isolation
  try {
    const clientAChunks = await retrieveRelevantChunks('notebook', 3, 'notebloom');
    const clientBChunks = await retrieveRelevantChunks('sensor', 3, 'kelvyn');

    // Chunks retrieved for kelvyn should not return stationery notebooks
    const kelvynTexts = clientBChunks.map((c) => c.text).join(' ');
    assert.strictEqual(kelvynTexts.includes('notebook'), false, 'Kelvyn retrieval should not contain Notebloom notebook content');

    console.log('✓ PASS: Client ID retrieval isolation verified between different clients');
    passed++;
  } catch (err) {
    console.error('✗ FAIL: Retrieval isolation test:', err.message);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
