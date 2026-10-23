import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Groq from 'groq-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

let groqClient = null;

function getGroqClient() {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('FATAL: GROQ_API_KEY is not defined in environment variables.');
    }
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

const promptCache = new Map();

/**
 * Loads the system prompt for a specific client_id from /prompts/<client_id>.md
 * Falls back to /prompts/default.md if client file does not exist.
 */
export async function getSystemPrompt(clientId = 'default') {
  if (promptCache.has(clientId)) {
    return promptCache.get(clientId);
  }

  const clientPromptFile = path.resolve(projectRoot, `prompts/${clientId}.md`);
  const defaultPromptFile = path.resolve(projectRoot, 'prompts/default.md');

  let promptText = '';
  try {
    promptText = await fs.readFile(clientPromptFile, 'utf8');
  } catch {
    try {
      promptText = await fs.readFile(defaultPromptFile, 'utf8');
    } catch {
      promptText = `You are a helpful customer support AI Assistant.
STRICT OPERATING RULES:
- ONLY answer questions using factual information from the RETRIEVED KNOWLEDGE CONTEXT.
- If unsure, say "I'm not sure, let me get you in touch with the team."
- Never invent pricing, stock, or policy details.`;
    }
  }

  promptCache.set(clientId, promptText.trim());
  return promptText.trim();
}

/**
 * Streams a chat completion response from Groq.
 * 
 * @param {string} userMessage The current user message
 * @param {Array<{ text: string, score: number }>} contextChunks Retrieved RAG chunks
 * @param {string} clientId Client identifier
 * @param {Array<{ role: string, content: string }>} conversationHistory Prior turns (up to 6)
 * @returns {Promise<AsyncIterable<any>>}
 */
export async function streamGroqReply(userMessage, contextChunks = [], clientId = 'default', conversationHistory = []) {
  const groq = getGroqClient();
  const baseSystemPrompt = await getSystemPrompt(clientId);

  let contextSection = '';
  if (contextChunks && contextChunks.length > 0) {
    contextSection = contextChunks
      .map((chunk, index) => `[Fact ${index + 1}]: ${chunk.text}`)
      .join('\n');
  } else {
    contextSection = 'No relevant knowledge base entries found.';
  }

  const systemContent = `${baseSystemPrompt}\n\n--- RETRIEVED KNOWLEDGE CONTEXT ---\n${contextSection}\n--- END CONTEXT ---`;

  // Build message array with capped prior turns
  const messages = [
    {
      role: 'system',
      content: systemContent,
    },
  ];

  // Limit conversation history to the last 6 turns and cap each turn content length
  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    const trimmedHistory = conversationHistory.slice(-6);
    for (const turn of trimmedHistory) {
      if (turn.role && turn.content) {
        messages.push({
          role: turn.role === 'assistant' ? 'assistant' : 'user',
          content: String(turn.content).substring(0, 500),
        });
      }
    }
  }

  // Append latest user message
  messages.push({
    role: 'user',
    content: String(userMessage).substring(0, 500),
  });

  const modelName = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  const stream = await groq.chat.completions.create({
    model: modelName,
    messages,
    temperature: 0.2,
    max_tokens: 1024,
    stream: true,
  });

  return stream;
}
