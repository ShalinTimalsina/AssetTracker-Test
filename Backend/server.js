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
        const { fullName, email, position } = req.body;

        const result = await pool.request()
            .input('fullName', sql.NVarChar, fullName)
            .input('email', sql.NVarChar, email)
            .input('position', sql.NVarChar, position || null)
            .query(`
        INSERT INTO Employees (FullName, Email, Position)
        OUTPUT INSERTED.EmployeeId, INSERTED.FullName, INSERTED.Email, INSERTED.Position, INSERTED.CreatedAt
        VALUES (@fullName, @email, @position)
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

// Helper function to generate unique serial number from asset type
async function generateSerialNumber(assetType) {
    // Get first 2 letters of asset type (uppercase), handle short names
    const prefix = assetType
        .replace(/[^a-zA-Z]/g, '') // Remove non-letters
        .substring(0, 2)
        .toUpperCase()
        .padEnd(2, 'X'); // Pad with X if less than 2 chars

    const year = new Date().getFullYear();
    const basePattern = `${prefix}-${year}-`;

    // Find the highest existing number for this prefix-year combination
    const result = await pool.request()
        .input('pattern', sql.NVarChar, `${basePattern}%`)
        .query(`
            SELECT TOP 1 SerialNumber 
            FROM Assets 
            WHERE SerialNumber LIKE @pattern 
            ORDER BY CAST(RIGHT(SerialNumber, 3) AS INT) DESC
        `);

    let nextNumber = 1;

    if (result.recordset.length > 0) {
        const lastSerial = result.recordset[0].SerialNumber;
        const parts = lastSerial.split('-');
        if (parts.length === 3) {
            const lastNum = parseInt(parts[2], 10);
            if (!isNaN(lastNum)) {
                nextNumber = lastNum + 1;
            }
        }
    }

    // Format: XX-2025-001 (padded to 3 digits, can grow beyond 999)
    const serialNumber = `${basePattern}${nextNumber.toString().padStart(3, '0')}`;

    // Double-check uniqueness (security measure)
    const existsCheck = await pool.request()
        .input('serial', sql.NVarChar, serialNumber)
        .query('SELECT COUNT(*) as cnt FROM Assets WHERE SerialNumber = @serial');

    if (existsCheck.recordset[0].cnt > 0) {
        // Extremely rare: collision detected, recursively try next number
        return generateSerialNumber(assetType);
    }

    return serialNumber;
}

// POST /api/assets - Create asset with auto-generated serial number
app.post('/api/assets', checkDbConnection, async (req, res) => {
    try {
        const { assetName, assetType } = req.body;

        if (!assetName || !assetType) {
            return res.status(400).json({
                success: false,
                message: 'Asset name and type are required'
            });
        }

        // Auto-generate unique serial number
        const serialNumber = await generateSerialNumber(assetType);

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
            message: 'Asset created successfully',
            data: result.recordset[0]
        });
    } catch (err) {
        console.error('Create asset error:', err);

        if (err.message.includes('UNIQUE') || err.message.includes('duplicate')) {
            return res.status(400).json({
                success: false,
                message: 'Serial number conflict. Please try again.'
            });
        }

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

// PUT /api/assets/:assetId - Update asset
app.put('/api/assets/:assetId', checkDbConnection, async (req, res) => {
    try {
        const { assetId } = req.params;
        const { assetName, assetType } = req.body;

        if (!assetName || !assetType) {
            return res.status(400).json({
                success: false,
                message: 'Asset name and type are required'
            });
        }

        const result = await pool.request()
            .input('assetId', sql.Int, assetId)
            .input('assetName', sql.NVarChar, assetName)
            .input('assetType', sql.NVarChar, assetType)
            .query(`
                UPDATE Assets 
                SET AssetName = @assetName, AssetType = @assetType
                OUTPUT INSERTED.*
                WHERE AssetId = @assetId
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Asset not found'
            });
        }

        res.json({
            success: true,
            message: 'Asset updated successfully',
            data: result.recordset[0]
        });
    } catch (err) {
        console.error('Update asset error:', err);
        res.status(400).json({ success: false, message: err.message });
    }
});

