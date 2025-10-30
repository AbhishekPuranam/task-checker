import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  AppBar,
  Toolbar,
  IconButton,
  TextField,
  Chip,
  Collapse,
  Badge,
  Divider,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Build,
  LogoutOutlined,
  ExpandMore,
  ExpandLess,
  Search,
  FilterList,
  GridOn,
  LocalFireDepartment,
  ClearAll,
  AccountCircle,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function JobsPage() {
  const { user, logout } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingJob, setUpdatingJob] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalJobs: 0
  });
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    not_applicable: 0
  });
  const [expandedGrids, setExpandedGrids] = useState({});
  const [expandedFireProofing, setExpandedFireProofing] = useState({});
  const [expandedJobNames, setExpandedJobNames] = useState({});
  const [expandedStatus, setExpandedStatus] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterFireProofing, setFilterFireProofing] = useState('all');
  const [showFilters, setShowFilters] = useState({});

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchJobs();
      fetchStats();
    }
  }, [selectedProject, pagination.currentPage]);

  const fetchProjects = async () => {
    try {
      const response = await api.get('/projects');
      setProjects(response.data.tasks || []);
      // Auto-select first project if available
      if (response.data.tasks && response.data.tasks.length > 0) {
        setSelectedProject(response.data.tasks[0]._id);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async () => {
    if (!selectedProject) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/jobs?project=${selectedProject}&page=${pagination.currentPage}&limit=10000`);
      const fetchedJobs = response.data.jobs || [];
      setJobs(fetchedJobs); // useMemo will handle the grouping automatically
      
      setPagination(response.data.pagination || {
        currentPage: 1,
        totalPages: 1,
        totalJobs: 0
      });
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  };

  // PERFORMANCE OPTIMIZATION: Memoize the grouping function to avoid recalculating on every render
  const groupedJobs = useMemo(() => {
    // Apply filters
    let filtered = jobs.filter(job => {
      const matchesSearch = searchTerm === '' || 
        job.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.structuralElement?.structureNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.structuralElement?.gridNo?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'pending' && (!job.status || job.status === 'pending' || job.status === 'in_progress')) ||
        job.status === filterStatus;
      
      // Fire proofing filter
      let matchesFireProofing = true;
      if (filterFireProofing !== 'all') {
        // Match based on fireProofingType or jobType field
        const fireProofingType = (job.fireProofingType || job.jobType || '').toLowerCase();
        matchesFireProofing = fireProofingType === filterFireProofing.toLowerCase();
      }
      
      return matchesSearch && matchesStatus && matchesFireProofing;
    });

    // Group filtered jobs by grid → fireproofing type → job name → status
    const grouped = {};
    filtered.forEach(job => {
      const gridNo = job.structuralElement?.gridNo || 'No Grid';
      const jobName = job.jobTitle || 'Unnamed Job';
      
      // Use the actual fire proofing type from the job
      let fireProofingType = job.fireProofingType || job.jobType || 'other';
      
      // Determine status group
      let statusGroup = job.status || 'pending';
      if (!job.status || job.status === 'in_progress') {
        statusGroup = 'pending';
      }
      
      // Create nested structure: grid → fireproofing type → job name → status
      if (!grouped[gridNo]) {
        grouped[gridNo] = {};
      }
      
      if (!grouped[gridNo][fireProofingType]) {
        grouped[gridNo][fireProofingType] = {};
      }
      
      if (!grouped[gridNo][fireProofingType][jobName]) {
        grouped[gridNo][fireProofingType][jobName] = {};
      }
      
      if (!grouped[gridNo][fireProofingType][jobName][statusGroup]) {
        grouped[gridNo][fireProofingType][jobName][statusGroup] = [];
      }
      
      grouped[gridNo][fireProofingType][jobName][statusGroup].push(job);
    });
    
    // Sort jobs within each group by step number
    Object.keys(grouped).forEach(gridNo => {
      Object.keys(grouped[gridNo]).forEach(fireProofingType => {
        Object.keys(grouped[gridNo][fireProofingType]).forEach(jobName => {
          Object.keys(grouped[gridNo][fireProofingType][jobName]).forEach(statusGroup => {
            grouped[gridNo][fireProofingType][jobName][statusGroup].sort((a, b) => (a.stepNumber || 0) - (b.stepNumber || 0));
          });
        });
      });
    });
    
    return grouped;
  }, [jobs, searchTerm, filterStatus, filterFireProofing]); // Only recalculate when dependencies change

  // Auto-expand and scroll when searching for a specific structure
  useEffect(() => {
    if (searchTerm && jobs.length > 0) {
      // Find the first matching job
      const matchingJob = jobs.find(job => 
        job.structuralElement?.structureNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.structuralElement?.gridNo?.toLowerCase().includes(searchTerm.toLowerCase())
      );

      if (matchingJob) {
        const gridNo = matchingJob.structuralElement?.gridNo || 'No Grid';
        const fireProofingType = matchingJob.fireProofingType || matchingJob.jobType || 'other';

        // Auto-expand all levels
        setExpandedGrids(prev => ({ ...prev, [gridNo]: true }));
        setExpandedFireProofing(prev => ({ 
          ...prev, 
          [`${gridNo}-${fireProofingType}`]: true 
        }));

        // Scroll to element after a brief delay to allow rendering
        setTimeout(() => {
          const element = document.getElementById(`job-${matchingJob._id}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight the row briefly
            element.style.backgroundColor = '#ffe6f0';
            setTimeout(() => {
              element.style.backgroundColor = '';
            }, 2000);
          }
        }, 300);
      }
    }
  }, [searchTerm, jobs]);

  const fetchStats = async () => {
    if (!selectedProject) return;
    
    try {
      const response = await api.get(`/jobs/stats/${selectedProject}`);
      setStats(response.data || {
        total: 0,
        pending: 0,
        completed: 0,
        not_applicable: 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const toggleGrid = (gridKey) => {
    setExpandedGrids(prev => ({
      ...prev,
      [gridKey]: !prev[gridKey]
    }));
  };

  const toggleStatus = (gridKey, fpType, status) => {
    const key = `${gridKey}-${fpType}-${status}`;
    setExpandedStatus(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getWorkflowDisplayName = (jobType) => {
    const names = {
      fireproofing: 'Fire Proofing Workflow',
      formwork: 'Formwork',
      rebar: 'Rebar',
      concreting: 'Concreting',
      preparation: '🔧 Surface Preparation',
      application: '🔥 Application/Spray',
      inspection: '📏 Inspection/Measurement',
      curing: '⏱️ Curing/Drying',
      other: 'Other'
    };
    return names[jobType] || jobType;
  };

  const getStatusDisplayName = (status) => {
    const names = {
      pending: '⏳ Pending',
      completed: '✅ Completed',
      not_applicable: '🚫 Non-clearance'
    };
    return names[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'warning.main',
      completed: 'success.main',
      not_applicable: 'error.main'
    };
    return colors[status] || 'grey.500';
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterStatus('all');
    setFilterFireProofing('all');
  };

  const expandAllGrids = () => {
    const allExpanded = {};
    const allFPExpanded = {};
    const allStatusExpanded = {};
    
    Object.keys(groupedJobs).forEach(gridNo => {
      allExpanded[gridNo] = true;
      
      Object.keys(groupedJobs[gridNo]).forEach(fpType => {
        const fpKey = `${gridNo}-${fpType}`;
        allFPExpanded[fpKey] = true;
        
        Object.keys(groupedJobs[gridNo][fpType]).forEach(status => {
          const statusKey = `${gridNo}-${fpType}-${status}`;
          allStatusExpanded[statusKey] = true;
        });
      });
    });
    
    setExpandedGrids(allExpanded);
    setExpandedFireProofing(allFPExpanded);
    setExpandedStatus(allStatusExpanded);
  };

  const collapseAllGrids = () => {
    setExpandedGrids({});
    setExpandedFireProofing({});
    setExpandedStatus({});
  };

  const getGridStats = (gridNo) => {
    const gridData = groupedJobs[gridNo] || {};
    // Updated to handle the new structure: grid → fireproofing type → job name → status
    const gridJobs = Object.values(gridData).flatMap(fireProofingGroup => 
      Object.values(fireProofingGroup).flatMap(jobNameGroup => 
        Object.values(jobNameGroup).flat()
      )
    );
    const total = gridJobs.length;
    const completed = gridJobs.filter(j => j.status === 'completed').length;
    const pending = gridJobs.filter(j => !j.status || j.status === 'pending' || j.status === 'in_progress').length;
    const notApplicable = gridJobs.filter(j => j.status === 'not_applicable').length;
    return { total, completed, pending, notApplicable };
  };

  const getFireProofingStats = (gridNo, fireProofingType) => {
    const fpData = groupedJobs[gridNo]?.[fireProofingType] || {};
    const fpJobs = Object.values(fpData).flatMap(jobNameGroup => Object.values(jobNameGroup).flat());
    const total = fpJobs.length;
    const completed = fpJobs.filter(j => j.status === 'completed').length;
    const pending = fpJobs.filter(j => !j.status || j.status === 'pending' || j.status === 'in_progress').length;
    const notApplicable = fpJobs.filter(j => j.status === 'not_applicable').length;
    return { total, completed, pending, notApplicable };
  };

  const getJobNameStats = (gridNo, fireProofingType, jobName) => {
    const jobData = groupedJobs[gridNo]?.[fireProofingType]?.[jobName] || {};
    const jobs = Object.values(jobData).flat();
    const total = jobs.length;
    const completed = jobs.filter(j => j.status === 'completed').length;
    const pending = jobs.filter(j => !j.status || j.status === 'pending' || j.status === 'in_progress').length;
    const notApplicable = jobs.filter(j => j.status === 'not_applicable').length;
    return { total, completed, pending, notApplicable };
  };

  const toggleFireProofing = (gridNo, fireProofingType) => {
    const key = `${gridNo}-${fireProofingType}`;
    setExpandedFireProofing(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleJobName = (gridNo, fireProofingType, jobName) => {
    const key = `${gridNo}-${fireProofingType}-${jobName}`;
    setExpandedJobNames(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getFireProofingType = (job) => {
    // Get the type from fireProofingType or jobType field
    const type = job.fireProofingType || job.jobType;
    
    if (!type) {
      return 'N/A';
    }
    
    // Map known types to display names
    const typeMap = {
      'cement_fire_proofing': 'Cement Fire Proofing',
      'refinery_fire_proofing': 'Refinery Fire Proofing',
      'gypsum_fire_proofing': 'Gypsum Fire Proofing',
      'intumescent_coatings': 'Intumescent Coatings'
    };
    
    // Return mapped value if exists, otherwise format the type
    if (typeMap[type.toLowerCase()]) {
      return typeMap[type.toLowerCase()];
    }
    
    // Format unknown types (replace underscores with spaces and capitalize)
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // PERFORMANCE OPTIMIZATION: Memoize status update function to prevent re-creation on every render
  const handleStatusUpdate = useCallback(async (jobId, newStatus) => {
    try {
      setUpdatingJob(jobId);
      toast.loading('Updating job status...', { id: 'status-update' });
      
      await api.put(`/jobs/${jobId}`, {
        status: newStatus,
        progressPercentage: newStatus === 'completed' ? 100 : 
                           newStatus === 'not_applicable' ? 0 : 0
      });

      toast.success('Job status updated successfully!', { id: 'status-update' });
      fetchJobs(); // Refresh the list
    } catch (error) {
      console.error('Error updating job status:', error);
      toast.error('Failed to update job status', { id: 'status-update' });
    } finally {
      setUpdatingJob(null);
    }
  }, []); // Empty deps - fetchJobs is stable, api is external

  const getSelectedProjectName = () => {
    const project = projects.find(p => p._id === selectedProject);
    return project ? project.name || project.title : '';
  };

  if (loading && !selectedProject) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar position="static" sx={{ background: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)' }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            🏗️ Site Engineer Portal
          </Typography>
          <Typography variant="body1" sx={{ mr: 2 }}>
            {user?.name}
          </Typography>
          <IconButton 
            color="inherit" 
            onClick={() => window.location.href = '/engineer/profile'}
            title="Profile"
          >
            <AccountCircle />
          </IconButton>
          <IconButton color="inherit" onClick={logout} title="Logout">
            <LogoutOutlined />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 2, mb: 4, px: { xs: 1, sm: 2, md: 3 } }}>
        {/* Header */}
        <Paper 
          elevation={3} 
          sx={{ 
            p: { xs: 3, sm: 4, md: 5 }, 
            mb: 2, 
            background: 'white', 
            color: '#6a11cb',
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(106, 17, 203, 0.3)'
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <Build sx={{ fontSize: { xs: 40, sm: 50, md: 60 }, mb: 2, color: '#7b2ff7' }} />
            <Typography variant="h3" component="h1" gutterBottom fontWeight="bold" sx={{ color: '#6a11cb', fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' } }}>
              Hi, {user?.name}! 👋
            </Typography>
            <Typography 
              variant="h5" 
              sx={{ 
                opacity: 0.85, 
                fontStyle: 'italic',
                mt: 2,
                fontWeight: 300,
                color: '#7b2ff7',
                fontSize: { xs: '1rem', sm: '1.25rem', md: '1.5rem' }
              }}
            >
              "We shape our buildings; thereafter they shape us."
            </Typography>
          </Box>
        </Paper>

        {/* Project Selection */}
        <Paper 
          elevation={3} 
          sx={{ 
            p: { xs: 2, sm: 3, md: 4 }, 
            mb: 3, 
            borderRadius: 3, 
            bgcolor: 'white', 
            boxShadow: '0 4px 20px rgba(106, 17, 203, 0.2)',
            border: '2px solid transparent',
            background: 'linear-gradient(white, white) padding-box, linear-gradient(135deg, #7b2ff7 0%, #f107a3 100%) border-box',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 }, mb: { xs: 2, sm: 3 } }}>
            <Box 
              sx={{ 
                width: { xs: 40, sm: 44, md: 48 }, 
                height: { xs: 40, sm: 44, md: 48 }, 
                borderRadius: 2, 
                background: 'linear-gradient(135deg, #7b2ff7 0%, #f107a3 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(123, 47, 247, 0.3)'
              }}
            >
              <Typography sx={{ color: 'white', fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>📁</Typography>
            </Box>
            <Box>
              <Typography 
                variant="h5" 
                fontWeight="bold" 
                sx={{ 
                  color: '#6a11cb',
                  fontSize: { xs: '1.1rem', sm: '1.3rem', md: '1.5rem' }
                }}
              >
                Select Your Project
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: '#9D50BB', 
                  mt: 0.5,
                  fontSize: { xs: '0.75rem', sm: '0.875rem' }
                }}
              >
                Choose a project to view and manage fire proofing jobs
              </Typography>
            </Box>
          </Box>
          <FormControl fullWidth>
            <InputLabel sx={{ 
              color: '#6a11cb',
              fontWeight: 500,
              '&.Mui-focused': {
                color: '#7b2ff7'
              }
            }}>
              Project Name
            </InputLabel>
            <Select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              label="Project Name"
              sx={{
                borderRadius: 2,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#e0d4ff',
                  borderWidth: 2,
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#b794f6',
                  borderWidth: 2,
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#7b2ff7',
                  borderWidth: 2,
                },
                '& .MuiSelect-select': {
                  color: '#6a11cb',
                  fontWeight: 500,
                  py: 1.5,
                }
              }}
            >
              {projects.map((project) => (
                <MenuItem 
                  key={project._id} 
                  value={project._id}
                  sx={{
                    '&:hover': {
                      bgcolor: '#f8f7ff'
                    },
                    '&.Mui-selected': {
                      bgcolor: '#e0d4ff',
                      '&:hover': {
                        bgcolor: '#d4c5f9'
                      }
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box 
                      sx={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: '50%', 
                        bgcolor: '#7b2ff7' 
                      }} 
                    />
                    <Typography sx={{ color: '#6a11cb', fontWeight: 500 }}>
                      {project.name || project.title}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Paper>

        {selectedProject && (
          <>
            {/* Project Name Section */}
            <Paper 
              elevation={2} 
              sx={{ 
                p: { xs: 2, sm: 2.5, md: 3 }, 
                mb: 3, 
                bgcolor: 'white',
                color: '#6a11cb',
                borderRadius: 2,
                boxShadow: '0 4px 20px rgba(106, 17, 203, 0.2)'
              }}
            >
              <Typography 
                variant="h4" 
                component="h2" 
                fontWeight="bold"
                sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem' } }}
              >
                📋 {getSelectedProjectName()}
              </Typography>
            </Paper>

            {/* Search and Filter Section */}
            <Paper 
              elevation={2} 
              sx={{ 
                p: { xs: 2, sm: 2.5, md: 3 }, 
                mb: 3, 
                borderRadius: 2, 
                bgcolor: 'white', 
                boxShadow: '0 4px 20px rgba(106, 17, 203, 0.2)' 
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', gap: { xs: 1, sm: 2 }, alignItems: 'center' }}>
                  <Search sx={{ color: '#6a11cb', fontSize: { xs: 20, sm: 24 } }} />
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      color: '#6a11cb', 
                      fontWeight: 600,
                      fontSize: { xs: '1rem', sm: '1.25rem' }
                    }}
                  >
                    Search & Filter
                  </Typography>
                  {(searchTerm || filterStatus !== 'all' || filterFireProofing !== 'all') && (
                    <Chip 
                      label="Filters Active" 
                      sx={{ 
                        bgcolor: '#7b2ff7', 
                        color: 'white',
                        fontWeight: 500
                      }}
                      size="small"
                      onDelete={clearFilters}
                    />
                  )}
                </Box>
              </Box>
              
              <Grid container spacing={{ xs: 1.5, sm: 2 }}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Search Jobs"
                    placeholder="Search by job name, structure no, or grid..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Filter by Status</InputLabel>
                    <Select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      label="Filter by Status"
                    >
                      <MenuItem value="all">All Statuses</MenuItem>
                      <MenuItem value="pending">Pending</MenuItem>
                      <MenuItem value="completed">Completed</MenuItem>
                      <MenuItem value="not_applicable">Non-clearance</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Fire Proofing Type Filter</InputLabel>
                    <Select
                      value={filterFireProofing}
                      onChange={(e) => setFilterFireProofing(e.target.value)}
                      label="Fire Proofing Type Filter"
                    >
                      <MenuItem value="all">All Fire Proofing Types</MenuItem>
                      <MenuItem value="cement_fire_proofing">Cement Fire Proofing</MenuItem>
                      <MenuItem value="refinery_fire_proofing">Refinery Fire Proofing</MenuItem>
                      <MenuItem value="gypsum_fire_proofing">Gypsum Fire Proofing</MenuItem>
                      <MenuItem value="intumescent_coatings">Intumescent Coatings</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {Object.keys(groupedJobs).length > 0 && (
                <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip 
                    icon={<GridOn sx={{ fontSize: { xs: 18, sm: 20 } }} />}
                    label={`${Object.keys(groupedJobs).length} Grids`} 
                    sx={{ 
                      bgcolor: '#e0d4ff',
                      color: '#6a11cb',
                      fontWeight: 500,
                      borderColor: '#7b2ff7',
                      fontSize: { xs: '0.75rem', sm: '0.8125rem' }
                    }}
                    variant="outlined"
                  />
                </Box>
              )}
            </Paper>

            {/* Jobs Table */}
            <Paper 
              elevation={2} 
              sx={{ 
                borderRadius: 2, 
                bgcolor: 'white', 
                boxShadow: '0 4px 20px rgba(106, 17, 203, 0.2)',
                overflow: 'hidden'
              }}
            >
              {loading ? (
                <Box sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
                  <CircularProgress sx={{ color: '#7b2ff7' }} />
                </Box>
              ) : jobs.length === 0 ? (
                <Box sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
                  <Build sx={{ fontSize: { xs: 48, sm: 64 }, color: '#b794f6', mb: 2 }} />
                  <Alert severity="info">
                    No jobs found for this project.
                  </Alert>
                </Box>
              ) : (
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'primary.main' }}>
                        <TableCell sx={{ 
                          color: 'white', 
                          fontWeight: 'bold', 
                          fontSize: { xs: '0.875rem', sm: '1rem', md: '1.1rem' }, 
                          width: '50px',
                          display: { xs: 'none', sm: 'table-cell' }
                        }}>
                          
                        </TableCell>
                        <TableCell sx={{ 
                          color: 'white', 
                          fontWeight: 'bold', 
                          fontSize: { xs: '0.875rem', sm: '1rem', md: '1.1rem' }
                        }}>
                          Grid / Workflow Type
                        </TableCell>
                        <TableCell sx={{ 
                          color: 'white', 
                          fontWeight: 'bold', 
                          fontSize: { xs: '0.875rem', sm: '1rem', md: '1.1rem' }
                        }}>
                          Job Name
                        </TableCell>
                        <TableCell sx={{ 
                          color: 'white', 
                          fontWeight: 'bold', 
                          fontSize: { xs: '0.875rem', sm: '1rem', md: '1.1rem' },
                          display: { xs: 'none', md: 'table-cell' }
                        }}>
                          Structure No.
                        </TableCell>
                        <TableCell align="center" sx={{ 
                          color: 'white', 
                          fontWeight: 'bold', 
                          fontSize: { xs: '0.875rem', sm: '1rem', md: '1.1rem' }
                        }}>
                          Current Status
                        </TableCell>
                        <TableCell align="center" sx={{ 
                          color: 'white', 
                          fontWeight: 'bold', 
                          fontSize: { xs: '0.875rem', sm: '1rem', md: '1.1rem' }
                        }}>
                          Actions
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.keys(groupedJobs).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                            <FilterList sx={{ fontSize: 64, color: '#b794f6', mb: 2 }} />
                            <Typography variant="h6" sx={{ color: '#6a11cb' }}>
                              No jobs match your filters
                            </Typography>
                            <Button 
                              sx={{ 
                                mt: 2,
                                borderColor: '#7b2ff7',
                                color: '#7b2ff7',
                                '&:hover': {
                                  borderColor: '#6a11cb',
                                  bgcolor: '#f8f7ff'
                                }
                              }} 
                              variant="outlined" 
                              onClick={clearFilters}
                              startIcon={<ClearAll />}
                            >
                              Clear Filters
                            </Button>
                          </TableCell>
                        </TableRow>
                      ) : (
                        Object.keys(groupedJobs)
                          .sort((a, b) => {
                            // Sort by highest pending count
                            const statsA = getGridStats(a);
                            const statsB = getGridStats(b);
                            // Primary sort: pending count (descending)
                            if (statsB.pending !== statsA.pending) {
                              return statsB.pending - statsA.pending;
                            }
                            // Secondary sort: grid name (ascending)
                            return a.localeCompare(b);
                          })
                          .map((gridNo) => {
                          const gridStats = getGridStats(gridNo);
                          return (
                            <React.Fragment key={gridNo}>
                              {/* Grid Header Row */}
                              <TableRow 
                                sx={{ 
                                  background: 'white',
                                  cursor: 'pointer',
                                  borderLeft: '4px solid #7b2ff7',
                                  '&:hover': { 
                                    bgcolor: '#f8f7ff'
                                  }
                                }}
                                onClick={() => toggleGrid(gridNo)}
                              >
                                <TableCell sx={{ py: { xs: 1.5, sm: 2 }, display: { xs: 'none', sm: 'table-cell' } }}>
                                  <IconButton size="small" sx={{ color: '#7b2ff7' }}>
                                    {expandedGrids[gridNo] ? <ExpandLess /> : <ExpandMore />}
                                  </IconButton>
                                </TableCell>
                                <TableCell colSpan={5}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
                                      {expandedGrids[gridNo] ? (
                                        <ExpandLess sx={{ color: '#7b2ff7', display: { sm: 'none' } }} />
                                      ) : (
                                        <ExpandMore sx={{ color: '#7b2ff7', display: { sm: 'none' } }} />
                                      )}
                                      <GridOn sx={{ color: '#7b2ff7', fontSize: { xs: 20, sm: 24 } }} />
                                      <Typography 
                                        variant="h6" 
                                        fontWeight="bold" 
                                        sx={{ 
                                          color: '#6a11cb',
                                          fontSize: { xs: '1rem', sm: '1.25rem' }
                                        }}
                                      >
                                        Grid: {gridNo}
                                      </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1 }, flexWrap: 'wrap' }}>
                                      <Chip 
                                        label={`${gridStats.total} Total`} 
                                        size="small" 
                                        sx={{ 
                                          bgcolor: '#e0d4ff', 
                                          color: '#6a11cb', 
                                          fontWeight: 'bold',
                                          fontSize: { xs: '0.7rem', sm: '0.8125rem' }
                                        }}
                                      />
                                      {gridStats.completed > 0 && (
                                        <Chip 
                                          label={`${gridStats.completed} Done`} 
                                          size="small" 
                                          sx={{ 
                                            bgcolor: '#d4edda', 
                                            color: '#155724', 
                                            fontWeight: 'bold',
                                            fontSize: { xs: '0.7rem', sm: '0.8125rem' }
                                          }}
                                        />
                                      )}
                                      {gridStats.pending > 0 && (
                                        <Chip 
                                          label={`${gridStats.pending} Pending`} 
                                          size="small" 
                                          sx={{ 
                                            bgcolor: '#fff3cd', 
                                            color: '#856404', 
                                            fontWeight: 'bold',
                                            fontSize: { xs: '0.7rem', sm: '0.8125rem' }
                                          }}
                                        />
                                      )}
                                    </Box>
                                  </Box>
                                </TableCell>
                              </TableRow>
                          
                              {/* Jobs for this Grid */}
                              {expandedGrids[gridNo] && (
                                <>
                              {/* Column Headers for Jobs */}
                              <TableRow sx={{ bgcolor: '#f3e8ff' }}>
                                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}></TableCell>
                                <TableCell sx={{ pl: { xs: 2, sm: 4 } }}>
                                  {/* Empty column - fire proofing type shown in subheader */}
                                </TableCell>
                                <TableCell>
                                  <Typography 
                                    variant="caption" 
                                    fontWeight="bold" 
                                    sx={{ 
                                      color: '#6a11cb',
                                      fontSize: { xs: '0.7rem', sm: '0.75rem' }
                                    }}
                                  >
                                    Job Name
                                  </Typography>
                                </TableCell>
                                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                                  <Typography 
                                    variant="caption" 
                                    fontWeight="bold" 
                                    sx={{ 
                                      color: '#6a11cb',
                                      fontSize: { xs: '0.7rem', sm: '0.75rem' }
                                    }}
                                  >
                                    Structure No.
                                  </Typography>
                                </TableCell>
                                <TableCell align="center">
                                  <Typography 
                                    variant="caption" 
                                    fontWeight="bold" 
                                    sx={{ 
                                      color: '#6a11cb',
                                      fontSize: { xs: '0.7rem', sm: '0.75rem' }
                                    }}
                                  >
                                    Current Status
                                  </Typography>
                                </TableCell>
                                <TableCell align="center">
                                  <Typography 
                                    variant="caption" 
                                    fontWeight="bold" 
                                    sx={{ 
                                      color: '#6a11cb',
                                      fontSize: { xs: '0.7rem', sm: '0.75rem' }
                                    }}
                                  >
                                    Actions
                                  </Typography>
                                </TableCell>
                              </TableRow>

                                  {/* Fire Proofing Types - grouped by fire proofing type */}
                                  {Object.keys(groupedJobs[gridNo]).sort().map((fireProofingType) => {
                                    const fpKey = `${gridNo}-${fireProofingType}`;
                                    const fpStats = getFireProofingStats(gridNo, fireProofingType);
                                    
                                    return (
                                      <React.Fragment key={fireProofingType}>
                                        {/* Fire Proofing Type Header */}
                                        <TableRow 
                                          sx={{ 
                                            bgcolor: '#e8f5e9',
                                            cursor: 'pointer',
                                            borderLeft: '4px solid #4caf50',
                                            '&:hover': { 
                                              bgcolor: '#c8e6c9'
                                            }
                                          }}
                                          onClick={() => toggleFireProofing(gridNo, fireProofingType)}
                                        >
                                          <TableCell sx={{ py: 1, display: { xs: 'none', sm: 'table-cell' } }}>
                                            <IconButton size="small" sx={{ color: '#2e7d32' }}>
                                              {expandedFireProofing[fpKey] ? <ExpandLess /> : <ExpandMore />}
                                            </IconButton>
                                          </TableCell>
                                          <TableCell colSpan={5} sx={{ pl: { xs: 2, sm: 4 } }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                                              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
                                                {expandedFireProofing[fpKey] ? (
                                                  <ExpandLess sx={{ color: '#2e7d32', display: { sm: 'none' } }} />
                                                ) : (
                                                  <ExpandMore sx={{ color: '#2e7d32', display: { sm: 'none' } }} />
                                                )}
                                                <LocalFireDepartment sx={{ color: '#2e7d32', fontSize: { xs: 18, sm: 20 } }} />
                                                <Typography 
                                                  variant="body2" 
                                                  fontWeight="bold" 
                                                  sx={{ 
                                                    color: '#1b5e20',
                                                    fontSize: { xs: '0.8rem', sm: '0.875rem' }
                                                  }}
                                                >
                                                  {getFireProofingType({ fireProofingType })}
                                                </Typography>
                                              </Box>
                                              <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1 }, flexWrap: 'wrap' }}>
                                                <Chip 
                                                  label={`${fpStats.total} Total`} 
                                                  size="small" 
                                                  sx={{ 
                                                    bgcolor: '#c8e6c9', 
                                                    color: '#1b5e20', 
                                                    fontWeight: 'bold',
                                                    fontSize: { xs: '0.65rem', sm: '0.75rem' }
                                                  }}
                                                />
                                                {fpStats.completed > 0 && (
                                                  <Chip 
                                                    label={`${fpStats.completed} Done`} 
                                                    size="small" 
                                                    sx={{ 
                                                      bgcolor: '#a5d6a7', 
                                                      color: '#1b5e20', 
                                                      fontWeight: 'bold',
                                                      fontSize: { xs: '0.65rem', sm: '0.75rem' }
                                                    }}
                                                  />
                                                )}
                                                {fpStats.pending > 0 && (
                                                  <Chip 
                                                    label={`${fpStats.pending} Pending`} 
                                                    size="small" 
                                                    sx={{ 
                                                      bgcolor: '#fff9c4', 
                                                      color: '#f57f17', 
                                                      fontWeight: 'bold',
                                                      fontSize: { xs: '0.65rem', sm: '0.75rem' }
                                                    }}
                                                  />
                                                )}
                                                {fpStats.notApplicable > 0 && (
                                                  <Chip 
                                                    label={`${fpStats.notApplicable} Non-clearance`} 
                                                    size="small" 
                                                    sx={{ 
                                                      bgcolor: '#ffcdd2', 
                                                      color: '#c62828', 
                                                      fontWeight: 'bold',
                                                      fontSize: { xs: '0.65rem', sm: '0.75rem' }
                                                    }}
                                                  />
                                                )}
                                              </Box>
                                            </Box>
                                          </TableCell>
                                        </TableRow>

                                        {/* Job Names under this fire proofing type */}
                                        {expandedFireProofing[fpKey] && Object.keys(groupedJobs[gridNo][fireProofingType]).sort().map((jobName) => {
                                          const jobNameKey = `${gridNo}-${fireProofingType}-${jobName}`;
                                          const jobNameStats = getJobNameStats(gridNo, fireProofingType, jobName);
                                          
                                          return (
                                            <React.Fragment key={jobName}>
                                              {/* Job Name Subgroup Header */}
                                              <TableRow 
                                                sx={{ 
                                                  bgcolor: 'white',
                                                  cursor: 'pointer',
                                                  borderLeft: '4px solid #b794f6',
                                                  '&:hover': { 
                                                    bgcolor: '#faf8ff'
                                                  }
                                                }}
                                                onClick={() => toggleJobName(gridNo, fireProofingType, jobName)}
                                              >
                                                <TableCell sx={{ py: 1, display: { xs: 'none', sm: 'table-cell' } }}>
                                                  <IconButton size="small" sx={{ color: '#7b2ff7' }}>
                                                    {expandedJobNames[jobNameKey] ? <ExpandLess /> : <ExpandMore />}
                                                  </IconButton>
                                                </TableCell>
                                                <TableCell colSpan={5} sx={{ pl: { xs: 2, sm: 8 } }}>
                                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
                                                    {expandedJobNames[jobNameKey] ? (
                                                      <ExpandLess sx={{ color: '#7b2ff7', display: { sm: 'none' } }} />
                                                    ) : (
                                                      <ExpandMore sx={{ color: '#7b2ff7', display: { sm: 'none' } }} />
                                                    )}
                                                    <Typography 
                                                      variant="body2" 
                                                      fontWeight="bold" 
                                                      sx={{ 
                                                        color: '#7b2ff7',
                                                        fontSize: { xs: '0.85rem', sm: '0.9rem' }
                                                      }}
                                                    >
                                                      {jobName}
                                                    </Typography>
                                                    <Chip 
                                                      label={`${jobNameStats.total} item${jobNameStats.total !== 1 ? 's' : ''}`}
                                                      size="small"
                                                      sx={{ 
                                                        bgcolor: '#e0d4ff',
                                                        color: '#6a11cb',
                                                        fontWeight: 600,
                                                        fontSize: { xs: '0.65rem', sm: '0.7rem' },
                                                        height: 20
                                                      }}
                                                    />
                                                  </Box>
                                                </TableCell>
                                              </TableRow>

                                        {/* Individual Jobs under this job name */}
                                        {expandedJobNames[jobNameKey] && Object.keys(groupedJobs[gridNo][fireProofingType][jobName]).sort((a, b) => {
                                          const order = { pending: 1, completed: 2, not_applicable: 3 };
                                          return (order[a] || 99) - (order[b] || 99);
                                        }).map((statusGroup) => {
                                          return groupedJobs[gridNo][fireProofingType][jobName][statusGroup].map((job, index) => (
                                            <TableRow 
                                              key={job._id}
                                              id={`job-${job._id}`}
                                              sx={{ 
                                                '&:nth-of-type(even)': { bgcolor: '#faf8ff' },
                                                '&:nth-of-type(odd)': { bgcolor: 'white' },
                                                '&:hover': { 
                                                  bgcolor: '#e0d4ff',
                                                  transform: 'scale(1.001)',
                                                  boxShadow: '0 2px 8px rgba(123, 47, 247, 0.15)',
                                                  borderLeft: '3px solid #7b2ff7'
                                                },
                                                transition: 'all 0.2s ease',
                                                borderLeft: '3px solid transparent'
                                              }}
                                            >
                                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}></TableCell>
                                  <TableCell sx={{ pl: { xs: 2, sm: 4 } }}>
                                    {/* Fire proofing type removed - shown in header */}
                                  </TableCell>
                                  <TableCell>
                                    <Typography 
                                      variant="body2" 
                                      sx={{ 
                                        color: '#2d3748', 
                                        fontWeight: 500,
                                        fontSize: { xs: '0.8rem', sm: '0.875rem' }
                                      }}
                                    >
                                      {job.jobTitle}
                                    </Typography>
                                  </TableCell>
                                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                                    <Typography 
                                      variant="body2" 
                                      sx={{ 
                                        color: '#7b2ff7', 
                                        fontWeight: 600,
                                        fontFamily: 'monospace',
                                        bgcolor: '#f8f7ff',
                                        px: 1,
                                        py: 0.5,
                                        borderRadius: 1,
                                        display: 'inline-block',
                                        fontSize: { xs: '0.75rem', sm: '0.875rem' }
                                      }}
                                    >
                                      {job.structuralElement?.structureNumber || 'N/A'}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="center">
                                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                      {job.status === 'completed' && (
                                        <Chip
                                          icon={<CheckCircle sx={{ fontSize: { xs: 14, sm: 16 }, color: '#fff !important' }} />}
                                          label="Completed"
                                          sx={{ 
                                            bgcolor: '#10b981',
                                            color: 'white',
                                            fontWeight: 700,
                                            fontSize: { xs: '0.65rem', sm: '0.75rem' },
                                            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                                            '& .MuiChip-icon': {
                                              color: 'white'
                                            }
                                          }}
                                        />
                                      )}
                                      {job.status === 'not_applicable' && (
                                        <Chip
                                          icon={<Cancel sx={{ fontSize: { xs: 14, sm: 16 }, color: '#fff !important' }} />}
                                          label="Non-clearance"
                                          sx={{ 
                                            bgcolor: '#ef4444',
                                            color: 'white',
                                            fontWeight: 700,
                                            fontSize: { xs: '0.65rem', sm: '0.75rem' },
                                            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                                            '& .MuiChip-icon': {
                                              color: 'white'
                                            }
                                          }}
                                        />
                                      )}
                                      {(!job.status || job.status === 'pending' || job.status === 'in_progress') && (
                                        <Chip
                                          icon={<Build sx={{ fontSize: { xs: 14, sm: 16 }, color: '#fff !important' }} />}
                                          label="Pending"
                                          sx={{ 
                                            bgcolor: '#f59e0b',
                                            color: 'white',
                                            fontWeight: 700,
                                            fontSize: { xs: '0.65rem', sm: '0.75rem' },
                                            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                                            '& .MuiChip-icon': {
                                              color: 'white'
                                            }
                                          }}
                                        />
                                      )}
                                    </Box>
                                  </TableCell>
                                  <TableCell align="center">
                                    <Box sx={{ display: 'flex', gap: { xs: 0.3, sm: 0.5 }, justifyContent: 'center', flexWrap: 'wrap' }}>
                                      <Button
                                        variant={(!job.status || job.status === 'pending' || job.status === 'in_progress') ? "contained" : "outlined"}
                                        color="warning"
                                        size="small"
                                        onClick={() => handleStatusUpdate(job._id, 'pending')}
                                        disabled={updatingJob === job._id}
                                        sx={{ 
                                          minWidth: { xs: '32px', sm: 80 },
                                          px: { xs: 1, sm: 1.5 },
                                          fontSize: { xs: '0.7rem', sm: '0.8125rem' },
                                          py: 0.5
                                        }}
                                      >
                                        Pending
                                      </Button>
                                      <Button
                                        variant={job.status === 'completed' ? "contained" : "outlined"}
                                        color="success"
                                        size="small"
                                        onClick={() => handleStatusUpdate(job._id, 'completed')}
                                        disabled={updatingJob === job._id}
                                        sx={{ 
                                          minWidth: { xs: '36px', sm: 90 },
                                          px: { xs: 1, sm: 1.5 },
                                          fontSize: { xs: '0.7rem', sm: '0.8125rem' },
                                          py: 0.5
                                        }}
                                      >
                                        Complete
                                      </Button>
                                      <Button
                                        variant={job.status === 'not_applicable' ? "contained" : "outlined"}
                                        color="error"
                                        size="small"
                                        onClick={() => handleStatusUpdate(job._id, 'not_applicable')}
                                        disabled={updatingJob === job._id}
                                        sx={{ 
                                          minWidth: { xs: '38px', sm: 100 },
                                          px: { xs: 1, sm: 1.5 },
                                          fontSize: { xs: '0.65rem', sm: '0.75rem' },
                                          py: 0.5
                                        }}
                                      >
                                        Non-clearance
                                      </Button>
                                    </Box>
                                  </TableCell>
                                </TableRow>
                              ));
                            })}
                              </React.Fragment>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                                </>
                              )}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
              )}
            </Paper>
          </>
        )}
      </Container>
    </Box>
  );
}
