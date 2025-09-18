// Ultra Chat Application with Group Functionality
// Enhanced version with group chat features

class UltraChat {
  constructor() {
    this.socket = io();
    this.currentUser = null;
    this.activeFriend = null;
    this.activeGroup = null;
    this.replyToMessageId = null;
    this.typingTimeout = null;
    this.isTypingEmitted = false;
    this.friends = [];
    
    // Initialize the app
    this.init();
  }
  
  init() {
    // Cache DOM elements
    this.cacheDOM();
    
    // Initialize particles background
    this.initParticles();
    
    // Bind events
    this.bindEvents();
    
    // Auto-login if session exists
    this.autoLogin();
  }
  
  cacheDOM() {
    // Authentication elements
    this.authSection = document.getElementById('auth-section');
    this.usernameInput = document.getElementById('username');
    this.passwordInput = document.getElementById('password');
    this.loginBtn = document.getElementById('login-btn');
    this.registerBtn = document.getElementById('register-btn');
    
    // Chat elements
    this.chatSection = document.getElementById('chat-section');
    this.currentUserSpan = document.getElementById('current-user');
    this.logoutBtn = document.getElementById('logout-btn');
    this.friendUsernameInput = document.getElementById('friend-username');
    this.addFriendBtn = document.getElementById('add-friend-btn');
    this.createGroupBtn = document.getElementById('create-group-btn');
    this.friendsListEl = document.getElementById('friends-list');
    this.groupsListEl = document.getElementById('groups-list');
    this.friendRequests = document.getElementById('friend-requests');
    this.messagesContainer = document.getElementById('messages');
    this.messageInput = document.getElementById('message');
    this.sendBtn = document.getElementById('send-btn');
    this.activeChat = document.getElementById('active-chat');
    this.typingIndicator = document.getElementById('typing-indicator');
    this.lastSeenEl = document.getElementById('last-seen');
    this.replyPreview = document.getElementById('reply-preview');
    this.replyWho = document.getElementById('reply-who');
    this.replyText = document.getElementById('reply-text');
    this.cancelReplyBtn = document.getElementById('cancel-reply');
    this.backToFriendsBtn = document.getElementById('back-to-friends');
    this.groupInfoBtn = document.getElementById('group-info-btn');
    this.groupInfoPanel = document.getElementById('group-info-panel');
    this.groupMembersList = document.getElementById('group-members-list');
    this.addMemberInput = document.getElementById('add-member-input');
    this.addMemberBtn = document.getElementById('add-member-btn');
    
    // Modal elements
    this.createGroupModal = document.getElementById('create-group-modal');
    this.groupNameInput = document.getElementById('group-name-input');
    this.friendsCheckboxContainer = document.getElementById('friends-checkbox-container');
    this.closeModalBtn = document.querySelector('.close-modal');
    this.cancelCreateGroupBtn = document.getElementById('cancel-create-group');
    this.confirmCreateGroupBtn = document.getElementById('confirm-create-group');
  }
  
  initParticles() {
    particlesJS('particles-js', {
      particles: {
        number: { value: 80, density: { enable: true, value_area: 800 } },
        color: { value: "#00e6ff" },
        shape: { type: "circle" },
        opacity: { value: 0.5, random: true },
        size: { value: 3, random: true },
        line_linked: {
          enable: true,
          distance: 150,
          color: "#00a0ff",
          opacity: 0.4,
          width: 1
        },
        move: {
          enable: true,
          speed: 2,
          direction: "none",
          random: true,
          straight: false,
          out_mode: "out",
          bounce: false
        }
      },
      interactivity: {
        detect_on: "canvas",
        events: {
          onhover: { enable: true, mode: "grab" },
          onclick: { enable: true, mode: "push" },
          resize: true
        }
      },
      retina_detect: true
    });
  }
  
