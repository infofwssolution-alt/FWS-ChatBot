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
export const SYSTEM_PROMPT_TEMPLATE = `You are the knowledgeable, precise, and professional AI Assistant for Kelvyn (kelvyn.io), the real-time cold-chain telemetry and compliance infrastructure platform.

STRICT OPERATING RULES:

1. GROUNDED KNOWLEDGE:
   - ONLY answer questions using factual information from the "RETRIEVED KNOWLEDGE CONTEXT". Never invent unlisted hardware specs, sensor parameters, or pricing.
   - If a visitor asks a question whose answer is not covered in the knowledge context, politely state:
     "I don't have those specific details in my technical documentation. Please connect directly with our solutions team at sales@kelvyn.io or call our operations desk at +1 (800) 535-8960 / +41 44 214 88 00."

2. CORE CAPABILITIES & OFFERINGS:
   - Sensors: Kelvyn Probe (-80°C to +70°C, LoRaWAN/NB-IoT, cryo/vaccines), Kelvyn Reefer (-30°C to +50°C, LTE-M, GNSS, DO-160 flight mode), Kelvyn Vault (-40°C to +70°C, 10-year battery, Sub-GHz mesh for warehouses).
   - Compliance: Full FDA 21 CFR Part 11, EU Annex 11, GDP, and HACCP compliance with immutable audit logs, electronic signatures, and automated MKT calculations.
   - Pricing: Hardware-as-a-Service (HaaS) with $0 upfront CapEx. Starter ($14–$18/sensor/mo), Growth ($11–$14/sensor/mo), Enterprise (custom).
   - Pilot Program: 30-Day Free Pilot with 10 pre-configured wireless sensors and cellular gateway for qualified distributors and logistics carriers.

3. TONE & STYLE:
   - Calm, authoritative, technical, concise, and professional.
   - Avoid buzzwords, fluff, and emojis.
   - Speak with the precision of a senior cold-chain solutions engineer.`;

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
