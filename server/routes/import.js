// routes/import.js - Fixed version for books only
const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const Book = require('../models/Book'); // Import Book model
const router = express.Router();

// Configure multer for file upload with better error handling
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Admin check middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Function to generate book_id in the format <Initials>_<Number>
const generateBookId = async (bookName) => {
  try {
    const words = bookName.trim().split(/\s+/);
    const initials = words
      .map(word => word.charAt(0).toUpperCase())
      .join('');

    // Count existing books with the same initials (both old and new formats)
    const regexNewFormat = new RegExp(`^${initials}_\\d+$`);
    const regexOldFormat = new RegExp(`^${initials}\\d+$`);
    const countNewFormat = await Book.countDocuments({ book_id: regexNewFormat });
    const countOldFormat = await Book.countDocuments({ book_id: regexOldFormat });

    const totalCount = countNewFormat + countOldFormat;
    const nextNumber = totalCount + 1;
    const bookId = `${initials}_${nextNumber}`;

    return bookId;
  } catch (error) {
    console.error('Error generating book_id:', error);
    throw error;
  }
};

// Process and validate book data
function processBookData(data, rowNumber) {
  // Clean and normalize keys
  const cleanData = {};
  Object.keys(data).forEach(key => {
    const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '_');
    cleanData[cleanKey] = data[key] ? data[key].toString().trim() : '';
  });
  
  // Required fields validation
  if (!cleanData.name && !cleanData.book_name) {
    throw new Error(`Row ${rowNumber}: Book name is required`);
  }
  if (!cleanData.author) {
    throw new Error(`Row ${rowNumber}: Author is required`);
  }
  if (!cleanData.language) {
    throw new Error(`Row ${rowNumber}: Language is required`);
  }
  
  // Helper function to parse boolean fields
  const parseBooleanField = (value, defaultValue) => {
    if (!value) return defaultValue;
    const lowerValue = value.toString().toLowerCase().trim();
    return ['true', '1', 'yes', 'y'].includes(lowerValue);
  };

  const processedData = {
    _originalRow: rowNumber,
    name: cleanData.name || cleanData.book_name,
    author: cleanData.author,
    language: cleanData.language,
    publisher: cleanData.publisher || '',
    genre: cleanData.genre || '',
    description: cleanData.description || '',
    image_url: cleanData.image_url || '',
    audio_url: cleanData.audio_url || '',
    pdf_url: cleanData.pdf_url || '',
    ratings: parseFloat(cleanData.ratings) || 0,
    available: parseBooleanField(cleanData.available, true),
    is_free: parseBooleanField(cleanData.is_free, false),
    keeper_id: cleanData.keeper_id || ''
  };
  
  // Validate ratings
  if (processedData.ratings < 0 || processedData.ratings > 5) {
    processedData.ratings = 0;
  }
  
  return processedData;
}

// CSV Import endpoint for books only
router.post('/csv/books', authenticateToken, requireAdmin, upload.single('csvFile'), async (req, res) => {
  console.log('CSV import request received for books');
  
  try {
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log('File received:', file.originalname, 'Size:', file.size);
    
    const results = [];
    const errors = [];
    let rowNumber = 0;
    
    // Parse CSV file
    const parsePromise = new Promise((resolve, reject) => {
      fs.createReadStream(file.path)
        .pipe(csv())
        .on('data', (data) => {
          rowNumber++;
          console.log(`Processing row ${rowNumber}:`, data);
          
          try {
            const processedData = processBookData(data, rowNumber);
            if (processedData) {
              results.push(processedData);
            }
          } catch (error) {
            console.error(`Error processing row ${rowNumber}:`, error.message);
            errors.push({
              row: rowNumber,
              error: error.message,
              data: data
            });
          }
        })
        .on('end', () => {
          console.log('CSV parsing completed. Total rows processed:', rowNumber);
          resolve();
        })
        .on('error', (error) => {
          console.error('CSV parsing error:', error);
          reject(error);
        });
    });
    
    await parsePromise;
    
    // Clean up uploaded file
    fs.unlinkSync(file.path);
    
    if (results.length === 0) {
      return res.status(400).json({ 
        error: 'No valid data found in CSV',
        errors: errors
      });
    }
    
    console.log(`Found ${results.length} valid records to insert`);
    
    // Insert books into database
    let insertedCount = 0;
    let insertErrors = [];
    const insertedBooks = [];
    
    for (let i = 0; i < results.length; i++) {
      try {
        const bookData = results[i];
        
        // Generate book_id
        const bookId = await generateBookId(bookData.name);
        console.log(`Generated book_id for "${bookData.name}": ${bookId}`);
        
        // Create book object
        const newBook = new Book({
          book_id: bookId,
          name: bookData.name,
          author: bookData.author,
          language: bookData.language,
          publisher: bookData.publisher,
          genre: bookData.genre,
          description: bookData.description,
          image_url: bookData.image_url,
          audio_url: bookData.audio_url,
          pdf_url: bookData.pdf_url,
          ratings: bookData.ratings,
          available: bookData.available,
          is_free: bookData.is_free,
          keeper_id: bookData.keeper_id
        });
        
        // Save to database
        const savedBook = await newBook.save();
        console.log(`Book saved successfully: ${savedBook.book_id}`);
        
        insertedCount++;
        insertedBooks.push({
          id: savedBook.book_id,
          name: savedBook.name,
          author: savedBook.author,
          language: savedBook.language,
          publisher: savedBook.publisher,
          genre: savedBook.genre,
          image_url: savedBook.image_url,
          ratings: savedBook.ratings,
          available: savedBook.available,
          is_free: savedBook.is_free,
          keeper_id: savedBook.keeper_id
        });
        
      } catch (error) {
        console.error(`Error inserting book ${i + 1}:`, error.message);
        insertErrors.push({
          row: results[i]._originalRow,
          error: error.message,
          data: results[i]
        });
      }
    }
    
    console.log(`Import completed. Inserted: ${insertedCount}, Errors: ${insertErrors.length}`);
    
    res.json({
      success: true,
      message: `Successfully imported ${insertedCount} books`,
      totalProcessed: results.length,
      insertedCount: insertedCount,
      errorCount: errors.length + insertErrors.length,
      errors: [...errors, ...insertErrors],
      insertedData: insertedBooks
    });
    
  } catch (error) {
    console.error('CSV import error:', error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      error: 'Internal server error during CSV import',
      message: error.message
    });
  }
});

// Import status endpoint
router.get('/status', authenticateToken, requireAdmin, (req, res) => {
  res.json({
    message: 'Import service is running',
    supportedCollections: ['books'],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;