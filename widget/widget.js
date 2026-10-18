/**
 * ============================================================================
 * EMBEDDABLE AI CHAT WIDGET (VANILLA JAVASCRIPT - ZERO DEPENDENCIES)
 * Features:
 * - Real-time SSE streaming
 * - Automatic site navigation
 * - In-chat automatic Add-to-Cart with redirect to checkout
 * - In-chat appointment booking for custom sourcing
 * - In-chat quick ordering with WhatsApp confirmation
 * - Isolated Shadow DOM
 * ============================================================================
 */

(function () {
  'use strict';

  if (window.__AI_CHAT_WIDGET_INITIALIZED__) return;
  window.__AI_CHAT_WIDGET_INITIALIZED__ = true;

  const scriptTag = document.currentScript || document.querySelector('script[data-api-url]');
  const apiUrl = scriptTag?.getAttribute('data-api-url')?.replace(/\/+$/, '') || window.location.origin;
  const clientId = scriptTag?.getAttribute('data-client-id') || 'kelvyn';

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

  const template = document.createElement('template');
  template.innerHTML = `
    <style>
      :host {
        --primary: #f59e0b;
        --primary-hover: #d97706;
        --surface: rgba(255, 255, 255, 0.94);
        --surface-border: #e2e8f0;
        --header-bg: #111827;
        --header-border: #1f2937;
        --bot-bubble: #f1f5f9;
        --bot-bubble-border: #e2e8f0;
        --bot-text: #0f172a;
        --user-bubble: #f59e0b;
        --user-text: #0b0f17;
        --text-main: #0f172a;
        --text-muted: #64748b;
        --shadow-panel: 0 24px 48px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.08);
        --shadow-launcher: 0 10px 25px -5px rgba(245, 158, 11, 0.4), 0 8px 10px -6px rgba(245, 158, 11, 0.2);
        --radius-panel: 14px;
        --radius-bubble: 8px;
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

      /* Floating Launcher Button - Industrial Minimalist */
      .chat-launcher {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 54px;
        height: 54px;
        border-radius: 50%;
        background: #f59e0b;
        box-shadow: var(--shadow-launcher);
        border: 1px solid rgba(217, 119, 6, 0.5);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2147483647;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, background-color 0.2s;
        outline: none;
      }

      .chat-launcher:hover {
        transform: scale(1.06);
        background: #fbbf24;
        box-shadow: 0 14px 28px -4px rgba(245, 158, 11, 0.5);
      }

      .chat-launcher:active {
        transform: scale(0.96);
      }

      .launcher-icon {
        width: 22px;
        height: 22px;
        fill: #0b0f17;
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

      /* Chat Panel Window - Glassmorphic / CAD Precision */
      .chat-panel {
        position: fixed;
        bottom: 90px;
        right: 24px;
        width: 380px;
        height: 560px;
        max-width: calc(100vw - 32px);
        max-height: calc(100vh - 110px);
        background: #ffffff;
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

      /* Header - Clean Technical Obsidian Header */
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
        border-radius: 6px;
        background: #f59e0b;
        color: #0b0f17;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-weight: 800;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(255, 255, 255, 0.15);
      }

      .header-text h3 {
        font-size: 13.5px;
        font-weight: 700;
        letter-spacing: -0.01em;
        font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif;
      }

      .header-text p {
        font-size: 11px;
        color: #94a3b8;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        letter-spacing: 0.02em;
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
        background: rgba(255, 255, 255, 0.08);
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
        background-image: 
          linear-gradient(to right, rgba(15, 23, 42, 0.04) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(15, 23, 42, 0.04) 1px, transparent 1px);
        background-size: 24px 24px;
      }

      .message-wrapper {
        display: flex;
        flex-direction: column;
        max-width: 88%;
        animation: fadeIn 0.15s ease-out;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .message-wrapper.bot {
        align-self: flex-start;
      }

      .message-wrapper.user {
        align-self: flex-end;
      }

      .bubble {
        padding: 10px 14px;
        border-radius: var(--radius-bubble);
        word-break: break-word;
        white-space: pre-wrap;
        line-height: 1.5;
        font-size: 13px;
      }

      .message-wrapper.bot .bubble {
        background: #ffffff;
        color: var(--bot-text);
        border: 1px solid var(--bot-bubble-border);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      }

      .message-wrapper.user .bubble {
        background: #f59e0b;
        color: #0b0f17;
        font-weight: 500;
        border: 1px solid #d97706;
        box-shadow: 0 1px 3px rgba(245, 158, 11, 0.2);
      }

      .notice-bubble {
        background: #fffbeb !important;
        border: 1px solid #fef3c7;
        color: #92400e !important;
        font-size: 12px;
        border-radius: var(--radius-bubble) !important;
        padding: 10px 12px !important;
      }

      /* Animated Typing Indicator */
      .typing-indicator {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 10px 14px;
        background: #ffffff;
        border: 1px solid var(--bot-bubble-border);
        border-radius: var(--radius-bubble);
        width: fit-content;
      }

      .typing-dot {
        width: 5px;
        height: 5px;
        background: #94a3b8;
        border-radius: 50%;
        animation: bounce 1.4s infinite ease-in-out both;
      }

      .typing-dot:nth-child(1) { animation-delay: -0.32s; }
      .typing-dot:nth-child(2) { animation-delay: -0.16s; }

      @keyframes bounce {
        0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
        40% { transform: scale(1.1); opacity: 1; }
      }

      /* Input Footer - Clean Minimalist Box */
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
        background: #ffffff;
        border-radius: 6px;
        padding: 9px 12px;
        font-size: 13px;
        color: var(--text-main);
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
      }

      .chat-input:focus {
        border-color: #f59e0b;
        box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.15);
      }

      .chat-input::placeholder {
        color: #94a3b8;
        font-size: 12.5px;
      }

      .send-button {
        width: 36px;
        height: 36px;
        border-radius: 6px;
        background: #f59e0b;
        border: 1px solid #d97706;
        color: #0b0f17;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.15s, transform 0.1s;
        flex-shrink: 0;
      }

      .send-button:hover:not(:disabled) {
        background: #fbbf24;
      }

      .send-button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .send-button svg {
        width: 15px;
        height: 15px;
        fill: currentColor;
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
          <div class="bot-avatar">&#176;K</div>
          <div class="header-text">
            <h3>Kelvyn Assistant</h3>
            
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
          <div class="bubble">Welcome to Kelvyn. I'm here to answer questions regarding our wireless IoT sensors (Probe, Reefer, Vault), FDA 21 CFR Part 11 / GDP compliance, pricing tiers, and our 30-Day Free Pilot program. How can I help you today?</div>
        </div>
      </div>

      <form class="panel-input-area" id="chatForm">
        <input 
          type="text" 
          id="chatInput" 
          class="chat-input" 
          placeholder="Ask about sensors, compliance, or pilot..." 
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

  // Session-scoped persistence keys (tab-specific: persists across navigations in same tab, resets on new tab)
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
    bubble.textContent = text;

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

  // Restore open/closed state across navigations in same tab
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
   * Helper: Add item to Notebloom guest cart cookie and redirect
   */
  function addToCartAndRedirect(bookId, qty = 1, redirectUrl = '/cart') {
    let cart = [];
    try {
      const match = document.cookie.match(/(?:^|; )notebloom_cart=([^;]*)/);
      if (match) cart = JSON.parse(decodeURIComponent(match[1]));
      if (!Array.isArray(cart)) cart = [];
    } catch (_) {}

    const idx = cart.findIndex((it) => Number(it.book_id) === Number(bookId));
    if (idx >= 0) {
      cart[idx].quantity = (Number(cart[idx].quantity) || 1) + qty;
    } else {
      cart.push({ book_id: Number(bookId), quantity: qty, color: null });
    }

    // Set cookie for 30 days
    document.cookie = `notebloom_cart=${encodeURIComponent(JSON.stringify(cart))}; path=/; max-age=2592000; SameSite=Lax`;

    // Perform redirect after short visual confirmation
    setTimeout(() => {
      window.location.href = redirectUrl;
    }, 1200);
  }

  /**
   * Helper: Render interactive appointment booking card in chat
   */
  function renderAppointmentBookingCard() {
    const card = document.createElement('div');
    card.className = 'chat-interactive-card';
    card.innerHTML = `
      <h4>📅 Book Custom Sourcing Consultation</h4>
      <p style="font-size:12px; color:var(--text-muted);">Speak with our team regarding custom stationery, bulk orders, or wedding favors.</p>
      <div class="form-field">
        <label>Your Name *</label>
        <input type="text" class="form-control" id="aptName" placeholder="e.g. Ayesha Khan" required />
      </div>
      <div class="form-field">
        <label>WhatsApp / Phone *</label>
        <input type="tel" class="form-control" id="aptPhone" placeholder="0333XXXXXXX" required />
      </div>
      <div class="form-field">
        <label>Preferred Date / Time</label>
        <input type="text" class="form-control" id="aptDate" placeholder="e.g. Next Monday 3 PM" />
      </div>
      <div class="form-field">
        <label>Project Details / Notes</label>
        <input type="text" class="form-control" id="aptNotes" placeholder="e.g. 100 customized notebooks with logo" />
      </div>
      <button type="button" class="form-submit-btn" id="aptSubmitBtn">Submit Booking Request 🌸</button>
      <div id="aptStatus"></div>
    `;

    messagesContainer.appendChild(card);
    scrollToBottom();

    const submitBtn = card.querySelector('#aptSubmitBtn');
    submitBtn.addEventListener('click', async () => {
      const name = card.querySelector('#aptName').value.trim();
      const phone = card.querySelector('#aptPhone').value.trim();
      const date = card.querySelector('#aptDate').value.trim();
      const message = card.querySelector('#aptNotes').value.trim();
      const statusDiv = card.querySelector('#aptStatus');

      if (!name || !phone) {
        statusDiv.innerHTML = '<p style="color:#b91c1c; font-size:12px;">Please enter your name and phone number.</p>';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving Booking...';

      try {
        const res = await fetch(`${apiUrl}/appointments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone, date, message, session_id: sessionId }),
        });
        const data = await res.json();
        if (data.success) {
          card.innerHTML = `
            <div style="color:#15803d; font-weight:600; font-size:13px;">✅ Consultation Request Submitted!</div>
            <p style="font-size:12px; margin-top:4px;">We have received your details and will contact you via WhatsApp / phone shortly.</p>
            <a href="${data.whatsappUrl}" target="_blank" class="wa-confirm-btn">📱 Confirm via WhatsApp</a>
          `;
        } else {
          statusDiv.innerHTML = `<p style="color:#b91c1c; font-size:12px;">${data.error || 'Failed to submit'}</p>`;
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Booking Request 🌸';
        }
      } catch (err) {
        statusDiv.innerHTML = '<p style="color:#b91c1c; font-size:12px;">Connection error. Please try again.</p>';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Booking Request 🌸';
      }
    });
  }

  /**
   * Helper: Render interactive quick order form in chat
   */
  function renderQuickOrderCard() {
    const card = document.createElement('div');
    card.className = 'chat-interactive-card';
    card.innerHTML = `
      <h4>🛍️ Quick Order Form</h4>
      <p style="font-size:12px; color:var(--text-muted);">Place an order directly from chat without going through full checkout!</p>
      <div class="form-field">
        <label>Full Name *</label>
        <input type="text" class="form-control" id="ordName" placeholder="Your Name" required />
      </div>
      <div class="form-field">
        <label>WhatsApp / Phone *</label>
        <input type="tel" class="form-control" id="ordPhone" placeholder="0333XXXXXXX" required />
      </div>
      <div class="form-field">
        <label>Delivery Address *</label>
        <input type="text" class="form-control" id="ordAddress" placeholder="Street, Area, City" required />
      </div>
      <div class="form-field">
        <label>Items & Quantity *</label>
        <input type="text" class="form-control" id="ordItems" placeholder="e.g. 1 Scented Chocolate Notebook, 1 Diamond Pen" required />
      </div>
      <div class="form-field">
        <label>Payment Method</label>
        <select class="form-control" id="ordPayment">
          <option value="Cash on Delivery (COD)">Cash on Delivery (COD)</option>
          <option value="Bank Transfer">Advance Bank Transfer</option>
          <option value="JazzCash / EasyPaisa">JazzCash / EasyPaisa</option>
        </select>
      </div>
      <button type="button" class="form-submit-btn" id="ordSubmitBtn">Place Quick Order 📦</button>
      <div id="ordStatus"></div>
    `;

    messagesContainer.appendChild(card);
    scrollToBottom();

    const submitBtn = card.querySelector('#ordSubmitBtn');
    submitBtn.addEventListener('click', async () => {
      const name = card.querySelector('#ordName').value.trim();
      const phone = card.querySelector('#ordPhone').value.trim();
      const address = card.querySelector('#ordAddress').value.trim();
      const items = card.querySelector('#ordItems').value.trim();
      const paymentMethod = card.querySelector('#ordPayment').value;
      const statusDiv = card.querySelector('#ordStatus');

      if (!name || !phone || !address || !items) {
        statusDiv.innerHTML = '<p style="color:#b91c1c; font-size:12px;">Please fill in all required fields.</p>';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Recording Order...';

      try {
        const res = await fetch(`${apiUrl}/quick-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone, address, items, paymentMethod, session_id: sessionId }),
        });
        const data = await res.json();
        if (data.success) {
          card.innerHTML = `
            <div style="color:#15803d; font-weight:600; font-size:13px;">🎉 Order ${data.orderCode} Confirmed!</div>
            <p style="font-size:12px; margin-top:4px;">Thank you! We have logged your order and will confirm it before dispatch.</p>
            <a href="${data.whatsappUrl}" target="_blank" class="wa-confirm-btn">📱 Send WhatsApp Confirmation</a>
          `;
        } else {
          statusDiv.innerHTML = `<p style="color:#b91c1c; font-size:12px;">${data.error || 'Failed to submit'}</p>`;
          submitBtn.disabled = false;
          submitBtn.textContent = 'Place Quick Order 📦';
        }
      } catch (err) {
        statusDiv.innerHTML = '<p style="color:#b91c1c; font-size:12px;">Connection error. Please try again.</p>';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Place Quick Order 📦';
      }
    });
  }

  /**
   * Action Parser: Processes [[ACTION:...]] tags from assistant stream
   */
  function handleDetectedActions(rawText) {
    // 1. Check for NAVIGATE directive: [[ACTION:NAVIGATE:<url>]]
    const navMatch = rawText.match(/\[\[ACTION:NAVIGATE:(.*?)\]\]/);
    if (navMatch) {
      const targetUrl = navMatch[1].trim();
      const banner = document.createElement('div');
      banner.className = 'action-banner';
      banner.innerHTML = `<span>🌸 Taking you to <strong>${targetUrl}</strong> in a moment...</span>`;
      messagesContainer.appendChild(banner);
      scrollToBottom();
      setTimeout(() => {
        window.location.href = targetUrl;
      }, 1400);
    }

    // 2. Check for ADD_TO_CART directive: [[ACTION:ADD_TO_CART:<json>]]
    const cartMatch = rawText.match(/\[\[ACTION:ADD_TO_CART:(.*?)\]\]/);
    if (cartMatch) {
      try {
        const itemData = JSON.parse(cartMatch[1]);
        const banner = document.createElement('div');
        banner.className = 'action-banner';
        banner.innerHTML = `<span>🛒 Added <strong>${itemData.name}</strong> to your cart! Taking you to checkout...</span>`;
        messagesContainer.appendChild(banner);
        scrollToBottom();
        addToCartAndRedirect(itemData.bookId, itemData.qty || 1, itemData.redirect || '/cart');
      } catch (e) {
        console.error('Failed to parse cart directive:', e);
      }
    }

    // 3. Check for SHOW_FORM:booking
    if (rawText.includes('[[ACTION:SHOW_FORM:booking]]')) {
      renderAppointmentBookingCard();
    }

    // 4. Check for SHOW_FORM:quick_order
    if (rawText.includes('[[ACTION:SHOW_FORM:quick_order]]')) {
      renderQuickOrderCard();
    }
  }

  /**
   * Form submission and SSE stream consumption
   */
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (!message || isSending) return;

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
        }),
      });

      if (response.status === 403) {
        removeTypingIndicator();
        appendMessage('bot', '⚠️ Chat is currently disabled for this website domain. Please contact support.', true);
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
        appendMessage('bot', 'Sorry, our chat service encountered an error. Please try again in a moment.', true);
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

              // Hide raw action tags while streaming
              const cleanText = accumulatedText.replace(/\[\[ACTION:.*?\]\]/g, '').trim();
              botBubble.textContent = cleanText;
              scrollToBottom();
            } else if (parsed.error) {
              if (!botBubble) removeTypingIndicator();
              appendMessage('bot', parsed.error, true);
            }
          } catch (_) {}
        }
      }

      removeTypingIndicator();

      if (botBubble && botBubble.textContent) {
        chatHistory.push({ sender: 'bot', text: botBubble.textContent, isNotice: false });
        saveChatHistory();
      }

      // Trigger any actions found in the complete response
      handleDetectedActions(accumulatedText);

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


