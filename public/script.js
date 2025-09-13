// Client-side script with real-time features
const socket = io();

// DOM
const authSection = document.getElementById('auth-section');
const chatSection = document.getElementById('chat-section');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const currentUserSpan = document.getElementById('current-user');
const logoutBtn = document.getElementById('logout-btn');
const friendUsernameInput = document.getElementById('friend-username');
const addFriendBtn = document.getElementById('add-friend-btn');
const friendsListEl = document.getElementById('friends-list');
const friendRequests = document.getElementById('friend-requests');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message');
const sendBtn = document.getElementById('send-btn');
const activeChat = document.getElementById('active-chat');
const typingIndicator = document.getElementById('typing-indicator');
const lastSeenEl = document.getElementById('last-seen');
const replyPreview = document.getElementById('reply-preview');
const replyWho = document.getElementById('reply-who');
const replyText = document.getElementById('reply-text');
const cancelReplyBtn = document.getElementById('cancel-reply');

let currentUser = null;
let activeFriend = null;
let replyToMessageId = null;
let typingTimeout = null;
let isTypingEmitted = false;

// Helpers for session
function saveUserSession(username){ localStorage.setItem('chatUser', username); }
function getUserSession(){ return localStorage.getItem('chatUser'); }
function clearUserSession(){ localStorage.removeItem('chatUser'); }

// event listeners
loginBtn.addEventListener('click', login);
registerBtn.addEventListener('click', register);
logoutBtn.addEventListener('click', logout);
addFriendBtn.addEventListener('click', addFriend);
sendBtn.addEventListener('click', sendMessage);
cancelReplyBtn.addEventListener('click', cancelReply);
messageInput.addEventListener('input', onTypingInput);
messageInput.addEventListener('keypress', (e)=> { if(e.key==='Enter') sendMessage(); });

// auto-login if saved
document.addEventListener('DOMContentLoaded', () => {
  const saved = getUserSession();
  if (saved) socket.emit('auto-login', { username: saved });
});

// Socket handlers
socket.on('connect', ()=> console.log('connected'));

socket.on('auth-response', (data) => {
  if (data.success) {
    currentUser = data.user;
    currentUserSpan.textContent = currentUser.username;
    authSection.classList.remove('active');
    chatSection.classList.add('active');
    saveUserSession(currentUser.username);
    // request friends & requests
    socket.emit('get-friends', { username: currentUser.username });
    socket.emit('get-requests', { username: currentUser.username });
  } else {
    alert(data.message || 'Auth error');
    clearUserSession();
  }
});

// receive list of friends (with online, unread, lastSeen)
socket.on('friends-list', (friends) => {
  friendsListEl.innerHTML = '';
  friends.forEach(f => {
    const el = document.createElement('div');
    el.className = 'friend-item';
    el.innerHTML = `
      <div class="friend-left">
        <span class="status-dot ${f.online ? 'online':''}" title="${f.online ? 'Online' : 'Offline'}"></span>
        <span class="friend-name">${f.username}</span>
        ${f.unread > 0 ? `<span class="unread-badge">${f.unread}</span>` : ''}
      </div>
      <div>
        <button class="chat-btn btn small" data-friend="${f.username}">Chat</button>
        <button class="remove-btn btn small" data-friend="${f.username}">Remove</button>
      </div>
    `;
    friendsListEl.appendChild(el);
  });

  // attach listeners
  document.querySelectorAll('.chat-btn').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      activeFriend = e.target.getAttribute('data-friend');
      activeChat.textContent = `Chat with ${activeFriend}`;
      messageInput.disabled = false;
      sendBtn.disabled = false;
      loadChat(activeFriend);
    });
  });
  document.querySelectorAll('.remove-btn').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const friend = e.target.getAttribute('data-friend');
      socket.emit('remove-friend', { username: currentUser.username, friendUsername: friend });
    });
  });
});

// requests list
socket.on('requests-list', (requests) => {
  friendRequests.innerHTML = '';
  requests.forEach(r=>{
    const el = document.createElement('div');
    el.className = 'request-item';
    el.innerHTML = `
      <span>${r}</span>
      <div>
        <button class="accept-btn btn small" data-request="${r}">Accept</button>
        <button class="reject-btn btn small" data-request="${r}">Reject</button>
      </div>
    `;
    friendRequests.appendChild(el);
  });

  document.querySelectorAll('.accept-btn').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const req = e.target.getAttribute('data-request');
      socket.emit('accept-request', { username: currentUser.username, requestUsername: req });
    });
  });
  document.querySelectorAll('.reject-btn').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const req = e.target.getAttribute('data-request');
      socket.emit('reject-request', { username: currentUser.username, requestUsername: req });
    });
  });
});

