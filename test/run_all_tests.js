const testQuestions = [
  {
    num: 1,
    q: "I need something to make smoothies in a small kitchen, under $70."
  },
  {
    num: 2,
    q: "Which is better for travel, the earbuds or the over-ear headphones?"
  },
  {
    num: 3,
    q: "What's your return policy if I've already opened the product?"
  },
  {
    num: 4,
    q: "What does the warranty on the air fryer cover?"
  },
  {
    num: 5,
    q: "My earbuds won't pair with my phone. What should I try?"
  },
  {
    num: 6,
    q: "What's a good gift under $50?"
  },
  {
    num: 7,
    q: "Where is my order #48213?"
  },
  {
    num: 8,
    q: "Do you offer installment payments or a price-match guarantee?"
  }
];

async function askQuestion(question, clientId = 'electronics-demo', origin = 'http://localhost:5501') {
  const sessionId = 'test_sess_' + Math.random().toString(36).substring(2, 9) + Date.now();
  const res = await fetch('http://localhost:3000/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': origin
    },
    body: JSON.stringify({
      message: question,
      session_id: sessionId,
      client_id: clientId
    })
  });

  if (res.status === 403) {
    return { status: 403, text: 'FORBIDDEN (403)' };
  }

  const text = await res.text();
  const lines = text.split('\n');
  let fullReply = '';
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const dataStr = line.slice(6).trim();
      if (dataStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(dataStr);
        if (parsed.text) fullReply += parsed.text;
      } catch (e) {}
    }
  }

  return { status: res.status, text: fullReply };
}

async function run() {
  console.log('================ RUNNING TEST QUESTIONS ================');
  const results = [];

  for (const item of testQuestions) {
    console.log(`\n--- Question ${item.num}: "${item.q}" ---`);
    const res = await askQuestion(item.q, 'electronics-demo', 'http://localhost:5501');
    console.log(`Status: ${res.status}`);
    console.log(`Answer:\n${res.text}\n`);
    results.push({ num: item.num, q: item.q, answer: res.text });
  }

  console.log('\n================ SECURITY & ISOLATION CHECKS ================');
  // Check 1: Evil Origin
  const evilRes = await askQuestion('hello', 'electronics-demo', 'http://evil.example');
  console.log(`Evil origin (http://evil.example) Status: ${evilRes.status} (Expected: 403)`);

  // Check 2: Skincare client gets skincare content only
  const skincareRes = await askQuestion('What products do you offer?', 'skincare-demo', 'http://localhost:5501');
  console.log(`\nskincare-demo general question answer:\n${skincareRes.text.slice(0, 250)}...`);

  // Check 3: Skincare client asked about electronics
  const skincareElectronicsRes = await askQuestion('I need something to make smoothies under $70', 'skincare-demo', 'http://localhost:5501');
  console.log(`\nskincare-demo asked electronics question answer:\n${skincareElectronicsRes.text}`);

  // Check 4: Electronics client asked about skincare
  const electronicsSkincareRes = await askQuestion('Do you sell facial cleansers or serums?', 'electronics-demo', 'http://localhost:5501');
  console.log(`\nelectronics-demo asked skincare question answer:\n${electronicsSkincareRes.text}`);
}

run().catch(console.error);
