
# 📦 Asset Management and Tracking System  
A comprehensive web application for managing company assets, tracking assignments, and maintaining detailed history records.

## 📚 Table of Contents
- Features
- Tech Stack
- Prerequisites
- Installation
- Database Setup
- Running the Application
- API Endpoints
- Workflow
- Project Structure
- Contributing


## ✨ Features
### ✅ Core Functionality
- **Asset Management**: Add, edit, delete, and categorize company assets  
- **Asset Assignment**: Assign assets to employees with automatic tracking  
- **Assignment History**: View complete timeline of asset assignments and returns  
- **Real-time Dashboard**: Overview of total, assigned, and available assets  

### 🔒 Advanced Features
- **Auto-generated Serial Numbers**: Unique serial numbers based on asset type  
- **Type Management**: Create, rename, and delete asset types  
- **Search & Filter**: Advanced filtering by status, type, and search terms  
- **Responsive Design**: Works seamlessly on desktop and mobile devices  
- **Data Validation**: Comprehensive validation and error handling  

## 🛠 Tech Stack
### Frontend
- https://react.dev/ – Modern React with hooks and functional components  
- https://vitejs.dev/ – Fast build tool and development server  
- **CSS3** – Custom styling with modern design principles  
- **DM Sans Font** – Clean, modern typography  

### Backend
- https://nodejs.org/ – JavaScript runtime environment  
- https://expressjs.com/ – Web application framework  
- https://www.microsoft.com/en-us/sql-server – Database  
- https://www.npmjs.com/package/mssql – SQL Server driver for Node.js  

### Database
- **SQL Server Management Studio (SSMS)** – Database management  
- Tables: `Employees`, `Assets`, `AssetAssignments`, `AssetTypes`  

## 📋 Prerequisites
Ensure you have installed:
- https://nodejs.org/en/download/  
- https://www.microsoft.com/en-us/sql-server/sql-server-downloads  
- https://learn.microsoft.com/en-us/sql/ssms/download-sql-server-management-studio-ssms  
- https://git-scm.com/downloads  

## ⚙️ Installation
### 1️⃣ Clone the repository
```bash
git clone https://github.com/your-username/asset-tracking-system.git
cd asset-tracking-system
````

### 2️⃣ Install dependencies

```bash
# Backend
cd Backend
npm install

# Frontend
cd ../Frontend
npm install
```

## 🗄 Database Setup

### i. Create the database

*   Open **SQL Server Management Studio (SSMS)**
*   Connect to your SQL Server instance
*   Run the SQL script: `AssetManagament.sql`

### ii. Configure database connection

Edit `Backend/config/database.js`:

```javascript
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
```

### iii. Insert sample data (optional)

Run provided SQL scripts to insert sample employees and assets.

## ▶ Running the Application

### Development Mode

```bash
# Start backend
cd Backend
npm start
# Runs on http://localhost:3000

# Start frontend
cd ../Frontend
npm run dev
# Runs on http://localhost:5173
```

Open browser: <http://localhost:5173>

### Production Mode

```bash
# Build frontend
cd Frontend
npm run build

# Start backend
cd ../Backend
npm start
```

## 📡 API Endpoints

| Method   | Endpoint                      | Description          |
| -------- | ----------------------------- | -------------------- |
| **POST** | `/api/employees`              | Create employee      |
| **GET**  | `/api/employees`              | Get all employees    |
| **POST** | `/api/assets`                 | Create asset         |
| **GET**  | `/api/assets`                 | Get all assets       |
| **GET**  | `/api/assets/available`       | Get available assets |
| **GET**  | `/api/assets/:id/history`     | Get asset history    |
| **POST** | `/api/assignments`            | Assign asset         |
| **POST** | `/api/assignments/:id/return` | Return asset         |
| **GET**  | `/api/assignments/active`     | Active assignments   |
| **GET**  | `/api/dashboard`              | Dashboard stats      |

## 🔄 Workflow

**Asset Lifecycle:**  
`Add Asset → Assign Asset → Track Usage → Return Asset → Edit/Delete`

**User Workflow:**  
`Dashboard → Manage Assets → Assign Assets → View History → Manage Types`

## 📁 Project Structure

    Asset Tracking System/
    ├── Backend/
    │   ├── config/
    │   │   └── database.js
    │   ├── routes/
    │   ├── server.js
    │   └── package.json
    ├── Frontend/
    │   ├── public/
    │   ├── src/
    │   │   ├── App.jsx
    │   │   ├── App.css
    │   │   └── main.jsx
    │   └── package.json
    ├── AssetManagament.sql
    └── README.md

## 🤝 Contributing

1.  Fork the repository
2.  Create a feature branch:
    ```bash
    git checkout -b feature/amazing-feature
    ```
3.  Commit changes:
    ```bash
    git commit -m "Add amazing feature"
    ```
4.  Push to branch:
    ```bash
    git push origin feature/amazing-feature
    ```
5.  Open a Pull Request