// DELETE /api/assets/:assetId - Delete asset (only if not currently assigned)
app.delete('/api/assets/:assetId', checkDbConnection, async (req, res) => {
    try {
        const { assetId } = req.params;

        // Check if asset is currently assigned
        const assignmentCheck = await pool.request()
            .input('assetId', sql.Int, assetId)
            .query(`
                SELECT COUNT(*) as cnt 
                FROM AssetAssignments 
                WHERE AssetId = @assetId AND ReturnedAt IS NULL
            `);

        if (assignmentCheck.recordset[0].cnt > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete asset. It is currently assigned to an employee. Return it first.'
            });
        }

        // Delete assignment history first (if any)
        await pool.request()
            .input('assetId', sql.Int, assetId)
            .query('DELETE FROM AssetAssignments WHERE AssetId = @assetId');

        // Delete the asset
        const result = await pool.request()
            .input('assetId', sql.Int, assetId)
            .query('DELETE FROM Assets WHERE AssetId = @assetId');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Asset not found'
            });
        }

        res.json({
            success: true,
            message: 'Asset deleted successfully'
        });
    } catch (err) {
        console.error('Delete asset error:', err);
        res.status(400).json({ success: false, message: err.message });
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

// GET /api/assignments/active - Get active assignments with employee details
app.get('/api/assignments/active', checkDbConnection, async (req, res) => {
    try {
        // Use direct query to include all employee details
        const result = await pool.request()
            .query(`
                SELECT 
                    aa.AssignmentId,
                    aa.AssetId,
                    aa.EmployeeId,
                    aa.AssignedAt,
                    aa.ReturnedAt,
                    a.AssetName,
                    a.AssetType,
                    a.SerialNumber,
                    e.FullName AS EmployeeName,
                    e.Email AS EmployeeEmail,
                    e.Position AS EmployeePosition
                FROM AssetAssignments aa
                JOIN Assets a ON aa.AssetId = a.AssetId
                JOIN Employees e ON aa.EmployeeId = e.EmployeeId
                WHERE aa.ReturnedAt IS NULL
                ORDER BY aa.AssignedAt DESC
            `);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get active assignments error:', err);
        res.status(500).json({ error: err.message });
    }
});

// =====================================================
// ASSET TYPES (CRUD)
// =====================================================

// GET /api/asset-types - Get all unique asset types (from Assets table + defaults)
app.get('/api/asset-types', checkDbConnection, async (req, res) => {
    try {
        const result = await pool.request()
            .query(`
                SELECT DISTINCT AssetType 
                FROM Assets 
                WHERE AssetType IS NOT NULL AND AssetType != ''
                ORDER BY AssetType
            `);

        // Default types
        const defaultTypes = ['Laptop', 'Mobile', 'Monitor', 'Keyboard', 'Mouse', 'Headset', 'Tablet', 'Camera', 'Printer', 'Other'];
        const dbTypes = result.recordset.map(r => r.AssetType);

        // Merge and deduplicate
        const allTypes = [...new Set([...defaultTypes, ...dbTypes])].sort();

        res.json(allTypes);
    } catch (err) {
        console.error('Get asset types error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/asset-types/rename - Rename an asset type (updates all assets with that type)
app.put('/api/asset-types/rename', checkDbConnection, async (req, res) => {
    try {
        const { oldType, newType } = req.body;

        if (!oldType || !newType) {
            return res.status(400).json({
                success: false,
                message: 'Old type and new type are required'
            });
        }

        if (oldType === newType) {
            return res.status(400).json({
                success: false,
                message: 'New type must be different from old type'
            });
        }

        // Check if new type already exists (to prevent duplicates)
        const existsCheck = await pool.request()
            .input('newType', sql.NVarChar, newType)
            .query('SELECT COUNT(*) as cnt FROM Assets WHERE AssetType = @newType');

        if (existsCheck.recordset[0].cnt > 0) {
            return res.status(400).json({
                success: false,
                message: `Type "${newType}" already exists. Cannot create duplicate.`
            });
        }

        // Update all assets with the old type
        const result = await pool.request()
            .input('oldType', sql.NVarChar, oldType)
            .input('newType', sql.NVarChar, newType)
            .query(`
                UPDATE Assets 
                SET AssetType = @newType 
                WHERE AssetType = @oldType
            `);

        res.json({
            success: true,
            message: `Renamed "${oldType}" to "${newType}". ${result.rowsAffected[0]} asset(s) updated.`,
            count: result.rowsAffected[0]
        });
    } catch (err) {
        console.error('Rename asset type error:', err);
        res.status(400).json({ success: false, message: err.message });
    }
});

// DELETE /api/asset-types/:type - Delete a type (only if no assets use it)
app.delete('/api/asset-types/:type', checkDbConnection, async (req, res) => {
    try {
        const { type } = req.params;

        // Check if any assets use this type
        const countCheck = await pool.request()
            .input('type', sql.NVarChar, type)
            .query('SELECT COUNT(*) as cnt FROM Assets WHERE AssetType = @type');

        if (countCheck.recordset[0].cnt > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete "${type}". ${countCheck.recordset[0].cnt} asset(s) are using this type. Rename or reassign them first.`
            });
        }

        // Type is not in use, just return success (it's only in our default list)
        res.json({
            success: true,
            message: `Type "${type}" is not used by any assets.`
        });
    } catch (err) {
        console.error('Delete asset type error:', err);
        res.status(400).json({ success: false, message: err.message });
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