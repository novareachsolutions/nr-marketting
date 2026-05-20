import axios, { AxiosError } from 'axios';

/**
 * Anthropic Messages API helper.
 *
 * Function names (callOpenAIJson*, etc.) are kept for backward compatibility
 * with existing call sites — the underlying provider is now Anthropic.
 * Default model is claude-haiku-4-5 (cheap/fast). Pass `model` to override.
 */

const ANTHROPIC_VERSION = '2023-06-01';
const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-4-5';

const JSON_GUARD =
  '\n\nRespond with ONLY a single valid JSON object. No prose, no markdown fences, no commentary before or after the JSON.';

/**
 * Translate Anthropic HTTP errors into user-friendly Error messages.
 * Callers catch these and surface them as 4xx/5xx responses to the user.
 *
 * - 529 = Overloaded (transient, retry in a moment)
 * - 429 = Rate limited (the API key is being throttled)
 * - 401 = Bad API key
 * - 500/502/503/504 = Anthropic outage
 */
function translateAnthropicError(err: unknown): never {
  if (axios.isAxiosError(err)) {
    const axiosErr = err as AxiosError<any>;
    const status = axiosErr.response?.status;
    const upstreamMsg =
      axiosErr.response?.data?.error?.message ||
      axiosErr.response?.data?.message ||
      axiosErr.message;

    if (status === 529) {
      throw new Error(
        'AI service is temporarily busy (Anthropic overloaded). Please try again in a moment.',
      );
    }
    if (status === 429) {
      throw new Error(
        'AI service rate limit reached. Please wait a few seconds and try again.',
      );
    }
    if (status === 401 || status === 403) {
      throw new Error(
        'AI service authentication failed. Check ANTHROPIC_API_KEY configuration.',
      );
    }
    if (status && status >= 500) {
      throw new Error(
        `AI service is temporarily unavailable (Anthropic ${status}). Please try again shortly.`,
      );
    }
    if (status) {
      throw new Error(`AI service error (${status}): ${upstreamMsg}`);
    }
    // Network / timeout error
    throw new Error(`AI service request failed: ${upstreamMsg}`);
  }
  throw err;
}

interface OpenAIJsonOptions {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  timeout?: number;
  temperature?: number;
  /** Override the default model. Defaults to claude-haiku-4-5. */
  model?: string;
}

/**
 * Call Anthropic's Messages API and parse a single JSON object from the response.
 * Throws on network errors, missing text, or unparseable JSON.
 */
export async function callOpenAIJson<T = any>(
  options: OpenAIJsonOptions,
): Promise<T> {
  const {
    apiKey,
    systemPrompt,
    userPrompt,
    maxTokens = 3000,
    timeout = 120000,
    temperature = 0.3,
    model = DEFAULT_MODEL,
  } = options;

  try {
    const response = await axios.post(
      MESSAGES_URL,
      {
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt + JSON_GUARD,
        messages: [{ role: 'user', content: userPrompt }],
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        timeout,
      },
    );

    const text = extractMessagesText(response.data);
    const json = extractFirstJsonObject(text);
    return JSON.parse(json) as T;
  } catch (err) {
    translateAnthropicError(err);
  }
}

interface OpenAIJsonWithSearchOptions extends OpenAIJsonOptions {
  /** ISO 3166-1 alpha-2 country code, e.g. "US", "IN". Used to localize web search. */
  country?: string;
}

const WEB_SEARCH_FLAG = 'OPENAI_ENABLE_WEB_SEARCH';
const WEB_SEARCH_MODULES_FLAG = 'OPENAI_WEBSEARCH_MODULES';

/**
 * True if the given module name is enabled for web search via env flags.
 *
 * Logic:
 *   - If OPENAI_ENABLE_WEB_SEARCH is not "true", return false.
 *   - If OPENAI_WEBSEARCH_MODULES is set, only the listed modules return true.
 *   - Otherwise, all modules return true when the flag is on.
 *
 * Env var names are retained as OPENAI_* for deployment-config backward compatibility.
 */
export function isWebSearchEnabled(moduleName: string): boolean {
  if (process.env[WEB_SEARCH_FLAG] !== 'true') return false;
  const list = process.env[WEB_SEARCH_MODULES_FLAG];
  if (!list) return true;
  return list
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .includes(moduleName.toLowerCase());
}

/**
 * Call Anthropic's Messages API with the `web_search_20250305` tool enabled.
 * Claude performs live web searches and returns a final assistant text from which
 * we parse a single JSON object.
 *
 * country (ISO-2) is forwarded as `user_location` for localized search.
 */
export async function callOpenAIJsonWithSearch<T = any>(
  options: OpenAIJsonWithSearchOptions,
): Promise<T> {
  const {
    apiKey,
    systemPrompt,
    userPrompt,
    maxTokens = 4000,
    timeout = 180000,
    temperature = 0.3,
    country,
    model = DEFAULT_MODEL,
  } = options;

  const tool: Record<string, any> = {
    type: 'web_search_20250305',
    name: 'web_search',
  };
  if (country) {
    tool.user_location = {
      type: 'approximate',
      country: country.toUpperCase(),
    };
  }

  try {
    const response = await axios.post(
      MESSAGES_URL,
      {
        model,
        max_tokens: maxTokens,
        temperature,
        tools: [tool],
        system: systemPrompt + JSON_GUARD,
        messages: [{ role: 'user', content: userPrompt }],
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        timeout,
      },
    );

    const text = extractMessagesText(response.data);
    const json = extractFirstJsonObject(text);
    return JSON.parse(json) as T;
  } catch (err) {
    translateAnthropicError(err);
  }
}

interface OpenAITextOptions {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  timeout?: number;
  temperature?: number;
  /** Override the default model. Defaults to claude-haiku-4-5. */
  model?: string;
}

/**
 * Call Anthropic's Messages API and return the raw assistant text (no JSON parsing).
 * Use when the caller needs unstructured output (e.g., a generated file body).
 */
export async function callOpenAIText(options: OpenAITextOptions): Promise<string> {
  const {
    apiKey,
    systemPrompt,
    userPrompt,
    maxTokens = 3000,
    timeout = 120000,
    temperature = 0.3,
    model = DEFAULT_MODEL,
  } = options;

  try {
    const response = await axios.post(
      MESSAGES_URL,
      {
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        timeout,
      },
    );

    return extractMessagesText(response.data);
  } catch (err) {
    translateAnthropicError(err);
  }
}

/**
 * Concatenate all `text` blocks from a Messages API response.
 * Skips server_tool_use, web_search_tool_result, and other non-text blocks.
 */
function extractMessagesText(data: any): string {
  const content = data?.content;
  if (!Array.isArray(content)) {
    throw new Error('Anthropic Messages API returned no content array');
  }
  const parts: string[] = [];
  for (const block of content) {
    if (block?.type === 'text' && typeof block.text === 'string') {
      parts.push(block.text);
    }
  }
  if (!parts.length) {
    throw new Error('Anthropic Messages API returned no text output');
  }
  return parts.join('\n');
}

function extractFirstJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in model output');
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  throw new Error('Unterminated JSON object in model output');
}
