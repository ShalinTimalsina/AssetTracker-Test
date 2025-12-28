import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import './App.css';

const API_BASE = 'http://localhost:3000/api';
const CUSTOM_TYPES_KEY = 'asset-tracker-custom-types';

// Helper to get custom types config from localStorage
const getCustomTypesConfig = () => {
    try {
        const saved = localStorage.getItem(CUSTOM_TYPES_KEY);
        return saved ? JSON.parse(saved) : { added: [], removed: [], renamed: {} };
    } catch {
        return { added: [], removed: [], renamed: {} };
    }
};

// Helper to apply custom types config to a list
const applyCustomTypesConfig = (types, config) => {
    let result = types
        .map(t => config.renamed[t] || t)
        .filter(t => !config.removed.includes(t));
    result = [...new Set([...result, ...config.added])].sort();
    return result;
};

export default function AssetTrackingApp() {
    const [currentScreen, setCurrentScreen] = useState('dashboard');
    const [dashboardData, setDashboardData] = useState(null);
    const [allAssets, setAllAssets] = useState([]);
    const [activeAssignments, setActiveAssignments] = useState([]);
    const [assetHistory, setAssetHistory] = useState([]);
    const [notification, setNotification] = useState({ show: false, message: '', type: '' });
    const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null, confirmText: 'Confirm' });
    const [addAssetModal, setAddAssetModal] = useState(false);
    const [editAssetModal, setEditAssetModal] = useState(null); // null or asset object to edit
    const [manageTypesModal, setManageTypesModal] = useState(false);
    const [searchInput, setSearchInput] = useState(''); // What user types (instant)
    const [searchTerm, setSearchTerm] = useState(''); // Debounced value (for filtering)
    const [filterType, setFilterType] = useState('All');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'available'
    const [selectedHistoryAsset, setSelectedHistoryAsset] = useState(null);

    // Ref for search input to maintain focus
    const searchInputRef = useRef(null);
    const debounceRef = useRef(null);

    // Handle search input change with debounce
    const handleSearchChange = useCallback((e) => {
        const value = e.target.value;
        setSearchInput(value); // Update input immediately (no lag)

        // Debounce the actual filter
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
            setSearchTerm(value); // Update filter after 150ms
        }, 150);
    }, []);

    // Clear search
    const clearSearch = useCallback(() => {
        setSearchInput('');
        setSearchTerm('');
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        searchInputRef.current?.focus();
    }, []);

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    // Show notification
    const showNotification = (message, type = 'success') => {
        setNotification({ show: true, message, type });
        setTimeout(() => setNotification({ show: false, message: '', type: '' }), 4000);
    };

    // Fetch dashboard stats
    const fetchDashboard = async () => {
        try {
            const res = await fetch(`${API_BASE}/dashboard`);
            if (!res.ok) throw new Error('Failed to fetch dashboard');
            const data = await res.json();
            setDashboardData(data);
        } catch (err) {
            console.error('Dashboard error:', err);
        }
    };

    // Fetch all assets
    const fetchAllAssets = async () => {
        try {
            const res = await fetch(`${API_BASE}/assets`);
            if (!res.ok) throw new Error('Failed to fetch assets');
            const data = await res.json();
            setAllAssets(data);
        } catch (err) {
            console.error('Assets error:', err);
        }
    };

    // Fetch active assignments
    const fetchActiveAssignments = async () => {
        try {
            const res = await fetch(`${API_BASE}/assignments/active`);
            if (!res.ok) throw new Error('Failed to fetch assignments');
            const data = await res.json();
            setActiveAssignments(data);
        } catch (err) {
            console.error('Assignments error:', err);
        }
    };

    // Initial data load
    useEffect(() => {
        fetchDashboard();
        fetchAllAssets();
        fetchActiveAssignments();
    }, []);

    // Refresh all data with loading indicator
    const [isRefreshing, setIsRefreshing] = useState(false);

    const refreshData = async () => {
        setIsRefreshing(true);
        try {
            await Promise.all([
                fetchDashboard(),
                fetchAllAssets(),
                fetchActiveAssignments()
            ]);
            showNotification('Data refreshed successfully');
        } catch (err) {
            showNotification('Failed to refresh', 'error');
        } finally {
            setIsRefreshing(false);
        }
    };

    // Handle return asset
    const handleReturn = (assignmentId, assetName) => {
        setConfirmModal({
            show: true,
            title: 'Return Asset',
            message: `Are you sure you want to return "${assetName}"? This will mark the asset as available.`,
            confirmText: 'Yes, Return Asset',
            onConfirm: async () => {
                setConfirmModal({ ...confirmModal, show: false });
                try {
                    const res = await fetch(`${API_BASE}/assignments/${assignmentId}/return`, { method: 'POST' });
                    const data = await res.json();
                    if (data.success) {
                        showNotification('Asset returned successfully');
                        refreshData();
                    } else {
                        showNotification(data.message || 'Failed to return asset', 'error');
                    }
                } catch (err) {
                    showNotification('Network error', 'error');
                }
            }
        });
    };

    // Handle delete asset
    const handleDeleteAsset = (asset) => {
        const isAssigned = assignmentMap.has(asset.AssetId);

        if (isAssigned) {
            showNotification('Cannot delete asset while it is assigned. Return it first.', 'error');
            return;
        }

        setConfirmModal({
            show: true,
            title: 'Delete Asset',
            message: `Are you sure you want to delete "${asset.AssetName}"? This action cannot be undone and will also delete all assignment history for this asset.`,
            confirmText: 'Yes, Delete Asset',
            onConfirm: async () => {
                setConfirmModal({ ...confirmModal, show: false });
                try {
                    const res = await fetch(`${API_BASE}/assets/${asset.AssetId}`, { method: 'DELETE' });
                    const data = await res.json();
                    if (data.success) {
                        showNotification('Asset deleted successfully');
                        refreshData();
                    } else {
                        showNotification(data.message || 'Failed to delete asset', 'error');
                    }
                } catch (err) {
                    showNotification('Network error', 'error');
                }
            }
        });
    };

    // Get asset status
    const getAssetStatus = (assetId) => {
        const assignment = activeAssignments.find(a => a.AssetId === assetId);
        return assignment ? 'Active' : 'Available';
    };

    // Create a map of asset assignments for fast lookup
    const assignmentMap = useMemo(() => {
        const map = new Map();
        activeAssignments.forEach(a => {
            map.set(a.AssetId, a);
        });
        return map;
    }, [activeAssignments]);

    // Get assigned employee name (uses memoized map)
    const getAssignedEmployee = useCallback((assetId) => {
        const assignment = assignmentMap.get(assetId);
        return assignment ? (assignment.EmployeeName || assignment.FullName) : 'Unassigned';
    }, [assignmentMap]);

    // Get full employee details for an asset (uses memoized map)
    const getEmployeeDetails = useCallback((assetId) => {
        const assignment = assignmentMap.get(assetId);
        if (!assignment) return null;
        return {
            id: assignment.EmployeeId,
            name: assignment.EmployeeName || assignment.FullName,
            position: assignment.EmployeePosition || 'N/A',
            email: assignment.EmployeeEmail
        };
    }, [assignmentMap]);

    // Filter assets - search by name, serial, type, and assigned employee
    const filteredAssets = useMemo(() => {
        const search = searchTerm.toLowerCase().trim();

        return allAssets.filter(asset => {
            // Filter by status (from stat card click)
            const isAssigned = assignmentMap.has(asset.AssetId);
            if (statusFilter === 'active' && !isAssigned) return false;
            if (statusFilter === 'available' && isAssigned) return false;

            if (filterType !== 'All' && asset.AssetType !== filterType) {
                return false;
            }

            if (!search) return true;

            // Check asset fields
            if (asset.AssetName.toLowerCase().includes(search)) return true;
            if (asset.SerialNumber?.toLowerCase().includes(search)) return true;
            if (asset.AssetType.toLowerCase().includes(search)) return true;

            // Check assigned employee
            const assignment = assignmentMap.get(asset.AssetId);
            if (assignment) {
                const empName = (assignment.EmployeeName || assignment.FullName || '').toLowerCase();
                if (empName.includes(search)) return true;
            }

            return false;
        });
    }, [allAssets, searchTerm, filterType, statusFilter, assignmentMap]);

    // Get unique asset types for filter - memoized
    const assetTypes = useMemo(() =>
        ['All', ...new Set(allAssets.map(a => a.AssetType).filter(Boolean))],
        [allAssets]
    );

    // Get icon based on asset type - auto-generated icons
    const getAssetIcon = (assetType) => {
        const type = (assetType || '').toLowerCase();

        if (type.includes('laptop') || type.includes('macbook') || type.includes('notebook')) {
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="2" y1="20" x2="22" y2="20"></line>
                </svg>
            );
        }
        if (type.includes('phone') || type.includes('mobile') || type.includes('iphone') || type.includes('android')) {
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                    <line x1="12" y1="18" x2="12.01" y2="18"></line>
                </svg>
            );
        }
        if (type.includes('monitor') || type.includes('display') || type.includes('screen')) {
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
            );
        }
        if (type.includes('keyboard')) {
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
                    <line x1="6" y1="8" x2="6" y2="8"></line>
                    <line x1="10" y1="8" x2="10" y2="8"></line>
                    <line x1="14" y1="8" x2="14" y2="8"></line>
                    <line x1="18" y1="8" x2="18" y2="8"></line>
                    <line x1="6" y1="12" x2="18" y2="12"></line>
                    <line x1="6" y1="16" x2="18" y2="16"></line>
                </svg>
            );
        }
        if (type.includes('mouse')) {
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="6" y="2" width="12" height="20" rx="6" ry="6"></rect>
                    <line x1="12" y1="6" x2="12" y2="10"></line>
                </svg>
            );
        }
        if (type.includes('headset') || type.includes('headphone') || type.includes('earphone')) {
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                </svg>
            );
        }
        if (type.includes('tablet') || type.includes('ipad')) {
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
                    <line x1="12" y1="18" x2="12.01" y2="18"></line>
                </svg>
            );
        }
        // Default - generic device icon
        return (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
        );
    };

    // ==========================================
    // CONFIRM MODAL COMPONENT
    // ==========================================
    const ConfirmModal = () => {
        if (!confirmModal.show) return null;
        return (
            <div className="modal-overlay modal-confirm-overlay" onClick={() => setConfirmModal({ ...confirmModal, show: false })}>
                <div className="modal-container modal-confirm" onClick={e => e.stopPropagation()}>
                    <h2 className="modal-title">{confirmModal.title}</h2>
                    <p className="modal-message">{confirmModal.message}</p>
                    <div className="modal-actions">
                        <button className="btn-secondary" onClick={() => setConfirmModal({ ...confirmModal, show: false })}>
                            Cancel
                        </button>
                        <button className="btn-danger-solid" onClick={confirmModal.onConfirm}>
                            {confirmModal.confirmText}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ==========================================
    // ADD ASSET MODAL COMPONENT
    // ==========================================
    // Get serial prefix from asset type (first 2 letters uppercase)
    const getSerialPrefix = (type) => {
        if (!type) return 'XX';
        return type.replace(/[^a-zA-Z]/g, '').substring(0, 2).toUpperCase().padEnd(2, 'X');
    };

    const AddAssetModal = () => {
        const [formData, setFormData] = useState({ assetName: '', assetType: '' });
        const [isSubmitting, setIsSubmitting] = useState(false);
        const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
        const [typeSearch, setTypeSearch] = useState('');
        const typeInputRef = useRef(null);

        // Default types + types from database + custom types from localStorage
        const defaultTypes = ['Laptop', 'Mobile', 'Monitor', 'Keyboard', 'Mouse', 'Headset', 'Tablet', 'Camera', 'Printer', 'Other'];
        const dbTypes = allAssets.map(a => a.AssetType).filter(Boolean);
        const baseTypes = [...new Set([...defaultTypes, ...dbTypes])];
        const config = getCustomTypesConfig();
        const assetTypeOptions = applyCustomTypesConfig(baseTypes, config);

        // Filter options based on search
        const filteredTypeOptions = assetTypeOptions.filter(type =>
            type.toLowerCase().includes(typeSearch.toLowerCase())
        );

        // Handle type selection
        const selectType = (type) => {
            setFormData({ ...formData, assetType: type });
            setTypeSearch(type);
            setTypeDropdownOpen(false);
        };

        // Handle typing in the input
        const handleTypeInput = (e) => {
            const value = e.target.value;
            setTypeSearch(value);
            setFormData({ ...formData, assetType: value });
            setTypeDropdownOpen(true);
        };

        // Handle focus
        const handleTypeFocus = () => {
            setTypeDropdownOpen(true);
        };

        // Handle blur with delay to allow click
        const handleTypeBlur = () => {
            setTimeout(() => setTypeDropdownOpen(false), 200);
        };

        // Handle mouse down on dropdown item (prevents blur from firing first)
        const handleItemMouseDown = (e, type) => {
            e.preventDefault(); // Prevent input blur
            selectType(type);
        };

        const handleSubmit = async (e) => {
            e.preventDefault();
            if (!formData.assetName || !formData.assetType) {
                showNotification('Please fill all fields', 'error');
                return;
            }

            setIsSubmitting(true);
            try {
                const res = await fetch(`${API_BASE}/assets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        assetName: formData.assetName,
                        assetType: formData.assetType
                    })
                });
                const data = await res.json();

                if (data.success) {
                    showNotification(`Asset added! Serial: ${data.data.SerialNumber}`);
                    setAddAssetModal(false);
                    setFormData({ assetName: '', assetType: '' });
                    refreshData();
                } else {
                    showNotification(data.message || 'Failed to add asset', 'error');
                }
            } catch (err) {
                showNotification('Network error', 'error');
            } finally {
                setIsSubmitting(false);
            }
        };

        if (!addAssetModal) return null;

        const year = new Date().getFullYear();
        const previewPrefix = getSerialPrefix(formData.assetType);

        return (
            <div className="modal-overlay" onClick={() => setAddAssetModal(false)}>
                <div className="modal-container modal-form" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h2>Add New Asset</h2>
                        <button className="modal-close" onClick={() => setAddAssetModal(false)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Asset Name *</label>
                                <input
                                    type="text"
                                    placeholder="e.g., MacBook Pro 16&quot;"
                                    value={formData.assetName}
                                    onChange={e => setFormData({ ...formData, assetName: e.target.value })}
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="form-group">
                                <label>Asset Type *</label>
                                <div className="searchable-dropdown">
                                    <input
                                        ref={typeInputRef}
                                        type="text"
                                        placeholder="Search or type asset type..."
                                        value={typeSearch}
                                        onChange={handleTypeInput}
                                        onFocus={handleTypeFocus}
                                        onBlur={handleTypeBlur}
                                        disabled={isSubmitting}
                                        className="dropdown-input"
                                    />
                                    <svg className="dropdown-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                    {typeDropdownOpen && (
                                        <div className="dropdown-menu">
                                            {filteredTypeOptions.length > 0 ? (
                                                filteredTypeOptions.map(type => (
                                                    <div
                                                        key={type}
                                                        className={`dropdown-item ${formData.assetType === type ? 'selected' : ''}`}
                                                        onMouseDown={(e) => handleItemMouseDown(e, type)}
                                                    >
                                                        {type}
                                                    </div>
                                                ))
                                            ) : (
                                                <div
                                                    className="dropdown-item custom-type"
                                                    onMouseDown={(e) => handleItemMouseDown(e, typeSearch)}
                                                >
                                                    <span>Use custom type: </span>
                                                    <strong>{typeSearch}</strong>
                                                </div>
                                            )}
                                            {typeSearch && !assetTypeOptions.includes(typeSearch) && filteredTypeOptions.length > 0 && (
                                                <div
                                                    className="dropdown-item custom-type"
                                                    onMouseDown={(e) => handleItemMouseDown(e, typeSearch)}
                                                >
                                                    <span>+ Add as custom: </span>
                                                    <strong>{typeSearch}</strong>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <span className="form-hint">
                                    Select from list or type a custom type
                                </span>
                            </div>

                            {/* Serial Number Preview */}
                            <div className="serial-preview">
                                <div className="serial-preview-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="3" y1="9" x2="21" y2="9"></line>
                                        <line x1="9" y1="21" x2="9" y2="9"></line>
                                    </svg>
                                </div>
                                <div className="serial-preview-text">
                                    <span className="serial-preview-label">Serial Number (Auto-generated)</span>
                                    <span className="serial-preview-value">
                                        {formData.assetType
                                            ? `${previewPrefix}-${year}-XXX`
                                            : 'Enter asset type to preview'
                                        }
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn-secondary" onClick={() => setAddAssetModal(false)}>
                                Cancel
                            </button>
                            <button type="submit" className="btn-primary" disabled={isSubmitting || !formData.assetName || !formData.assetType}>
                                {isSubmitting ? 'Adding...' : 'Add Asset'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    // ==========================================
    // MANAGE TYPES MODAL
    // ==========================================
    const ManageTypesModal = () => {
        const [typesList, setTypesList] = useState([]);
        const [loading, setLoading] = useState(true);
        const [editingType, setEditingType] = useState(null);
        const [editValue, setEditValue] = useState('');
        const [newType, setNewType] = useState('');
        const [isSubmitting, setIsSubmitting] = useState(false);

        // Save custom types config to localStorage
        const saveCustomTypesConfig = (config) => {
            localStorage.setItem(CUSTOM_TYPES_KEY, JSON.stringify(config));
        };

        // Fetch types from API and apply local customizations
        const fetchTypes = async () => {
            try {
                const res = await fetch(`${API_BASE}/asset-types`);
                const apiTypes = await res.json();
                const config = getCustomTypesConfig();
                const finalTypes = applyCustomTypesConfig(apiTypes, config);
                setTypesList(finalTypes);
            } catch (err) {
                console.error('Failed to fetch types:', err);
            } finally {
                setLoading(false);
            }
        };

        useEffect(() => {
            if (manageTypesModal) {
                setLoading(true);
                fetchTypes();
            }
        }, [manageTypesModal]);

        // Get count of assets using each type
        const getTypeCount = (type) => {
            return allAssets.filter(a => a.AssetType === type).length;
        };

        // Handle rename
        const handleRename = async (oldType) => {
            if (!editValue.trim() || editValue.trim() === oldType) {
                setEditingType(null);
                setEditValue('');
                return;
            }

            const newTypeName = editValue.trim();

            // Check if new type already exists (case-insensitive)
            if (typesList.some(t => t.toLowerCase() === newTypeName.toLowerCase() && t !== oldType)) {
                showNotification(`Type "${newTypeName}" already exists`, 'error');
                setEditValue(oldType);
                return;
            }

            const assetCount = getTypeCount(oldType);

            // If type has assets, update via API
            if (assetCount > 0) {
                setIsSubmitting(true);
                try {
                    const res = await fetch(`${API_BASE}/asset-types/rename`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ oldType, newType: newTypeName })
                    });
                    const data = await res.json();

                    if (data.success) {
                        showNotification(data.message);
                        await fetchTypes();
                        refreshData();
                    } else {
                        showNotification(data.message, 'error');
                    }
                } catch (err) {
                    showNotification('Failed to rename type', 'error');
                } finally {
                    setIsSubmitting(false);
                    setEditingType(null);
                    setEditValue('');
                }
            } else {
                // If type has no assets, save rename to localStorage
                const config = getCustomTypesConfig();

                // Track the rename (handle chained renames)
                const originalName = Object.keys(config.renamed).find(k => config.renamed[k] === oldType) || oldType;
                if (config.added.includes(oldType)) {
                    // If it was a custom added type, update the added list
                    config.added = config.added.map(t => t === oldType ? newTypeName : t);
                } else {
                    // Track rename of default type
                    config.renamed[originalName] = newTypeName;
                }
                saveCustomTypesConfig(config);

                setTypesList(prev =>
                    prev.map(t => t === oldType ? newTypeName : t).sort()
                );
                showNotification(`Type "${oldType}" renamed to "${newTypeName}"`);
                setEditingType(null);
                setEditValue('');
            }
        };

        // Handle delete
        const handleDelete = (type) => {
            const count = getTypeCount(type);
            if (count > 0) {
                showNotification(`Cannot delete "${type}". ${count} asset(s) are using it.`, 'error');
                return;
            }

            setConfirmModal({
                show: true,
                title: 'Delete Type',
                message: `Are you sure you want to remove "${type}" from the list?`,
                confirmText: 'Delete',
                onConfirm: async () => {
                    setConfirmModal({ ...confirmModal, show: false });

                    // Save deletion to localStorage
                    const config = getCustomTypesConfig();

                    if (config.added.includes(type)) {
                        // If it was a custom added type, just remove from added list
                        config.added = config.added.filter(t => t !== type);
                    } else {
                        // If it's a default or renamed type, add to removed list
                        const originalName = Object.keys(config.renamed).find(k => config.renamed[k] === type);
                        if (originalName) {
                            // Remove the rename entry and add original to removed
                            delete config.renamed[originalName];
                            config.removed.push(originalName);
                        } else {
                            config.removed.push(type);
                        }
                    }
                    saveCustomTypesConfig(config);

                    setTypesList(prev => prev.filter(t => t !== type));
                    showNotification(`Type "${type}" removed`);
                }
            });
        };

        // Handle add new type
        const handleAddType = () => {
            if (!newType.trim()) return;

            const typeName = newType.trim();

            if (typesList.some(t => t.toLowerCase() === typeName.toLowerCase())) {
                showNotification(`Type "${typeName}" already exists`, 'error');
                return;
            }

            // Save to localStorage
            const config = getCustomTypesConfig();

            // Check if this was a previously removed default type
            if (config.removed.includes(typeName)) {
                config.removed = config.removed.filter(t => t !== typeName);
            } else {
                config.added.push(typeName);
            }
            saveCustomTypesConfig(config);

            setTypesList(prev => [...prev, typeName].sort());
            showNotification(`Type "${typeName}" added`);
            setNewType('');
        };

        if (!manageTypesModal) return null; const totalAssets = typesList.reduce((sum, type) => sum + getTypeCount(type), 0);

        return (
            <div className="modal-overlay" onClick={() => setManageTypesModal(false)}>
                <div className="modal-container modal-types" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <div className="modal-header-content">
                            <h2>Manage Asset Types</h2>
                            <p className="modal-subtitle">{typesList.length} types • {totalAssets} total assets</p>
                        </div>
                        <button className="modal-close" onClick={() => setManageTypesModal(false)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div className="modal-body">
                        {/* Add new type */}
                        <div className="add-type-section">
                            <div className="add-type-row">
                                <div className="input-with-icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 5v14M5 12h14"></path>
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Enter new asset type..."
                                        value={newType}
                                        onChange={e => setNewType(e.target.value)}
                                        onKeyPress={e => e.key === 'Enter' && handleAddType()}
                                    />
                                </div>
                                <button
                                    className="btn-primary btn-sm"
                                    onClick={handleAddType}
                                    disabled={!newType.trim()}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M12 5v14M5 12h14"></path>
                                    </svg>
                                    Add Type
                                </button>
                            </div>
                            <p className="add-type-hint">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                                    <path d="M6 8h.01M10 8h.01M14 8h.01"></path>
                                </svg>
                                Press Enter to add quickly
                            </p>
                        </div>

                        {/* Types list */}
                        <div className="types-list-header">
                            <span>#</span>
                            <span>Type Name</span>
                            <span>Assets</span>
                            <span>Actions</span>
                        </div>
                        <div className="types-list">
                            {loading ? (
                                <div className="types-loading">
                                    <div className="loading-spinner"></div>
                                    <span>Loading types...</span>
                                </div>
                            ) : typesList.length === 0 ? (
                                <div className="types-empty">
                                    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                                    </svg>
                                    <p>No asset types defined</p>
                                    <span>Add your first type above to get started</span>
                                </div>
                            ) : (
                                typesList.map((type, index) => (
                                    <div key={type} className={`type-row ${editingType === type ? 'editing' : ''}`}>
                                        <span className="type-index">{index + 1}</span>
                                        {editingType === type ? (
                                            <input
                                                type="text"
                                                value={editValue}
                                                onChange={e => setEditValue(e.target.value)}
                                                onBlur={() => handleRename(type)}
                                                onKeyPress={e => {
                                                    if (e.key === 'Enter') handleRename(type);
                                                    if (e.key === 'Escape') setEditingType(null);
                                                }}
                                                autoFocus
                                                disabled={isSubmitting}
                                                className="type-edit-input"
                                            />
                                        ) : (
                                            <span className="type-name" onDoubleClick={() => {
                                                setEditingType(type);
                                                setEditValue(type);
                                            }}>{type}</span>
                                        )}
                                        <span className={`type-count ${getTypeCount(type) === 0 ? 'zero' : ''}`}>
                                            {getTypeCount(type)}
                                        </span>
                                        <div className="type-actions">
                                            {editingType === type ? (
                                                <>
                                                    <button
                                                        className="btn-icon-sm btn-success"
                                                        onClick={() => handleRename(type)}
                                                        title="Save"
                                                        disabled={isSubmitting}
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                            <polyline points="20 6 9 17 4 12"></polyline>
                                                        </svg>
                                                    </button>
                                                    <button
                                                        className="btn-icon-sm"
                                                        onClick={() => setEditingType(null)}
                                                        title="Cancel"
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                                        </svg>
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        className="btn-icon-sm"
                                                        onClick={() => {
                                                            setEditingType(type);
                                                            setEditValue(type);
                                                        }}
                                                        title="Rename (or double-click)"
                                                        disabled={isSubmitting}
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                            <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                        </svg>
                                                    </button>
                                                    <button
                                                        className="btn-icon-sm btn-danger"
                                                        onClick={() => handleDelete(type)}
                                                        title={getTypeCount(type) > 0 ? `Cannot delete - ${getTypeCount(type)} asset(s) using this type` : 'Delete type'}
                                                        disabled={getTypeCount(type) > 0 || isSubmitting}
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <polyline points="3 6 5 6 21 6"></polyline>
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        </svg>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    <div className="modal-footer types-footer">
                        <p className="footer-hint">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M12 16v-4M12 8h.01"></path>
                            </svg>
                            Double-click a type name to rename
                        </p>
                        <button className="btn-secondary" onClick={() => setManageTypesModal(false)}>
                            Done
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ==========================================
    // EDIT ASSET MODAL
    // ==========================================
    const EditAssetModal = () => {
        const [formData, setFormData] = useState({
            assetName: editAssetModal?.AssetName || '',
            assetType: editAssetModal?.AssetType || ''
        });
        const [isSubmitting, setIsSubmitting] = useState(false);
        const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
        const [typeSearch, setTypeSearch] = useState(editAssetModal?.AssetType || '');

        // Reset form when modal opens with new asset
        useEffect(() => {
            if (editAssetModal) {
                setFormData({
                    assetName: editAssetModal.AssetName,
                    assetType: editAssetModal.AssetType
                });
                setTypeSearch(editAssetModal.AssetType);
            }
        }, [editAssetModal]);

        // Default types + types from database + custom types
        const defaultTypes = ['Laptop', 'Mobile', 'Monitor', 'Keyboard', 'Mouse', 'Headset', 'Tablet', 'Camera', 'Printer', 'Other'];
        const dbTypes = allAssets.map(a => a.AssetType).filter(Boolean);
        const baseTypes = [...new Set([...defaultTypes, ...dbTypes])];
        const config = getCustomTypesConfig();
        const assetTypeOptions = applyCustomTypesConfig(baseTypes, config);

        const filteredTypeOptions = assetTypeOptions.filter(type =>
            type.toLowerCase().includes(typeSearch.toLowerCase())
        );

        const selectType = (type) => {
            setFormData({ ...formData, assetType: type });
            setTypeSearch(type);
            setTypeDropdownOpen(false);
        };

        const handleTypeInput = (e) => {
            const value = e.target.value;
            setTypeSearch(value);
            setFormData({ ...formData, assetType: value });
            setTypeDropdownOpen(true);
        };

        // Handle mouse down on dropdown item (prevents blur from firing first)
        const handleItemMouseDown = (e, type) => {
            e.preventDefault();
            selectType(type);
        };

        const handleSubmit = async (e) => {
            e.preventDefault();
            if (!formData.assetName || !formData.assetType) {
                showNotification('Please fill all fields', 'error');
                return;
            }

            setIsSubmitting(true);
            try {
                const res = await fetch(`${API_BASE}/assets/${editAssetModal.AssetId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        assetName: formData.assetName,
                        assetType: formData.assetType
                    })
                });
                const data = await res.json();

                if (data.success) {
                    showNotification('Asset updated successfully');
                    setEditAssetModal(null);
                    refreshData();
                } else {
                    showNotification(data.message || 'Failed to update asset', 'error');
                }
            } catch (err) {
                showNotification('Network error', 'error');
            } finally {
                setIsSubmitting(false);
            }
        };

        if (!editAssetModal) return null;

        return (
            <div className="modal-overlay" onClick={() => setEditAssetModal(null)}>
                <div className="modal-container modal-form" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h2>Edit Asset</h2>
                        <button className="modal-close" onClick={() => setEditAssetModal(null)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Asset Name *</label>
                                <input
                                    type="text"
                                    placeholder="e.g., MacBook Pro 16&quot;"
                                    value={formData.assetName}
                                    onChange={e => setFormData({ ...formData, assetName: e.target.value })}
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="form-group">
                                <label>Asset Type *</label>
                                <div className="searchable-dropdown">
                                    <input
                                        type="text"
                                        placeholder="Search or type asset type..."
                                        value={typeSearch}
                                        onChange={handleTypeInput}
                                        onFocus={() => setTypeDropdownOpen(true)}
                                        onBlur={() => setTimeout(() => setTypeDropdownOpen(false), 200)}
                                        disabled={isSubmitting}
                                        className="dropdown-input"
                                    />
                                    <svg className="dropdown-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                    {typeDropdownOpen && (
                                        <div className="dropdown-menu">
                                            {filteredTypeOptions.map(type => (
                                                <div
                                                    key={type}
                                                    className={`dropdown-item ${formData.assetType === type ? 'selected' : ''}`}
                                                    onMouseDown={(e) => handleItemMouseDown(e, type)}
                                                >
                                                    {type}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Serial Number (read-only) */}
                            <div className="form-group">
                                <label>Serial Number</label>
                                <input
                                    type="text"
                                    value={editAssetModal.SerialNumber || 'N/A'}
                                    disabled
                                    className="input-disabled"
                                />
                                <span className="form-hint">Serial number cannot be changed</span>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn-secondary" onClick={() => setEditAssetModal(null)}>
                                Cancel
                            </button>
                            <button type="submit" className="btn-primary" disabled={isSubmitting || !formData.assetName || !formData.assetType}>
                                {isSubmitting ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    // ==========================================
    // DASHBOARD SCREEN (JSX, not a component)
    // ==========================================
    const DashboardScreen = (
        <div className="dashboard">
            {/* Header */}
            <div className="page-header-main">
                <div className="header-title-row">
                    <h1><strong>Asset Management and Tracking System</strong></h1>
                    <div className="header-actions">
                        <button className={`btn-secondary btn-icon ${isRefreshing ? 'btn-loading' : ''}`} onClick={refreshData} disabled={isRefreshing}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isRefreshing ? 'spin' : ''}>
                                <path d="M21 12a9 9 0 11-3-6.7"></path>
                                <path d="M21 3v6h-6"></path>
                            </svg>
                            {isRefreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                        <button className="btn-primary btn-icon" onClick={() => setAddAssetModal(true)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Add Asset
                        </button>
                        <button className="btn-secondary btn-icon" onClick={() => setManageTypesModal(true)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"></path>
                            </svg>
                            Manage Types
                        </button>
                    </div>
                </div>
                <p className="header-subtitle-main">Track and manage company assets for your staffing organization</p>
            </div>

            {/* Metrics */}
            <div className="metrics-grid">
                <div className="metric-card">
                    <div className="metric-icon blue">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                            <line x1="8" y1="21" x2="16" y2="21"></line>
                            <line x1="12" y1="17" x2="12" y2="21"></line>
                        </svg>
                    </div>
                    <div className="metric-content">
                        <div className="metric-label">Total Assets</div>
                        <div className="metric-value">{dashboardData?.TotalAssets || 0}</div>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-icon yellow">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                    </div>
                    <div className="metric-content">
                        <div className="metric-label">Active Assignments</div>
                        <div className="metric-value yellow">{dashboardData?.AssignedAssets || 0}</div>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-icon green">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                    </div>
                    <div className="metric-content">
                        <div className="metric-label">Available</div>
                        <div className="metric-value green">{dashboardData?.AvailableAssets || 0}</div>
                        <div className="metric-sub">Ready to assign</div>
                    </div>
                </div>
            </div>

            {/* Asset Inventory */}
            <div className="content-card">
                <div className="card-header-extended">
                    <div className="card-title-section">
                        <h2>Asset Inventory</h2>
                        <p>Manage all assets assigned to staff members</p>
                    </div>
                    <div className="card-actions">
                        <select
                            className="status-filter-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active Assignments</option>
                            <option value="available">Available</option>
                        </select>
                        <select
                            className="status-filter-select"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                        >
                            {assetTypes.map(type => (
                                <option key={type} value={type}>
                                    {type === 'All' ? 'All Types' : type}
                                </option>
                            ))}
                        </select>
                        <div className={`search-box ${searchInput ? 'has-value' : ''}`}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search assets..."
                                value={searchInput}
                                onChange={handleSearchChange}
                                autoComplete="off"
                            />
                            {searchInput && (
                                <button
                                    className="search-clear"
                                    onClick={clearSearch}
                                    title="Clear search"
                                    type="button"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            )}
                        </div>
                        <button className="btn-secondary btn-icon" onClick={() => {
                            setSelectedHistoryAsset(null);
                            setCurrentScreen('history');
                        }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            History
                        </button>
                        <button className="btn-secondary btn-icon" onClick={() => setCurrentScreen('assign')}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="8.5" cy="7" r="4"></circle>
                                <line x1="20" y1="8" x2="20" y2="14"></line>
                                <line x1="23" y1="11" x2="17" y2="11"></line>
                            </svg>
                            Assign Asset
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th className="col-number">#</th>
                                <th>ASSET</th>
                                <th>ASSIGNED TO</th>
                                <th>TYPE</th>
                                <th>SERIAL NUMBER</th>
                                <th>STATUS</th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAssets.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="empty-row">
                                        No assets found
                                    </td>
                                </tr>
                            ) : (
                                filteredAssets.map((asset, index) => {
                                    const status = getAssetStatus(asset.AssetId);
                                    const employeeDetails = getEmployeeDetails(asset.AssetId);
                                    const assignment = activeAssignments.find(a => a.AssetId === asset.AssetId);

                                    return (
                                        <tr key={asset.AssetId}>
                                            <td className="col-number">{index + 1}</td>
                                            <td>
                                                <div className="asset-cell">
                                                    <div className="asset-icon">
                                                        {getAssetIcon(asset.AssetType)}
                                                    </div>
                                                    <div className="asset-info">
                                                        <span className="asset-name">{asset.AssetName}</span>
                                                        <span className="asset-id">AST-{String(asset.AssetId).padStart(3, '0')}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                {employeeDetails ? (
                                                    <div className="employee-cell">
                                                        <span className="employee-name">{employeeDetails.name}</span>
                                                        <span className="employee-details">
                                                            ID: EMP-{String(employeeDetails.id).padStart(3, '0')} • {employeeDetails.position}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted">Unassigned</span>
                                                )}
                                            </td>
                                            <td>{asset.AssetType}</td>
                                            <td className="text-muted">{asset.SerialNumber || 'N/A'}</td>
                                            <td>
                                                <span className={`status-badge ${status.toLowerCase()}`}>
                                                    {status}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    {status === 'Active' && assignment && (
                                                        <button
                                                            className="btn-action"
                                                            onClick={() => handleReturn(assignment.AssignmentId, asset.AssetName)}
                                                            title="Return Asset"
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <polyline points="9 10 4 15 9 20"></polyline>
                                                                <path d="M20 4v7a4 4 0 0 1-4 4H4"></path>
                                                            </svg>
                                                        </button>
                                                    )}
                                                    <button
                                                        className="btn-action"
                                                        onClick={() => setEditAssetModal(asset)}
                                                        title="Edit Asset"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                            <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                        </svg>
                                                    </button>
                                                    <button
                                                        className="btn-action"
                                                        onClick={() => {
                                                            setSelectedHistoryAsset(asset);
                                                            setCurrentScreen('history');
                                                        }}
                                                        title="View History"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <circle cx="12" cy="12" r="10"></circle>
                                                            <polyline points="12 6 12 12 16 14"></polyline>
                                                        </svg>
                                                    </button>
                                                    <button
                                                        className={`btn-action btn-action-danger ${status === 'Active' ? 'disabled' : ''}`}
                                                        onClick={() => handleDeleteAsset(asset)}
                                                        title={status === 'Active' ? 'Return asset first to delete' : 'Delete Asset'}
                                                        disabled={status === 'Active'}
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <polyline points="3 6 5 6 21 6"></polyline>
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    // ==========================================
    // ASSIGN ASSET SCREEN
    // ==========================================
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
                    const empData = await empRes.json();
                    const assetData = await assetRes.json();
                    setLocalEmployees(empData);
                    setLocalAssets(assetData);
                } catch (err) {
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
                const res = await fetch(`${API_BASE}/assignments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        assetId: parseInt(selectedAsset),
                        employeeId: parseInt(selectedEmployee)
                    })
                });
                const result = await res.json();

                if (result.success) {
                    showNotification('Asset assigned successfully!');
                    setTimeout(() => {
                        refreshData();
                        setCurrentScreen('dashboard');
                    }, 1000);
                } else {
                    showNotification(result.message || 'Failed to assign asset', 'error');
                }
            } catch (err) {
                showNotification('Network error', 'error');
            } finally {
                setIsSubmitting(false);
            }
        };

        return (
            <div className="assign-page">
                <div className="assign-container">
                    <div className="assign-header">
                        <button className="btn-back" onClick={() => setCurrentScreen('dashboard')}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="19" y1="12" x2="5" y2="12"></line>
                                <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                        </button>
                        <div className="assign-title">
                            <h1>Assign Asset</h1>
                            <p>Assign an available asset to an employee</p>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="loading-container">
                            <div className="spinner"></div>
                            <p>Loading...</p>
                        </div>
                    ) : (
                        <div className="assign-card">
                            <div className="assign-icon">
                                <svg width="48\" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="8.5" cy="7" r="4"></circle>
                                    <line x1="20" y1="8" x2="20" y2="14"></line>
                                    <line x1="23" y1="11" x2="17" y2="11"></line>
                                </svg>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="assign-form-group">
                                    <label>Select Employee *</label>
                                    <select
                                        value={selectedEmployee}
                                        onChange={e => setSelectedEmployee(e.target.value)}
                                        disabled={isSubmitting}
                                        className={selectedEmployee ? 'has-value' : ''}
                                    >
                                        <option value="">Choose an employee...</option>
                                        {localEmployees.map(emp => (
                                            <option key={emp.EmployeeId} value={emp.EmployeeId}>
                                                {emp.FullName} ({emp.Email})
                                            </option>
                                        ))}
                                    </select>
                                    {localEmployees.length === 0 && (
                                        <span className="form-error">No employees found in database</span>
                                    )}
                                </div>

                                <div className="assign-form-group">
                                    <label>Select Asset *</label>
                                    <select
                                        value={selectedAsset}
                                        onChange={e => setSelectedAsset(e.target.value)}
                                        disabled={isSubmitting}
                                        className={selectedAsset ? 'has-value' : ''}
                                    >
                                        <option value="">Choose an available asset...</option>
                                        {localAssets.map(asset => (
                                            <option key={asset.AssetId} value={asset.AssetId}>
                                                {asset.AssetName} - {asset.AssetType} ({asset.SerialNumber})
                                            </option>
                                        ))}
                                    </select>
                                    {localAssets.length === 0 ? (
                                        <span className="form-error">No available assets</span>
                                    ) : (
                                        <span className="form-hint">{localAssets.length} asset(s) available for assignment</span>
                                    )}
                                </div>

                                <div className="assign-actions">
                                    <button type="button" className="btn-secondary btn-full" onClick={() => setCurrentScreen('dashboard')}>
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-primary btn-full"
                                        disabled={isSubmitting || !selectedEmployee || !selectedAsset}
                                    >
                                        {isSubmitting ? 'Assigning...' : 'Assign Asset'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // ==========================================
    // ASSET HISTORY SCREEN
    // ==========================================
    const AssetHistoryScreen = () => {
        const [selectedAsset, setSelectedAsset] = useState(
            selectedHistoryAsset ? String(selectedHistoryAsset.AssetId) : ''
        );
        const [isLoading, setIsLoading] = useState(false);
        const [localHistory, setLocalHistory] = useState([]);

        // Load history for specific asset on initial mount
        useEffect(() => {
            const loadInitialHistory = async () => {
                if (selectedHistoryAsset) {
                    setIsLoading(true);
                    try {
                        const res = await fetch(`${API_BASE}/assets/${selectedHistoryAsset.AssetId}/history`);
                        const data = await res.json();
                        setLocalHistory(data);
                    } catch (err) {
                        console.error('Failed to load history:', err);
                    } finally {
                        setIsLoading(false);
                    }
                }
            };
            loadInitialHistory();
        }, []); // Only run once on mount

        const handleSelectAsset = async (e) => {
            const assetId = e.target.value;
            setSelectedAsset(assetId);

            if (assetId) {
                setIsLoading(true);
                try {
                    const res = await fetch(`${API_BASE}/assets/${assetId}/history`);
                    const data = await res.json();
                    setLocalHistory(data);
                } catch (err) {
                    showNotification('Failed to load history', 'error');
                } finally {
                    setIsLoading(false);
                }
            } else {
                setLocalHistory([]);
            }
        };

        // Get current asset info for display
        const currentAsset = allAssets.find(a => String(a.AssetId) === selectedAsset);

        return (
            <div className="history-page">
                <div className="history-container">
                    {/* Header */}
                    <div className="history-header">
                        <button className="btn-back" onClick={() => {
                            setSelectedHistoryAsset(null);
                            setCurrentScreen('dashboard');
                        }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="19" y1="12" x2="5" y2="12"></line>
                                <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                        </button>
                        <div className="history-title">
                            <h1>{currentAsset ? currentAsset.AssetName : 'Assignment History'}</h1>
                            <p>{currentAsset
                                ? `${currentAsset.AssetType} • ${currentAsset.SerialNumber || 'No Serial'}`
                                : 'View the assignment timeline for any asset'
                            }</p>
                        </div>
                    </div>

                    {/* Asset Selector Card */}
                    <div className="history-card">
                        <div className="history-icon">
                            <svg width="32" height="32" viewBox="0 0 50 50" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                {/* Document */}
                                <path d="M8 6C8 4.34315 9.34315 3 11 3H28L38 13V42C38 43.6569 36.6569 45 35 45H11C9.34315 45 8 43.6569 8 42V6Z"></path>
                                <path d="M28 3V13H38"></path>
                                {/* Lines on document */}
                                <line x1="14" y1="22" x2="26" y2="22"></line>
                                <line x1="14" y1="28" x2="26" y2="28"></line>
                                <line x1="14" y1="34" x2="22" y2="34"></line>
                                {/* Clock circle */}
                                <circle cx="38" cy="32" r="10" fill="white"></circle>
                                <circle cx="38" cy="32" r="10"></circle>
                                {/* Clock hands */}
                                <polyline points="38 27 38 32 42 34"></polyline>
                            </svg>
                        </div>
                        <div className="history-form-group">
                            <label>{currentAsset ? 'Change Asset' : 'Select Asset'}</label>
                            <select
                                onChange={handleSelectAsset}
                                value={selectedAsset}
                                className={selectedAsset ? 'has-value' : ''}
                            >
                                <option value="">Choose an asset to view history...</option>
                                {allAssets.map(asset => (
                                    <option key={asset.AssetId} value={asset.AssetId}>
                                        {asset.AssetName} - {asset.AssetType} ({asset.SerialNumber || 'N/A'})
                                    </option>
                                ))}
                            </select>
                            <span className="form-hint">
                                {currentAsset
                                    ? 'Select a different asset or go back to dashboard'
                                    : 'Select an asset to see its complete assignment history'
                                }
                            </span>
                        </div>
                    </div>

                    {/* Loading State */}
                    {isLoading && (
                        <div className="history-card">
                            <div className="loading-container">
                                <div className="spinner"></div>
                                <p>Loading history...</p>
                            </div>
                        </div>
                    )}

                    {/* Timeline Card */}
                    {!isLoading && localHistory.length > 0 && (
                        <div className="history-card timeline-card">
                            <h2 className="timeline-title">Assignment Timeline</h2>
                            <div className="timeline">
                                {localHistory.map((record, index) => (
                                    <div key={record.AssignmentId} className={`timeline-item ${index === 0 ? 'first' : ''}`}>
                                        <div className="timeline-marker"></div>
                                        <div className="timeline-content">
                                            <div className="timeline-header">
                                                <span className="timeline-name">{record.FullName}</span>
                                                {!record.ReturnedAt && (
                                                    <span className="status-badge active">Currently Assigned</span>
                                                )}
                                            </div>
                                            <div className="timeline-meta">
                                                <div className="timeline-date">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                                    </svg>
                                                    <span>Assigned: {new Date(record.AssignedAt).toLocaleString()}</span>
                                                </div>
                                                {record.ReturnedAt && (
                                                    <div className="timeline-date returned">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <polyline points="9 10 4 15 9 20"></polyline>
                                                            <path d="M20 4v7a4 4 0 0 1-4 4H4"></path>
                                                        </svg>
                                                        <span>Returned: {new Date(record.ReturnedAt).toLocaleString()}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {!isLoading && localHistory.length === 0 && selectedAsset && (
                        <div className="history-card">
                            <div className="empty-state">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                </svg>
                                <p>No assignment history found for this asset</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // ==========================================
    // MAIN RENDER
    // ==========================================
    return (
        <div className="app">
            {/* Notification */}
            {notification.show && (
                <div className={`notification ${notification.type}`}>
                    <span>{notification.message}</span>
                </div>
            )}

            {/* Modals */}
            <AddAssetModal />
            <EditAssetModal />
            <ManageTypesModal />
            <ConfirmModal />

            {/* Screens */}
            {currentScreen === 'dashboard' && DashboardScreen}
            {currentScreen === 'assign' && <AssignAssetScreen />}
            {currentScreen === 'history' && <AssetHistoryScreen />}
        </div>
    );
}
