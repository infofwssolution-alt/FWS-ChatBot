/**
 * ============================================================================
 * EMBEDDABLE AI CHAT WIDGET (VANILLA JAVASCRIPT - ZERO DEPENDENCIES)
 * ============================================================================
 *
 * Embed snippet:
 * <script src="http://localhost:3000/widget/widget.js" 
 *         data-api-url="http://localhost:3000" 
 *         data-client-id="client-demo" 
 *         defer></script>
 */

(function () {
  'use strict';

  // Prevent double injection if script is included twice
  if (window.__AI_CHAT_WIDGET_INITIALIZED__) return;
  window.__AI_CHAT_WIDGET_INITIALIZED__ = true;

  /**
   * 1. Read configuration from script tag attributes
   */
  const scriptTag = document.currentScript || document.querySelector('script[data-api-url]');
  const apiUrl = scriptTag?.getAttribute('data-api-url')?.replace(/\/+$/, '') || window.location.origin;
  const clientId = scriptTag?.getAttribute('data-client-id') || 'default-client';

  /**
   * ==========================================================================
   * WHY sessionStorage INSTEAD OF localStorage:
   * ==========================================================================
   * 1. Ephemeral Visit Lifecycle:
   *    `sessionStorage` is strictly scoped to the active browser tab and window 
   *    lifecycle. When a visitor closes the tab or window, the session ID is 
   *    automatically purged. With `localStorage`, a stale session ID would persist 
   *    indefinitely across days or weeks, incorrectly conflating separate visits into 
   *    one long-running context.
   *
   * 2. Privacy & Shared Device Protection:
   *    On public or shared computers (e.g. libraries, offices, family PCs), 
   *    `localStorage` retains identifiable tokens and state indefinitely. 
   *    `sessionStorage` guarantees that the conversation token dies when the tab 
   *    is closed, preventing subsequent users of that computer from inheriting the session.
   *
   * 3. Rate Limit & Window Reset Alignment:
   *    Our backend rate limiter operates on a rolling hourly window per `session_id`. 
   *    Using `sessionStorage` ensures clean session resets for fresh user visits while 
   *    preventing accidental permanent lockouts due to permanently persisted storage.
   * ==========================================================================
   */
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
      // Fallback if third-party cookies/storage are disabled
      sessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
    }
    return sessionId;
  }

  const sessionId = getOrCreateSessionId();

  // 2. Create host container and Shadow DOM
  const hostElement = document.createElement('div');
  hostElement.id = 'ai-chatbot-widget-host';
  document.body.appendChild(hostElement);

  // Attach Shadow DOM so host site CSS never bleeds into or out of widget
  const shadow = hostElement.attachShadow({ mode: 'open' });

  // 3. Define Widget Template & Isolated CSS
  const template = document.createElement('template');
  template.innerHTML = `
    <style>
      :host {
        --primary: #7c2f2f;
        --primary-hover: #682323;
        --primary-gradient: linear-gradient(135deg, #8c3636 0%, #682323 100%);
        --surface: #ffffff;
        --surface-subtle: #fcfbf8;
        --border: #e8dfd1;
        --text-main: #20283a;
        --text-muted: #78716c;
        --bot-bubble: #f4ede2;
        --bot-text: #20283a;
        --shadow-lg: 0 20px 25px -5px rgba(32, 40, 58, 0.12), 0 8px 10px -6px rgba(32, 40, 58, 0.08);
        --shadow-bubble: 0 10px 18px -3px rgba(124, 47, 47, 0.35), 0 4px 6px -4px rgba(124, 47, 47, 0.2);
        --radius-lg: 18px;
        --radius-md: 14px;
        --radius-sm: 8px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        box-sizing: border-box;
      }

      *, *::before, *::after {
        box-sizing: inherit;
        margin: 0;
        padding: 0;
      }

      /* Floating Bubble Button */
      .chat-launcher {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: var(--primary-gradient);
        box-shadow: var(--shadow-bubble);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2147483647;
        transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
        outline: none;
      }

      .chat-launcher:hover {
        transform: scale(1.08);
        box-shadow: 0 14px 20px -3px rgba(79, 70, 229, 0.45);
      }

      .chat-launcher:active {
        transform: scale(0.96);
      }

      .launcher-icon {
        width: 28px;
        height: 28px;
        fill: #ffffff;
        transition: transform 0.3s ease, opacity 0.3s ease;
      }

      .launcher-icon.close-icon {
        position: absolute;
        opacity: 0;
        transform: rotate(-90deg) scale(0.6);
      }

      .chat-launcher.is-active .chat-icon {
        opacity: 0;
        transform: rotate(90deg) scale(0.6);
      }

      .chat-launcher.is-active .close-icon {
        opacity: 1;
        transform: rotate(0) scale(1);
      }

      /* Chat Panel Window */
      .chat-panel {
        position: fixed;
        bottom: 96px;
        right: 24px;
        width: 380px;
        height: 560px;
        max-width: calc(100vw - 32px);
        max-height: calc(100vh - 120px);
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        z-index: 2147483646;
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        pointer-events: none;
        transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .chat-panel.is-open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      /* Header */
      .panel-header {
        background: var(--primary-gradient);
        color: #ffffff;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .header-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .bot-avatar {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 16px;
      }

      .header-text h3 {
        font-size: 16px;
        font-weight: 600;
        letter-spacing: -0.01em;
      }

      .header-text p {
        font-size: 12px;
        opacity: 0.88;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .online-dot {
        width: 7px;
        height: 7px;
        background-color: #4ade80;
        border-radius: 50%;
        display: inline-block;
      }

      .close-btn {
        background: transparent;
        border: none;
        color: #ffffff;
        cursor: pointer;
        opacity: 0.8;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: opacity 0.2s, background 0.2s;
      }

      .close-btn:hover {
        opacity: 1;
        background: rgba(255, 255, 255, 0.15);
      }

      /* Messages Container */
      .panel-messages {
        flex: 1;
        padding: 18px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 14px;
        background: var(--surface-subtle);
      }

      .message-wrapper {
        display: flex;
        flex-direction: column;
        max-width: 82%;
        animation: fadeIn 0.2s ease-out;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .message-wrapper.bot {
        align-self: flex-start;
      }

      .message-wrapper.user {
        align-self: flex-end;
      }

      .bubble {
        padding: 11px 15px;
        border-radius: var(--radius-md);
        word-break: break-word;
        white-space: pre-wrap;
        line-height: 1.48;
      }

      .message-wrapper.bot .bubble {
        background: var(--bot-bubble);
        color: var(--bot-text);
        border-bottom-left-radius: 4px;
      }

      .message-wrapper.user .bubble {
        background: var(--primary-gradient);
        color: #ffffff;
        border-bottom-right-radius: 4px;
      }

      .notice-bubble {
        background: #fef2f2 !important;
        border: 1px solid #fecaca;
        color: #991b1b !important;
        font-size: 13px;
        border-radius: var(--radius-md) !important;
        padding: 12px 14px !important;
      }

      /* Animated Typing Indicator */
      .typing-indicator {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 12px 16px;
        background: var(--bot-bubble);
        border-radius: var(--radius-md);
        border-bottom-left-radius: 4px;
        width: fit-content;
      }

      .typing-dot {
        width: 6px;
        height: 6px;
        background: #94a3b8;
        border-radius: 50%;
        animation: bounce 1.4s infinite ease-in-out both;
      }

      .typing-dot:nth-child(1) { animation-delay: -0.32s; }
      .typing-dot:nth-child(2) { animation-delay: -0.16s; }

      @keyframes bounce {
        0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
        40% { transform: scale(1.1); opacity: 1; }
      }

      /* Input Footer */
      .panel-input-area {
        padding: 12px 16px;
        background: var(--surface);
        border-top: 1px solid var(--border);
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .chat-input {
        flex: 1;
        border: 1px solid var(--border);
        background: #f8fafc;
        border-radius: 24px;
        padding: 10px 16px;
        font-size: 14px;
        color: var(--text-main);
        outline: none;
        transition: border-color 0.2s, background 0.2s;
      }

      .chat-input:focus {
        border-color: var(--primary);
        background: #ffffff;
      }

      .send-button {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: var(--primary-gradient);
        border: none;
        color: #ffffff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.15s ease, opacity 0.2s ease;
        flex-shrink: 0;
      }

      .send-button:hover:not(:disabled) {
        transform: scale(1.06);
      }

      .send-button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .send-button svg {
        width: 17px;
        height: 17px;
        fill: currentColor;
        transform: translateX(1px);
      }
    </style>

    <!-- Floating Chat Launcher Button -->
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

    <!-- Chat Panel -->
    <div class="chat-panel" id="chatPanel" role="dialog" aria-hidden="true">
      <div class="panel-header">
        <div class="header-info">
          <div class="bot-avatar">🌸</div>
          <div class="header-text">
            <h3>Notebloom Assistant</h3>
            <p><span class="online-dot"></span> Aesthetic Stationery & Help</p>
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
          <div class="bubble">Hello! 🌸 Welcome to Notebloom. Ask me anything about our Korean stationery, journals, notebooks, pens, prices, or order tracking!</div>
        </div>
      </div>

      <form class="panel-input-area" id="chatForm">
        <input 
          type="text" 
          id="chatInput" 
          class="chat-input" 
          placeholder="Ask a question..." 
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

  // DOM Elements
  const launcher = shadow.getElementById('chatLauncher');
  const panel = shadow.getElementById('chatPanel');
  const closeBtn = shadow.getElementById('closePanelBtn');
  const messagesContainer = shadow.getElementById('panelMessages');
  const chatForm = shadow.getElementById('chatForm');
  const chatInput = shadow.getElementById('chatInput');
  const sendBtn = shadow.getElementById('sendBtn');

  let isSending = false;

  // Toggle Panel Open/Close
  function toggleChat() {
    const isOpen = panel.classList.toggle('is-open');
    launcher.classList.toggle('is-active', isOpen);
    panel.setAttribute('aria-hidden', String(!isOpen));
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

  /**
   * Appends a message bubble into the conversation view
   */
  function appendMessage(sender, text, isNotice = false) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${sender}`;

    const bubble = document.createElement('div');
    bubble.className = isNotice ? 'bubble notice-bubble' : 'bubble';
    bubble.textContent = text;

    wrapper.appendChild(bubble);
    messagesContainer.appendChild(wrapper);
    scrollToBottom();
    return bubble;
  }

  /**
   * Appends typing indicator dots
   */
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
   * Form submission and SSE stream consumption
   */
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (!message || isSending) return;

    // Display user message
    appendMessage('user', message);
    chatInput.value = '';
    isSending = true;
    chatInput.disabled = true;
    sendBtn.disabled = true;

    // Show typing dots before first token arrives
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
        }),
      });

      // Handle 403 Forbidden (Bad Origin)
      if (response.status === 403) {
        removeTypingIndicator();
        appendMessage('bot', '⚠️ Chat is currently disabled for this website domain. Please contact support.', true);
        return;
      }

      // Handle 429 Rate Limit Exceeded
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

      // Handle generic server errors
      if (!response.ok) {
        removeTypingIndicator();
        appendMessage('bot', 'Sorry, our chat service encountered an error. Please try again in a moment.', true);
        return;
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let botBubble = null;
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Retain incomplete line

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
              // When first token lands, remove typing indicator and mount bubble
              if (!botBubble) {
                removeTypingIndicator();
                botBubble = appendMessage('bot', '');
              }
              botBubble.textContent += parsed.text;
              scrollToBottom();
            } else if (parsed.error) {
              if (!botBubble) removeTypingIndicator();
              appendMessage('bot', parsed.error, true);
            }
          } catch (jsonErr) {
            // Non-JSON SSE event ignored
          }
        }
      }

      // Fallback if stream completed with no tokens
      removeTypingIndicator();

    } catch (networkErr) {
      console.error('[Chat Widget] Connection failed:', networkErr);
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
