const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://chatuser:chat123@sc.xoed8vb.mongodb.net/?retryWrites=true&w=majority&appName=sc';
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
.then(()=> console.log('MongoDB connected'))
.catch(err=> console.error('MongoDB error', err));

// Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, minlength: 1, maxlength: 12 },
  password: String,
  lastSeen: { type: Date, default: null }
});

const friendRequestSchema = new mongoose.Schema({
  from: String,
  to: String,
  status: { type: String, default: 'pending' }
});

const messageSchema = new mongoose.Schema({
  from: String,
  to: String,
  text: String,
  timestamp: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null }
});

const User = mongoose.model('User', userSchema);
const FriendRequest = mongoose.model('FriendRequest', friendRequestSchema);
const Message = mongoose.model('Message', messageSchema);

// In-memory connected user map: username -> socketId
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('Socket connected', socket.id);

  // helper: send friends-list with statuses and unread counts
  async function sendFriendsListTo(username, socketId) {
    // find accepted friend relationships
    const friends = await FriendRequest.find({
      $or: [{ from: username }, { to: username }],
      status: 'accepted'
    });

    const friendNames = friends.map(f => (f.from === username ? f.to : f.from));

    // build payload with online status and unread counts and lastSeen
    const payload = await Promise.all(friendNames.map(async (friend) => {
      const isOnline = connectedUsers.has(friend);
      const unreadCount = await Message.countDocuments({ from: friend, to: username, isRead: false });
      const friendUser = await User.findOne({ username: friend });
      return {
        username: friend,
        online: !!isOnline,
        unread: unreadCount,
        lastSeen: friendUser ? friendUser.lastSeen : null
      };
    }));

    io.to(socketId).emit('friends-list', payload);
  }

  // Authentication / registration
  socket.on('register', async (data) => {
    try {
      const { username, password } = data;
      if (!username || username.length < 1 || username.length > 12) {
        socket.emit('auth-response', { success: false, message: 'Username must be 1-12 characters.' });
        return;
      }
      const existing = await User.findOne({ username });
      if (existing) {
        socket.emit('auth-response', { success: false, message: 'Username already exists' });
        return;
      }
      const hashed = await bcrypt.hash(password, 10);
      const user = new User({ username, password: hashed });
      await user.save();
      connectedUsers.set(username, socket.id);
      // broadcast online status
      io.emit('user-online', { username });
      socket.emit('auth-response', { success: true, user: { username } });
      // send friends list and requests
      sendFriendsListTo(username, socket.id);
      const requests = await FriendRequest.find({ to: username, status: 'pending' }).then(r=> r.map(x=> x.from));
      socket.emit('requests-list', requests);
    } catch (err) {
      console.error(err);
      socket.emit('auth-response', { success: false, message: 'Registration failed' });
    }
  });

  socket.on('login', async (data) => {
    try {
      const { username, password } = data;
      if (!username || username.length < 1 || username.length > 12) {
        socket.emit('auth-response', { success: false, message: 'Username must be 1-12 characters.' });
        return;
      }
      const user = await User.findOne({ username });
      if (!user) {
        socket.emit('auth-response', { success: false, message: 'Invalid username or password' });
        return;
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        socket.emit('auth-response', { success: false, message: 'Invalid username or password' });
        return;
      }
      connectedUsers.set(username, socket.id);
      // broadcast online
      io.emit('user-online', { username });
      socket.emit('auth-response', { success: true, user: { username } });
      sendFriendsListTo(username, socket.id);
      const requests = await FriendRequest.find({ to: username, status: 'pending' }).then(r=> r.map(x=> x.from));
      socket.emit('requests-list', requests);
    } catch (err) {
      console.error(err);
      socket.emit('auth-response', { success: false, message: 'Login failed' });
    }
  });

  socket.on('auto-login', async (data) => {
    try {
      const { username } = data;
      const user = await User.findOne({ username });
      if (!user) {
        socket.emit('auth-response', { success: false, message: 'User not found' });
        return;
      }
      connectedUsers.set(username, socket.id);
      io.emit('user-online', { username });
      socket.emit('auth-response', { success: true, user: { username } });
      sendFriendsListTo(username, socket.id);
      const requests = await FriendRequest.find({ to: username, status: 'pending' }).then(r=> r.map(x=> x.from));
      socket.emit('requests-list', requests);
    } catch (err) {
      console.error(err);
      socket.emit('auth-response', { success: false, message: 'Auto-login failed' });
    }
  });

  // friend request flow
  socket.on('add-friend', async (data) => {
    try {
      const { username, friendUsername } = data;
      if (username === friendUsername) {
        socket.emit('friend-added', { success: false, message: 'Cannot add yourself' });
        return;
      }
      const userExists = await User.findOne({ username: friendUsername });
      if (!userExists) {
        socket.emit('friend-added', { success: false, message: 'User not found' });
        return;
      }
      const existing = await FriendRequest.findOne({ $or: [
        { from: username, to: friendUsername },
        { from: friendUsername, to: username }
      ]});
      if (existing) {
        socket.emit('friend-added', { success: false, message: 'Request already exists or already friends' });
        return;
      }
      const req = new FriendRequest({ from: username, to: friendUsername });
      await req.save();
      // Notify recipient
      const recipSocket = connectedUsers.get(friendUsername);
      if (recipSocket) io.to(recipSocket).emit('new-request', { from: username });
      socket.emit('friend-added', { success: true, message: 'Friend request sent' });
    } catch (err) {
      console.error(err);
      socket.emit('friend-added', { success: false, message: 'Error adding friend' });
    }
  });

  socket.on('get-friends', async (data) => {
    try {
      const { username } = data;
      sendFriendsListTo(username, socket.id);
    } catch (err) {
      console.error('get-friends error', err);
    }
  });

  socket.on('get-requests', async (data) => {
    try {
      const { username } = data;
      const requests = await FriendRequest.find({ to: username, status: 'pending' }).then(r => r.map(x => x.from));
      socket.emit('requests-list', requests);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('accept-request', async (data) => {
    try {
      const { username, requestUsername } = data;
      await FriendRequest.findOneAndUpdate({ from: requestUsername, to: username }, { status: 'accepted' });
      // Update both users friends lists (real-time)
      const userSocket = connectedUsers.get(username);
      const reqSocket = connectedUsers.get(requestUsername);
      if (userSocket) sendFriendsListTo(username, userSocket);
      if (reqSocket) sendFriendsListTo(requestUsername, reqSocket);

      // refresh receiver's requests list
      const requests = await FriendRequest.find({ to: username, status: 'pending' }).then(r => r.map(x => x.from));
      socket.emit('requests-list', requests);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('reject-request', async (data) => {
    try {
      const { username, requestUsername } = data;
      await FriendRequest.findOneAndDelete({ from: requestUsername, to: username, status: 'pending' });
      const requests = await FriendRequest.find({ to: username, status: 'pending' }).then(r => r.map(x => x.from));
      socket.emit('requests-list', requests);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('remove-friend', async (data) => {
    try {
      const { username, friendUsername } = data;
      await FriendRequest.findOneAndDelete({
        $or: [
          { from: username, to: friendUsername, status: 'accepted' },
          { from: friendUsername, to: username, status: 'accepted' }
        ]
      });
      const userSocket = connectedUsers.get(username);
      const friendSocket = connectedUsers.get(friendUsername);
      if (userSocket) sendFriendsListTo(username, userSocket);
      if (friendSocket) sendFriendsListTo(friendUsername, friendSocket);
    } catch (err) {
      console.error(err);
    }
  });

  // Messaging
  socket.on('send-message', async (data) => {
    try {
      const { from, to, message, replyTo } = data;
      const newMsg = new Message({
        from,
        to,
        text: message,
        replyTo: replyTo || null
      });
      await newMsg.save();

      // send to recipient if online
      const recipSocket = connectedUsers.get(to);
      // include _id and metadata so client can operate
      const payload = {
        _id: newMsg._id,
        from: newMsg.from,
        to: newMsg.to,
        text: newMsg.text,
        timestamp: newMsg.timestamp,
        isRead: newMsg.isRead,
        deleted: newMsg.deleted,
        replyTo: newMsg.replyTo
      };

      if (recipSocket) {
        io.to(recipSocket).emit('new-message', payload);
      }
      // send back to sender (self) so sender gets message with id
      io.to(socket.id).emit('new-message', payload);
      // update unread counts for recipient's friends list
      const friendSocket = connectedUsers.get(to) || null;
      if (friendSocket) sendFriendsListTo(to, friendSocket);
      const senderSocket = connectedUsers.get(from);
      if (senderSocket) sendFriendsListTo(from, senderSocket);
    } catch (err) {
      console.error('send-message error', err);
    }
  });

  socket.on('get-chat-history', async (data) => {
    try {
      const { username, withUser } = data;
      // find messages back and forth
      const messages = await Message.find({
        $or: [
          { from: username, to: withUser },
          { from: withUser, to: username }
        ]
      }).sort({ timestamp: 1 }).lean();

      // If user opened chat, mark messages sent to them as read
      await Message.updateMany({ from: withUser, to: username, isRead: false }, { isRead: true });

      // send updated chat history
      io.to(socket.id).emit('chat-history', messages);

      // send updated friends lists (so unread badges refresh)
      sendFriendsListTo(username, socket.id);
      const otherSocket = connectedUsers.get(withUser);
      if (otherSocket) sendFriendsListTo(withUser, otherSocket);

    } catch (err) {
      console.error('get-chat-history error', err);
    }
  });

  // set message read explicitly (optional)
  socket.on('mark-as-read', async (data) => {
    try {
      const { username, fromUser } = data;
      await Message.updateMany({ from: fromUser, to: username, isRead: false }, { isRead: true });
      // notify both sides to refresh friends list unread counts
      const s = connectedUsers.get(username);
      const other = connectedUsers.get(fromUser);
      if (s) sendFriendsListTo(username, s);
      if (other) sendFriendsListTo(fromUser, other);
    } catch (err) {
      console.error(err);
    }
  });

  // delete message
  socket.on('delete-message', async (data) => {
    try {
      const { messageId, requestor } = data;
      // only allow author to delete: verify
      const msg = await Message.findById(messageId);
      if (!msg) return;
      if (msg.from !== requestor) {
        socket.emit('action-failed', { message: 'Not authorized to delete' });
        return;
      }
      msg.deleted = true;
      await msg.save();

      // notify both participants if online
      const participants = [msg.from, msg.to];
      participants.forEach(u => {
        const sId = connectedUsers.get(u);
        if (sId) io.to(sId).emit('message-deleted', { messageId });
      });
    } catch (err) {
      console.error('delete-message error', err);
    }
  });

  // typing indicator
  socket.on('typing', (data) => {
    const { from, to } = data;
    const recipSocket = connectedUsers.get(to);
    if (recipSocket) io.to(recipSocket).emit('typing', { from });
  });

  socket.on('stop-typing', (data) => {
    const { from, to } = data;
    const recipSocket = connectedUsers.get(to);
    if (recipSocket) io.to(recipSocket).emit('stop-typing', { from });
  });

  // request last-seen for a user
  socket.on('get-last-seen', async (data) => {
    try {
      const { username } = data;
      const user = await User.findOne({ username });
      socket.emit('last-seen', { username, lastSeen: user ? user.lastSeen : null, online: connectedUsers.has(username) });
    } catch (err) {
      console.error(err);
    }
  });

  // when socket disconnects -> remove from connected map, update lastSeen and broadcast offline
  socket.on('disconnect', async () => {
    console.log('Socket disconnected', socket.id);
    let removedUser = null;
    for (let [username, sId] of connectedUsers.entries()) {
      if (sId === socket.id) {
        removedUser = username;
        connectedUsers.delete(username);
        break;
      }
    }
    if (removedUser) {
      // update lastSeen in DB
      await User.findOneAndUpdate({ username: removedUser }, { lastSeen: new Date() });
      io.emit('user-offline', { username: removedUser, lastSeen: new Date() });
    }
  });

});
const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=> console.log('Server running on', PORT));
