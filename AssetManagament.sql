
-- Creation of a database
CREATE DATABASE AssetTrackingDB;
GO

--Switch to the new database
USE AssetTrackingDb;
Go

-- Creation of First table.
-- Table 1 : Employees

CREATE TABLE Employees (
    EmployeeId INT IDENTITY(1,1) PRIMARY KEY,
    FullName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(100) NOT NULL UNIQUE,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
    ALTER TABLE Employees ADD Position NVARCHAR(100) NULL;
    UPDATE Employees SET Position = 'Staff' WHERE Position IS NULL;
);

-- Creation of second table.
-- Table 1 : Assets
CREATE TABLE Assets (
    AssetId INT IDENTITY(1,1) PRIMARY KEY,
    AssetName NVARCHAR(100) NOT NULL,
    AssetType NVARCHAR(50) NOT NULL,
    SerialNumber NVARCHAR(100) UNIQUE,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
);






-- Creation of third table.
-- Table 3 : AssetAssignments

CREATE TABLE AssetAssignments (
    AssignmentId INT IDENTITY(1,1) PRIMARY KEY,
    AssetId INT NOT NULL,
    EmployeeId INT NOT NULL,
    AssignedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
    ReturnedAt DATETIME2 NULL,

    FOREIGN KEY (AssetId) REFERENCES Assets(AssetId),
    FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId),

    -- Prevent returning before assigned
    CONSTRAINT CK_ReturnedAfterAssigned CHECK (ReturnedAt IS NULL OR ReturnedAt >= AssignedAt)
);

-- Critical: One asset = One active assignment at a time
CREATE UNIQUE INDEX UQ_OneAssetOneEmployee
ON AssetAssignments(AssetId)
WHERE ReturnedAt IS NULL;
GO


-- STEP 2: STORED PROCEDURES

-- Assign Asset Procedure
CREATE PROCEDURE sp_AssignAsset
    @AssetId INT,
    @EmployeeId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM AssetAssignments WHERE AssetId = @AssetId AND ReturnedAt IS NULL)
    BEGIN
        PRINT 'Asset already assigned';
        RETURN;
    END

    INSERT INTO AssetAssignments (AssetId, EmployeeId)
    VALUES (@AssetId, @EmployeeId);

    PRINT 'Asset assigned successfully';
END
GO

-- Return Asset Procedure
CREATE PROCEDURE sp_ReturnAsset
    @AssignmentId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE AssetAssignments
    SET ReturnedAt = GETDATE()
    WHERE AssignmentId = @AssignmentId AND ReturnedAt IS NULL;

    IF @@ROWCOUNT = 0
        PRINT 'Assignment not found or already returned';
    ELSE
        PRINT 'Asset returned successfully';
END
GO

-- Get Active Assignments Procedure
CREATE PROCEDURE sp_GetActiveAssignments
AS
BEGIN
    SELECT aa.AssignmentId, a.AssetName, e.FullName, aa.AssignedAt
    FROM AssetAssignments aa
    JOIN Assets a ON aa.AssetId = a.AssetId
    JOIN Employees e ON aa.EmployeeId = e.EmployeeId
    WHERE aa.ReturnedAt IS NULL
    ORDER BY aa.AssignedAt DESC;
END
GO

-- Get Asset History Procedure
CREATE PROCEDURE sp_GetAssetHistory
    @AssetId INT
AS
BEGIN
    SELECT aa.AssignmentId, e.FullName, aa.AssignedAt, aa.ReturnedAt
    FROM AssetAssignments aa
    JOIN Employees e ON aa.EmployeeId = e.EmployeeId
    WHERE aa.AssetId = @AssetId
    ORDER BY aa.AssignedAt DESC;
END
GO

-- STEP 3: SAMPLE DATA INSERTION
INSERT INTO Employees (FullName, Email) VALUES
('John Smith', 'john@company.com'),
('Sarah Johnson', 'sarah@company.com'),
('Mike Chen', 'mike@company.com');


USE AssetTrackingDB;
GO

INSERT INTO Employees (FullName, Email) VALUES
('Aarav Sharma', 'aarav.sharma@company.com'),
('Sita Thapa', 'sita.thapa@company.com'),
('Bikash Gurung', 'bikash.gurung@company.com'),
('Priya Shrestha', 'priya.shrestha@company.com'),
('Rajesh Adhikari', 'rajesh.adhikari@company.com'),
('Anita Rai', 'anita.rai@company.com'),
('Sunil Tamang', 'sunil.tamang@company.com'),
('Kabita Magar', 'kabita.magar@company.com'),
('Dipesh Bhandari', 'dipesh.bhandari@company.com'),
('Manisha Karki', 'manisha.karki@company.com');
GO

-- Verify the data
SELECT * FROM Employees;




INSERT INTO Assets (AssetName, AssetType, SerialNumber) VALUES
('MacBook Pro 16"', 'Laptop', 'MBP-001'),
('iPhone 15 Pro', 'Phone', 'IPH-001'),
('Dell Monitor', 'Monitor', 'MON-001');
GO







USE master;
GO

-- Create login
CREATE LOGIN Finetuners WITH PASSWORD = 'Finetuners 123@@';
GO

-- Switch to your database
USE AssetTrackingDB;
GO



-- Create user for the login
CREATE USER Finetuners FOR LOGIN Finetuners;
GO

-- Grant permissions
ALTER ROLE db_datareader ADD MEMBER Finetuners;
ALTER ROLE db_datawriter ADD MEMBER Finetuners;
GRANT EXECUTE TO Finetuners;
GO