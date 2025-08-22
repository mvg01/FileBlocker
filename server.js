const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 8001;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'data.json');

async function migrateFromJsonToDatabase() {
  try {
    await fs.access(DATA_FILE);
    const jsonData = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
    
    console.log('Found existing data.json, migrating to database...');
    
    for (const ext of jsonData.fixedExtensions) {
      try {
        await db.updateFixedExtension(ext.name, ext.blocked);
      } catch (error) {
        console.error(`Error migrating fixed extension ${ext.name}:`, error);
      }
    }
    
    for (const extName of jsonData.customExtensions) {
      try {
        await db.addCustomExtension(extName);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.error(`Error migrating custom extension ${extName}:`, error);
        }
      }
    }
    
    const backupFile = DATA_FILE + '.backup';
    await fs.rename(DATA_FILE, backupFile);
    console.log(`Migration completed. Backup saved as ${backupFile}`);
    
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Migration error:', error);
    }
  }
}

app.get('/api/extensions', async (req, res) => {
  try {
    const data = await db.getAllExtensionData();
    res.json(data);
  } catch (error) {
    console.error('Error fetching extensions:', error);
    res.status(500).json({ error: 'Failed to read data' });
  }
});

app.put('/api/extensions/fixed/:extensionName', async (req, res) => {
  try {
    const { extensionName } = req.params;
    const { blocked } = req.body;
    
    const updated = await db.updateFixedExtension(extensionName, blocked);
    
    if (!updated) {
      return res.status(404).json({ error: 'Extension not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating fixed extension:', error);
    res.status(500).json({ error: 'Failed to update extension' });
  }
});

app.post('/api/extensions/custom', async (req, res) => {
  try {
    const { extension } = req.body;
    
    if (!extension || extension.length > 20) {
      return res.status(400).json({ error: 'Invalid extension length' });
    }
    
    if (!/^[a-z0-9]+$/i.test(extension)) {
      return res.status(400).json({ error: 'Invalid extension format' });
    }
    
    await db.addCustomExtension(extension);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding custom extension:', error);
    
    if (error.message === 'Maximum custom extensions limit reached') {
      return res.status(400).json({ error: 'Maximum custom extensions limit reached' });
    }
    
    if (error.message === 'Extension already exists') {
      return res.status(400).json({ error: 'Extension already exists' });
    }
    
    res.status(500).json({ error: 'Failed to add custom extension' });
  }
});

app.delete('/api/extensions/custom/:extension', async (req, res) => {
  try {
    const { extension } = req.params;
    
    const deleted = await db.removeCustomExtension(extension);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Extension not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting custom extension:', error);
    res.status(500).json({ error: 'Failed to delete custom extension' });
  }
});

app.get('/api/settings/file-size-limit', async (req, res) => {
  try {
    const limit = await db.getFileSizeLimit();
    res.json({ fileSizeLimit: limit });
  } catch (error) {
    console.error('Error fetching file size limit:', error);
    res.status(500).json({ error: 'Failed to fetch file size limit' });
  }
});

app.put('/api/settings/file-size-limit', async (req, res) => {
  try {
    const { limit } = req.body;
    
    if (typeof limit !== 'number' || limit < 0 || limit > 1024) {
      return res.status(400).json({ error: 'Invalid file size limit. Must be between 0-1024 MB.' });
    }
    
    await db.setFileSizeLimit(Math.floor(limit));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting file size limit:', error);
    res.status(500).json({ error: 'Failed to set file size limit' });
  }
});

async function startServer() {
  try {
    await db.initializeDatabase();
    await migrateFromJsonToDatabase();
    
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log('Database connection established');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();