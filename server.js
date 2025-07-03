const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files

// Initialize SQLite database
const db = new sqlite3.Database('shared_tasks.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('📦 Connected to SQLite database');
    }
});

// Create tasks table if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    completed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT DEFAULT 'Anonymous'
)`, (err) => {
    if (err) {
        console.error('Error creating table:', err);
    } else {
        console.log('✅ Tasks table ready');
    }
});

// API Routes

// Get all tasks
app.get('/api/tasks', (req, res) => {
    db.all('SELECT * FROM tasks ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            console.error('Error fetching tasks:', err);
            res.status(500).json({ error: 'Failed to fetch tasks' });
        } else {
            res.json(rows);
        }
    });
});

// Add a new task
app.post('/api/tasks', (req, res) => {
    const { text, created_by = 'Anonymous' } = req.body;
    
    if (!text || text.trim().length === 0) {
        return res.status(400).json({ error: 'Task text is required' });
    }

    db.run(
        'INSERT INTO tasks (text, created_by) VALUES (?, ?)', 
        [text.trim(), created_by], 
        function(err) {
            if (err) {
                console.error('Error adding task:', err);
                res.status(500).json({ error: 'Failed to add task' });
            } else {
                res.json({ 
                    id: this.lastID, 
                    text: text.trim(), 
                    completed: false,
                    created_by: created_by,
                    message: 'Task added successfully' 
                });
            }
        }
    );
});

// Toggle task completion
app.put('/api/tasks/:id/toggle', (req, res) => {
    const taskId = req.params.id;
    
    // First get current status
    db.get('SELECT completed FROM tasks WHERE id = ?', [taskId], (err, row) => {
        if (err) {
            console.error('Error fetching task:', err);
            return res.status(500).json({ error: 'Failed to fetch task' });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        const newStatus = !row.completed;
        
        // Update the task
        db.run(
            'UPDATE tasks SET completed = ? WHERE id = ?', 
            [newStatus, taskId], 
            function(err) {
                if (err) {
                    console.error('Error updating task:', err);
                    res.status(500).json({ error: 'Failed to update task' });
                } else {
                    res.json({ 
                        id: taskId, 
                        completed: newStatus,
                        message: `Task ${newStatus ? 'completed' : 'marked incomplete'}` 
                    });
                }
            }
        );
    });
});

// Delete a task
app.delete('/api/tasks/:id', (req, res) => {
    const taskId = req.params.id;
    
    db.run('DELETE FROM tasks WHERE id = ?', [taskId], function(err) {
        if (err) {
            console.error('Error deleting task:', err);
            res.status(500).json({ error: 'Failed to delete task' });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Task not found' });
        } else {
            res.json({ 
                message: 'Task deleted successfully',
                deletedId: taskId 
            });
        }
    });
});

// Get task statistics
app.get('/api/stats', (req, res) => {
    db.get(`
        SELECT 
            COUNT(*) as total,
            SUM(completed) as completed,
            COUNT(*) - SUM(completed) as pending
        FROM tasks
    `, (err, stats) => {
        if (err) {
            console.error('Error fetching stats:', err);
            res.status(500).json({ error: 'Failed to fetch statistics' });
        } else {
            res.json(stats);
        }
    });
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🌐 Anyone can access the app at this URL`);
    console.log(`📊 Database: shared_tasks.db`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('📦 Database connection closed');
        }
        process.exit(0);
    });
});