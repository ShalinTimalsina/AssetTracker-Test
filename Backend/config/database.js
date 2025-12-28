// =====================================================
// DATABASE CONFIGURATION FOR SQL SERVER (SSMS)
// =====================================================

const sql = require('mssql');
require('dotenv').config();

// Database Configuration from .env file
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || 1433),
    options: {
        encrypt: false,               // Set to true if using Azure
        trustServerCertificate: true, // Required for local SQL Server
        enableArithAbort: true
    },
    pool: {
        max: 10,    // Maximum number of connections in pool
        min: 0,     // Minimum number of connections in pool
        idleTimeoutMillis: 30000  // Close idle connections after 30 seconds
    }
};

// Connection pool variable
let pool = null;

// Connect to database
async function connectDB() {
    try {
        if (pool) {
            return pool; // Return existing connection
        }
        pool = await sql.connect(dbConfig);
        console.log('Connected to SQL Server database successfully');
        return pool;
    } catch (err) {
        console.error('Database connection failed:', err.message);
        throw err;
    }
}

// Close database connection
async function closeDB() {
    try {
        if (pool) {
            await pool.close();
            pool = null;
            console.log('Database connection closed');
        }
    } catch (err) {
        console.error('Error closing database connection:', err.message);
        throw err;
    }
}

// Get the connection pool
function getPool() {
    if (!pool) {
        throw new Error('Database not connected. Call connectDB() first.');
    }
    return pool;
}

module.exports = {
    sql,
    dbConfig,
    connectDB,
    closeDB,
    getPool
};
