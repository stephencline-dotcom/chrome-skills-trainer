const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

require('./server/classroom')(app, express);

// Serve static assets from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Explicit routes for landing page and roles
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/teacher', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'teacher.html'));
});

app.get('/student', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student.html'));
});

app.get('/presentation', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'presentation.html'));
});

app.get('/teacher.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'teacher.html'));
});

app.get('/student.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student.html'));
});

app.get('/presentation.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'presentation.html'));
});

app.listen(PORT, () => {
  console.log(`Chrome Skills Trainer server running at http://localhost:${PORT}`);
});
