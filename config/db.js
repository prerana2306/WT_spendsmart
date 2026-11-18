const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/spendsmart';
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[SpendSmart Database] MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[SpendSmart Database Error] Connection failed: ${error.message}`);
    console.error('Please ensure MongoDB is running or check your MONGODB_URI in .env');
    // If running in development and local mongod failed, give informative message
    if (process.env.NODE_ENV !== 'production') {
      console.log('Tip: You can start mongod locally or provide a free MongoDB Atlas URI in .env.');
    }
    throw error;
  }
};

module.exports = connectDB;
