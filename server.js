const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Enable CORS for socket.io
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Add CORS middleware
app.use(cors());

// MongoDB connection - Added database name to the connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://chatuser:chat123@sc.xoed8vb.mongodb.net/?retryWrites=true&w=majority&appName=sc';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('Connected to MongoDB successfully');
})
.catch((error) => {
  console.error('Error connecting to MongoDB:', error);
});

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String
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
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const FriendRequest = mongoose.model('FriendRequest', friendRequestSchema);
const Message = mongoose.model('Message', messageSchema);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Add JSON parsing middleware
app.use(express.json());

// Store connected users
const connectedUsers = new Map();

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Auto-login event
  socket.on('auto-login', async (data) => {
    try {
      const { username } = data;
      
      const user = await User.findOne({ username });
      if (user) {
        // Store user connection
        connectedUsers.set(username, socket.id);
        socket.emit('auth-response', { success: true, user: { username } });
      } else {
        socket.emit('auth-response', { success: false, message: 'User not found' });
      }
    } catch (error) {
      socket.emit('auth-response', { success: false, message: 'Auto-login failed' });
    }
  });
  
  // Authentication events
  socket.on('register', async (data) => {
    try {
      const { username, password } = data;
      
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        socket.emit('auth-response', { success: false, message: 'Username already exists' });
        return;
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = new User({ username, password: hashedPassword });
      await newUser.save();
      
      // Store user connection
      connectedUsers.set(username, socket.id);
      socket.emit('auth-response', { success: true, user: { username } });
    } catch (error) {
      socket.emit('auth-response', { success: false, message: 'Registration failed' });
    }
  });
  
  socket.on('login', async (data) => {
    try {
      const { username, password } = data;
      
      const user = await User.findOne({ username });
      if (!user) {
        socket.emit('auth-response', { success: false, message: 'Invalid username or password' });
        return;
      }
      
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        socket.emit('auth-response', { success: false, message: 'Invalid username or password' });
        return;
      }
      
      // Store user connection
      connectedUsers.set(username, socket.id);
      socket.emit('auth-response', { success: true, user: { username } });
    } catch (error) {
      socket.emit('auth-response', { success: false, message: 'Login failed' });
    }
  });
  
  // Friends events
  socket.on('get-friends', async (data) => {
    try {
      const { username } = data;
      
      const friends = await FriendRequest.find({
        $or: [{ from: username }, { to: username }],
        status: 'accepted'
      });
      
      const friendList = friends.map(req => {
        return req.from === username ? req.to : req.from;
      });
      
      socket.emit('friends-list', friendList);
    } catch (error) {
      console.error('Error getting friends:', error);
    }
  });
  
  socket.on('get-requests', async (data) => {
    try {
      const { username } = data;
      
      const requests = await FriendRequest.find({
        to: username,
        status: 'pending'
      });
      
      const requestList = requests.map(req => req.from);
      socket.emit('requests-list', requestList);
    } catch (error) {
      console.error('Error getting requests:', error);
    }
  });
  
  socket.on('add-friend', async (data) => {
    try {
      const { username, friendUsername } = data;
      
      const userExists = await User.findOne({ username: friendUsername });
      if (!userExists) {
        socket.emit('friend-added', { success: false, message: 'User not found' });
        return;
      }
      
      const existingRequest = await FriendRequest.findOne({
        $or: [
          { from: username, to: friendUsername },
          { from: friendUsername, to: username }
        ]
      });
      
      if (existingRequest) {
        socket.emit('friend-added', { success: false, message: 'Request already exists' });
        return;
      }
      
      const newRequest = new FriendRequest({
        from: username,
        to: friendUsername
      });
      
      await newRequest.save();
      
      // Notify the recipient if they're online
      const recipientSocketId = connectedUsers.get(friendUsername);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('new-request', { from: username });
      }
      
      socket.emit('friend-added', { success: true, message: 'Friend request sent' });
    } catch (error) {
      console.error('Error adding friend:', error);
      socket.emit('friend-added', { success: false, message: 'Error adding friend' });
    }
  });
  
  socket.on('accept-request', async (data) => {
    try {
      const { username, requestUsername } = data;
      
      await FriendRequest.findOneAndUpdate(
        { from: requestUsername, to: username },
        { status: 'accepted' }
      );
      
      // Refresh both users' friends lists
      socket.emit('get-friends', { username });
      
      // Notify the requester if they're online
      const requesterSocketId = connectedUsers.get(requestUsername);
      if (requesterSocketId) {
        io.to(requesterSocketId).emit('get-friends', { username: requestUsername });
      }
      
      // Refresh requests list
      const requests = await FriendRequest.find({
        to: username,
        status: 'pending'
      });
      
      const requestList = requests.map(req => req.from);
      socket.emit('requests-list', requestList);
    } catch (error) {
      console.error('Error accepting request:', error);
    }
  });
  
  socket.on('reject-request', async (data) => {
    try {
      const { username, requestUsername } = data;
      
      await FriendRequest.findOneAndDelete(
        { from: requestUsername, to: username }
      );
      
      // Refresh requests list
      const requests = await FriendRequest.find({
        to: username,
        status: 'pending'
      });
      
      const requestList = requests.map(req => req.from);
      socket.emit('requests-list', requestList);
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  });
  
  socket.on('remove-friend', async (data) => {
    try {
      const { username, friendUsername } = data;
      
      await FriendRequest.findOneAndDelete({
        $or: [
          { from: username, to: friendUsername },
          { from: friendUsername, to: username }
        ],
        status: 'accepted'
      });
      
      // Refresh friends list
      socket.emit('get-friends', { username });
      
      // Notify the friend if they're online
      const friendSocketId = connectedUsers.get(friendUsername);
      if (friendSocketId) {
        io.to(friendSocketId).emit('get-friends', { username: friendUsername });
      }
    } catch (error) {
      console.error('Error removing friend:', error);
    }
  });
  
  // Messaging events
  socket.on('send-message', async (data) => {
    try {
      const { from, to, message } = data;
      
      const newMessage = new Message({
        from,
        to,
        text: message
      });
      
      await newMessage.save();
      
      // Send to recipient if online
      const recipientSocketId = connectedUsers.get(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('new-message', { from, message });
      }
      
      // Also send back to sender for immediate UI update
      socket.emit('new-message', { from, message, self: true });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });
  
  socket.on('get-chat-history', async (data) => {
    try {
      const { username, withUser } = data;
      
      const messages = await Message.find({
        $or: [
          { from: username, to: withUser },
          { from: withUser, to: username }
        ]
      }).sort({ timestamp: 1 });
      
      socket.emit('chat-history', messages);
    } catch (error) {
      console.error('Error getting chat history:', error);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove user from connected users
    for (let [username, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) {
        connectedUsers.delete(username);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});