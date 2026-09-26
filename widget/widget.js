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
  const clientId = scriptTag?.getAttribute('data-client-id') || 'notebloom';

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
        box-shadow: 0 14px 22px -3px rgba(124, 47, 47, 0.5);
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
        width: 390px;
        height: 590px;
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
        font-size: 18px;
      }

      .header-text h3 {
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.01em;
      }

      .header-text p {
        font-size: 12px;
        opacity: 0.9;
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
        max-width: 86%;
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

      /* Navigation & Action Banner */
      .action-banner {
        background: #fff7ed;
        border: 1px solid #ffedd5;
        border-left: 4px solid var(--primary);
        padding: 10px 14px;
        border-radius: 8px;
        font-size: 13px;
        color: #9a3412;
        margin-top: 6px;
        display: flex;
        align-items: center;
        gap: 8px;
        animation: pulse 1.5s infinite ease-in-out;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.75; }
      }

      /* In-Chat Interactive Form Card */
      .chat-interactive-card {
        background: #ffffff;
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 14px;
        margin-top: 8px;
        box-shadow: 0 4px 12px rgba(32, 40, 58, 0.06);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .chat-interactive-card h4 {
        font-size: 14px;
        color: var(--primary);
        font-weight: 600;
        margin-bottom: 2px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .form-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .form-field label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--text-muted);
      }

      .form-control {
        border: 1px solid var(--border);
        background: #faf8f5;
        border-radius: 6px;
        padding: 7px 10px;
        font-size: 13px;
        color: var(--text-main);
        outline: none;
      }

      .form-control:focus {
        border-color: var(--primary);
        background: #ffffff;
      }

      .form-submit-btn {
        background: var(--primary-gradient);
        color: #ffffff;
        border: none;
        border-radius: 6px;
        padding: 9px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      .form-submit-btn:hover {
        opacity: 0.92;
      }

      .wa-confirm-btn {
        background: #25d366;
        color: #ffffff;
        text-decoration: none;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        margin-top: 6px;
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
          <div class="bubble">Hello! 🌸 Welcome to Notebloom. Ask me anything, or let me guide you to our stationery, add items to your cart, or book an appointment for custom sourcing!</div>
        </div>
      </div>

      <form class="panel-input-area" id="chatForm">
        <input 
          type="text" 
          id="chatInput" 
          class="chat-input" 
          placeholder="Ask or type 'Take me to Diaries'..." 
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
