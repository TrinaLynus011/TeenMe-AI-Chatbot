require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware
app.use(cors({
  origin: '*'
}));
app.use(express.json());
app.use(express.static('public')); // Serves files from /public

// Database (MongoDB)
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/teenme', { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
});

// Models
const Message = mongoose.model('Message', {
  sessionId: String,
  text: String,
  sender: String, // 'user' or 'bot'
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', {
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Auth Middleware
const authenticate = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: "Access denied" });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: "Invalid token" });
  }
};

// Registration Endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(409).json({ 
        error: existingUser.username === username 
          ? "Username already exists" 
          : "Email already registered" 
      });
    }

    // Create new user (without hashing - DEVELOPMENT ONLY)
    const newUser = new User({ username, email, password });
    await newUser.save();

    // Create token
    const token = jwt.sign(
      { userId: newUser._id, username: newUser.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );

    res.status(201).json({ 
      success: true, 
      token,
      user: { 
        id: newUser._id, 
        username: newUser.username,
        email: newUser.email
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login Endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Create token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );

    res.json({ 
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

// Protected Profile Endpoint
app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Voice Processing Endpoint
app.post('/api/process-voice', express.raw({ type: 'audio/wav', limit: '5mb' }), async (req, res) => {
  try {
    const mockTranscript = "This is a mock voice transcript"; 
    res.json({ text: mockTranscript });
  } catch (error) {
    console.error('Voice processing error:', error);
    res.status(500).json({ error: "Voice processing failed" });
  }
});

// Chat Endpoint (protected)
app.post('/api/chat', authenticate, async (req, res) => {
  try {
    const { message, sessionId = uuidv4() } = req.body;
    const userId = req.user.userId;

    // Save user message
    await Message.create({ 
      sessionId, 
      text: message, 
      sender: 'user',
      userId
    });

    // AI Response (mock)
    const aiResponse = `I received: "${message}". This is a mock response.`;
    
    // Save bot response
    await Message.create({
      sessionId,
      text: aiResponse,
      sender: 'bot',
      userId
    });

    res.json({ response: aiResponse, sessionId });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: "Chat processing failed" });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});