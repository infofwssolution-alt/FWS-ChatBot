/**
 * ============================================================================
 * EMBEDDABLE AI CHAT WIDGET (VANILLA JAVASCRIPT - ZERO DEPENDENCIES)
 * Features:
 * - Real-time SSE streaming
 * - Configurable data attributes: data-client-id, data-api-url, data-title,
 *   data-greeting, data-color, data-avatar-url, data-position
 * - Safe markdown rendering in bot replies (bold, italics, links, lists, linebreaks)
 * - In-chat lead capture & appointment booking forms
 * - Isolated Shadow DOM & full mobile viewport optimization
 * ============================================================================
 */

(function () {
  'use strict';

  if (window.__AI_CHAT_WIDGET_INITIALIZED__) return;
  window.__AI_CHAT_WIDGET_INITIALIZED__ = true;

  const scriptTag = document.currentScript || document.querySelector('script[data-api-url]');
  const apiUrl = scriptTag?.getAttribute('data-api-url')?.replace(/\/+$/, '') || window.location.origin;
  const clientId = scriptTag?.getAttribute('data-client-id') || 'default';

  // Configurable attributes
  const chatTitle = scriptTag?.getAttribute('data-title') || 'Support Assistant';
  const chatGreeting = scriptTag?.getAttribute('data-greeting') || 'Hello! How can I help you today?';
  const primaryColor = scriptTag?.getAttribute('data-color') || '#2563eb';
  const avatarUrl = scriptTag?.getAttribute('data-avatar-url') || '';
  const position = (scriptTag?.getAttribute('data-position') || 'bottom-right').toLowerCase();

  const isLeft = position.includes('left');

  function getOrCreateSessionId() {
    const STORAGE_KEY = `ai_chat_session_${clientId}`;
    let sessionId = null;
    try {
      sessionId = sessionStorage.getItem(STORAGE_KEY);
      if (!sessionId) {
        sessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
        sessionStorage.setItem(STORAGE_KEY, sessionId);
      }
    } catch (e) {
      sessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
    }
    return sessionId;
  }

  const sessionId = getOrCreateSessionId();

  const hostElement = document.createElement('div');
  hostElement.id = 'ai-chatbot-widget-host';
  document.body.appendChild(hostElement);

  const shadow = hostElement.attachShadow({ mode: 'open' });

  // Safe markdown renderer without raw innerHTML
  function renderSafeMarkdown(rawText) {
    if (!rawText) return '';

    // 1. HTML entity escape to prevent XSS
    let escaped = rawText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    // 2. Bold: **text** or __text__
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/__(.*?)__/g, '<strong>$1</strong>');

    // 3. Italics: *text* or _text_
    escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
    escaped = escaped.replace(/_([^_]+)_/g, '<em>$1</em>');

    // 4. Inline code: `text`
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 5. Links: [text](https://url)
    escaped = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // 6. Split into lines to parse bullet lists and paragraphs
    const lines = escaped.split('\n');
    let inList = false;
    const outputLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const bulletMatch = line.match(/^\s*[-*•]\s+(.*)$/);

      if (bulletMatch) {
        if (!inList) {
          inList = true;
          outputLines.push('<ul>');
        }
        outputLines.push(`<li>${bulletMatch[1]}</li>`);
      } else {
        if (inList) {
          inList = false;
          outputLines.push('</ul>');
        }
        outputLines.push(line);
      }
    }
    if (inList) outputLines.push('</ul>');

    // Join remaining with line breaks, preserving lists cleanly
    return outputLines
      .join('\n')
      .replace(/\n{2,}/g, '<br><br>')
      .replace(/\n/g, '<br>')
      .replace(/<br><\/?(ul|li)>/g, '<$1>')
      .replace(/<\/?(ul|li)><br>/g, '<$1>');
  }

  const template = document.createElement('template');
  template.innerHTML = `
    <style>
      :host {
        --primary: ${primaryColor};
        --primary-hover: ${primaryColor};
        --surface: #ffffff;
        --surface-border: #e2e8f0;
        --header-bg: #0f172a;
        --header-border: #1e293b;
        --bot-bubble: #f1f5f9;
        --bot-bubble-border: #e2e8f0;
        --bot-text: #0f172a;
        --user-bubble: ${primaryColor};
        --user-text: #ffffff;
        --text-main: #0f172a;
        --text-muted: #64748b;
        --shadow-panel: 0 20px 40px -10px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.08);
        --shadow-launcher: 0 10px 25px -5px rgba(0, 0, 0, 0.25);
        --radius-panel: 14px;
        --radius-bubble: 10px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
        font-size: 13.5px;
        line-height: 1.5;
        box-sizing: border-box;
      }

      *, *::before, *::after {
        box-sizing: inherit;
        margin: 0;
        padding: 0;
      }

      /* Floating Launcher Button */
      .chat-launcher {
        position: fixed;
        bottom: 24px;
        ${isLeft ? 'left: 24px;' : 'right: 24px;'}
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: var(--primary);
        box-shadow: var(--shadow-launcher);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2147483647;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, opacity 0.2s ease;
        outline: none;
      }

      .chat-launcher:hover {
        transform: scale(1.06);
      }

      .chat-launcher:active {
        transform: scale(0.96);
      }

      .launcher-icon {
        width: 24px;
        height: 24px;
        fill: #ffffff;
        transition: transform 0.25s ease, opacity 0.25s ease;
      }

      .launcher-icon.close-icon {
        position: absolute;
        opacity: 0;
        transform: rotate(-90deg) scale(0.7);
      }

      .chat-launcher.is-active .chat-icon {
        opacity: 0;
        transform: rotate(90deg) scale(0.7);
      }

      .chat-launcher.is-active .close-icon {
        opacity: 1;
        transform: rotate(0) scale(1);
      }

      /* Chat Panel Window */
      .chat-panel {
        position: fixed;
        bottom: 90px;
        ${isLeft ? 'left: 24px;' : 'right: 24px;'}
        width: 380px;
        height: 560px;
        max-width: calc(100vw - 32px);
        max-height: calc(100vh - 110px);
        background: var(--surface);
        border: 1px solid var(--surface-border);
        border-radius: var(--radius-panel);
        box-shadow: var(--shadow-panel);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        z-index: 2147483646;
        opacity: 0;
        transform: translateY(16px) scale(0.97);
        pointer-events: none;
        transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .chat-panel.is-open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      /* Header */
      .panel-header {
        background: var(--header-bg);
        border-bottom: 1px solid var(--header-border);
        color: #ffffff;
        padding: 14px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .header-info {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .bot-avatar {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: var(--primary);
        color: #ffffff;
        font-weight: 700;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .bot-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .header-text h3 {
        font-size: 14px;
        font-weight: 700;
      }

      .header-text p {
        font-size: 11px;
        color: #94a3b8;
        display: flex;
        align-items: center;
        gap: 5px;
        margin-top: 1px;
      }

      .online-dot {
        width: 6px;
        height: 6px;
        background-color: #10b981;
        border-radius: 50%;
        display: inline-block;
      }

      .close-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: color 0.15s, background-color 0.15s;
      }

      .close-btn:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.1);
      }

      /* Messages Container */
      .panel-messages {
        flex: 1;
        padding: 16px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: #f8fafc;
      }

      .message-wrapper {
        display: flex;
        flex-direction: column;
        max-width: 85%;
        word-break: break-word;
      }

      .message-wrapper.user {
        align-self: flex-end;
      }

      .message-wrapper.bot {
        align-self: flex-start;
      }

      .bubble {
        padding: 10px 14px;
        border-radius: var(--radius-bubble);
        font-size: 13.5px;
        line-height: 1.5;
      }

      .message-wrapper.user .bubble {
        background: var(--user-bubble);
        color: var(--user-text);
        border-bottom-right-radius: 2px;
      }

      .message-wrapper.bot .bubble {
        background: var(--bot-bubble);
        color: var(--bot-text);
        border: 1px solid var(--bot-bubble-border);
        border-bottom-left-radius: 2px;
      }

      .bubble a {
        color: var(--primary);
        text-decoration: underline;
      }

      .bubble ul {
        margin: 6px 0 6px 18px;
        padding: 0;
      }

      .bubble li {
        margin-bottom: 3px;
      }

      .bubble code {
        background: rgba(0,0,0,0.06);
        padding: 2px 4px;
        border-radius: 4px;
        font-size: 12px;
      }

      .notice-bubble {
        background: #fef2f2 !important;
        border-color: #fecaca !important;
        color: #991b1b !important;
        font-size: 12.5px;
      }

      /* Typing indicator */
      .typing-indicator {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 8px 12px;
        background: var(--bot-bubble);
        border: 1px solid var(--bot-bubble-border);
        border-radius: var(--radius-bubble);
        width: fit-content;
      }

      .typing-dot {
        width: 6px;
        height: 6px;
        background: #94a3b8;
        border-radius: 50%;
        animation: typing 1.4s infinite ease-in-out both;
      }

      .typing-dot:nth-child(1) { animation-delay: -0.32s; }
      .typing-dot:nth-child(2) { animation-delay: -0.16s; }

      @keyframes typing {
        0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
        40% { transform: scale(1); opacity: 1; }
      }

      /* Inline Form Cards (Lead Capture & Booking) */
      .inline-card {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 12px;
        margin-top: 6px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      }

      .inline-card h4 {
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 6px;
        color: #0f172a;
      }

      .inline-card p {
        font-size: 12px;
        color: #64748b;
        margin-bottom: 8px;
      }

      .inline-card input, .inline-card textarea, .inline-card select {
        width: 100%;
        padding: 7px 10px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-size: 12.5px;
        margin-bottom: 6px;
        font-family: inherit;
      }

      .inline-card button {
        width: 100%;
        padding: 8px;
        background: var(--primary);
        color: #ffffff;
        border: none;
        border-radius: 6px;
        font-weight: 600;
        font-size: 12.5px;
        cursor: pointer;
        transition: opacity 0.2s;
      }

      .inline-card button:hover {
        opacity: 0.9;
      }

      /* Input Area */
      .panel-input-area {
        padding: 12px 14px;
        background: #ffffff;
        border-top: 1px solid var(--surface-border);
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .chat-input {
        flex: 1;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 13px;
        color: var(--text-main);
        outline: none;
        font-family: inherit;
      }

      .chat-input:focus {
        border-color: var(--primary);
      }

      .send-button {
        width: 36px;
        height: 36px;
        border-radius: 6px;
        background: var(--primary);
        border: none;
        color: #ffffff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .send-button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .send-button svg {
        width: 16px;
        height: 16px;
        fill: currentColor;
      }

      /* Mobile Full-Viewport Under 480px */
      @media (max-width: 480px) {
        .chat-panel {
          width: 100vw;
          height: 100%;
          max-width: 100vw;
          max-height: 100dvh;
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
          top: 0 !important;
          border-radius: 0;
          border: none;
        }

        .chat-launcher {
          bottom: 16px;
          ${isLeft ? 'left: 16px;' : 'right: 16px;'}
        }
      }
    </style>

    <button class="chat-launcher" id="chatLauncher" aria-label="Open support chat">
      <svg class="launcher-icon chat-icon" viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
        <circle cx="8" cy="10" r="1.5"/>
        <circle cx="12" cy="10" r="1.5"/>
        <circle cx="16" cy="10" r="1.5"/>
      </svg>
      <svg class="launcher-icon close-icon" viewBox="0 0 24 24">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </button>

    <div class="chat-panel" id="chatPanel" role="dialog" aria-hidden="true">
      <div class="panel-header">
        <div class="header-info">
          <div class="bot-avatar" id="botAvatar">
            ${avatarUrl ? `<img src="${avatarUrl}" alt="Avatar">` : chatTitle.charAt(0)}
          </div>
          <div class="header-text">
            <h3 id="panelTitle">${chatTitle}</h3>
            <p><span class="online-dot"></span> Online</p>
          </div>
        </div>
        <button class="close-btn" id="closePanelBtn" aria-label="Close chat window">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="panel-messages" id="panelMessages">
        <div class="message-wrapper bot">
          <div class="bubble">${chatGreeting}</div>
        </div>
      </div>

      <form class="panel-input-area" id="chatForm">
        <input 
          type="text" 
          id="chatInput" 
          class="chat-input" 
          placeholder="Ask a question..." 
          maxlength="500"
          autocomplete="off" 
          aria-label="Your message"
        />
        <button type="submit" class="send-button" id="sendBtn" aria-label="Send message">
          <svg viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </form>
    </div>
  `;

  shadow.appendChild(template.content.cloneNode(true));

  const launcher = shadow.getElementById('chatLauncher');
  const panel = shadow.getElementById('chatPanel');
  const closeBtn = shadow.getElementById('closePanelBtn');
  const messagesContainer = shadow.getElementById('panelMessages');
  const chatForm = shadow.getElementById('chatForm');
  const chatInput = shadow.getElementById('chatInput');
  const sendBtn = shadow.getElementById('sendBtn');

  let isSending = false;

  const IS_OPEN_KEY = `ai_chat_open_${clientId}`;
  const HISTORY_KEY = `ai_chat_history_${clientId}`;

  let chatHistory = [];
  try {
    const rawHist = sessionStorage.getItem(HISTORY_KEY);
    if (rawHist) {
      const parsed = JSON.parse(rawHist);
      if (Array.isArray(parsed) && parsed.length > 0) {
        chatHistory = parsed;
      }
    }
  } catch (_) {}

  function saveChatHistory() {
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(chatHistory));
    } catch (_) {}
  }

  function appendMessageToDOM(sender, text, isNotice = false) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${sender}`;

    const bubble = document.createElement('div');
    bubble.className = isNotice ? 'bubble notice-bubble' : 'bubble';

    if (sender === 'bot' && !isNotice) {
      bubble.innerHTML = renderSafeMarkdown(text);
    } else {
      bubble.textContent = text;
    }

    wrapper.appendChild(bubble);
    messagesContainer.appendChild(wrapper);
    scrollToBottom();
    return bubble;
  }

  // Restore previous message history in same tab if any
  if (chatHistory.length > 0) {
    messagesContainer.innerHTML = '';
    chatHistory.forEach((msg) => {
      appendMessageToDOM(msg.sender, msg.text, msg.isNotice);
    });
  }

  try {
    const wasOpen = sessionStorage.getItem(IS_OPEN_KEY) === 'true';
    if (wasOpen) {
      panel.classList.add('is-open');
      launcher.classList.add('is-active');
      panel.setAttribute('aria-hidden', 'false');
      setTimeout(scrollToBottom, 60);
    }
  } catch (_) {}

  function toggleChat() {
    const isOpen = panel.classList.toggle('is-open');
    launcher.classList.toggle('is-active', isOpen);
    panel.setAttribute('aria-hidden', String(!isOpen));
    try {
      sessionStorage.setItem(IS_OPEN_KEY, String(isOpen));
    } catch (_) {}
    if (isOpen) {
      setTimeout(() => chatInput.focus(), 150);
      scrollToBottom();
    }
  }

  launcher.addEventListener('click', toggleChat);
  closeBtn.addEventListener('click', toggleChat);

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function appendMessage(sender, text, isNotice = false) {
    const bubble = appendMessageToDOM(sender, text, isNotice);
    if (text) {
      chatHistory.push({ sender, text, isNotice });
      saveChatHistory();
    }
    return bubble;
  }

  function showTypingIndicator() {
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper bot';
    wrapper.id = 'typingIndicator';

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = `
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    `;

    wrapper.appendChild(indicator);
    messagesContainer.appendChild(wrapper);
    scrollToBottom();
    return wrapper;
  }

  function removeTypingIndicator() {
    const indicator = shadow.getElementById('typingIndicator');
    if (indicator) {
      indicator.remove();
    }
  }

  /**
   * Renders in-widget lead capture card for human handoff
   */
  function renderLeadCaptureCard() {
    if (shadow.getElementById('leadCaptureCard')) return;

    const card = document.createElement('div');
    card.className = 'inline-card';
    card.id = 'leadCaptureCard';
    card.innerHTML = `
      <h4>Connect With Our Team</h4>
      <p>Leave your details and a specialist will contact you directly.</p>
      <input type="text" id="leadName" placeholder="Your Name" required />
      <input type="text" id="leadContact" placeholder="Email or Phone Number" required />
      <textarea id="leadMessage" placeholder="How can we help?" rows="2"></textarea>
      <button type="button" id="submitLeadBtn">Send Message</button>
      <div id="leadStatus" style="font-size:12px; margin-top:4px;"></div>
    `;

    messagesContainer.appendChild(card);
    scrollToBottom();

    const submitBtn = card.querySelector('#submitLeadBtn');
    submitBtn.addEventListener('click', async () => {
      const name = card.querySelector('#leadName').value.trim();
      const contact = card.querySelector('#leadContact').value.trim();
      const message = card.querySelector('#leadMessage').value.trim();
      const statusDiv = card.querySelector('#leadStatus');

      if (!name || !contact) {
        statusDiv.style.color = '#dc2626';
        statusDiv.textContent = 'Please provide both your name and contact info.';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      try {
        const res = await fetch(`${apiUrl}/lead`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, contact, message, client_id: clientId, session_id: sessionId }),
        });
        const data = await res.json();
        if (res.ok) {
          card.innerHTML = `
            <div style="color:#15803d; font-weight:600; font-size:13px;">✓ Message Received</div>
            <p style="font-size:12px; margin-top:4px;">${data.message || 'Our team will contact you shortly.'}</p>
          `;
        } else {
          statusDiv.style.color = '#dc2626';
          statusDiv.textContent = data.error || 'Submission failed.';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send Message';
        }
      } catch (err) {
        statusDiv.style.color = '#dc2626';
        statusDiv.textContent = 'Connection error. Please try again.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Message';
      }
    });
  }

  /**
   * Renders appointment booking card
   */
  function renderAppointmentBookingCard() {
    if (shadow.getElementById('bookingCard')) return;

    const card = document.createElement('div');
    card.className = 'inline-card';
    card.id = 'bookingCard';
    card.innerHTML = `
      <h4>Request Consultation / Appointment</h4>
      <p>Select your preferred time slot. Our team will verify and confirm.</p>
      <input type="text" id="bookName" placeholder="Your Name" required />
      <input type="text" id="bookContact" placeholder="Phone or Email" required />
      <input type="text" id="bookTime" placeholder="Preferred Date / Time" required />
      <button type="button" id="submitBookBtn">Request Appointment</button>
      <div id="bookStatus" style="font-size:12px; margin-top:4px;"></div>
    `;

    messagesContainer.appendChild(card);
    scrollToBottom();

    const submitBtn = card.querySelector('#submitBookBtn');
    submitBtn.addEventListener('click', async () => {
      const name = card.querySelector('#bookName').value.trim();
      const contact = card.querySelector('#bookContact').value.trim();
      const preferred_time = card.querySelector('#bookTime').value.trim();
      const statusDiv = card.querySelector('#bookStatus');

      if (!name || !contact) {
        statusDiv.style.color = '#dc2626';
        statusDiv.textContent = 'Please provide your name and contact details.';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting Request...';

      try {
        const res = await fetch(`${apiUrl}/booking`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, contact, preferred_time, client_id: clientId, session_id: sessionId }),
        });
        const data = await res.json();
        if (res.ok) {
          card.innerHTML = `
            <div style="color:#15803d; font-weight:600; font-size:13px;">✓ Request Submitted</div>
            <p style="font-size:12px; margin-top:4px;">${data.message}</p>
          `;
        } else {
          statusDiv.style.color = '#dc2626';
          statusDiv.textContent = data.error || 'Failed to submit booking.';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Request Appointment';
        }
      } catch (err) {
        statusDiv.style.color = '#dc2626';
        statusDiv.textContent = 'Connection error. Please try again.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Request Appointment';
      }
    });
  }

  function handleDetectedTriggers(text) {
    const lower = text.toLowerCase();
    if (
      lower.includes("get you in touch with the team") ||
      lower.includes("connect directly with our solutions team") ||
      lower.includes("leave your details") ||
      lower.includes("contact our team directly") ||
      lower.includes("human agent") ||
      lower.includes("[[action:show_form:lead]]")
    ) {
      renderLeadCaptureCard();
    }

    if (
      lower.includes("book an appointment") ||
      lower.includes("schedule a consultation") ||
      lower.includes("book a consultation") ||
      lower.includes("[[action:show_form:booking]]")
    ) {
      renderAppointmentBookingCard();
    }
  }

  /**
   * Chat Form Submission
   */
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (!message || isSending) return;

    if (message.length > 500) {
      appendMessage('bot', 'Please keep your message under 500 characters so I can best assist you.', true);
      return;
    }

    appendMessage('user', message);
    chatInput.value = '';
    isSending = true;
    chatInput.disabled = true;
    sendBtn.disabled = true;

    showTypingIndicator();

    try {
      const response = await fetch(`${apiUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          session_id: sessionId,
          client_id: clientId,
        }),
      });

      if (response.status === 403) {
        removeTypingIndicator();
        appendMessage('bot', '⚠️ Chat is disabled for this website domain. Please check allowed origins.', true);
        return;
      }

      if (response.status === 429) {
        removeTypingIndicator();
        let errorMsg = "You've reached the message limit, please try again later.";
        try {
          const data = await response.json();
          if (data?.error) errorMsg = data.error;
        } catch (_) {}
        appendMessage('bot', `⏳ ${errorMsg}`, true);
        return;
      }

      if (!response.ok) {
        removeTypingIndicator();
        let errMsg = 'Our chat service encountered an error. Please try again in a moment.';
        try {
          const errData = await response.json();
          if (errData?.error) errMsg = errData.error;
        } catch (_) {}
        appendMessage('bot', errMsg, true);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let botBubble = null;
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const dataPayload = trimmed.slice(5).trim();
          if (dataPayload === '[DONE]') {
            continue;
          }

          try {
            const parsed = JSON.parse(dataPayload);
            if (parsed.text) {
              if (!botBubble) {
                removeTypingIndicator();
                botBubble = appendMessage('bot', '');
              }
              accumulatedText += parsed.text;
              botBubble.innerHTML = renderSafeMarkdown(accumulatedText);
              scrollToBottom();
            } else if (parsed.error) {
              if (!botBubble) removeTypingIndicator();
              appendMessage('bot', parsed.error, true);
            }
          } catch (_) {}
        }
      }

      removeTypingIndicator();

      if (botBubble && accumulatedText) {
        chatHistory.push({ sender: 'bot', text: accumulatedText, isNotice: false });
        saveChatHistory();
      }

      handleDetectedTriggers(accumulatedText);

    } catch (networkErr) {
      console.error('[Chat Widget] Connection error:', networkErr);
      removeTypingIndicator();
      appendMessage('bot', 'Unable to reach the server. Please check your internet connection.', true);
    } finally {
      isSending = false;
      chatInput.disabled = false;
      sendBtn.disabled = false;
      chatInput.focus();
    }
  });

})();
