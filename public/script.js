// Add session management functions
function saveUserSession(username) {
  localStorage.setItem('chatUser', username);
}

function getUserSession() {
  return localStorage.getItem('chatUser');
}

function clearUserSession() {
  localStorage.removeItem('chatUser');
}

// Initialize socket connection
const socket = io();

// DOM elements
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
const friendsList = document.getElementById('friends-list');
const friendRequests = document.getElementById('friend-requests');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message');
const sendBtn = document.getElementById('send-btn');
const activeChat = document.getElementById('active-chat');

let currentUser = null;
let activeFriend = null;

// Event listeners
loginBtn.addEventListener('click', login);
registerBtn.addEventListener('click', register);
logoutBtn.addEventListener('click', logout);
addFriendBtn.addEventListener('click', addFriend);
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Check for existing session on page load
document.addEventListener('DOMContentLoaded', function() {
  const savedUser = getUserSession();
  if (savedUser) {
    // Auto-login the user
    socket.emit('auto-login', { username: savedUser });
  }
});

// Socket event listeners
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('auth-response', (data) => {
    if (data.success) {
        currentUser = data.user;
        currentUserSpan.textContent = currentUser.username;
        authSection.classList.remove('active');
        chatSection.classList.add('active');
        
        // Save user session
        saveUserSession(currentUser.username);
        
        // Load friends and requests with username included
        socket.emit('get-friends', { username: currentUser.username });
        socket.emit('get-requests', { username: currentUser.username });
    } else {
        alert('Error: ' + data.message);
        clearUserSession();
    }
});

socket.on('friends-list', (friends) => {
    friendsList.innerHTML = '';
    friends.forEach(friend => {
        const friendElement = document.createElement('div');
        friendElement.className = 'friend-item';
        friendElement.innerHTML = `
            <span>${friend}</span>
            <div>
                <button class="chat-btn" data-friend="${friend}">Chat</button>
                <button class="remove-btn" data-friend="${friend}">Remove</button>
            </div>
        `;
        friendsList.appendChild(friendElement);
    });
    
    // Add event listeners to new buttons
    document.querySelectorAll('.chat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            activeFriend = e.target.getAttribute('data-friend');
            activeChat.textContent = `Chat with ${activeFriend}`;
            messageInput.disabled = false;
            sendBtn.disabled = false;
            loadChat(activeFriend);
        });
    });
    
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const friend = e.target.getAttribute('data-friend');
            socket.emit('remove-friend', { 
                username: currentUser.username, 
                friendUsername: friend 
            });
        });
    });
});

socket.on('requests-list', (requests) => {
    friendRequests.innerHTML = '';
    requests.forEach(request => {
        const requestElement = document.createElement('div');
        requestElement.className = 'request-item';
        requestElement.innerHTML = `
            <span>${request}</span>
            <div>
                <button class="accept-btn" data-request="${request}">Accept</button>
                <button class="reject-btn" data-request="${request}">Reject</button>
            </div>
        `;
        friendRequests.appendChild(requestElement);
    });
    
    // Add event listeners to new buttons
    document.querySelectorAll('.accept-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const request = e.target.getAttribute('data-request');
            socket.emit('accept-request', { 
                username: currentUser.username, 
                requestUsername: request 
            });
        });
    });
    
    document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const request = e.target.getAttribute('data-request');
            socket.emit('reject-request', { 
                username: currentUser.username, 
                requestUsername: request 
            });
        });
    });
});

socket.on('new-request', (data) => {
    // Refresh requests list when a new request is received
    socket.emit('get-requests', { username: currentUser.username });
});

socket.on('new-message', (data) => {
    // Check if the message is for the active chat
    if (data.from === activeFriend || data.self) {
        addMessage(data.message, data.self || data.from === currentUser.username);
    }
});

