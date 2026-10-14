/**
 * Unit tests for engine/llm.js
 *
 * We mock fetch() to avoid real API calls and test:
 * - provider selection
 * - error handling
 * - missing API key
 */

const originalEnv = { ...process.env };

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
  // Remove any real API keys for test isolation
  delete process.env.AI_API_KEY;
  delete process.env.AI_PROVIDER;
  delete process.env.AI_MODEL;
});

afterAll(() => {
  process.env = originalEnv;
});

describe('callLLM', () => {
  test('throws when AI_API_KEY is not set', async () => {
    const { callLLM } = require('../../engine/llm');
    await expect(callLLM('system', 'user')).rejects.toThrow('AI_API_KEY not configured');
  });

  test('calls OpenAI-compatible endpoint by default', async () => {
    process.env.AI_API_KEY = 'test-key-123';
    process.env.AI_PROVIDER = 'openai';

    const mockResponse = {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Test response from OpenAI' } }],
      }),
    };
    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    const { callLLM } = require('../../engine/llm');
    const result = await callLLM('You are helpful', 'Hello');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const callArgs = global.fetch.mock.calls[0];
    expect(callArgs[0]).toBe('https://api.openai.com/v1/chat/completions');
    expect(result).toBe('Test response from OpenAI');

    delete global.fetch;
  });

  test('calls Groq endpoint when AI_PROVIDER=groq', async () => {
    process.env.AI_API_KEY = 'test-key-groq';
    process.env.AI_PROVIDER = 'groq';

    const mockResponse = {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Test from Groq' } }],
      }),
    };
    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    const { callLLM } = require('../../engine/llm');
    const result = await callLLM('System', 'User prompt');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const callArgs = global.fetch.mock.calls[0];
    expect(callArgs[0]).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(result).toBe('Test from Groq');

    delete global.fetch;
  });

  test('calls Anthropic endpoint when AI_PROVIDER=anthropic', async () => {
    process.env.AI_API_KEY = 'test-key-anthropic';
    process.env.AI_PROVIDER = 'anthropic';

    const mockResponse = {
      ok: true,
      json: async () => ({
        content: [{ text: 'Response from Anthropic' }],
      }),
    };
    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    const { callLLM } = require('../../engine/llm');
    const result = await callLLM('System', 'User prompt');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const callArgs = global.fetch.mock.calls[0];
    expect(callArgs[0]).toBe('https://api.anthropic.com/v1/messages');

    // Check Anthropic-specific headers
    const headers = JSON.parse(callArgs[1].body);
    expect(headers.system).toBe('System');
    expect(result).toBe('Response from Anthropic');

    delete global.fetch;
  });

  test('handles API error response', async () => {
    process.env.AI_API_KEY = 'test-key';
    process.env.AI_PROVIDER = 'openai';

    const mockResponse = {
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    };
    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    const { callLLM } = require('../../engine/llm');
    await expect(callLLM('system', 'user')).rejects.toThrow('API error');

    delete global.fetch;
  });

  test('returns "No response" when API returns empty content', async () => {
    process.env.AI_API_KEY = 'test-key';
    process.env.AI_PROVIDER = 'openai';

    const mockResponse = {
      ok: true,
      json: async () => ({ choices: [{ message: { content: null } }] }),
    };
    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    const { callLLM } = require('../../engine/llm');
    const result = await callLLM('system', 'user');
    expect(result).toBe('No response');

    delete global.fetch;
  });

  test('uses custom model when AI_MODEL is set', async () => {
    process.env.AI_API_KEY = 'test-key';
    process.env.AI_PROVIDER = 'openai';
    process.env.AI_MODEL = 'gpt-4-turbo';

    const mockResponse = {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'response' } }],
      }),
    };
    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    const { callLLM } = require('../../engine/llm');
    await callLLM('system', 'user');

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.model).toBe('gpt-4-turbo');

    delete global.fetch;
  });
});