// new incoming message (also sent back to sender)
socket.on('new-message', (msg) => {
  // if message is for currently active chat or is from current user, append
  if ((activeFriend && (msg.from === activeFriend || msg.to === activeFriend)) || msg.from === currentUser.username) {
    addMessageToUI(msg);
  } else {
    // update unread badge by re-requesting friend list for simplicity
    socket.emit('get-friends', { username: currentUser.username });
  }
});

// chat history
socket.on('chat-history', (messages) => {
  messagesContainer.innerHTML = '';
  messages.forEach(m => addMessageToUI(m));
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

// message deleted
socket.on('message-deleted', (data) => {
  const { messageId } = data;
  const el = document.querySelector(`[data-id="${messageId}"]`);
  if (el) {
    el.classList.add('deleted');
    const content = el.querySelector('.msg-content');
    if (content) content.textContent = 'Message deleted';
    const meta = el.querySelector('.meta');
    if (meta) meta.textContent = '';
    // remove three-dots menu
    const td = el.querySelector('.three-dots');
    if (td) td.remove();
  }
});

// typing indicator events
socket.on('typing', (data) => {
  if (activeFriend && data.from === activeFriend) {
    typingIndicator.textContent = `${data.from} is typing...`;
  }
});
socket.on('stop-typing', (data) => {
  if (activeFriend && data.from === activeFriend) {
    typingIndicator.textContent = '';
  }
});

// online/offline events to update friend list quickly
socket.on('user-online', (data) => {
  socket.emit('get-friends', { username: currentUser.username });
});
socket.on('user-offline', (data) => {
  socket.emit('get-friends', { username: currentUser.username });
});

// last seen response
socket.on('last-seen', (data) => {
  if (activeFriend && data.username === activeFriend) {
    if (data.online) lastSeenEl.textContent = 'Online';
    else if (data.lastSeen) lastSeenEl.textContent = `Last seen: ${new Date(data.lastSeen).toLocaleString()}`;
    else lastSeenEl.textContent = 'Last seen: unknown';
  }
});

// ACTIONS
function login(){
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  if(!username || username.length < 1 || username.length > 12){ alert('Username must be 1-12 characters'); return; }
  if(!password){ alert('Enter password'); return; }
  socket.emit('login', { username, password });
}
function register(){
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  if(!username || username.length < 1 || username.length > 12){ alert('Username must be 1-12 characters'); return; }
  if(!password){ alert('Enter password'); return; }
  socket.emit('register', { username, password });
}
function logout(){
  clearUserSession();
  currentUser = null;
  activeFriend = null;
  authSection.classList.add('active');
  chatSection.classList.remove('active');
  usernameInput.value = ''; passwordInput.value = '';
  messageInput.value = '';
  messagesContainer.innerHTML = '';
  socket.disconnect();
  // reconnect to create new socket
  setTimeout(()=> { socket.connect(); }, 200);
}
function addFriend(){
  const friendUsername = friendUsernameInput.value.trim();
  if(!friendUsername) return;
  socket.emit('add-friend', { username: currentUser.username, friendUsername });
  friendUsernameInput.value = '';
}
function loadChat(friend){
  activeFriend = friend;
  messagesContainer.innerHTML = '';
  replyToMessageId = null;
  hideReplyPreview();
  // fetch chat history (server will mark messages as read)
  socket.emit('get-chat-history', { username: currentUser.username, withUser: friend });
  // request last seen for friend
  socket.emit('get-last-seen', { username: friend });
}
function sendMessage(){
  const text = messageInput.value.trim();
  if (!text || !activeFriend) return;
  socket.emit('send-message', { from: currentUser.username, to: activeFriend, message: text, replyTo: replyToMessageId });
  // clear input & replyTo
  messageInput.value = '';
  cancelReply();
  // stop typing emit
  stopTypingEmit();
}
function addMessageToUI(msg){
  const isSent = msg.from === currentUser.username;
  const el = document.createElement('div');
  el.className = `message ${isSent ? 'sent' : 'received'} ${msg.deleted ? 'deleted' : ''}`;
  if (msg._id) el.setAttribute('data-id', msg._id);

  const contentText = msg.deleted ? 'Message deleted' : (msg.text || '');

  // --- reply snippet handling ---
  let replySnippet = '';
  if (msg.replyTo) {
    const repliedMsg = document.querySelector(`[data-id="${msg.replyTo}"]`);
    let repliedText = repliedMsg ? repliedMsg.querySelector('.msg-content').textContent : '[original message]';
    replySnippet = `
      <div class="reply-snippet" style="
        font-size:0.8rem;
        opacity:0.8;
        border-left:3px solid #00e6ff;
        padding-left:6px;
        margin-bottom:4px;
      ">
        ${repliedText}
      </div>`;
  }

  el.innerHTML = `
    ${replySnippet}
    <div class="msg-content">${contentText}</div>
    <div class="meta">${msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}</div>
    <div class="three-dots">
      <button class="dots-btn">⋯</button>
      <div class="dots-menu hidden"></div>
    </div>
  `;
  messagesContainer.appendChild(el);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  



 // populate dots menu
const dotsBtn = el.querySelector('.dots-btn');
const menu = el.querySelector('.dots-menu');
if (dotsBtn) {
  dotsBtn.addEventListener('click', (e) => {
    e.stopPropagation();

    if (!menu.classList.contains('hidden')) {
      menu.classList.add('hidden');
      const overlay = document.querySelector('.menu-overlay');
      if (overlay) overlay.remove();
      return;
    }

    menu.classList.remove('hidden');
    menu.innerHTML = '';

    // Reply option
    const replyBtn = document.createElement('button');
    replyBtn.textContent = 'Reply';
    replyBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      startReply(msg);
      menu.classList.add('hidden');
      const overlay = document.querySelector('.menu-overlay');
      if (overlay) overlay.remove();
    });
    menu.appendChild(replyBtn);

    // Delete option (only if sender & not deleted)
    if (isSent && !msg.deleted) {
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete message';
      delBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        socket.emit('delete-message', { messageId: msg._id, requestor: currentUser.username });
        menu.classList.add('hidden');
        const overlay = document.querySelector('.menu-overlay');
        if (overlay) overlay.remove();
      });
      menu.appendChild(delBtn);
    }

    // --- Create overlay ---
    const overlay = document.createElement('div');
    overlay.className = 'menu-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0,0,0,0.4)';
    overlay.style.zIndex = '9998';
    document.body.appendChild(overlay);

    // clicking overlay closes menu
    overlay.addEventListener('click', () => {
      menu.classList.add('hidden');
      overlay.remove();
    });

    // --- Position menu in the center of the screen ---
    document.body.appendChild(menu);
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    menu.style.position = 'fixed';
    menu.style.left = `calc(50% - ${menuWidth / 2}px)`;
    menu.style.top = `calc(50% - ${menuHeight / 2}px)`;
    menu.style.zIndex = 9999;
  });
}





    
}