socket.on('chat-history', (messages) => {
    messagesContainer.innerHTML = '';
    messages.forEach(message => {
        addMessage(message.text, message.from === currentUser.username);
    });
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

socket.on('friend-added', (data) => {
    if (data.success) {
        alert(data.message);
        // Refresh friends list
        socket.emit('get-friends', { username: currentUser.username });
    } else {
        alert('Error: ' + data.message);
    }
});

// Functions
function login() {
    const username = usernameInput.value;
    const password = passwordInput.value;
    
    if (username && password) {
        socket.emit('login', { username, password });
    } else {
        alert('Please enter username and password');
    }
}

function register() {
    const username = usernameInput.value;
    const password = passwordInput.value;
    
    if (username && password) {
        socket.emit('register', { username, password });
    } else {
        alert('Please enter username and password');
    }
}

function logout() {
    clearUserSession();
    currentUser = null;
    authSection.classList.add('active');
    chatSection.classList.remove('active');
    usernameInput.value = '';
    passwordInput.value = '';
    socket.disconnect();
    socket.connect();
}

function addFriend() {
    const friendUsername = friendUsernameInput.value;
    if (friendUsername) {
        socket.emit('add-friend', { 
            username: currentUser.username, 
            friendUsername: friendUsername 
        });
        friendUsernameInput.value = '';
    }
}

function sendMessage() {
    const message = messageInput.value;
    if (message && activeFriend) {
        socket.emit('send-message', {
            from: currentUser.username,
            to: activeFriend,
            message: message
        });
        addMessage(message, true);
        messageInput.value = '';
    }
}

function addMessage(text, isSent) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
    messageElement.textContent = text;
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function loadChat(friend) {
    socket.emit('get-chat-history', { 
        username: currentUser.username, 
        withUser: friend 
    });
}



// Add this event listener for real-time friend list updates
socket.on('friends-list', (friends) => {
  friendsList.innerHTML = '';
  friends.forEach(friend => {
    const friendElement = document.createElement('div');
    friendElement.className = 'friend-item';
    friendElement.innerHTML = `
      <span>${friend}</span>
      <div>
        <button class="chat-btn" data-friend="${friend}">Chat</button>
        <button class="remove-btn" data-friend="${friend}">Remove</button>
      </div>
    `;
    friendsList.appendChild(friendElement);
  });
  
  // Add event listeners to new buttons
  document.querySelectorAll('.chat-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      activeFriend = e.target.getAttribute('data-friend');
      activeChat.textContent = `Chat with ${activeFriend}`;
      messageInput.disabled = false;
      sendBtn.disabled = false;
      loadChat(activeFriend);
    });
  });
  
  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const friend = e.target.getAttribute('data-friend');
      socket.emit('remove-friend', { 
        username: currentUser.username, 
        friendUsername: friend 
      });
    });
  });
});

// Add this event listener for real-time request list updates
socket.on('requests-list', (requests) => {
  friendRequests.innerHTML = '';
  requests.forEach(request => {
    const requestElement = document.createElement('div');
    requestElement.className = 'request-item';
    requestElement.innerHTML = `
      <span>${request}</span>
      <div>
        <button class="accept-btn" data-request="${request}">Accept</button>
        <button class="reject-btn" data-request="${request}">Reject</button>
      </div>
    `;
    friendRequests.appendChild(requestElement);
  });
  
  // Add event listeners to new buttons
  document.querySelectorAll('.accept-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const request = e.target.getAttribute('data-request');
      socket.emit('accept-request', { 
        username: currentUser.username, 
        requestUsername: request 
      });
    });
  });
  
  document.querySelectorAll('.reject-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const request = e.target.getAttribute('data-request');
      socket.emit('reject-request', { 
        username: currentUser.username, 
        requestUsername: request 
      });
    });
  });
});

// Add this event listener for new friend requests
socket.on('new-request', () => {
  // Refresh requests list when a new request is received
  socket.emit('get-requests', { username: currentUser.username });
});