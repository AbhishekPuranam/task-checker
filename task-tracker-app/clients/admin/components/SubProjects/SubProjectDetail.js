import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { titleToSlug, getSubProjectUrl } from '../../utils/slug';
import JobManagementDialog from '../Jobs/JobManagementDialog';
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
  Menu,
  TextField
} from '@mui/material';
import { 
  ArrowBack, Download, ViewModule as ViewModuleIcon, Settings as SettingsIcon,
  MoreVert as MoreVertIcon, CheckCircle, Cancel, Edit, AddCircle 
} from '@mui/icons-material';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const SECTIONS = [
  { id: 'active', label: 'Active', color: 'blue' },
  { id: 'non_clearance', label: 'Non-Clearance', color: 'yellow' },
  { id: 'no_job', label: 'No Job', color: 'gray' },
  { id: 'complete', label: 'Complete', color: 'green' }
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
  
    // Pagination state for grouped data
  const [groupPages, setGroupPages] = useState({});
  const [groupRowsPerPage, setGroupRowsPerPage] = useState({});
  
  // Job action states
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [statusDialog, setStatusDialog] = useState({ open: false, status: '' });
  const [jobDialog, setJobDialog] = useState({ open: false, mode: 'add', job: {} });
  const [jobManagementDialog, setJobManagementDialog] = useState({ open: false, element: null });
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination helpers
  const getGroupPage = (groupIndex) => groupPages[groupIndex] || 0;
  const getGroupRowsPerPage = (groupIndex) => groupRowsPerPage[groupIndex] || 25;
  
  // Pagination handlers for groups
  const handleGroupPageChange = (groupIndex, newPage) => {
    setGroupPages(prev => ({ ...prev, [groupIndex]: newPage }));
  };
  
  const handleGroupRowsPerPageChange = (groupIndex, event) => {
    setGroupRowsPerPage(prev => ({ ...prev, [groupIndex]: parseInt(event.target.value, 10) }));
    setGroupPages(prev => ({ ...prev, [groupIndex]: 0 }));
  };

  // Job action handlers
  const handleActionMenuOpen = (event, element) => {
    setActionMenuAnchor(event.currentTarget);
    setSelectedElement(element);
  };

  const handleActionMenuClose = () => {
    setActionMenuAnchor(null);
  };

  const handleStatusChange = async (status) => {
    handleActionMenuClose();
    setStatusDialog({ open: true, status });
  };

  const confirmStatusChange = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/structuralElements/${selectedElement._id}`,
        { status: statusDialog.status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setStatusDialog({ open: false, status: '' });
      setSelectedElement(null);
      
      // Refresh data
      await fetchGroupedData();
      await fetchData();
      
      alert('Status updated successfully');
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleEditJob = () => {
    handleActionMenuClose();
    if (selectedElement.currentJob) {
      setJobDialog({ 
        open: true, 
        mode: 'edit', 
        job: selectedElement.currentJob 
      });
    }
  };

  const handleAddJob = () => {
    handleActionMenuClose();
    setJobDialog({ 
      open: true, 
      mode: 'add', 
      job: { 
        jobTitle: '', 
        jobDescription: '', 
        structuralElement: selectedElement._id 
      } 
    });
  };

  const handleJobSave = async () => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = jobDialog.mode === 'add' 
        ? `${API_URL}/jobs`
        : `${API_URL}/jobs/${jobDialog.job._id}`;
      
      const method = jobDialog.mode === 'add' ? 'post' : 'put';
      
      await axios[method](endpoint, jobDialog.job, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setJobDialog({ open: false, mode: 'add', job: {} });
      setSelectedElement(null);
      
      // Refresh data
      await fetchGroupedData();
      
      alert(`Job ${jobDialog.mode === 'add' ? 'added' : 'updated'} successfully`);
    } catch (err) {
      console.error('Error saving job:', err);
      alert('Failed to save job');
    }
  };
  
  // Column visibility handlers
  const [visibleColumns, setVisibleColumns] = useState({
    serialNo: true,
    structureNumber: true,
    drawingNo: true,
    level: true,
    memberType: true,
    gridNo: true,
    sectionSizes: true,
    surfaceAreaSqm: true,
    qty: true,
    status: true,
    fireProofingWorkflow: true,
    currentJob: true,
    jobs: true,
    jobProgress: true,
    actions: true
  });
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  
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
    { key: 'jobs', label: 'All Jobs' },
    { key: 'jobProgress', label: 'Job Progress' },
    { key: 'actions', label: 'Actions' }
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
      
      // Set default groupBy to 'level' after fields are loaded
      if (fields.length > 0 && !groupBy) {
        console.log('📊 [fetchAvailableFields] Setting groupBy to level');
        setGroupBy('level');
      }
    } catch (err) {
      console.error('Error fetching fields:', err);
    }
  };

  const fetchGroupedData = async () => {
    try {
      setLoadingGroups(true);
      const token = localStorage.getItem('token');
      
      console.log('📊 [fetchGroupedData] Request params:', {
        subProjectId: subProject._id,
        status: activeSection,
        groupBy,
        subGroupBy: subGroupBy || undefined
      });
      
      const res = await axios.post(
        `${API_URL}/grouping/elements`,
        {
          subProjectId: subProject._id,
          status: activeSection,
          groupBy,
          subGroupBy: subGroupBy || undefined,
          page: 1,
          limit: 10000, // Fetch all elements
          includeElements: true // Request full element details
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      console.log('📊 [fetchGroupedData] Response:', res.data);
      setGroupedData(res.data);
    } catch (err) {
      console.error('❌ [fetchGroupedData] Error fetching grouped data:', err);
      console.error('Error response:', err.response?.data);
      alert('Failed to load grouped data');
    } finally {
      setLoadingGroups(false);
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
        return element.currentJob?.jobTitle || '-';
      case 'jobs':
        return element.jobs?.length || 0;
      case 'jobProgress':
        return element.currentJob?.status || '-';
      case 'actions':
        return null; // Actions will be rendered separately
      default:
        return '';
    }
  };

  // Search filter function
  const filterElementsBySearch = (elements) => {
    if (!searchQuery || searchQuery.trim() === '') {
      return elements;
    }

    const query = searchQuery.toLowerCase().trim();
    
    return elements.filter(element => {
      // Search across all visible columns
      return getVisibleColumns().some(column => {
        const value = getCellValue(element, column.key);
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(query);
      });
    });
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
                  {subProject.completionPercentage || 0}%
                </Typography>
                <Typography variant="body2" fontWeight="medium" sx={{ color: '#388e3c' }}>
                  Completion
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
                  {subProject.sqmCompletionPercentage || 0}%
                </Typography>
                <Typography variant="body2" fontWeight="medium" sx={{ color: '#ef6c00' }}>
                  SQM Completion
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

        {/* Sections Tabs */}
        <Paper 
          elevation={3} 
          sx={{ 
            mb: 3, 
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(106, 17, 203, 0.3)'
          }}
        >
          <Tabs
            value={activeSection}
            onChange={(e, newValue) => setActiveSection(newValue)}
            variant="fullWidth"
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
          >
            {SECTIONS.map((section) => {
              const count = subProject.statistics?.sections?.[section.id === 'non_clearance' ? 'nonClearance' : section.id === 'no_job' ? 'noJob' : section.id]?.count || 0;
              const sqm = subProject.statistics?.sections?.[section.id === 'non_clearance' ? 'nonClearance' : section.id === 'no_job' ? 'noJob' : section.id]?.sqm || 0;
              
              return (
                <Tab
                  key={section.id}
                  value={section.id}
                  label={
                    <Box>
                      <Typography variant="body1" fontWeight="bold">
                        {section.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#666' }}>
                        {count} items • {sqm.toFixed(1)} SQM
                      </Typography>
                    </Box>
                  }
                />
              );
            })}
          </Tabs>
        </Paper>

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
          
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Search across all columns"
                placeholder="Type to search in serial no, structure, drawing, level, etc..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                variant="outlined"
                sx={{ 
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'white'
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <Box sx={{ mr: 1, color: 'text.secondary' }}>
                      🔍
                    </Box>
                  )
                }}
              />
            </Grid>

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
              onClick={fetchGroupedData}
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

            {/* Current View Metrics */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} md={4}>
                <Box sx={{ 
                  background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                  p: 2,
                  borderRadius: 2,
                  border: '1px solid #90caf9'
                }}>
                  <Typography variant="h5" fontWeight="bold" sx={{ color: '#1565c0', mb: 0.5 }}>
                    {groupedData.totalElements || 0}
                  </Typography>
                  <Typography variant="body2" fontWeight="medium" sx={{ color: '#1976d2' }}>
                    Total Elements (Current View)
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} md={4}>
                <Box sx={{ 
                  background: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)',
                  p: 2,
                  borderRadius: 2,
                  border: '1px solid #ce93d8'
                }}>
                  <Typography variant="h5" fontWeight="bold" sx={{ color: '#6a1b9a', mb: 0.5 }}>
                    {groupedData.totalSqm?.toFixed(2) || '0.00'}
                  </Typography>
                  <Typography variant="body2" fontWeight="medium" sx={{ color: '#7b1fa2' }}>
                    Total SQM (Current View)
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} md={4}>
                <Box sx={{ 
                  background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
                  p: 2,
                  borderRadius: 2,
                  border: '1px solid #ffb74d'
                }}>
                  <Typography variant="h5" fontWeight="bold" sx={{ color: '#e65100', mb: 0.5 }}>
                    {groupedData.totalQty || 0}
                  </Typography>
                  <Typography variant="body2" fontWeight="medium" sx={{ color: '#ef6c00' }}>
                    Total Quantity (Current View)
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {groupedData.groups?.map((group, index) => {
              const filteredGroupElements = filterElementsBySearch(group.elements);
              return (
              <Paper key={index} sx={{ p: 3, border: '1px solid #e0e0e0', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                  <Typography variant="h6" fontWeight="600">
                    {group._id[groupBy] || '(Not Set)'}
                    {subGroupBy && group._id[subGroupBy] && (
                      <Box component="span" sx={{ color: '#666', ml: 1 }}>
                        → {group._id[subGroupBy]}
                      </Box>
                    )}
                  </Typography>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" sx={{ color: '#666' }}>
                      {searchQuery ? `${filteredGroupElements.length} of ${group.count}` : group.count} elements • {group.totalSqm?.toFixed(2)} SQM
                    </Typography>
                    {group.totalQty > 0 && (
                      <Typography variant="body2" sx={{ color: '#666' }}>
                        Total Qty: {group.totalQty}
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* All Elements */}
                {group.elements && group.elements.length > 0 && (() => {
                  const filteredElements = filterElementsBySearch(group.elements);
                  return (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" fontWeight="600" sx={{ color: '#333', mb: 1 }}>
                      All Elements ({filteredElements.length} {searchQuery ? `of ${group.elements.length}` : ''} total):
                    </Typography>
                    <Box sx={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: '#f5f5f5' }}>
                          <tr>
                            {getVisibleColumns().map((column) => (
                              <th key={column.key} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>
                                {column.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredElements
                            .slice(
                              getGroupPage(index) * getGroupRowsPerPage(index), 
                              getGroupPage(index) * getGroupRowsPerPage(index) + getGroupRowsPerPage(index)
                            )
                            .map((element) => (
                              <tr key={element._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                {getVisibleColumns().map((column) => (
                                  <td key={column.key} style={{ padding: '8px 12px' }}>
                                    {column.key === 'actions' ? (
                                      <IconButton
                                        size="small"
                                        onClick={(e) => handleActionMenuOpen(e, element)}
                                        sx={{ color: '#6a11cb' }}
                                      >
                                        <MoreVertIcon />
                                      </IconButton>
                                    ) : column.key === 'jobs' ? (
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => setJobManagementDialog({ open: true, element })}
                                        sx={{ 
                                          minWidth: '80px',
                                          fontWeight: 'bold',
                                          color: element.jobs?.length > 0 ? 'primary.main' : 'text.disabled',
                                          borderColor: element.jobs?.length > 0 ? 'primary.main' : 'divider'
                                        }}
                                      >
                                        {element.jobs?.length || 0} Job{element.jobs?.length !== 1 ? 's' : ''}
                                      </Button>
                                    ) : (
                                      getCellValue(element, column.key)
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                        </tbody>
                      </table>
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
                      sx={{ borderTop: '1px solid #e0e0e0', mt: 1 }}
                    />
                  </Box>
                  );
                })()}
              </Paper>
              );
            })}
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
                qty: true,
                actions: true
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

      {/* Action Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleActionMenuClose}
      >
        <MenuItem onClick={() => handleStatusChange('complete')}>
          <CheckCircle sx={{ mr: 1, color: 'green' }} />
          Mark Complete
        </MenuItem>
        <MenuItem onClick={() => handleStatusChange('non_clearance')}>
          <Cancel sx={{ mr: 1, color: 'orange' }} />
          Mark Non-Clearance
        </MenuItem>
        <MenuItem onClick={handleEditJob} disabled={!selectedElement?.currentJob}>
          <Edit sx={{ mr: 1, color: 'blue' }} />
          Edit Job
        </MenuItem>
        <MenuItem onClick={handleAddJob}>
          <AddCircle sx={{ mr: 1, color: 'purple' }} />
          Add Custom Job
        </MenuItem>
      </Menu>

      {/* Status Change Confirmation Dialog */}
      <Dialog
        open={statusDialog.open}
        onClose={() => setStatusDialog({ open: false, status: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Status Change</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to mark this element as{' '}
            <strong>{statusDialog.status === 'complete' ? 'Complete' : 'Non-Clearance'}</strong>?
          </Typography>
          {selectedElement && (
            <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="body2"><strong>Serial No:</strong> {selectedElement.serialNo}</Typography>
              <Typography variant="body2"><strong>Structure:</strong> {selectedElement.structureNumber}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialog({ open: false, status: '' })}>
            Cancel
          </Button>
          <Button onClick={confirmStatusChange} variant="contained" color="primary">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Job Dialog */}
      <Dialog
        open={jobDialog.open}
        onClose={() => setJobDialog({ open: false, mode: 'add', job: {} })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {jobDialog.mode === 'add' ? 'Add Custom Job' : 'Edit Job'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Job Title"
              fullWidth
              value={jobDialog.job.jobTitle || ''}
              onChange={(e) => setJobDialog(prev => ({
                ...prev,
                job: { ...prev.job, jobTitle: e.target.value }
              }))}
            />
            <TextField
              label="Job Description"
              fullWidth
              multiline
              rows={3}
              value={jobDialog.job.jobDescription || ''}
              onChange={(e) => setJobDialog(prev => ({
                ...prev,
                job: { ...prev.job, jobDescription: e.target.value }
              }))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJobDialog({ open: false, mode: 'add', job: {} })}>
            Cancel
          </Button>
          <Button 
            onClick={handleJobSave} 
            variant="contained" 
            color="primary"
            disabled={!jobDialog.job.jobTitle}
          >
            {jobDialog.mode === 'add' ? 'Add Job' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Job Management Dialog */}
      <JobManagementDialog
        open={jobManagementDialog.open}
        onClose={() => setJobManagementDialog({ open: false, element: null })}
        element={jobManagementDialog.element}
        onJobsUpdated={() => {
          // Refresh data after jobs are updated
          if (groupBy && subProject?._id) {
            fetchGroupedData();
          }
        }}
      />
    </Box>
  );
}