// Reply flow
function startReply(msg){
  replyToMessageId = msg._id || null;
  replyWho.textContent = msg.from;
  replyText.textContent = msg.text || '[deleted]';
  replyPreview.classList.remove('hidden');
}
function cancelReply(){
  replyToMessageId = null;
  hideReplyPreview();
}
function hideReplyPreview(){
  replyPreview.classList.add('hidden');
  replyWho.textContent = '';
  replyText.textContent = '';
}

// Typing indicators (debounced)
function onTypingInput(){
  if(!activeFriend) return;
  // emit typing if not already
  if (!isTypingEmitted) {
    socket.emit('typing', { from: currentUser.username, to: activeFriend });
    isTypingEmitted = true;
  }
  // clear existing timeout
  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    stopTypingEmit();
  }, 900);
}
function stopTypingEmit(){
  if (!isTypingEmitted) return;
  socket.emit('stop-typing', { from: currentUser.username, to: activeFriend });
  isTypingEmitted = false;
}

// Cancel reply button
function cancelReplyBtnHandler(){
  cancelReply();
}
function cancelReply(){ replyToMessageId = null; hideReplyPreview(); }

// Utility: when opening a chat, ask server to mark messages as read (already done in get-chat-history). Also request last-seen update periodically.
setInterval(()=>{
  if (activeFriend && currentUser) socket.emit('get-last-seen', { username: activeFriend });
}, 15000); // every 15s

// ensure friend list updates
socket.on('action-failed', (d) => { if (d && d.message) alert(d.message); });

// extra: click to open friend chat when message from friend arrives (optional UX) done by addMessageToUI routing

// listen for real-time incoming friend requests
socket.on('new-request', (data) => {
  if (data && data.from) {
    // re-fetch requests list
    socket.emit('get-requests', { username: currentUser.username });
  }
});
