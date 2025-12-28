Asset Management and Tracking System
A comprehensive web application for managing company assets, tracking assignments, and maintaining detailed history records.

Table of Contents
Features
Tech Stack
Prerequisites
Installation
Database Setup
Running the Application
API Endpoints
Workflow
Project Structure
Contributing
License

Features
Core Functionality
Asset Management: Add, edit, delete, and categorize company assets
Asset Assignment: Assign assets to employees with automatic tracking
Assignment History: View complete timeline of asset assignments and returns
Real-time Dashboard: Overview of total, assigned, and available assets

Advanced Features
Auto-generated Serial Numbers: Unique serial numbers based on asset type
Type Management: Create, rename, and delete asset types
Search & Filter: Advanced filtering by status, type, and search terms
Responsive Design: Works seamlessly on desktop and mobile devices
Data Validation: Comprehensive validation and error handling

🛠 Tech Stack
Frontend
React 18 - Modern React with hooks and functional components
Vite - Fast build tool and development server
CSS3 - Custom styling with modern design principles
DM Sans Font - Clean, modern typography
Backend
Node.js - JavaScript runtime environment
Express.js - Web application framework
SQL Server - Microsoft SQL Server database
mssql - SQL Server driver for Node.js
Database
SQL Server Management Studio (SSMS) - Database management
Tables: Employees, Assets, AssetAssignments, AssetTypes

📋 Prerequisites
Before running this application, make sure you have the following installed:

Node.js (v16 or higher) - Download
SQL Server (Express or Developer Edition) - Download
SQL Server Management Studio (SSMS) - Download
Git - Download

1. Installation
Clone the repository

git clone https://github.com/your-username/asset-tracking-system.git
cd asset-tracking-system

2. Install dependencies

# Install backend dependencies
cd Backend
npm install

# Install frontend dependencies
cd ../Frontend
npm install

3. Database Setup
i. Create the database

Open SQL Server Management Studio (SSMS)
Connect to your SQL Server instance
Run the SQL script from AssetManagament.sql to create the database and tables

ii. Configure database connection

Open database.js
Update the connection settings:

const config = {
  user: 'your-username',
  password: 'your-password',
  server: 'localhost',
  database: 'AssetTrackingDB',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

iii. Insert sample data (optional)
Run the provided SQL scripts to insert sample employees and assets

▶ Running the Application
Development Mode
i. Start the backend server
cd Backend
npm start
# Server will run on http://localhost:3000

ii. Start the frontend development servercd Frontend
npm run dev
# Application will run on http://localhost:5173

iii. Open your browser
Navigate to http://localhost:5173
The application should load with the dashboard

Production Mode
i. Build the frontend
cd Frontend
npm run build

ii. Start the backend in production
cd Backend
npm start


📡 API Endpoints

Endpoints:
  POST /api/employees - Create employee
  GET  /api/employees - Get all employees
  POST /api/assets - Create asset
  GET  /api/assets - Get all assets
  GET  /api/assets/available - Get available assets
  GET  /api/assets/:id/history - Get asset history
  POST /api/assignments - Assign asset
  POST /api/assignments/:id/return - Return asset
  GET  /api/assignments/active - Active assignments
  GET  /api/dashboard - Dashboard stats


🔄 Workflow
Asset Lifecycle
Add Asset → Asset is created with auto-generated serial number
Assign Asset → Asset is assigned to an employee
Track Usage → Assignment history is maintained
Return Asset → Asset becomes available again
Edit/Delete → Asset can be modified or removed

User Workflow
Dashboard Overview → View asset statistics and recent assignments
Manage Assets → Add new assets, edit existing ones
Assign Assets → Assign available assets to employees
View History → Check assignment history for any asset
Manage Types → Create and manage asset categories

📁 Project Structure

Asset Tracking System/
├── Backend/
│   ├── config/
│   │   └── database.js          # Database configuration
│   ├── models/                  # Data models (if separated)
│   ├── routes/                  # API route handlers
│   ├── server.js                # Main server file
│   └── package.json
├── Frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.jsx              # Main React component
│   │   ├── App.css              # Main styles
│   │   └── main.jsx             # React entry point
│   └── package.json
├── AssetManagament.sql          # Database schema
├── .gitignore                   # Git ignore rules
└── README.md                    # This file

🤝 Contributing
Fork the repository
Create a feature branch (git checkout -b feature/amazing-feature)
Commit your changes (git commit -m 'Add amazing feature')
Push to the branch (git push origin feature/amazing-feature)
Open a Pull Request
