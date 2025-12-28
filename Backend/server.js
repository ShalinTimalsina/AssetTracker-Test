// =====================================================
// ASSET TRACKING BACKEND - SIMPLE API
// Connects to SQL Server stored procedures
// =====================================================

require('dotenv').config();
const express = require('express');
const sql = require('mssql');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database Configuration
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || 1433),
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

// Database Connection Pool
let pool;

// Middleware to check database connection
const checkDbConnection = (req, res, next) => {
    if (!pool) {
        return res.status(503).json({ error: 'Database not connected yet. Please wait.' });
    }
    next();
};

// =====================================================
// API ENDPOINTS
// =====================================================

// Health Check (no db needed)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'API is running' });
});

// =====================================================
// EMPLOYEES
// =====================================================

// POST /api/employees - Create employee
app.post('/api/employees', checkDbConnection, async (req, res) => {
    try {
        const { fullName, email } = req.body;

        const result = await pool.request()
            .input('fullName', sql.NVarChar, fullName)
            .input('email', sql.NVarChar, email)
            .query(`
        INSERT INTO Employees (FullName, Email)
        OUTPUT INSERTED.EmployeeId, INSERTED.FullName, INSERTED.Email, INSERTED.CreatedAt
        VALUES (@fullName, @email)
      `);

        res.status(201).json({
            success: true,
            message: 'Employee created',
            data: result.recordset[0]
        });
    } catch (err) {
        console.error('Create employee error:', err);
        res.status(400).json({ success: false, message: err.message });
    }
});

// GET /api/employees - Get all employees
app.get('/api/employees', checkDbConnection, async (req, res) => {
    try {
        const result = await pool.request()
            .query('SELECT * FROM Employees ORDER BY FullName');
        res.json(result.recordset);
    } catch (err) {
        console.error('Get employees error:', err);
        res.status(500).json({ error: err.message });
    }
});

// =====================================================
// ASSETS
// =====================================================

// POST /api/assets - Create asset
app.post('/api/assets', checkDbConnection, async (req, res) => {
    try {
        const { assetName, assetType, serialNumber } = req.body;

        const result = await pool.request()
            .input('assetName', sql.NVarChar, assetName)
            .input('assetType', sql.NVarChar, assetType)
            .input('serialNumber', sql.NVarChar, serialNumber)
            .query(`
        INSERT INTO Assets (AssetName, AssetType, SerialNumber)
        OUTPUT INSERTED.*
        VALUES (@assetName, @assetType, @serialNumber)
      `);

        res.status(201).json({
            success: true,
            message: 'Asset created',
            data: result.recordset[0]
        });
    } catch (err) {
        console.error('Create asset error:', err);
        res.status(400).json({ success: false, message: err.message });
    }
});

