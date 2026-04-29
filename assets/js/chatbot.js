/* ============================================================
   NEXUSIT — CHATBOT MODULE
   ─────────────────────────────────────────────────────────────
   AI Support chat with typing indicator, message history,
   and keyboard shortcuts.
   
   Improvements:
   - XSS-safe user message rendering
   - Prevents double-send while bot is "typing"
   - Better scroll-to-bottom with smooth behavior
   - Empty message guard improved
   ============================================================ */

let isBotTyping = false; // Prevents sending while bot responds


/** Initialize or reset the chat window with a welcome message. */
function initChat() {
  $('#chatMessages').empty();
  const firstName = (typeof currentUser !== 'undefined' && currentUser && currentUser.name)
    ? currentUser.name.split(' ')[0]
    : '';
  const greeting  = firstName ? ` Hello, <strong>${escapeHTML(firstName)}</strong>!` : ' Hello!';
  appendMsg('bot', `${greeting} I'm <strong>NexusBot</strong>, your AI-powered IT support agent. Comment puis-je vous aider aujourd'hui ?`);
}



/**
 * Append a message bubble to the chat window.
 * @param {'bot'|'user'} role — Who sent it
 * @param {string} html — Message content (HTML allowed for bot, escaped for user)
 */
function appendMsg(role, html) {
  const $msgs = $('#chatMessages');
  // Use current user's first initial, fallback to 'U'
  const userLetter = (typeof currentUser !== 'undefined' && currentUser && currentUser.name)
    ? currentUser.name[0].toUpperCase() : 'U';
  const avatarLetter = role === 'bot' ? 'N' : userLetter;

  const $msg = $(`
    <div class="msg ${role}">
      <div class="msg-avatar">${avatarLetter}</div>
      <div class="msg-body">
        <div class="msg-bubble">${html}</div>
        <div class="msg-time">${currentTime()}</div>
      </div>
    </div>
  `);

  $msgs.append($msg);

  // Smooth auto-scroll to latest message
  $msgs.stop(true).animate({ scrollTop: $msgs[0].scrollHeight }, 300);
}


/**
 * Read user input, display it, and simulate a bot response.
 * Guards against empty input and double-send while typing.
 */
function sendMessage() {
  const text = $('#chatInput').val().trim();
  if (!text || isBotTyping) return;

  // Clear input immediately
  $('#chatInput').val('');

  // Display user message (XSS-safe — escape user input)
  appendMsg('user', escapeHTML(text));

  // Show typing indicator and lock sending
  isBotTyping = true;
  $('#typingIndicator').css('visibility', 'visible');

  // Simulate variable response delay (1–2.5s) for realism
  const delay = 1000 + Math.random() * 1500;

  setTimeout(() => {
    // Hide typing indicator
    $('#typingIndicator').css('visibility', 'hidden');
    isBotTyping = false;

    // Pick a random bot reply
    const reply = BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)];
    appendMsg('bot', reply);
  }, delay);
}


/* —— EVENT LISTENERS ——————————————————————————————————————— */

$('#sendBtn').on('click', sendMessage);

$('#chatInput').on('keypress', function (e) {
  if (e.which === 13) {
    e.preventDefault();
    sendMessage();
  }
});
