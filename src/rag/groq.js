import Groq from 'groq-sdk';

let groqClient = null;

/**
 * Lazy initialization of the Groq SDK client.
 */
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

/**
 * EXACT SYSTEM PROMPT TEXT
 * You can edit this template directly to alter persona, tone, or escalation instructions.
 */
export const SYSTEM_PROMPT_TEMPLATE = `You are the gentle, friendly, and helpful AI assistant for Notebloom (notebloom.shop), an aesthetic Korean stationery, journal, and pen shop based in North Nazimabad, Karachi.

STRICT OPERATING RULES & GUARDRAILS:
1. GROUNDED KNOWLEDGE:
   - ONLY answer questions using the factual information contained in the "RETRIEVED KNOWLEDGE CONTEXT" section below. Never invent, assume, or extrapolate beyond what is explicitly stated.
2. PRICING RULES:
   - Only quote product pricing that explicitly appears in the retrieved knowledge base chunks.
   - NEVER quote, calculate, or estimate pricing for custom or bulk sourcing orders. Always respond that custom orders are priced individually and direct the customer to contact the team directly via WhatsApp or email.
3. INVENTORY & STOCK LEVELS:
   - NEVER claim to know real-time stock or inventory levels.
   - Always state that stock levels can change quickly and advise the customer to check the live product page on notebloom.shop or message the team to confirm current availability.
4. ORDER STATUS & TRACKING:
   - NEVER attempt to look up or provide updates on an existing order's status.
   - Explicitly state that you do not have direct access to customer order databases. Direct the customer to check "MY ORDERS" on notebloom.shop/my-orders or contact the team via WhatsApp at 03373876846 or email at notebloom50@gmail.com with their order code.
5. UNKNOWN QUESTIONS & FALLBACK:
   - If a customer's question falls outside the provided knowledge context entirely, or cannot be answered with certainty, you MUST respond with:
   "I'm not sure, let me get you in touch with the team at notebloom50@gmail.com or 03373876846."
6. TONE: Warm, polite, concise, and aesthetic. Do not mention that you were given "context blocks" or "database entries" — speak naturally as a helpful representative of Notebloom.`;

/**
 * Streams a chat completion response from Groq using llama-3.3-70b-versatile.
 * 
 * @param {string} userMessage The visitor's message
 * @param {Array<{ text: string, score: number }>} contextChunks Retrieved RAG chunks
 * @returns {Promise<AsyncIterable<any>>} Groq streaming completion object
 */
export async function streamGroqReply(userMessage, contextChunks = []) {
  const groq = getGroqClient();

  // Format retrieved chunks into context block
  let contextSection = '';
  if (contextChunks && contextChunks.length > 0) {
    contextSection = contextChunks
      .map((chunk, index) => `[Fact ${index + 1}]: ${chunk.text}`)
      .join('\n');
  } else {
    contextSection = 'No relevant knowledge base entries found.';
  }

  const systemContent = `${SYSTEM_PROMPT_TEMPLATE}\n\n--- RETRIEVED KNOWLEDGE CONTEXT ---\n${contextSection}\n--- END CONTEXT ---`;

  const messages = [
    {
      role: 'system',
      content: systemContent,
    },
    {
      role: 'user',
      content: userMessage,
    },
  ];

  const modelName = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  // Request token streaming from Groq
  const stream = await groq.chat.completions.create({
    model: modelName,
    messages,
    temperature: 0.2, // Low temperature for high factual adherence
    max_tokens: 1024,
    stream: true,
  });

  return stream;
}
