import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { titleToSlug, getSubProjectUrl } from '../../utils/slug';
import {
  Container,
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Chip,
  CircularProgress,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Collapse
} from '@mui/material';
import { ArrowBack, Download, ViewModule as ViewModuleIcon, Settings as SettingsIcon, Search as SearchIcon, Work as WorkIcon, ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon, Close as CloseIcon, Info as InfoIcon } from '@mui/icons-material';
import JobManagementDialog from '../Jobs/JobManagementDialog';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const SECTIONS = [
  { id: 'active', label: 'Active', color: 'blue' },
  { id: 'complete', label: 'Complete', color: 'green' },
  { id: 'non_clearance', label: 'Non-Clearance', color: 'red' },
  { id: 'no_job', label: 'No Job', color: 'purple' }
];

export default function SubProjectDetail() {
  const router = useRouter();
  const { projectId, subProjectId } = router.query;

  const [subProject, setSubProject] = useState(null);
  const [project, setProject] = useState(null);
  const [activeSection, setActiveSection] = useState('active');
  const [groupBy, setGroupBy] = useState(''); // Start empty, set to 'level' after fields load
  const [subGroupBy, setSubGroupBy] = useState('');
  const [groupedData, setGroupedData] = useState(null);
  const [availableFields, setAvailableFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Client-side cache for grouped data by section
  const [cachedGroupedData, setCachedGroupedData] = useState({});
  
  // Track which groups are expanded for lazy loading
  const [expandedGroups, setExpandedGroups] = useState({});
  const [groupElementsLoading, setGroupElementsLoading] = useState({});
  
  // Pagination state - per group
  const [groupPages, setGroupPages] = useState({});
  const [groupRowsPerPage, setGroupRowsPerPage] = useState({});
  
  // Get pagination for specific group
  const getGroupPage = (groupIndex) => groupPages[groupIndex] || 0;
  const getGroupRowsPerPage = (groupIndex) => groupRowsPerPage[groupIndex] || 10;
  
  // Pagination handlers for groups
  const handleGroupPageChange = (groupIndex, newPage) => {
    setGroupPages(prev => ({ ...prev, [groupIndex]: newPage }));
  };
  
  const handleGroupRowsPerPageChange = (groupIndex, event) => {
    setGroupRowsPerPage(prev => ({ ...prev, [groupIndex]: parseInt(event.target.value, 10) }));
    setGroupPages(prev => ({ ...prev, [groupIndex]: 0 }));
  };
  
  // Column visibility state - All columns enabled by default
  const [visibleColumns, setVisibleColumns] = useState({
    serialNo: true,
    level: true,
    gridNo: true,
    partMarkNo: true,
    lengthMm: true,
    surfaceAreaSqm: true,
    qty: true,
    fireProofingWorkflow: true,
    currentJob: true,
    // Hidden by default
    fireproofingThickness: true,
    structureNumber: false,
    drawingNo: false,
    memberType: false,
    sectionSizes: false,
    status: false,
    sectionDepthMm: false,
    flangeWidthMm: false,
    webThicknessMm: false,
    flangeThicknessMm: false,
    jobProgress: false
  });
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  
  // Expanded rows state for showing more details
  const [expandedRows, setExpandedRows] = useState({});
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedElementDetails, setSelectedElementDetails] = useState(null);
  
  const toggleRowExpanded = (elementId) => {
    setExpandedRows(prev => ({
      ...prev,
      [elementId]: !prev[elementId]
    }));
  };
  
  const openDetailsDialog = (element) => {
    setSelectedElementDetails(element);
    setDetailsDialogOpen(true);
  };
  
  const closeDetailsDialog = () => {
    setDetailsDialogOpen(false);
    setSelectedElementDetails(null);
  };
  
  // Job management dialog state
  const [selectedElement, setSelectedElement] = useState(null);
  const [showJobDialog, setShowJobDialog] = useState(false);
  
  // Define available columns
  const availableColumns = [
    { key: 'serialNo', label: 'Serial No' },
    { key: 'structureNumber', label: 'Structure No' },
    { key: 'drawingNo', label: 'Drawing No' },
    { key: 'level', label: 'Level' },
    { key: 'memberType', label: 'Member Type' },
    { key: 'gridNo', label: 'Grid No' },
    { key: 'partMarkNo', label: 'Part Mark No' },
    { key: 'sectionSizes', label: 'Section' },
    { key: 'lengthMm', label: 'Length (mm)' },
    { key: 'qty', label: 'Qty' },
    { key: 'surfaceAreaSqm', label: 'SQM' },
    { key: 'fireproofingThickness', label: 'FP Thickness' },
    { key: 'sectionDepthMm', label: 'Depth (mm)' },
    { key: 'flangeWidthMm', label: 'Flange Width (mm)' },
    { key: 'webThicknessMm', label: 'Web Thickness (mm)' },
    { key: 'flangeThicknessMm', label: 'Flange Thickness (mm)' },
    { key: 'status', label: 'Status' },
    { key: 'fireProofingWorkflow', label: 'FP Workflow' },
    { key: 'currentJob', label: 'Current Job' },
    { key: 'jobProgress', label: 'Job Progress' }
  ];

  useEffect(() => {
    if (projectId && subProjectId) {
      fetchData();
      fetchAvailableFields();
    }
  }, [projectId, subProjectId]);

  useEffect(() => {
    console.log('🔍 [SubProjectDetail] useEffect triggered:', { groupBy, subProjectId: subProject?._id, activeSection });
    if (groupBy && subProject?._id) {
      console.log('✅ [SubProjectDetail] Calling fetchGroupedData');
      fetchGroupedData();
    } else {
      console.log('❌ [SubProjectDetail] NOT calling fetchGroupedData - groupBy:', groupBy, 'subProject._id:', subProject?._id);
    }
  }, [groupBy, subGroupBy, activeSection, subProject]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Check if projectId looks like a MongoDB ObjectId
      const isProjectMongoId = /^[0-9a-fA-F]{24}$/.test(projectId);
      const isSubProjectMongoId = /^[0-9a-fA-F]{24}$/.test(subProjectId);
      
      const projectEndpoint = isProjectMongoId 
        ? `${API_URL}/projects/${projectId}`
        : `${API_URL}/projects/by-name/${encodeURIComponent(projectId)}`;
      
      // First fetch the project to get its ID for the subproject query
      const projectRes = await axios.get(projectEndpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setProject(projectRes.data);
      
      // Now fetch subproject - use by-name endpoint if it's not a Mongo ID
      let subProjectRes;
      if (isSubProjectMongoId) {
        subProjectRes = await axios.get(`${API_URL}/subprojects/${subProjectId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        // Use the by-name endpoint with project ID
        subProjectRes = await axios.get(
          `${API_URL}/subprojects/by-name/${projectRes.data._id}/${encodeURIComponent(subProjectId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      
      setSubProject(subProjectRes.data);
      
      console.log('✅ [fetchData] SubProject loaded:', subProjectRes.data._id);
      
      // Trigger fetch if groupBy is already set
      if (groupBy) {
        console.log('📊 [fetchData] groupBy already set, will trigger fetchGroupedData via useEffect');
      }
      
      // Update URL to use slugs if we got ID-based URLs
      const needsProjectSlug = isProjectMongoId && projectRes.data.title;
      const needsSubProjectSlug = isSubProjectMongoId && (subProjectRes.data.code || subProjectRes.data.name);
      
      if (needsProjectSlug || needsSubProjectSlug) {
        const url = getSubProjectUrl(projectRes.data, subProjectRes.data);
        router.replace(url, undefined, { shallow: true });
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableFields = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/grouping/available-fields`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const fields = res.data.fields || [];
      setAvailableFields(fields);
      
      console.log('✅ [fetchAvailableFields] Loaded', fields.length, 'fields');
      
      // Set default groupBy to 'currentJob' after fields are loaded
      if (fields.length > 0 && !groupBy) {
        console.log('📊 [fetchAvailableFields] Setting groupBy to currentJob');
        setGroupBy('currentJob');
      }
    } catch (err) {
      console.error('Error fetching fields:', err);
    }
  };

  const fetchGroupedData = async (forceRefresh = false, includeElements = false) => {
    try {
      // Create cache key based on current parameters
      const cacheKey = `${activeSection}-${groupBy}-${subGroupBy || 'none'}-${includeElements ? 'full' : 'metrics'}`;
      
      // Check if we have cached data for this section (unless forcing refresh)
      if (!forceRefresh && cachedGroupedData[cacheKey]) {
        console.log('✅ [fetchGroupedData] Using cached data for:', cacheKey);
        setGroupedData(cachedGroupedData[cacheKey]);
        return;
      }
      
      setLoadingGroups(true);
      const token = localStorage.getItem('token');
      
      console.log('📊 [fetchGroupedData] Fetching from server:', {
        subProjectId: subProject._id,
        status: activeSection,
        groupBy,
        subGroupBy: subGroupBy || undefined,
        includeElements
      });
      
      const res = await axios.post(
        `${API_URL}/grouping/elements`,
        {
          subProjectId: subProject._id,
          status: activeSection,
          groupBy,
          subGroupBy: subGroupBy || undefined,
          page: 1,
          limit: 10000, // Fetch all groups
          includeElements: includeElements // Only fetch elements if requested
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      console.log('📊 [fetchGroupedData] Response received');
      setGroupedData(res.data);
      
      // Cache the data
      setCachedGroupedData(prev => ({
        ...prev,
        [cacheKey]: res.data
      }));
    } catch (err) {
      console.error('❌ [fetchGroupedData] Error fetching grouped data:', err);
      console.error('Error response:', err.response?.data);
      alert('Failed to load grouped data');
    } finally {
      setLoadingGroups(false);
    }
  };

  // Fetch elements for a specific group when expanded
  const fetchGroupElements = async (groupIndex) => {
    // Toggle collapse/expand
    if (expandedGroups[groupIndex]) {
      // Collapse the group
      setExpandedGroups(prev => ({ ...prev, [groupIndex]: false }));
      return;
    }
    
    // Check if group has full elements loaded
    const group = groupedData.groups[groupIndex];
    const hasFullElements = group.elements && group.elements.length >= group.count;
    
    // If group already has ALL elements (count matches), just expand
    if (hasFullElements) {
      console.log('✅ [fetchGroupElements] Group already has all elements, just expanding');
      setExpandedGroups(prev => ({ ...prev, [groupIndex]: true }));
      return;
    }
    
    // Otherwise, fetch all elements for this group
    if (groupElementsLoading[groupIndex]) {
      return; // Already loading
    }
    
    try {
      setExpandedGroups(prev => ({ ...prev, [groupIndex]: true }));
      setGroupElementsLoading(prev => ({ ...prev, [groupIndex]: true }));
      
      const token = localStorage.getItem('token');
      
      // Fetch ALL groups WITH full elements, then extract just this group's elements
      console.log('📊 [fetchGroupElements] Fetching ALL elements for group:', groupIndex, 'Expected count:', group.count);
      
      const res = await axios.post(
        `${API_URL}/grouping/elements`,
        {
          subProjectId: subProject._id,
          status: activeSection,
          groupBy,
          subGroupBy: subGroupBy || undefined,
          page: 1,
          limit: 10000,
          includeElements: true // Force full element fetch
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      console.log('📊 [fetchGroupElements] Response received, updating group', groupIndex);
      
      // Update the specific group with full elements from the response
      if (res.data.groups && res.data.groups[groupIndex]) {
        const fetchedElements = res.data.groups[groupIndex].elements;
        console.log('✅ [fetchGroupElements] Fetched', fetchedElements?.length, 'elements for group (expected:', group.count, ')');
        
        setGroupedData(prev => {
          const newData = { ...prev };
          newData.groups[groupIndex] = {
            ...newData.groups[groupIndex],
            elements: fetchedElements
          };
          return newData;
        });
        
        // Also update cache with full elements
        const cacheKey = `${activeSection}-${groupBy}-${subGroupBy || 'none'}-full`;
        setCachedGroupedData(prev => ({
          ...prev,
          [cacheKey]: res.data
        }));
      }
    } catch (err) {
      console.error('❌ [fetchGroupElements] Error:', err);
      alert('Failed to load group elements');
    } finally {
      setGroupElementsLoading(prev => ({ ...prev, [groupIndex]: false }));
    }
  };

  const downloadReport = async (status = null) => {
    try {
      const token = localStorage.getItem('token');
      const subProjectIdToUse = subProject?._id || subProjectId;
      const url = `${API_URL}/reports/excel/subproject/${subProjectIdToUse}${status ? `?status=${status}` : ''}`;
      window.open(url + `&token=${token}`, '_blank');
    } catch (err) {
      console.error('Error downloading report:', err);
      alert('Failed to download report');
    }
  };
  
  // Column visibility handlers
  const toggleColumnVisibility = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }));
  };
  
  const getVisibleColumns = () => {
    return availableColumns.filter(col => visibleColumns[col.key]);
  };
  
  // Filter elements based on search query
  const filterElements = (elements) => {
    if (!searchQuery.trim()) return elements;
    
    const query = searchQuery.toLowerCase();
    return elements.filter(element => {
      return (
        element.serialNo?.toString().toLowerCase().includes(query) ||
        element.structureNumber?.toString().toLowerCase().includes(query) ||
        element.drawingNo?.toString().toLowerCase().includes(query) ||
        element.memberType?.toLowerCase().includes(query) ||
        element.level?.toLowerCase().includes(query) ||
        element.gridNo?.toLowerCase().includes(query) ||
        element.partMarkNo?.toLowerCase().includes(query) ||
        element.sectionSizes?.toLowerCase().includes(query) ||
        element.fireProofingWorkflow?.toLowerCase().includes(query) ||
        element.status?.toLowerCase().includes(query) ||
        element.qty?.toString().includes(query) ||
        element.lengthMm?.toString().includes(query) ||
        element.surfaceAreaSqm?.toString().includes(query)
      );
    });
  };
  
  // Handle row click to open job management
  const handleRowClick = (element) => {
    // Enrich element with project information if not already present
    const enrichedElement = {
      ...element,
      project: element.project || project?._id || project
    };
    setSelectedElement(enrichedElement);
    setShowJobDialog(true);
  };
  
  const handleJobsUpdated = async () => {
    // Clear client-side cache since data has changed
    setCachedGroupedData({});
    
    // Wait a moment for backend to finish updating element status and cache invalidation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Force refresh of current section data
    const promises = [fetchGroupedData(true)]; // Pass true to force refresh
    
    if (subProject?._id) {
      const token = localStorage.getItem('token');
      const subProjectPromise = axios.get(`${API_URL}/subprojects/${subProject._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        setSubProject(res.data);
        console.log('✅ SubProject statistics refreshed');
      })
      .catch(err => {
        console.error('Error refreshing subproject:', err);
      });
      
      promises.push(subProjectPromise);
    }
    
    // Wait for all refreshes to complete
    await Promise.all(promises);
  };
  
  // Get status color helper
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'complete':
        return { bg: 'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)', border: '#28a745', text: '#155724' };
      case 'active':
        return { bg: 'linear-gradient(135deg, #cce5ff 0%, #b8daff 100%)', border: '#007bff', text: '#004085' };
      case 'non_clearance':
        return { bg: 'linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%)', border: '#dc3545', text: '#721c24' };
      case 'no_job':
        return { bg: 'linear-gradient(135deg, #e2d6f3 0%, #d4c4e8 100%)', border: '#9c27b0', text: '#4a148c' };
      default:
        return { bg: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)', border: '#6c757d', text: '#495057' };
    }
  };

  // Get workflow color helper
  const getWorkflowColor = (workflow) => {
    switch (workflow?.toLowerCase()) {
      case 'cement_fire_proofing':
        return { bg: '#fff3cd', text: '#856404' };
      case 'intumescent_coating':
        return { bg: '#d1ecf1', text: '#0c5460' };
      case 'board_system':
        return { bg: '#f8d7da', text: '#721c24' };
      default:
        return { bg: '#e7f3ff', text: '#004085' };
    }
  };
  
  // Get cell value helper
  const getCellValue = (element, columnKey) => {
    switch (columnKey) {
      case 'serialNo':
        return element.serialNo;
      case 'structureNumber':
        return element.structureNumber;
      case 'drawingNo':
        return element.drawingNo;
      case 'level':
        return element.level;
      case 'memberType':
        return element.memberType;
      case 'gridNo':
        return element.gridNo;
      case 'partMarkNo':
        return element.partMarkNo;
      case 'sectionSizes':
        return element.sectionSizes;
      case 'lengthMm':
        return element.lengthMm;
      case 'qty':
        return element.qty;
      case 'surfaceAreaSqm':
        return element.surfaceAreaSqm?.toFixed(2);
      case 'fireproofingThickness':
        return element.fireproofingThickness;
      case 'sectionDepthMm':
        return element.sectionDepthMm;
      case 'flangeWidthMm':
        return element.flangeWidthMm;
      case 'webThicknessMm':
        return element.webThicknessMm;
      case 'flangeThicknessMm':
        return element.flangeThicknessMm;
      case 'status':
        return element.status;
      case 'fireProofingWorkflow':
        return element.fireProofingWorkflow || '-';
      case 'currentJob':
        const jobTitle = element.currentJob?.jobTitle || '-';
        return (
          <Box
            component="span"
            sx={{
              color: '#ff6600',
              fontWeight: 'bold',
              animation: 'pulse 2s ease-in-out infinite',
              '@keyframes pulse': {
                '0%, 100%': { 
                  opacity: 1,
                  transform: 'scale(1)'
                },
                '50%': { 
                  opacity: 0.7,
                  transform: 'scale(1.05)'
                }
              }
            }}
          >
            {jobTitle}
          </Box>
        );
      case 'jobProgress':
        return element.currentJob?.status || '-';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!subProject) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Paper sx={{ p: 4, bgcolor: '#fee', color: '#c00' }}>
          <Typography variant="h6">SubProject not found</Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Box 
      sx={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        py: 3
      }}
    >
      <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2, md: 3 } }}>
        {/* Header */}
        <Paper 
          elevation={3} 
          sx={{ 
            p: { xs: 3, sm: 4, md: 5 }, 
            mb: 3, 
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(106, 17, 203, 0.3)'
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 3 }}>
            <Box>
              <Typography variant="h3" component="h1" fontWeight="bold" sx={{ color: '#6a11cb', mb: 1 }}>
                {subProject.name}
              </Typography>
              <Typography variant="body2" sx={{ color: '#666', mb: 1 }}>
                Code: <Box component="span" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{subProject.code}</Box>
              </Typography>
              {subProject.description && (
                <Typography variant="body1" sx={{ color: '#666' }}>
                  {subProject.description}
                </Typography>
              )}
            </Box>
            <Button
              startIcon={<ArrowBack />}
              variant="outlined"
              onClick={() => {
                if (project) {
                  const slug = titleToSlug(project.title);
                  router.push(`/projects/${slug}`);
                }
              }}
              sx={{ borderColor: '#6a11cb', color: '#6a11cb' }}
            >
              Back to Project
            </Button>
          </Box>

          {/* Statistics */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} md={3}>
              <Box sx={{ 
                background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                p: 3,
                borderRadius: 2,
                border: '1px solid #90caf9'
              }}>
                <Typography variant="h4" fontWeight="bold" sx={{ color: '#1565c0', mb: 0.5 }}>
                  {subProject.statistics?.totalElements || 0}
                </Typography>
                <Typography variant="body2" fontWeight="medium" sx={{ color: '#1976d2' }}>
                  Total Elements
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ 
                background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
                p: 3,
                borderRadius: 2,
                border: '1px solid #81c784'
              }}>
                <Typography variant="h4" fontWeight="bold" sx={{ color: '#2e7d32', mb: 0.5 }}>
                  {subProject.statistics?.completedElements || 0}
                </Typography>
                <Typography variant="body2" fontWeight="medium" sx={{ color: '#388e3c' }}>
                  Completed Elements
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ 
                background: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)',
                p: 3,
                borderRadius: 2,
                border: '1px solid #ce93d8'
              }}>
                <Typography variant="h4" fontWeight="bold" sx={{ color: '#6a1b9a', mb: 0.5 }}>
                  {subProject.statistics?.totalSqm?.toFixed(2) || 0}
                </Typography>
                <Typography variant="body2" fontWeight="medium" sx={{ color: '#7b1fa2' }}>
                  Total SQM
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ 
                background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
                p: 3,
                borderRadius: 2,
                border: '1px solid #ffb74d'
              }}>
                <Typography variant="h4" fontWeight="bold" sx={{ color: '#e65100', mb: 0.5 }}>
                  {subProject.statistics?.completedSqm?.toFixed(2) || 0}
                </Typography>
                <Typography variant="body2" fontWeight="medium" sx={{ color: '#ef6c00' }}>
                  Completed SQM
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {/* Export Buttons */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={() => downloadReport()}
              sx={{ 
                bgcolor: '#4caf50', 
                '&:hover': { bgcolor: '#45a049' },
                textTransform: 'none',
                fontWeight: 600
              }}
            >
              Export All
            </Button>
            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={() => downloadReport(activeSection)}
              sx={{ 
                bgcolor: '#2196f3', 
                '&:hover': { bgcolor: '#1976d2' },
                textTransform: 'none',
                fontWeight: 600
              }}
            >
              Export {SECTIONS.find(s => s.id === activeSection)?.label}
            </Button>
          </Box>
        </Paper>

        {/* Section Metrics - Card Style */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {SECTIONS.map((section) => {
            const count = subProject.statistics?.sections?.[section.id === 'non_clearance' ? 'nonClearance' : section.id === 'no_job' ? 'noJob' : section.id]?.count || 0;
            const sqm = subProject.statistics?.sections?.[section.id === 'non_clearance' ? 'nonClearance' : section.id === 'no_job' ? 'noJob' : section.id]?.sqm || 0;
            
            // Get color scheme based on section
            const getColorScheme = (color) => {
              switch (color) {
                case 'blue': 
                  return { 
                    primary: '#2196f3', 
                    light: '#e3f2fd', 
                    lighter: '#bbdefb',
                    dark: '#1976d2',
                    gradient: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)'
                  };
                case 'red': 
                  return { 
                    primary: '#f44336', 
                    light: '#ffebee', 
                    lighter: '#ffcdd2',
                    dark: '#d32f2f',
                    gradient: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)'
                  };
                case 'purple': 
                  return { 
                    primary: '#9c27b0', 
                    light: '#f3e5f5', 
                    lighter: '#e1bee7',
                    dark: '#7b1fa2',
                    gradient: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)'
                  };
                case 'green': 
                  return { 
                    primary: '#4caf50', 
                    light: '#e8f5e9', 
                    lighter: '#c8e6c9',
                    dark: '#388e3c',
                    gradient: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)'
                  };
                default: 
                  return { 
                    primary: '#757575', 
                    light: '#fafafa', 
                    lighter: '#e0e0e0',
                    dark: '#616161',
                    gradient: 'linear-gradient(135deg, #757575 0%, #616161 100%)'
                  };
              }
            };
            
            const colors = getColorScheme(section.color);
            const isActive = activeSection === section.id;
            
            return (
              <Grid item xs={12} sm={6} md={3} key={section.id}>
                <Paper
                  elevation={isActive ? 8 : 2}
                  onClick={() => {
                    // Clear cache for fresh data when switching sections
                    setCachedGroupedData({});
                    setActiveSection(section.id);
                  }}
                  sx={{
                    p: 3,
                    cursor: 'pointer',
                    borderRadius: 3,
                    position: 'relative',
                    overflow: 'hidden',
                    background: isActive 
                      ? `linear-gradient(135deg, ${colors.light} 0%, ${colors.lighter} 100%)`
                      : 'white',
                    border: isActive ? `3px solid ${colors.primary}` : '1px solid #e0e0e0',
                    transform: isActive ? 'scale(1.05)' : 'scale(1)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'scale(1.05)',
                      boxShadow: `0 8px 24px ${colors.primary}40`,
                      borderColor: colors.primary
                    },
                    '&::before': isActive ? {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '6px',
                      background: colors.gradient,
                      animation: 'shimmer 2s ease-in-out infinite',
                      '@keyframes shimmer': {
                        '0%, 100%': { opacity: 1 },
                        '50%': { opacity: 0.6 }
                      }
                    } : {}
                  }}
                >
                  {/* Section Label */}
                  <Typography 
                    variant="h6" 
                    fontWeight="bold" 
                    sx={{ 
                      color: isActive ? colors.dark : colors.primary,
                      mb: 2,
                      fontSize: '1.1rem',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase'
                    }}
                  >
                    {section.label}
                  </Typography>
                  
                  {/* Count Metric */}
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.5 }}>
                    <Typography 
                      variant="h3" 
                      fontWeight="900"
                      sx={{ 
                        color: colors.primary,
                        lineHeight: 1,
                        fontSize: '2.5rem',
                        textShadow: isActive ? `0 2px 8px ${colors.primary}40` : 'none'
                      }}
                    >
                      {count}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: '#666',
                        fontWeight: 600
                      }}
                    >
                      Elements
                    </Typography>
                  </Box>
                  
                  {/* SQM Metric */}
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1,
                      p: 1.5,
                      background: isActive ? `${colors.primary}15` : `${colors.light}`,
                      borderRadius: 2,
                      border: `1px solid ${colors.lighter}`
                    }}
                  >
                    <Box 
                      sx={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: '50%',
                        bgcolor: colors.primary,
                        boxShadow: `0 0 10px ${colors.primary}60`
                      }} 
                    />
                    <Typography 
                      variant="h6" 
                      fontWeight="bold"
                      sx={{ 
                        color: colors.dark,
                        fontSize: '1.2rem'
                      }}
                    >
                      {sqm.toFixed(1)}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: '#666',
                        fontWeight: 600
                      }}
                    >
                      SQM
                    </Typography>
                  </Box>
                  
                  {/* Active Indicator */}
                  {isActive && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: colors.primary,
                        boxShadow: `0 0 0 4px ${colors.primary}30`,
                        animation: 'pulse 2s ease-in-out infinite',
                        '@keyframes pulse': {
                          '0%, 100%': { 
                            transform: 'scale(1)',
                            opacity: 1
                          },
                          '50%': { 
                            transform: 'scale(1.2)',
                            opacity: 0.8
                          }
                        }
                      }}
                    />
                  )}
                </Paper>
              </Grid>
            );
          })}
        </Grid>

        {/* Grouping Controls */}
        <Paper 
          elevation={3} 
          sx={{ 
            p: { xs: 3, sm: 4 }, 
            mb: 3, 
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(106, 17, 203, 0.3)'
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" fontWeight="bold" sx={{ color: '#333' }}>
              Group & Analyze
            </Typography>
            <Tooltip title="Customize visible columns">
              <IconButton 
                onClick={() => setShowColumnSettings(true)}
                sx={{ 
                  bgcolor: 'primary.main', 
                  color: 'white',
                  '&:hover': { bgcolor: 'primary.dark' }
                }}
              >
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Box>
          
          {/* Search Field */}
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search elements by any field (Serial No, Structure No, Drawing No, Level, Member Type, Grid No, Part Mark, Section Size, Status, Qty, Length, SQM, etc.)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 3 }}
          />
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Group By</InputLabel>
                <Select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  label="Group By"
                >
                  <MenuItem value="">-- Select Field --</MenuItem>
                  {availableFields.map((field) => (
                    <MenuItem key={field.value} value={field.value}>
                      {field.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth disabled={!groupBy}>
                <InputLabel>Sub-Group By (Optional)</InputLabel>
                <Select
                  value={subGroupBy}
                  onChange={(e) => setSubGroupBy(e.target.value)}
                  label="Sub-Group By (Optional)"
                >
                  <MenuItem value="">-- No Sub-Grouping --</MenuItem>
                  {availableFields
                    .filter((field) => field.value !== groupBy)
                    .map((field) => (
                      <MenuItem key={field.value} value={field.value}>
                        {field.label}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {groupBy && (
            <Button
              variant="contained"
              onClick={() => fetchGroupedData(false, false)}
              disabled={loadingGroups}
              sx={{ 
                mt: 3,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': { 
                  background: 'linear-gradient(135deg, #5568d3 0%, #63408b 100%)'
                },
                textTransform: 'none',
                fontWeight: 600,
                px: 4
              }}
            >
              {loadingGroups ? 'Loading...' : 'Apply Grouping'}
            </Button>
          )}
        </Paper>

        {/* Grouped Results */}
        {groupedData && (
          <Paper 
            elevation={3} 
            sx={{ 
              p: { xs: 3, sm: 4 }, 
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(106, 17, 203, 0.3)'
            }}
          >
            <Typography variant="h5" fontWeight="bold" sx={{ mb: 3, color: '#333' }}>
              Grouped Results ({groupedData.groups?.length || 0} groups)
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {groupedData.groups?.map((group, index) => (
              <Accordion 
                key={index}
                expanded={expandedGroups[index] || false}
                onChange={() => fetchGroupElements(index)}
                sx={{ 
                  border: '1px solid #e0e0e0', 
                  borderRadius: '12px !important',
                  overflow: 'hidden',
                  '&:before': { display: 'none' },
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ 
                    py: 1.5,
                    px: 2,
                    minHeight: '56px !important',
                    background: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)',
                    '&:hover': { background: 'linear-gradient(135deg, #f5f5f5 0%, #eeeeee 100%)' },
                    '& .MuiAccordionSummary-content': {
                      margin: '8px 0 !important'
                    }
                  }}
                >
                {/* Compact Group Header with Inline Metrics */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 2, 
                  mb: 0,
                  pb: 0,
                  borderBottom: 'none',
                  flexWrap: 'wrap'
                }}>
                  {/* Group Title */}
                  <Typography variant="h6" fontWeight="700" sx={{ color: '#333', flex: '1 1 auto', minWidth: '200px' }}>
                    {group._id[groupBy] || '(Not Set)'}
                    {subGroupBy && group._id[subGroupBy] && (
                      <Box component="span" sx={{ color: '#667eea', ml: 1, fontWeight: 600, fontSize: '0.9em' }}>
                        → {group._id[subGroupBy]}
                      </Box>
                    )}
                  </Typography>
                  
                  {/* Inline Compact Metrics */}
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Elements Count */}
                    <Box sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 2,
                      py: 1,
                      background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                      borderRadius: 2,
                      border: '1px solid #90caf9'
                    }}>
                      <Box sx={{ 
                        width: 32, 
                        height: 32, 
                        borderRadius: 1,
                        background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem'
                      }}>
                        📊
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', display: 'block', lineHeight: 1 }}>
                          Elements
                        </Typography>
                        <Typography variant="h6" fontWeight="900" sx={{ color: '#1565c0', lineHeight: 1, mt: 0.3 }}>
                          {group.count}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Total SQM */}
                    <Box sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 2,
                      py: 1,
                      background: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)',
                      borderRadius: 2,
                      border: '1px solid #ce93d8'
                    }}>
                      <Box sx={{ 
                        width: 32, 
                        height: 32, 
                        borderRadius: 1,
                        background: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem'
                      }}>
                        📐
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#7b1fa2', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', display: 'block', lineHeight: 1 }}>
                          Total SQM
                        </Typography>
                        <Typography variant="h6" fontWeight="900" sx={{ color: '#6a1b9a', lineHeight: 1, mt: 0.3 }}>
                          {group.totalSqm?.toFixed(1)}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Total Qty (if applicable) */}
                    {group.totalQty > 0 && (
                      <Box sx={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 2,
                        py: 1,
                        background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
                        borderRadius: 2,
                        border: '1px solid #ffb74d'
                      }}>
                        <Box sx={{ 
                          width: 32, 
                          height: 32, 
                          borderRadius: 1,
                          background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1rem'
                        }}>
                          🔢
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#f57c00', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', display: 'block', lineHeight: 1 }}>
                            Total Qty
                          </Typography>
                          <Typography variant="h6" fontWeight="900" sx={{ color: '#e65100', lineHeight: 1, mt: 0.3 }}>
                            {group.totalQty}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Box>
                </Box>
                </AccordionSummary>

                {/* All Elements - Lazy Loaded */}
                <AccordionDetails sx={{ pt: 0, px: 3, pb: 3 }}>
                {groupElementsLoading[index] ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : group.elements && group.elements.length > 0 && (() => {
                  const filteredElements = filterElements(group.elements);
                  return (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body1" fontWeight="600" sx={{ color: '#333', mb: 2, fontSize: '1rem' }}>
                      All Elements ({filteredElements.length} {searchQuery ? 'matching' : 'total'}):
                    </Typography>
                    
                    {/* Compact List Layout */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
                      {filteredElements
                        .slice(
                          getGroupPage(index) * getGroupRowsPerPage(index), 
                          getGroupPage(index) * getGroupRowsPerPage(index) + getGroupRowsPerPage(index)
                        )
                        .map((element) => {
                          const statusColors = getStatusColor(element.status);
                          const workflowColors = getWorkflowColor(element.fireProofingWorkflow);
                          
                          return (
                            <Paper
                              key={element._id}
                              sx={{
                                p: 2,
                                background: 'linear-gradient(to right, rgba(255,255,255,0.95) 0%, rgba(255,255,255,1) 100%)',
                                borderLeft: `5px solid ${statusColors.border}`,
                                borderRadius: 2,
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  transform: 'translateX(4px)',
                                  boxShadow: `0 4px 12px ${statusColors.border}30`,
                                  background: `linear-gradient(to right, ${statusColors.bg.replace('linear-gradient(135deg, ', '').replace(' 100%)', '')} 0%, rgba(255,255,255,1) 100%)`
                                }
                              }}
                            >
                              {/* Main Row - Horizontal Layout */}
                              <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 2,
                                flexWrap: 'wrap'
                              }}>
                                {/* Serial No Badge */}
                                <Chip 
                                  label={`#${element.serialNo}`} 
                                  size="small"
                                  sx={{ 
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    bgcolor: statusColors.border,
                                    color: 'white',
                                    minWidth: '60px'
                                  }}
                                />
                                
                                {/* Level */}
                                <Box sx={{ minWidth: '90px' }}>
                                  <Typography variant="caption" sx={{ color: '#888', fontSize: '0.7rem', display: 'block' }}>
                                    Level
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: '600', fontSize: '0.9rem' }}>
                                    {element.level}
                                  </Typography>
                                </Box>
                                
                                {/* Grid No */}
                                <Box sx={{ minWidth: '100px' }}>
                                  <Typography variant="caption" sx={{ color: '#888', fontSize: '0.7rem', display: 'block' }}>
                                    Grid
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: '600', fontSize: '0.9rem' }}>
                                    {element.gridNo}
                                  </Typography>
                                </Box>
                                
                                {/* Part Mark No */}
                                <Box sx={{ minWidth: '110px' }}>
                                  <Typography variant="caption" sx={{ color: '#888', fontSize: '0.7rem', display: 'block' }}>
                                    Part Mark
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: '600', fontSize: '0.9rem' }}>
                                    {element.partMarkNo || '-'}
                                  </Typography>
                                </Box>
                                
                                {/* Length (mm) */}
                                <Box sx={{ minWidth: '100px' }}>
                                  <Typography variant="caption" sx={{ color: '#888', fontSize: '0.7rem', display: 'block' }}>
                                    Length (mm)
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: '600', fontSize: '0.9rem' }}>
                                    {element.lengthMm || '-'}
                                  </Typography>
                                </Box>
                                
                                {/* SQM */}
                                <Box sx={{ minWidth: '80px' }}>
                                  <Typography variant="caption" sx={{ color: '#888', fontSize: '0.7rem', display: 'block' }}>
                                    SQM
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#2196f3' }}>
                                    {element.surfaceAreaSqm?.toFixed(2)}
                                  </Typography>
                                </Box>
                                
                                {/* Qty */}
                                <Box sx={{ minWidth: '90px' }}>
                                  <Typography variant="caption" sx={{ color: '#888', fontSize: '0.7rem', display: 'block' }}>
                                    Qty
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: '600', fontSize: '0.9rem' }}>
                                    {element.qty || '-'}
                                  </Typography>
                                </Box>
                                
                                {/* FP Thickness */}
                                {visibleColumns.fireproofingThickness && element.fireproofingThickness && (
                                  <Box sx={{ minWidth: '110px' }}>
                                    <Typography variant="caption" sx={{ color: '#888', fontSize: '0.7rem', display: 'block' }}>
                                      FP Thickness
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#ff9800' }}>
                                      {element.fireproofingThickness} mm
                                    </Typography>
                                  </Box>
                                )}
                                
                                {/* FP Workflow */}
                                <Box sx={{ minWidth: '120px' }}>
                                  <Typography variant="caption" sx={{ color: '#888', fontSize: '0.7rem', display: 'block' }}>
                                    FP Workflow
                                  </Typography>
                                  <Chip 
                                    label={element.fireProofingWorkflow?.replace(/_/g, ' ') || '-'}
                                    size="small"
                                    sx={{
                                      mt: 0.5,
                                      fontSize: '0.75rem',
                                      height: '22px',
                                      bgcolor: getWorkflowColor(element.fireProofingWorkflow).bg,
                                      color: getWorkflowColor(element.fireProofingWorkflow).text,
                                      textTransform: 'capitalize',
                                      fontWeight: '600'
                                    }}
                                  />
                                </Box>
                                
                                {/* Current Job - Highlighted Inline */}
                                {element.currentJob && (
                                  <Box sx={{ 
                                    flex: '1 1 200px',
                                    minWidth: '200px',
                                    p: 1.5,
                                    background: 'linear-gradient(90deg, rgba(255,102,0,0.12) 0%, rgba(255,152,0,0.15) 50%, rgba(255,102,0,0.12) 100%)',
                                    backgroundSize: '200% 100%',
                                    borderRadius: 2,
                                    border: '2px solid rgba(255, 102, 0, 0.3)',
                                    animation: 'shimmer 3s ease-in-out infinite',
                                    '@keyframes shimmer': {
                                      '0%': { 
                                        backgroundPosition: '200% 0',
                                        boxShadow: '0 0 10px rgba(255, 102, 0, 0.2)'
                                      },
                                      '50%': { 
                                        backgroundPosition: '0% 0',
                                        boxShadow: '0 0 20px rgba(255, 102, 0, 0.4)'
                                      },
                                      '100%': { 
                                        backgroundPosition: '-200% 0',
                                        boxShadow: '0 0 10px rgba(255, 102, 0, 0.2)'
                                      }
                                    }
                                  }}>
                                    <Typography variant="caption" sx={{ 
                                      color: '#d84315', 
                                      fontSize: '0.7rem', 
                                      display: 'block', 
                                      mb: 0.5,
                                      fontWeight: 'bold',
                                      letterSpacing: '0.5px'
                                    }}>
                                      ⚡ CURRENT JOB
                                    </Typography>
                                    <Typography
                                      sx={{
                                        color: '#ff6600',
                                        fontWeight: 'bold',
                                        fontSize: '1rem',
                                        textShadow: '0 1px 2px rgba(255, 102, 0, 0.3)'
                                      }}
                                    >
                                      {element.currentJob.jobTitle}
                                    </Typography>
                                    <Chip 
                                      label={element.currentJob.status}
                                      size="small"
                                      sx={{
                                        mt: 0.5,
                                        fontSize: '0.7rem',
                                        height: '18px',
                                        bgcolor: element.currentJob.status === 'complete' ? '#28a745' : '#ffc107',
                                        color: 'white',
                                        textTransform: 'capitalize',
                                        fontWeight: 'bold'
                                      }}
                                    />
                                  </Box>
                                )}
                                
                                {/* Status Chip */}
                                <Chip 
                                  label={element.status} 
                                  size="small"
                                  sx={{ 
                                    fontWeight: '600',
                                    fontSize: '0.8rem',
                                    background: statusColors.bg,
                                    color: statusColors.text,
                                    border: `2px solid ${statusColors.border}`,
                                    textTransform: 'capitalize',
                                    minWidth: '80px'
                                  }}
                                />
                                
                                {/* More Details Button */}
                                <Button
                                  size="small"
                                  startIcon={<InfoIcon />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDetailsDialog(element);
                                  }}
                                  sx={{
                                    minWidth: '120px',
                                    color: '#667eea',
                                    fontWeight: '600',
                                    fontSize: '0.8rem',
                                    textTransform: 'none',
                                    border: '1px solid rgba(102, 126, 234, 0.3)',
                                    '&:hover': {
                                      bgcolor: 'rgba(102, 126, 234, 0.08)',
                                      borderColor: '#667eea'
                                    }
                                  }}
                                >
                                  More Details
                                </Button>
                                
                                {/* Job Management Button */}
                                <Button
                                  variant="contained"
                                  size="small"
                                  startIcon={<WorkIcon />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRowClick(element);
                                  }}
                                  sx={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    fontSize: '0.85rem',
                                    textTransform: 'none',
                                    px: 2,
                                    '&:hover': {
                                      background: 'linear-gradient(135deg, #5568d3 0%, #63408b 100%)',
                                      transform: 'scale(1.05)',
                                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                                    },
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  Manage Jobs
                                </Button>
                              </Box>
                            </Paper>
                          );
                        })}
                    </Box>
                    
                    {/* Pagination */}
                    <TablePagination
                      component="div"
                      count={filteredElements.length}
                      page={getGroupPage(index)}
                      onPageChange={(event, newPage) => handleGroupPageChange(index, newPage)}
                      rowsPerPage={getGroupRowsPerPage(index)}
                      onRowsPerPageChange={(event) => handleGroupRowsPerPageChange(index, event)}
                      rowsPerPageOptions={[5, 10, 25, 50, 100]}
                      sx={{ borderTop: '1px solid #e0e0e0', mt: 2 }}
                    />
                  </Box>
                  );
                })()}
                </AccordionDetails>
              </Accordion>
            ))}
            </Box>
          </Paper>
        )}
      </Container>
      
      {/* Column Settings Dialog */}
      <Dialog 
        open={showColumnSettings} 
        onClose={() => setShowColumnSettings(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ViewModuleIcon />
            <Typography variant="h6">Customize Columns</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Select which columns to show in the table.
          </Typography>
          
          <Grid container spacing={2}>
            {availableColumns.map(column => (
              <Grid item xs={12} sm={6} key={column.key}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={visibleColumns[column.key]}
                      onChange={() => toggleColumnVisibility(column.key)}
                      color="primary"
                    />
                  }
                  label={
                    <Typography variant="body2" fontWeight={visibleColumns[column.key] ? 600 : 400}>
                      {column.label}
                    </Typography>
                  }
                  sx={{ 
                    width: '100%',
                    m: 0,
                    p: 1,
                    borderRadius: 1,
                    '&:hover': {
                      backgroundColor: 'grey.50'
                    }
                  }}
                />
              </Grid>
            ))}
          </Grid>

          <Box sx={{ mt: 3, p: 2, backgroundColor: '#e3f2fd', borderRadius: 1 }}>
            <Typography variant="body2" color="primary" fontWeight="500">
              💡 Tip: Customize columns to show only the data you need.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              // Reset to default columns
              setVisibleColumns({
                serialNo: true,
                structureNumber: true,
                drawingNo: true,
                level: true,
                memberType: true,
                gridNo: true,
                sectionSizes: true,
                surfaceAreaSqm: true,
                qty: true
              });
            }}
          >
            Reset to Default
          </Button>
          <Button
            onClick={() => setShowColumnSettings(false)}
            variant="contained"
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Element Details Dialog */}
      <Dialog 
        open={detailsDialogOpen} 
        onClose={closeDetailsDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InfoIcon sx={{ color: '#667eea' }} />
              <Typography variant="h6">Element Details</Typography>
            </Box>
            <IconButton onClick={closeDetailsDialog} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedElementDetails && (
            <Grid container spacing={2}>
              {/* Serial Number */}
              <Grid item xs={12} sm={6}>
                <Box sx={{ 
                  p: 2, 
                  bgcolor: '#f5f5f5', 
                  borderRadius: 2,
                  border: '1px solid #e0e0e0'
                }}>
                  <Typography variant="caption" sx={{ color: '#888', fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                    Serial Number
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: '600', fontSize: '1rem' }}>
                    #{selectedElementDetails.serialNo}
                  </Typography>
                </Box>
              </Grid>

              {/* Member Type */}
              <Grid item xs={12} sm={6}>
                <Box sx={{ 
                  p: 2, 
                  bgcolor: '#f5f5f5', 
                  borderRadius: 2,
                  border: '1px solid #e0e0e0'
                }}>
                  <Typography variant="caption" sx={{ color: '#888', fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                    Member Type
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: '600', fontSize: '1rem' }}>
                    {selectedElementDetails.memberType}
                  </Typography>
                </Box>
              </Grid>

              {/* Section Sizes */}
              <Grid item xs={12} sm={6}>
                <Box sx={{ 
                  p: 2, 
                  bgcolor: '#f5f5f5', 
                  borderRadius: 2,
                  border: '1px solid #e0e0e0'
                }}>
                  <Typography variant="caption" sx={{ color: '#888', fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                    Section Sizes
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: '600', fontSize: '1rem' }}>
                    {selectedElementDetails.sectionSizes || '-'}
                  </Typography>
                </Box>
              </Grid>

              {/* Level */}
              <Grid item xs={12} sm={6}>
                <Box sx={{ 
                  p: 2, 
                  bgcolor: '#f5f5f5', 
                  borderRadius: 2,
                  border: '1px solid #e0e0e0'
                }}>
                  <Typography variant="caption" sx={{ color: '#888', fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                    Level
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: '600', fontSize: '1rem' }}>
                    {selectedElementDetails.level}
                  </Typography>
                </Box>
              </Grid>

              {/* Grid Number */}
              {visibleColumns.gridNo && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: '#f5f5f5', 
                    borderRadius: 2,
                    border: '1px solid #e0e0e0'
                  }}>
                    <Typography variant="caption" sx={{ color: '#888', fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                      Grid Number
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: '600', fontSize: '1rem' }}>
                      {selectedElementDetails.gridNo}
                    </Typography>
                  </Box>
                </Grid>
              )}

              {/* Structure Number */}
              {visibleColumns.structureNumber && selectedElementDetails.structureNumber && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: '#f5f5f5', 
                    borderRadius: 2,
                    border: '1px solid #e0e0e0'
                  }}>
                    <Typography variant="caption" sx={{ color: '#888', fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                      Structure Number
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: '600', fontSize: '1rem' }}>
                      {selectedElementDetails.structureNumber}
                    </Typography>
                  </Box>
                </Grid>
              )}

              {/* Drawing Number */}
              {visibleColumns.drawingNo && selectedElementDetails.drawingNo && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: '#f5f5f5', 
                    borderRadius: 2,
                    border: '1px solid #e0e0e0'
                  }}>
                    <Typography variant="caption" sx={{ color: '#888', fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                      Drawing Number
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: '600', fontSize: '1rem' }}>
                      {selectedElementDetails.drawingNo}
                    </Typography>
                  </Box>
                </Grid>
              )}

              {/* Part Mark Number */}
              {visibleColumns.partMarkNo && selectedElementDetails.partMarkNo && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: '#f5f5f5', 
                    borderRadius: 2,
                    border: '1px solid #e0e0e0'
                  }}>
                    <Typography variant="caption" sx={{ color: '#888', fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                      Part Mark Number
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: '600', fontSize: '1rem' }}>
                      {selectedElementDetails.partMarkNo}
                    </Typography>
                  </Box>
                </Grid>
              )}

              {/* Quantity */}
              {visibleColumns.qty && selectedElementDetails.qty && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: '#f5f5f5', 
                    borderRadius: 2,
                    border: '1px solid #e0e0e0'
                  }}>
                    <Typography variant="caption" sx={{ color: '#888', fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                      Quantity
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: '600', fontSize: '1rem' }}>
                      {selectedElementDetails.qty}
                    </Typography>
                  </Box>
                </Grid>
              )}

              {/* Surface Area SQM */}
              <Grid item xs={12} sm={6}>
                <Box sx={{ 
                  p: 2, 
                  bgcolor: '#e3f2fd', 
                  borderRadius: 2,
                  border: '2px solid #2196f3'
                }}>
                  <Typography variant="caption" sx={{ color: '#1976d2', fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                    Surface Area (SQM)
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1565c0' }}>
                    {selectedElementDetails.surfaceAreaSqm?.toFixed(2)}
                  </Typography>
                </Box>
              </Grid>

              {/* Length */}
              {visibleColumns.lengthMm && selectedElementDetails.lengthMm && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: '#f5f5f5', 
                    borderRadius: 2,
                    border: '1px solid #e0e0e0'
                  }}>
                    <Typography variant="caption" sx={{ color: '#888', fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                      Length (mm)
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: '600', fontSize: '1rem' }}>
                      {selectedElementDetails.lengthMm}
                    </Typography>
                  </Box>
                </Grid>
              )}

              {/* Fireproofing Thickness */}
              {visibleColumns.fireproofingThickness && selectedElementDetails.fireproofingThickness && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: '#f5f5f5', 
                    borderRadius: 2,
                    border: '1px solid #e0e0e0'
                  }}>
                    <Typography variant="caption" sx={{ color: '#888', fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                      Fireproofing Thickness
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: '600', fontSize: '1rem' }}>
                      {selectedElementDetails.fireproofingThickness}
                    </Typography>
                  </Box>
                </Grid>
              )}

              {/* Section Depth */}
              {visibleColumns.sectionDepthMm && selectedElementDetails.sectionDepthMm && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: '#f5f5f5', 
                    borderRadius: 2,
                    border: '1px solid #e0e0e0'
                  }}>
                    <Typography variant="caption" sx={{ color: '#888', fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                      Section Depth (mm)
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: '600', fontSize: '1rem' }}>
                      {selectedElementDetails.sectionDepthMm}
                    </Typography>
                  </Box>
                </Grid>
              )}

              {/* Flange Width */}
              {visibleColumns.flangeWidthMm && selectedElementDetails.flangeWidthMm && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: '#f5f5f5', 
                    borderRadius: 2,
                    border: '1px solid #e0e0e0'
                  }}>
                    <Typography variant="caption" sx={{ color: '#888', fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                      Flange Width (mm)
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: '600', fontSize: '1rem' }}>
                      {selectedElementDetails.flangeWidthMm}
                    </Typography>
                  </Box>
                </Grid>
              )}

              {/* Web Thickness */}
              {visibleColumns.webThicknessMm && selectedElementDetails.webThicknessMm && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: '#f5f5f5', 
                    borderRadius: 2,
                    border: '1px solid #e0e0e0'
                  }}>
                    <Typography variant="caption" sx={{ color: '#888', fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                      Web Thickness (mm)
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: '600', fontSize: '1rem' }}>
                      {selectedElementDetails.webThicknessMm}
                    </Typography>
                  </Box>
                </Grid>
              )}

              {/* Flange Thickness */}
              {visibleColumns.flangeThicknessMm && selectedElementDetails.flangeThicknessMm && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: '#f5f5f5', 
                    borderRadius: 2,
                    border: '1px solid #e0e0e0'
                  }}>
                    <Typography variant="caption" sx={{ color: '#888', fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                      Flange Thickness (mm)
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: '600', fontSize: '1rem' }}>
                      {selectedElementDetails.flangeThicknessMm}
                    </Typography>
                  </Box>
                </Grid>
              )}

              {/* Fireproofing Workflow */}
              {visibleColumns.fireProofingWorkflow && selectedElementDetails.fireProofingWorkflow && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: '#f5f5f5', 
                    borderRadius: 2,
                    border: '1px solid #e0e0e0'
                  }}>
                    <Typography variant="caption" sx={{ color: '#888', fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                      Fireproofing Workflow
                    </Typography>
                    <Chip 
                      label={selectedElementDetails.fireProofingWorkflow.replace(/_/g, ' ')}
                      sx={{
                        bgcolor: getWorkflowColor(selectedElementDetails.fireProofingWorkflow).bg,
                        color: getWorkflowColor(selectedElementDetails.fireProofingWorkflow).text,
                        fontWeight: '600',
                        fontSize: '0.85rem',
                        textTransform: 'capitalize',
                        height: '28px',
                        mt: 0.5
                      }}
                    />
                  </Box>
                </Grid>
              )}

              {/* Status */}
              <Grid item xs={12} sm={6}>
                <Box sx={{ 
                  p: 2, 
                  bgcolor: '#f5f5f5', 
                  borderRadius: 2,
                  border: '1px solid #e0e0e0'
                }}>
                  <Typography variant="caption" sx={{ color: '#888', fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                    Status
                  </Typography>
                  <Chip 
                    label={selectedElementDetails.status}
                    sx={{
                      bgcolor: getStatusColor(selectedElementDetails.status).text,
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                      textTransform: 'capitalize',
                      height: '28px',
                      mt: 0.5
                    }}
                  />
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDetailsDialog} variant="contained" color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Job Management Dialog */}
      <JobManagementDialog
        open={showJobDialog}
        onClose={() => {
          setShowJobDialog(false);
          setSelectedElement(null);
        }}
        element={selectedElement}
        projectId={project?._id}
        onJobsUpdated={handleJobsUpdated}
      />
    </Box>
  );
}