  bindEvents() {
    // Authentication events
    this.loginBtn.addEventListener('click', () => this.login());
    this.registerBtn.addEventListener('click', () => this.register());
    this.logoutBtn.addEventListener('click', () => this.logout());
    
    // Friend management events
    this.addFriendBtn.addEventListener('click', () => this.addFriend());
    this.createGroupBtn.addEventListener('click', () => this.showCreateGroupModal());
    
    // Message events
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.cancelReplyBtn.addEventListener('click', () => this.cancelReply());
    this.messageInput.addEventListener('input', () => this.onTypingInput());
    this.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });
    
    // Group events
    this.groupInfoBtn.addEventListener('click', () => this.toggleGroupInfo());
    this.addMemberBtn.addEventListener('click', () => this.addGroupMember());
    
    // Navigation events
    this.backToFriendsBtn.addEventListener('click', () => this.showFriendsView());
    
    // Modal events
    this.closeModalBtn.addEventListener('click', () => this.hideCreateGroupModal());
    this.cancelCreateGroupBtn.addEventListener('click', () => this.hideCreateGroupModal());
    this.confirmCreateGroupBtn.addEventListener('click', () => this.createGroup());
    
    // Socket events
    this.bindSocketEvents();
  }
  
  bindSocketEvents() {
    this.socket.on('connect', () => console.log('Connected to server'));
    
    this.socket.on('auth-response', (data) => this.handleAuthResponse(data));
    this.socket.on('friends-list', (friends) => {
      this.friends = friends;
      this.renderFriendsList(friends);
    });
    this.socket.on('groups-list', (groups) => this.renderGroupsList(groups));
    this.socket.on('requests-list', (requests) => this.renderFriendRequests(requests));
    this.socket.on('new-message', (msg) => this.handleNewMessage(msg));
    this.socket.on('chat-history', (messages) => this.renderChatHistory(messages));
    this.socket.on('group-chat-history', (data) => this.renderGroupChatHistory(data));
    this.socket.on('message-deleted', (data) => this.handleMessageDeleted(data));
    this.socket.on('typing', (data) => this.showTypingIndicator(data));
    this.socket.on('group-typing', (data) => this.showGroupTypingIndicator(data));
    this.socket.on('stop-typing', (data) => this.hideTypingIndicator(data));
    this.socket.on('stop-group-typing', (data) => this.hideGroupTypingIndicator(data));
    this.socket.on('user-online', (data) => this.handleUserOnline(data));
    this.socket.on('user-offline', (data) => this.handleUserOffline(data));
    this.socket.on('last-seen', (data) => this.updateLastSeen(data));
    this.socket.on('new-request', (data) => this.handleNewRequest(data));
    this.socket.on('action-failed', (data) => this.handleActionFailed(data));
    this.socket.on('group-created', (data) => this.handleGroupCreated(data));
    this.socket.on('group-info', (data) => this.handleGroupInfo(data));
    this.socket.on('group-member-added', (data) => this.handleGroupMemberAdded(data));
    this.socket.on('group-member-removed', (data) => this.handleGroupMemberRemoved(data));
  }
  
  // Authentication methods
  login() {
    const username = this.usernameInput.value.trim();
    const password = this.passwordInput.value;
    
    if (!this.validateCredentials(username, password)) return;
    
    this.socket.emit('login', { username, password });
  }
  
  register() {
    const username = this.usernameInput.value.trim();
    const password = this.passwordInput.value;
    
    if (!this.validateCredentials(username, password)) return;
    
    this.socket.emit('register', { username, password });
  }
  
  validateCredentials(username, password) {
    if (!username || username.length < 1 || username.length > 12) {
      alert('Username must be 1-12 characters');
      return false;
    }
    
    if (!password) {
      alert('Enter password');
      return false;
    }
    
    return true;
  }
  
  handleAuthResponse(data) {
    if (data.success) {
      this.currentUser = data.user;
      this.currentUserSpan.textContent = this.currentUser.username;
      this.authSection.classList.remove('active');
      this.chatSection.classList.add('active');
      this.saveUserSession(this.currentUser.username);
      
      // Request friends, groups & requests
      this.socket.emit('get-friends', { username: this.currentUser.username });
      this.socket.emit('get-groups', { username: this.currentUser.username });
      this.socket.emit('get-requests', { username: this.currentUser.username });
    } else {
      alert(data.message || 'Auth error');
      this.clearUserSession();
    }
  }
  
  logout() {
    this.clearUserSession();
    this.currentUser = null;
    this.activeFriend = null;
    this.activeGroup = null;
    this.authSection.classList.add('active');
    this.chatSection.classList.remove('active');
    this.usernameInput.value = '';
    this.passwordInput.value = '';
    this.messageInput.value = '';
    this.messagesContainer.innerHTML = '';
    this.socket.disconnect();
    setTimeout(() => { this.socket.connect(); }, 200);
  }
  
  // Friend management methods
  addFriend() {
    const friendUsername = this.friendUsernameInput.value.trim();
    if (!friendUsername) return;
    
    this.socket.emit('add-friend', { 
      username: this.currentUser.username, 
      friendUsername 
    });
    
    this.friendUsernameInput.value = '';
  }
  
  renderFriendsList(friends) {
    this.friendsListEl.innerHTML = '';
    
    friends.forEach(f => {
      const el = document.createElement('div');
      el.className = 'friend-item';
      el.innerHTML = `
        <div class="friend-left">
          <span class="status-dot ${f.online ? 'online' : ''}" 
                title="${f.online ? 'Online' : 'Offline'}"></span>
          <span class="friend-name">${f.username}</span>
          ${f.unread > 0 ? `<span class="unread-badge">${f.unread}</span>` : ''}
        </div>
        <div>
          <button class="chat-btn btn small" data-friend="${f.username}">Chat</button>
          <button class="remove-btn btn small" data-friend="${f.username}">Remove</button>
        </div>
      `;
      
      this.friendsListEl.appendChild(el);
    });
    
    // Attach event listeners to friend items
    this.attachFriendEvents();
  }
  
  renderGroupsList(groups) {
    this.groupsListEl.innerHTML = '';
    
    groups.forEach(g => {
      const el = document.createElement('div');
      el.className = 'group-item';
      el.innerHTML = `
        <div class="group-left">
          <span class="group-name">${g.name}</span>
          <span class="group-members-count">${g.members.length} members</span>
          ${g.unread > 0 ? `<span class="unread-badge">${g.unread}</span>` : ''}
        </div>
        <div class="group-actions">
          <button class="group-chat-btn btn small" data-group="${g._id}">Chat</button>
          <button class="leave-group-btn btn small" data-group="${g._id}">Leave</button>
        </div>
      `;
      
      this.groupsListEl.appendChild(el);
    });
    
    // Attach event listeners to group items
    this.attachGroupEvents();
  }
  
  attachFriendEvents() {
    // Chat buttons
    document.querySelectorAll('.chat-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const friend = e.target.getAttribute('data-friend');
        this.startChatWithFriend(friend);
      });
    });
    
    // Remove buttons
    document.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const friend = e.target.getAttribute('data-friend');
        this.socket.emit('remove-friend', { 
          username: this.currentUser.username, 
          friendUsername: friend 
        });
      });
    });
  }
  
  attachGroupEvents() {
    // Group chat buttons
    document.querySelectorAll('.group-chat-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const groupId = e.target.getAttribute('data-group');
        this.startChatWithGroup(groupId);
      });
    });
    
    // Leave group buttons
    document.querySelectorAll('.leave-group-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const groupId = e.target.getAttribute('data-group');
        this.socket.emit('leave-group', { 
          username: this.currentUser.username, 
          groupId 
        });
      });
    });
  }
  
  renderFriendRequests(requests) {
    this.friendRequests.innerHTML = '';
    
    requests.forEach(r => {
      const el = document.createElement('div');
      el.className = 'request-item';
      el.innerHTML = `
        <span>${r}</span>
        <div>
          <button class="accept-btn btn small" data-request="${r}">Accept</button>
          <button class="reject-btn btn small" data-request="${r}">Reject</button>
        </div>
      `;
      
      this.friendRequests.appendChild(el);
    });
    
    // Attach event listeners to request buttons
    this.attachRequestEvents();
  }
  
  attachRequestEvents() {
    // Accept buttons
    document.querySelectorAll('.accept-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const req = e.target.getAttribute('data-request');
        this.socket.emit('accept-request', { 
          username: this.currentUser.username, 
          requestUsername: req 
        });
      });
    });
    
    // Reject buttons
    document.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const req = e.target.getAttribute('data-request');
        this.socket.emit('reject-request', { 
          username: this.currentUser.username, 
          requestUsername: req 
        });
      });
    });
  }
  
  // Group methods
  showCreateGroupModal() {
    // Populate friends checkboxes
    this.friendsCheckboxContainer.innerHTML = '';
    
    this.friends.forEach(friend => {
      const checkboxDiv = document.createElement('div');
      checkboxDiv.className = 'friend-checkbox';
      checkboxDiv.innerHTML = `
        <input type="checkbox" id="friend-${friend.username}" value="${friend.username}">
        <label for="friend-${friend.username}">${friend.username}</label>
      `;
      this.friendsCheckboxContainer.appendChild(checkboxDiv);
    });
    
    this.createGroupModal.classList.add('active');
  }
  
  hideCreateGroupModal() {
    this.createGroupModal.classList.remove('active');
    this.groupNameInput.value = '';
  }
  
  createGroup() {
    const groupName = this.groupNameInput.value.trim();
    if (!groupName) {
      alert('Please enter a group name');
      return;
    }
    
    const selectedFriends = [];
    document.querySelectorAll('#friends-checkbox-container input:checked').forEach(checkbox => {
      selectedFriends.push(checkbox.value);
    });
    
    if (selectedFriends.length === 0) {
      alert('Please select at least one friend');
      return;
    }
    
    this.socket.emit('create-group', {
      name: groupName,
      members: selectedFriends,
      createdBy: this.currentUser.username
    });
    
    this.hideCreateGroupModal();
  }
  
  handleGroupCreated(data) {
    if (data.success) {
      this.socket.emit('get-groups', { username: this.currentUser.username });
    } else {
      alert(data.message || 'Failed to create group');
    }
  }
  
  startChatWithGroup(groupId) {
    this.activeGroup = groupId;
    this.activeFriend = null;
    this.activeChat.textContent = `Group: ${groupId}`; // Will be updated with actual group name
    this.messageInput.disabled = false;
    this.sendBtn.disabled = false;
    this.groupInfoBtn.style.display = 'block';
    this.groupInfoPanel.classList.remove('active');
    
    this.loadGroupChat(groupId);
    this.showChatView();
    
    // Get group info
    this.socket.emit('get-group-info', { groupId });
  }
  
  loadGroupChat(groupId) {
    this.activeGroup = groupId;
    this.messagesContainer.innerHTML = '';
    this.replyToMessageId = null;
    this.hideReplyPreview();
    
    this.socket.emit('get-group-chat-history', { 
      groupId: groupId 
    });
    
    if (this.isMobile()) {
      this.showChatView();
    }
  }
  
  renderGroupChatHistory(data) {
    this.messagesContainer.innerHTML = '';
    data.messages.forEach(m => this.addMessageToUI(m));
    this.scrollToBottom();
    
    // Update active chat name
    if (data.group) {
      this.activeChat.textContent = `Group: ${data.group.name}`;
    }
  }
  
  toggleGroupInfo() {
    this.groupInfoPanel.classList.toggle('active');
    if (this.groupInfoPanel.classList.contains('active')) {
      this.socket.emit('get-group-info', { groupId: this.activeGroup });
    }
  }
  
  handleGroupInfo(data) {
    if (data.group) {
      this.groupMembersList.innerHTML = '';
      
      data.group.members.forEach(member => {
        const memberEl = document.createElement('div');
        memberEl.className = 'group-member';
        memberEl.innerHTML = `
          <div>${member} ${member === data.group.createdBy ? '<span class="admin-badge">Admin</span>' : ''}</div>
          ${member !== data.group.createdBy && this.currentUser.username === data.group.createdBy ? 
            `<button class="remove-member-btn btn danger small" data-member="${member}">Remove</button>` : ''}
        `;
        
        this.groupMembersList.appendChild(memberEl);
      });
      
      // Add event listeners to remove buttons
      document.querySelectorAll('.remove-member-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const member = e.target.getAttribute('data-member');
          this.socket.emit('remove-group-member', {
            groupId: this.activeGroup,
            member: member,
            removedBy: this.currentUser.username
          });
        });
      });
    }
  }
  
  addGroupMember() {
    const username = this.addMemberInput.value.trim();
    if (!username) return;
    
    this.socket.emit('add-group-member', {
      groupId: this.activeGroup,
      username: username,
      addedBy: this.currentUser.username
    });
    
    this.addMemberInput.value = '';
  }
  
  handleGroupMemberAdded(data) {
    if (data.success) {
      this.socket.emit('get-group-info', { groupId: this.activeGroup });
    } else {
      alert(data.message || 'Failed to add member');
    }
  }
  
  handleGroupMemberRemoved(data) {
    if (data.success) {
      this.socket.emit('get-group-info', { groupId: this.activeGroup });
      
      // If current user was removed, go back to friends view
      if (data.removedUser === this.currentUser.username) {
        this.showFriendsView();
        this.socket.emit('get-groups', { username: this.currentUser.username });
      }
    } else {
      alert(data.message || 'Failed to remove member');
    }
  }
  
  // Chat methods
  startChatWithFriend(friend) {
    this.activeFriend = friend;
    this.activeGroup = null;
    this.activeChat.textContent = `Chat with ${friend}`;
    this.messageInput.disabled = false;
    this.sendBtn.disabled = false;
    this.groupInfoBtn.style.display = 'none';
    this.groupInfoPanel.classList.remove('active');
    
    this.loadChat(friend);
    this.showChatView();
  }
  
  loadChat(friend) {
    this.activeFriend = friend;
    this.messagesContainer.innerHTML = '';
    this.replyToMessageId = null;
    this.hideReplyPreview();
    
    this.socket.emit('get-chat-history', { 
      username: this.currentUser.username, 
      withUser: friend 
    });
    
    this.socket.emit('get-last-seen', { username: friend });
    
    if (this.isMobile()) {
      this.showChatView();
    }
  }
  
  sendMessage() {
    const text = this.messageInput.value.trim();
    if (!text) return;
    
    if (this.activeFriend) {
      // Private message
      this.socket.emit('send-message', { 
        from: this.currentUser.username, 
        to: this.activeFriend, 
        message: text, 
        replyTo: this.replyToMessageId 
      });
    } else if (this.activeGroup) {
      // Group message
      this.socket.emit('send-group-message', { 
        from: this.currentUser.username, 
        groupId: this.activeGroup, 
        message: text, 
        replyTo: this.replyToMessageId 
      });
    }
    
    this.messageInput.value = '';
    this.cancelReply();
    this.stopTypingEmit();
  }
  
  handleNewMessage(msg) {
    if (msg.type === 'group') {
      // Group message
      if (this.activeGroup && msg.groupId === this.activeGroup) {
        this.addMessageToUI(msg);
      } else {
        // Update groups list to show unread count
        this.socket.emit('get-groups', { username: this.currentUser.username });
      }
    } else {
      // Private message
      if ((this.activeFriend && (msg.from === this.activeFriend || msg.to === this.activeFriend)) || 
          msg.from === this.currentUser.username) {
        this.addMessageToUI(msg);
      } else {
        this.socket.emit('get-friends', { username: this.currentUser.username });
      }
    }
  }
  
  renderChatHistory(messages) {
    this.messagesContainer.innerHTML = '';
    messages.forEach(m => this.addMessageToUI(m));
    this.scrollToBottom();
  }
  
  addMessageToUI(msg) {
    const isSent = msg.from === this.currentUser.username;
    const isGroup = msg.type === 'group';
    const el = document.createElement('div');
    el.className = `message ${isSent ? 'sent' : 'received'} ${msg.deleted ? 'deleted' : ''}`;
    
    if (msg._id) el.setAttribute('data-id', msg._id);

    const contentText = msg.deleted ? 'Message deleted' : (msg.text || '');

    // Reply snippet handling
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

    // Show sender name for group messages
    const senderInfo = isGroup && !isSent ? `<div class="small" style="margin-bottom:4px; opacity:0.8;">${msg.from}</div>` : '';

    el.innerHTML = `
      ${senderInfo}
      ${replySnippet}
      <div class="msg-content">${contentText}</div>
      <div class="meta">${msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}</div>
      
      ${!msg.deleted ? `
        <div class="message-actions">
          <button class="reply-btn" title="Reply">↩</button>
          ${isSent ? `
            <div class="message-menu">
              <button class="menu-btn">⋯</button>
              <div class="menu-options hidden">
                <button class="delete-option">Delete message</button>
              </div>
            </div>
          ` : ''}
        </div>
      ` : ''}
    `;
    
    this.messagesContainer.appendChild(el);
    this.scrollToBottom();

    // Add event listeners for message actions
    if (!msg.deleted) {
      const replyBtn = el.querySelector('.reply-btn');
      if (replyBtn) {
        replyBtn.addEventListener('click', () => {
          this.startReply(msg);
        });
      }
      
      if (isSent) {
        const menuBtn = el.querySelector('.menu-btn');
        const menuOptions = el.querySelector('.menu-options');
        const deleteOption = el.querySelector('.delete-option');
        
        menuBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          menuOptions.classList.toggle('hidden');
        });
        
        deleteOption.addEventListener('click', () => {
          if (isGroup) {
            this.socket.emit('delete-group-message', { 
              messageId: msg._id, 
              groupId: this.activeGroup,
              requestor: this.currentUser.username 
            });
          } else {
            this.socket.emit('delete-message', { 
              messageId: msg._id, 
              requestor: this.currentUser.username 
            });
          }
          menuOptions.classList.add('hidden');
        });
        
        // Close menu when clicking elsewhere
        document.addEventListener('click', (e) => {
          if (!el.contains(e.target)) {
            menuOptions.classList.add('hidden');
          }
        });
      }
    }
  }
  
  handleMessageDeleted(data) {
    const { messageId } = data;
    const el = document.querySelector(`[data-id="${messageId}"]`);
    
    if (el) {
      el.classList.add('deleted');
      const content = el.querySelector('.msg-content');
      if (content) content.textContent = 'Message deleted';
      
      const meta = el.querySelector('.meta');
      if (meta) meta.textContent = '';
      
      const actions = el.querySelector('.message-actions');
      if (actions) actions.remove();
    }
  }
  
  // Reply functionality
  startReply(msg) {
    this.replyToMessageId = msg._id || null;
    this.replyWho.textContent = msg.from;
    this.replyText.textContent = msg.text || '[deleted]';
    this.replyPreview.classList.remove('hidden');
    
    // Scroll to bottom to ensure input and reply preview are visible
    if (this.isMobile()) {
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }
  
  cancelReply() {
    this.replyToMessageId = null;
    this.hideReplyPreview();
  }
  
  hideReplyPreview() {
    this.replyPreview.classList.add('hidden');
    this.replyWho.textContent = '';
    this.replyText.textContent = '';
  }
  
  // Typing indicators
  onTypingInput() {
    if (!this.activeFriend && !this.activeGroup) return;
    
    if (!this.isTypingEmitted) {
      if (this.activeFriend) {
        this.socket.emit('typing', { 
          from: this.currentUser.username, 
          to: this.activeFriend 
        });
      } else if (this.activeGroup) {
        this.socket.emit('group-typing', { 
          from: this.currentUser.username, 
          groupId: this.activeGroup 
        });
      }
      this.isTypingEmitted = true;
    }
    
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.stopTypingEmit();
    }, 900);
  }
  
  stopTypingEmit() {
    if (!this.isTypingEmitted) return;
    
    if (this.activeFriend) {
      this.socket.emit('stop-typing', { 
        from: this.currentUser.username, 
        to: this.activeFriend 
      });
    } else if (this.activeGroup) {
      this.socket.emit('stop-group-typing', { 
        from: this.currentUser.username, 
        groupId: this.activeGroup 
      });
    }
    
    this.isTypingEmitted = false;
  }
  
  showTypingIndicator(data) {
    if (this.activeFriend && data.from === this.activeFriend) {
      this.typingIndicator.textContent = `${data.from} is typing...`;
    }
  }
  
  showGroupTypingIndicator(data) {
    if (this.activeGroup && data.groupId === this.activeGroup && data.from !== this.currentUser.username) {
      this.typingIndicator.textContent = `${data.from} is typing...`;
    }
  }
  
  hideTypingIndicator(data) {
    if (this.activeFriend && data.from === this.activeFriend) {
      this.typingIndicator.textContent = '';
    }
  }
  
  hideGroupTypingIndicator(data) {
    if (this.activeGroup && data.groupId === this.activeGroup && data.from !== this.currentUser.username) {
      this.typingIndicator.textContent = '';
    }
  }
  
  // User status methods
  handleUserOnline(data) {
    this.socket.emit('get-friends', { username: this.currentUser.username });
  }
  
  handleUserOffline(data) {
    this.socket.emit('get-friends', { username: this.currentUser.username });
  }
  
  updateLastSeen(data) {
    if (this.activeFriend && data.username === this.activeFriend) {
      if (data.online) {
        this.lastSeenEl.textContent = 'Online';
      } else if (data.lastSeen) {
        this.lastSeenEl.textContent = `Last seen: ${new Date(data.lastSeen).toLocaleString()}`;
      } else {
        this.lastSeenEl.textContent = 'Last seen: unknown';
      }
    }
  }
  
  handleNewRequest(data) {
    if (data && data.from) {
      this.socket.emit('get-requests', { username: this.currentUser.username });
    }
  }
  
  handleActionFailed(data) {
    if (data && data.message) alert(data.message);
  }
  
  // UI Helper methods
  showChatView() {
    if (this.isMobile()) {
      document.getElementById('friends-section').style.display = 'none';
      document.getElementById('chat-container').classList.add('active');
      document.getElementById('back-to-friends').style.display = 'flex';
      
      // Force a reflow and scroll to bottom
      setTimeout(() => {
        this.scrollToBottom();
        this.messageInput.focus();
      }, 100);
    }
  }
  
  showFriendsView() {
    if (this.isMobile()) {
      document.getElementById('friends-section').style.display = 'block';
      document.getElementById('chat-container').classList.remove('active');
      document.getElementById('back-to-friends').style.display = 'none';
      this.activeFriend = null;
      this.activeGroup = null;
      this.activeChat.textContent = 'Select a friend to chat';
      this.messageInput.disabled = true;
      this.sendBtn.disabled = true;
      this.messagesContainer.innerHTML = '';
      this.groupInfoBtn.style.display = 'none';
      this.groupInfoPanel.classList.remove('active');
    }
  }
  
  scrollToBottom() {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }
  
  isMobile() {
    return window.innerWidth <= 768 || 
           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  
  // Session management
  saveUserSession(username) { 
    localStorage.setItem('chatUser', username); 
  }
  
  getUserSession() { 
    return localStorage.getItem('chatUser'); 
  }
  
  clearUserSession() { 
    localStorage.removeItem('chatUser'); 
  }
  
  autoLogin() {
    const saved = this.getUserSession();
    if (saved) this.socket.emit('auto-login', { username: saved });
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const app = new UltraChat();
  
  // Periodically update last seen
  setInterval(() => {
    if (app.activeFriend && app.currentUser) {
      app.socket.emit('get-last-seen', { username: app.activeFriend });
    }
  }, 15000);
  
  // Handle window resize
  window.addEventListener('resize', () => {
    if (!app.isMobile() && document.getElementById('chat-container').classList.contains('active')) {
      document.getElementById('friends-section').style.display = 'block';
      document.getElementById('chat-container').classList.remove('active');
      document.getElementById('back-to-friends').style.display = 'none';
    }
  });
});