import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE = 'http://localhost:3000/api';

export default function AssetTrackingApp() {
    const [currentScreen, setCurrentScreen] = useState('dashboard');
    const [dashboardData, setDashboardData] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [availableAssets, setAvailableAssets] = useState([]);
    const [activeAssignments, setActiveAssignments] = useState([]);
    const [assetHistory, setAssetHistory] = useState([]);
    const [notification, setNotification] = useState({ show: false, message: '', type: '' });

    const showNotification = (message, type = 'success') => {
        setNotification({ show: true, message, type });
        setTimeout(() => setNotification({ show: false, message: '', type: '' }), 4000);
    };

    const fetchDashboard = async () => {
        try {
            const res = await fetch(`${API_BASE}/dashboard`);
            if (!res.ok) throw new Error('Failed to fetch dashboard');
            const data = await res.json();
            setDashboardData(data);
        } catch (err) {
            console.error('Dashboard error:', err);
            showNotification('Failed to load dashboard', 'error');
        }
    };

    const fetchActiveAssignments = async () => {
        try {
            const res = await fetch(`${API_BASE}/assignments/active`);
            if (!res.ok) throw new Error('Failed to fetch assignments');
            const data = await res.json();
            setActiveAssignments(data);
        } catch (err) {
            console.error('Assignments error:', err);
            showNotification('Failed to load assignments', 'error');
        }
    };

    useEffect(() => {
        fetchDashboard();
        fetchActiveAssignments();
    }, []);

    const handleReturn = async (assignmentId) => {
        if (!window.confirm('Return this asset?')) return;

        try {
            const res = await fetch(`${API_BASE}/assignments/${assignmentId}/return`, {
                method: 'POST'
            });
            const data = await res.json();

            if (data.success) {
                showNotification('Asset returned successfully');
                fetchDashboard();
                fetchActiveAssignments();
            } else {
                showNotification(data.message || 'Failed to return asset', 'error');
            }
        } catch (err) {
            console.error('Return error:', err);
            showNotification('Network error', 'error');
        }
    };

    // Dashboard Screen
    const DashboardScreen = () => (
        <div>
            <div className="page-header">
                <h1>Asset Tracking Dashboard</h1>
                <div className="button-group">
                    <button className="btn-primary" onClick={() => setCurrentScreen('assign')}>
                        Assign Asset
                    </button>
                    <button className="btn-secondary" onClick={() => setCurrentScreen('history')}>
                        View History
                    </button>
                </div>
            </div>

            {dashboardData && (
                <div className="metrics-grid">
                    <div className="metric-card">
                        <div className="metric-label">Total Assets</div>
                        <div className="metric-value">{dashboardData.TotalAssets || 0}</div>
                    </div>

                    <div className="metric-card">
                        <div className="metric-label">Currently Assigned</div>
                        <div className="metric-value" style={{ color: '#F59E0B' }}>
                            {dashboardData.AssignedAssets || 0}
                        </div>
                    </div>

                    <div className="metric-card">
                        <div className="metric-label">Available</div>
                        <div className="metric-value" style={{ color: '#16A34A' }}>
                            {dashboardData.AvailableAssets || 0}
                        </div>
                    </div>
                </div>
            )}

            <div className="content-card">
                <div className="card-header">
                    <h2>Active Assignments</h2>
                </div>

                {activeAssignments.length === 0 ? (
                    <div className="empty-state">
                        <p>No active assignments</p>
                    </div>
                ) : (
                    <div className="table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Asset Name</th>
                                    <th>Type</th>
                                    <th>Serial Number</th>
                                    <th>Assigned To</th>
                                    <th>Date Assigned</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeAssignments.map((assignment) => (
                                    <tr key={assignment.AssignmentId}>
                                        <td className="td-primary">{assignment.AssetName}</td>
                                        <td>
                                            <span className="tag">{assignment.AssetType}</span>
                                        </td>
                                        <td className="td-secondary">{assignment.SerialNumber}</td>
                                        <td>{assignment.EmployeeName || assignment.FullName}</td>
                                        <td className="td-secondary">
                                            {new Date(assignment.AssignedAt).toLocaleDateString()}
                                        </td>
                                        <td>
                                            <button
                                                className="btn-danger"
                                                onClick={() => handleReturn(assignment.AssignmentId)}
                                            >
                                                Return
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );

    // Assign Asset Screen - FIXED
    const AssignAssetScreen = () => {
        const [selectedEmployee, setSelectedEmployee] = useState('');
        const [selectedAsset, setSelectedAsset] = useState('');
        const [localEmployees, setLocalEmployees] = useState([]);
        const [localAssets, setLocalAssets] = useState([]);
        const [isLoading, setIsLoading] = useState(true);
        const [isSubmitting, setIsSubmitting] = useState(false);

        useEffect(() => {
            const fetchData = async () => {
                setIsLoading(true);
                try {
                    const [empRes, assetRes] = await Promise.all([
                        fetch(`${API_BASE}/employees`),
                        fetch(`${API_BASE}/assets/available`)
                    ]);

                    if (!empRes.ok || !assetRes.ok) {
                        throw new Error('Failed to fetch data');
                    }

                    const empData = await empRes.json();
                    const assetData = await assetRes.json();

                    setLocalEmployees(empData);
                    setLocalAssets(assetData);
                } catch (err) {
                    console.error('Fetch error:', err);
                    showNotification('Failed to load data', 'error');
                } finally {
                    setIsLoading(false);
                }
            };
            fetchData();
        }, []);

        const handleSubmit = async (e) => {
            e.preventDefault();

            if (!selectedEmployee || !selectedAsset) {
                showNotification('Please select both employee and asset', 'error');
                return;
            }

            setIsSubmitting(true);

            try {
                const jsonData = {
                    assetId: parseInt(selectedAsset),
                    employeeId: parseInt(selectedEmployee)
                };

                const res = await fetch(`${API_BASE}/assignments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(jsonData)
                });

                const result = await res.json();

                if (result.success) {
                    showNotification('Asset assigned successfully!');
                    setTimeout(() => setCurrentScreen('dashboard'), 1500);
                } else {
                    showNotification(result.message || 'Failed to assign asset', 'error');
                }
            } catch (err) {
                console.error('Submit error:', err);
                showNotification('Network error', 'error');
            } finally {
                setIsSubmitting(false);
            }
        };

        if (isLoading) {
            return (
                <div>
                    <div className="page-header">
                        <h1>Assign Asset to Employee</h1>
                        <button className="btn-secondary" onClick={() => setCurrentScreen('dashboard')}>
                            Cancel
                        </button>
                    </div>
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <p className="loading-text">Loading data...</p>
                    </div>
                </div>
            );
        }

        return (
            <div>
                <div className="page-header">
                    <h1>Assign Asset to Employee</h1>
                    <button className="btn-secondary" onClick={() => setCurrentScreen('dashboard')}>
                        Cancel
                    </button>
                </div>

                <div className="form-layout">
                    <div className="content-card">
                        <form onSubmit={handleSubmit}>
                            <div className="form-section">
                                <label className="form-label">Select Employee *</label>
                                <select
                                    value={selectedEmployee}
                                    onChange={(e) => setSelectedEmployee(e.target.value)}
                                    className="form-select"
                                    required
                                    disabled={isSubmitting}
                                >
                                    <option value="">-- Choose an employee --</option>
                                    {localEmployees.map((emp) => (
                                        <option key={emp.EmployeeId} value={emp.EmployeeId}>
                                            {emp.FullName} ({emp.Email})
                                        </option>
                                    ))}
                                </select>
                                {localEmployees.length === 0 && (
                                    <p className="form-hint" style={{ color: '#DC2626' }}>No employees found in database</p>
                                )}
                            </div>

                            <div className="form-section">
                                <label className="form-label">Select Asset *</label>
                                <select
                                    value={selectedAsset}
                                    onChange={(e) => setSelectedAsset(e.target.value)}
                                    className="form-select"
                                    required
                                    disabled={isSubmitting}
                                >
                                    <option value="">-- Choose an asset --</option>
                                    {localAssets.map((asset) => (
                                        <option key={asset.AssetId} value={asset.AssetId}>
                                            {asset.AssetName} - {asset.AssetType} ({asset.SerialNumber})
                                        </option>
                                    ))}
                                </select>
                                <p className="form-hint">Only available assets are shown</p>
                                {localAssets.length === 0 && (
                                    <p className="form-hint" style={{ color: '#DC2626' }}>No available assets found</p>
                                )}
                            </div>

                            <div className="form-actions">
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !selectedEmployee || !selectedAsset}
                                    className="btn-primary btn-large"
                                >
                                    {isSubmitting ? 'Assigning...' : 'Assign Asset'}
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="info-box">
                        <h3>How it works behind the scenes:</h3>
                        <ol>
                            <li>You fill this form (easy!)</li>
                            <li>React sends JSON to backend</li>
                            <li>Backend calls stored procedure</li>
                            <li>Database validates and saves</li>
                            <li>You see success message</li>
                        </ol>
                    </div>
                </div>
            </div>
        );
    };

    // Asset History Screen
    const AssetHistoryScreen = () => {
        const [selectedAsset, setSelectedAsset] = useState('');
        const [allAssets, setAllAssets] = useState([]);
        const [isLoading, setIsLoading] = useState(false);

        useEffect(() => {
            const fetchAssets = async () => {
                try {
                    const res = await fetch(`${API_BASE}/assets`);
                    if (!res.ok) throw new Error('Failed to fetch assets');
                    const data = await res.json();
                    setAllAssets(data);
                } catch (err) {
                    console.error('Fetch assets error:', err);
                    showNotification('Failed to load assets', 'error');
                }
            };
            fetchAssets();
        }, []);

        const handleSelectAsset = async (e) => {
            const assetId = e.target.value;
            setSelectedAsset(assetId);

            if (!assetId) {
                setAssetHistory([]);
                return;
            }

            setIsLoading(true);
            try {
                const res = await fetch(`${API_BASE}/assets/${assetId}/history`);
                if (!res.ok) throw new Error('Failed to fetch history');
                const data = await res.json();
                setAssetHistory(data);
            } catch (err) {
                console.error('History error:', err);
                showNotification('Failed to load history', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        return (
            <div>
                <div className="page-header">
                    <h1>Assignment History</h1>
                    <button className="btn-secondary" onClick={() => setCurrentScreen('dashboard')}>
                        Back to Dashboard
                    </button>
                </div>

                <div className="content-card">
                    <div className="form-section">
                        <label className="form-label">Select Asset to View History</label>
                        <select
                            onChange={handleSelectAsset}
                            className="form-select"
                            value={selectedAsset}
                        >
                            <option value="">-- Choose an asset --</option>
                            {allAssets.map((asset) => (
                                <option key={asset.AssetId} value={asset.AssetId}>
                                    {asset.AssetName} - {asset.AssetType}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {isLoading && (
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <p className="loading-text">Loading history...</p>
                    </div>
                )}

                {!isLoading && assetHistory.length > 0 && (
                    <div className="content-card">
                        <div className="card-header">
                            <h2>Assignment Timeline</h2>
                        </div>

                        <div className="timeline">
                            {assetHistory.map((record) => (
                                <div key={record.AssignmentId} className="timeline-item">
                                    <div className="timeline-marker"></div>
                                    <div className="timeline-content">
                                        <div className="timeline-header">
                                            <span className="timeline-name">{record.FullName}</span>
                                            {!record.ReturnedAt && (
                                                <span className="status-active">Currently Assigned</span>
                                            )}
                                        </div>
                                        <div className="timeline-meta">
                                            <span>
                                                Assigned: {new Date(record.AssignedAt).toLocaleString()}
                                            </span>
                                            {record.ReturnedAt && (
                                                <span>
                                                    Returned: {new Date(record.ReturnedAt).toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {!isLoading && assetHistory.length === 0 && selectedAsset && (
                    <div className="content-card">
                        <div className="empty-state">
                            <p>No history found for this asset</p>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="app">
            {notification.show && (
                <div className={`notification ${notification.type}`}>
                    {notification.message}
                </div>
            )}

            {currentScreen === 'dashboard' && <DashboardScreen />}
            {currentScreen === 'assign' && <AssignAssetScreen />}
            {currentScreen === 'history' && <AssetHistoryScreen />}
        </div>
    );
}