// GET /api/assets - Get all assets
app.get('/api/assets', checkDbConnection, async (req, res) => {
    try {
        const result = await pool.request()
            .query('SELECT * FROM Assets ORDER BY AssetName');
        res.json(result.recordset);
    } catch (err) {
        console.error('Get assets error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/assets/available - Get available assets (not assigned)
app.get('/api/assets/available', checkDbConnection, async (req, res) => {
    try {
        const result = await pool.request()
            .query(`
        SELECT a.*
        FROM Assets a
        WHERE NOT EXISTS (
          SELECT 1 FROM AssetAssignments aa
          WHERE aa.AssetId = a.AssetId AND aa.ReturnedAt IS NULL
        )
        ORDER BY a.AssetName
      `);
        res.json(result.recordset);
    } catch (err) {
        console.error('Get available assets error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/assets/:assetId/history - Get asset assignment history
app.get('/api/assets/:assetId/history', checkDbConnection, async (req, res) => {
    try {
        const { assetId } = req.params;

        // Using stored procedure
        const result = await pool.request()
            .input('AssetId', sql.Int, assetId)
            .execute('sp_GetAssetHistory');

        res.json(result.recordset);
    } catch (err) {
        console.error('Get asset history error:', err);
        res.status(500).json({ error: err.message });
    }
});

// =====================================================
// ASSIGNMENTS
// =====================================================

// POST /api/assignments - Assign asset to employee (using stored procedure)
app.post('/api/assignments', checkDbConnection, async (req, res) => {
    try {
        const { assetId, employeeId } = req.body;

        // Use the stored procedure sp_AssignAsset
        await pool.request()
            .input('AssetId', sql.Int, assetId)
            .input('EmployeeId', sql.Int, employeeId)
            .execute('sp_AssignAsset');

        // Get the newly created assignment
        const result = await pool.request()
            .input('assetId', sql.Int, assetId)
            .query(`
        SELECT TOP 1 aa.*, e.FullName as EmployeeName, a.AssetName
        FROM AssetAssignments aa
        JOIN Employees e ON aa.EmployeeId = e.EmployeeId
        JOIN Assets a ON aa.AssetId = a.AssetId
        WHERE aa.AssetId = @assetId AND aa.ReturnedAt IS NULL
        ORDER BY aa.AssignedAt DESC
      `);

        res.status(201).json({
            success: true,
            message: 'Asset assigned successfully',
            data: result.recordset[0]
        });
    } catch (err) {
        console.error('Assign asset error:', err);
        if (err.message.includes('already assigned')) {
            res.status(409).json({ success: false, message: 'Asset is already assigned' });
        } else {
            res.status(400).json({ success: false, message: err.message });
        }
    }
});

// POST /api/assignments/:assignmentId/return - Return asset (using stored procedure)
app.post('/api/assignments/:assignmentId/return', checkDbConnection, async (req, res) => {
    try {
        const { assignmentId } = req.params;

        // Use the stored procedure sp_ReturnAsset
        await pool.request()
            .input('AssignmentId', sql.Int, assignmentId)
            .execute('sp_ReturnAsset');

        // Get the updated assignment
        const result = await pool.request()
            .input('assignmentId', sql.Int, assignmentId)
            .query(`
        SELECT * FROM AssetAssignments WHERE AssignmentId = @assignmentId
      `);

        res.json({
            success: true,
            message: 'Asset returned successfully',
            data: result.recordset[0]
        });
    } catch (err) {
        console.error('Return asset error:', err);
        res.status(400).json({ success: false, message: err.message });
    }
});

// GET /api/assignments/active - Get active assignments (using stored procedure)
app.get('/api/assignments/active', checkDbConnection, async (req, res) => {
    try {
        const result = await pool.request()
            .execute('sp_GetActiveAssignments');

        res.json(result.recordset);
    } catch (err) {
        console.error('Get active assignments error:', err);
        res.status(500).json({ error: err.message });
    }
});

// =====================================================
// DASHBOARD
// =====================================================

// GET /api/dashboard - Get summary stats
app.get('/api/dashboard', checkDbConnection, async (req, res) => {
    try {
        const result = await pool.request()
            .query(`
        SELECT 
          (SELECT COUNT(*) FROM Assets) AS TotalAssets,
          (SELECT COUNT(*) FROM AssetAssignments WHERE ReturnedAt IS NULL) AS AssignedAssets,
          (SELECT COUNT(*) FROM Assets) - 
          (SELECT COUNT(*) FROM AssetAssignments WHERE ReturnedAt IS NULL) AS AvailableAssets
      `);

        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server after database connection
const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        // Connect to database first
        pool = await sql.connect(dbConfig);
        console.log('Database connected successfully');

        // Then start the server
        app.listen(PORT, () => {
            console.log('');
            console.log('===========================================');
            console.log('Asset Tracking API Server');
            console.log('===========================================');
            console.log(`Server: http://localhost:${PORT}`);
            console.log(`API: http://localhost:${PORT}/api`);
            console.log('===========================================');
            console.log('');
            console.log('Endpoints:');
            console.log('  POST /api/employees - Create employee');
            console.log('  GET  /api/employees - Get all employees');
            console.log('  POST /api/assets - Create asset');
            console.log('  GET  /api/assets - Get all assets');
            console.log('  GET  /api/assets/available - Get available assets');
            console.log('  GET  /api/assets/:id/history - Get asset history');
            console.log('  POST /api/assignments - Assign asset');
            console.log('  POST /api/assignments/:id/return - Return asset');
            console.log('  GET  /api/assignments/active - Active assignments');
            console.log('  GET  /api/dashboard - Dashboard stats');
            console.log('');
        });
    } catch (err) {
        console.error('Failed to start server:', err.message);
        process.exit(1);
    }
}

startServer();