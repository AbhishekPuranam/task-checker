import React, { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Box,
  CircularProgress,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Slider,
  Card,
  CardContent,
  CardActions,
  Divider,
  Stack,
  Badge,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { 
  Add, 
  Search, 
  FilterList, 
  Clear,
  ExpandMore,
  Engineering,
  Assessment,
  Timeline,
  LocationOn,
  CalendarMonth,
  TrendingUp,
  ManageAccounts,
  Delete,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import ProjectAccessManager from '../Admin/ProjectAccessManager';

const ProjectList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [surfaceAreaTotals, setSurfaceAreaTotals] = useState({});
  const [projectProgress, setProjectProgress] = useState({}); // Store detailed progress for each project
  const [loading, setLoading] = useState(true);
  
  // Project access management state
  const [accessManagerOpen, setAccessManagerOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  
  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  
  // Filter and search states
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [surfaceAreaRange, setSurfaceAreaRange] = useState([0, 1000]);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Utility function to create URL-safe slug from project title
  const createSlug = (title) => {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Handle page visibility changes (when user navigates back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && (!projects || projects.length === 0)) {
        // Page became visible and we have no projects, reload
        console.log('Page became visible, reloading projects...');
        fetchProjects();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [projects?.length]);

  const fetchProjects = async (retryCount = 0) => {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    try {
      const response = await api.get('/api/projects');
      setProjects(response.data.tasks || []);
      
      // Fetch surface area totals and progress for each project
      const totals = {};
      const progress = {};
      await Promise.all(
        (response.data.tasks || []).map(async (project) => {
          try {
            const elementsResponse = await api.get(`/api/structural-elements?project=${project._id}&limit=10000`);
            const elements = elementsResponse.data.elements || [];
            
            // Calculate total surface area
            const total = elements.reduce((sum, element) => {
              return sum + (element.surfaceAreaSqm || 0);
            }, 0);
            totals[project._id] = total;
            
            // Calculate progress metrics
            let completedSurfaceArea = 0;
            let completedElements = 0;
            const totalElements = elements.length;
            
            // Fetch jobs for this project to determine completion
            const jobsResponse = await api.get(`/api/jobs?project=${project._id}`);
            const jobs = jobsResponse.data.jobs || [];
            
            // Find elements with completed jobs (using same logic as StructuralElementsList)
            for (const element of elements) {
              const elementJobs = jobs.filter(job => {
                const elementId = job.structuralElement?._id || job.structuralElement;
                return elementId === element._id;
              });
              
              if (elementJobs.length > 0) {
                // Calculate completion percentage based on jobs
                const completedJobs = elementJobs.filter(job => job.status === 'completed').length;
                const totalJobs = elementJobs.length;
                const completionPercentage = (completedJobs / totalJobs) * 100;
                
                // Calculate average progress percentage
                const avgProgress = elementJobs.reduce((sum, job) => sum + (job.progressPercentage || 0), 0) / elementJobs.length;
                
                // Element is complete when all jobs are completed AND have 100% progress
                if (completionPercentage === 100 && avgProgress === 100) {
                  completedSurfaceArea += (element.surfaceAreaSqm || 0);
                  completedElements++;
                }
              }
            }
            
            // Calculate percentages
            const surfaceAreaPercentage = total > 0 ? ((completedSurfaceArea / total) * 100) : 0;
            const elementsPercentage = totalElements > 0 ? ((completedElements / totalElements) * 100) : 0;
            
            // Determine actual status
            let actualStatus = project.status;
            if (totalElements > 0 && completedElements < totalElements) {
              actualStatus = 'in-progress';
            } else if (totalElements > 0 && completedElements === totalElements) {
              actualStatus = 'completed';
            }
            
            progress[project._id] = {
              totalSurfaceArea: total,
              completedSurfaceArea,
              surfaceAreaPercentage,
              completedElements,
              totalElements,
              elementsPercentage,
              status: actualStatus
            };
            
          } catch (error) {
            console.error(`Error fetching data for project ${project._id}:`, error);
            totals[project._id] = 0;
            progress[project._id] = {
              totalSurfaceArea: 0,
              completedSurfaceArea: 0,
              surfaceAreaPercentage: 0,
              completedElements: 0,
              totalElements: 0,
              elementsPercentage: 0,
              status: project.status
            };
          }
        })
      );
      setSurfaceAreaTotals(totals);
      setProjectProgress(progress);
      
      // Update surface area range based on actual data
      const maxArea = Math.max(...Object.values(totals), 1000);
      setSurfaceAreaRange([0, maxArea]);
    } catch (error) {
      console.error('Error fetching projects:', error);
      
      // Retry logic for network errors or rate limiting
      if (retryCount < maxRetries && (
        error.code === 'ERR_NETWORK' || 
        error.response?.status === 429 ||
        error.response?.status >= 500
      )) {
        console.log(`Retrying request... Attempt ${retryCount + 1}/${maxRetries}`);
        setTimeout(() => {
          fetchProjects(retryCount + 1);
        }, retryDelay * (retryCount + 1)); // Exponential backoff
        return;
      }

      // Show user-friendly error message based on error type
      if (error.response?.status === 429) {
        toast.error('Server is busy. Please wait a moment and try again.');
      } else if (error.code === 'ERR_NETWORK') {
        toast.error('Network connection issue. Please check your connection and try again.');
      } else if (error.response?.status === 401) {
        toast.error('Please log in again to access your projects.');
      } else {
        toast.error('Failed to load projects. Please refresh the page.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Project access management handlers
  const handleManageAccess = (project, event) => {
    event.stopPropagation(); // Prevent card click
    setSelectedProject(project);
    setAccessManagerOpen(true);
  };

  const handleAccessManagerClose = () => {
    setAccessManagerOpen(false);
    setSelectedProject(null);
    // Optionally refresh projects to show updated access
    fetchProjects();
  };

  // Delete project handlers
  const handleDeleteProject = (project, event) => {
    event.stopPropagation(); // Prevent card click
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;

    try {
      await api.delete(`/api/projects/${projectToDelete._id}`);
      toast.success(`Project "${projectToDelete.title}" deleted successfully!`);
      
      // Refresh projects list
      fetchProjects();
      
      // Close dialog
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    } catch (error) {
      console.error('Error deleting project:', error);
      if (error.response?.status === 403) {
        toast.error('You do not have permission to delete this project.');
      } else if (error.response?.status === 404) {
        toast.error('Project not found.');
      } else {
        toast.error('Failed to delete project. Please try again.');
      }
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setProjectToDelete(null);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'primary';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'complete': return 'success';
      case 'pending': return 'warning';
      case 'completed': return 'success'; // fallback
      case 'in-progress': return 'primary'; // fallback
      case 'on-hold': return 'warning'; // fallback
      case 'cancelled': return 'error'; // fallback
      default: return 'default';
    }
  };

  // Calculate correct project status (don't trust database status for 'completed')
  const getCorrectedProjectStatus = (project) => {
    // If project is marked as 'completed', change to 'in-progress' until verified
    // This prevents showing incorrect completion status
    if (project.status === 'completed') {
      return 'in-progress';
    }
    return project.status;
  };

  // Filter and search logic
  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    return projects.filter(project => {
      // Search term filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const titleMatch = project.title.toLowerCase().includes(searchLower);
        const locationMatch = project.location?.toLowerCase().includes(searchLower);
        if (!titleMatch && !locationMatch) return false;
      }

      // Priority filter
      if (priorityFilter && project.priority !== priorityFilter) return false;

      // Status filter
      if (statusFilter && getCorrectedProjectStatus(project) !== statusFilter) return false;

      // Surface area filter
      const projectSurfaceArea = surfaceAreaTotals[project._id] || 0;
      if (projectSurfaceArea < surfaceAreaRange[0] || projectSurfaceArea > surfaceAreaRange[1]) {
        return false;
      }

      // Date range filter
      if (dateRange.startDate || dateRange.endDate) {
        const projectDate = new Date(project.createdAt);
        if (dateRange.startDate && projectDate < new Date(dateRange.startDate)) return false;
        if (dateRange.endDate && projectDate > new Date(dateRange.endDate)) return false;
      }

      return true;
    });
  }, [projects, searchTerm, priorityFilter, statusFilter, surfaceAreaRange, dateRange, surfaceAreaTotals]);

  // Get unique values for filter dropdowns
  const uniquePriorities = [...new Set((projects || []).map(p => p.priority))].filter(Boolean);
  const uniqueStatuses = [...new Set((projects || []).map(p => getCorrectedProjectStatus(p)))].filter(Boolean);
  
  // Calculate surface area range for slider
  const maxSurfaceArea = Math.max(...Object.values(surfaceAreaTotals), 1000);
  
  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm('');
    setPriorityFilter('');
    setStatusFilter('');
    setSurfaceAreaRange([0, maxSurfaceArea]);
    setDateRange({ startDate: '', endDate: '' });
  };

  // Check if any filters are active
  const hasActiveFilters = searchTerm || priorityFilter || statusFilter || 
    surfaceAreaRange[0] > 0 || surfaceAreaRange[1] < maxSurfaceArea || 
    dateRange.startDate || dateRange.endDate;

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Box 
      sx={{ 
        minHeight: '100vh',
        bgcolor: 'grey.50',
        py: 4
      }}
    >
      <Container maxWidth="xl">
        {/* Header Section */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography 
                variant="h3" 
                fontWeight="bold"
                sx={{ 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                🏗️ Project Dashboard
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ mt: 1 }}>
                Manage your structural engineering projects
              </Typography>
            </Box>
            {user?.role === 'admin' && (
              <Button
                variant="contained"
                size="large"
                startIcon={<Add />}
                onClick={() => navigate('/projects/new')}
                sx={{
                  py: 1.5,
                  px: 3,
                  borderRadius: 2,
                  background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
                  boxShadow: '0 3px 5px 2px rgba(25, 118, 210, .3)',
                  fontWeight: 'bold',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 10px 4px rgba(25, 118, 210, .3)',
                  }
                }}
              >
                New Project
              </Button>
            )}
          </Box>

          {/* Statistics Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="h4" fontWeight="bold">
                        {projects?.length || 0}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        Total Projects
                      </Typography>
                    </Box>
                    <Assessment sx={{ fontSize: 40, opacity: 0.7 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="h4" fontWeight="bold">
                        {filteredProjects?.length || 0}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        Filtered Results
                      </Typography>
                    </Box>
                    <FilterList sx={{ fontSize: 40, opacity: 0.7 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="h4" fontWeight="bold">
                        {Object.values(surfaceAreaTotals).reduce((sum, area) => sum + area, 0).toFixed(0)}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        Total Area (sqm)
                      </Typography>
                    </Box>
                    <TrendingUp sx={{ fontSize: 40, opacity: 0.7 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="h4" fontWeight="bold">
                        {(projects || []).filter(p => getCorrectedProjectStatus(p) === 'complete').length}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        Completed
                      </Typography>
                    </Box>
                    <Engineering sx={{ fontSize: 40, opacity: 0.7 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>

        {/* Search and Filters Section */}
        <Paper sx={{ p: 3, mb: 3, borderRadius: 2, boxShadow: 3 }}>
          {/* Search Bar */}
          <TextField
            fullWidth
            placeholder="Search projects by title or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search color="primary" />
                </InputAdornment>
              ),
            }}
            sx={{ 
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                '&:hover fieldset': {
                  borderColor: 'primary.main',
                },
              },
            }}
          />

          {/* Filters Accordion */}
          <Accordion 
            expanded={filtersExpanded} 
            onChange={(e, isExpanded) => setFiltersExpanded(isExpanded)}
            sx={{ boxShadow: 'none', '&:before': { display: 'none' } }}
          >
            <AccordionSummary 
              expandIcon={<ExpandMore />}
              sx={{ 
                bgcolor: 'grey.50', 
                borderRadius: 1,
                '&:hover': { bgcolor: 'grey.100' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FilterList color="primary" />
                <Typography fontWeight="bold">Advanced Filters</Typography>
                {hasActiveFilters && (
                  <Chip 
                    label="Filters Active" 
                    size="small" 
                    color="primary" 
                    variant="filled"
                  />
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 3 }}>
              <Grid container spacing={3}>
                {/* Priority Filter */}
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Priority</InputLabel>
                    <Select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      label="Priority"
                    >
                      <MenuItem value="">All Priorities</MenuItem>
                      {uniquePriorities.map(priority => (
                        <MenuItem key={priority} value={priority}>
                          <Chip
                            label={priority}
                            color={getPriorityColor(priority)}
                            size="small"
                            variant="outlined"
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Status Filter */}
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      label="Status"
                    >
                      <MenuItem value="">All Statuses</MenuItem>
                      {uniqueStatuses.map(status => (
                        <MenuItem key={status} value={status}>
                          <Chip
                            label={status}
                            color={getStatusColor(status)}
                            size="small"
                            variant="outlined"
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Date Range Filters */}
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="From Date"
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="To Date"
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                {/* Surface Area Range Filter */}
                <Grid item xs={12}>
                  <Typography gutterBottom fontWeight="bold">
                    Surface Area Range: {surfaceAreaRange[0]} - {surfaceAreaRange[1]} sqm
                  </Typography>
                  <Slider
                    value={surfaceAreaRange}
                    onChange={(e, newValue) => setSurfaceAreaRange(newValue)}
                    valueLabelDisplay="auto"
                    min={0}
                    max={maxSurfaceArea}
                    step={10}
                    sx={{
                      '& .MuiSlider-thumb': {
                        background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
                      },
                      '& .MuiSlider-track': {
                        background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
                      },
                    }}
                  />
                </Grid>

                {/* Clear Filters Button */}
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    startIcon={<Clear />}
                    onClick={clearAllFilters}
                    disabled={!hasActiveFilters}
                    sx={{ borderRadius: 2 }}
                  >
                    Clear All Filters
                  </Button>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Paper>

        {/* Projects Grid/Cards View */}
        {(!filteredProjects || filteredProjects.length === 0) ? (
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
            <Engineering sx={{ fontSize: 80, color: 'grey.400', mb: 2 }} />
            <Typography variant="h5" color="textSecondary" gutterBottom>
              {(!projects || projects.length === 0)
                ? "No projects found" 
                : hasActiveFilters 
                  ? "No projects match your filters"
                  : "No projects available"
              }
            </Typography>
            <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
              {(!projects || projects.length === 0)
                ? "Create your first project to get started!" 
                : hasActiveFilters 
                  ? "Try adjusting your search criteria."
                  : "Start by creating a new project."
              }
            </Typography>
            {user?.role === 'admin' && (
              <Button
                variant="contained"
                size="large"
                startIcon={<Add />}
                onClick={() => navigate('/projects/new')}
                sx={{
                  background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
                  borderRadius: 2,
                }}
              >
                Create New Project
              </Button>
            )}
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {filteredProjects.map((project) => (
              <Grid item xs={12} sm={6} md={4} key={project._id}>
                <Card 
                  sx={{ 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 2,
                    boxShadow: 3,
                    transition: 'all 0.3s ease-in-out',
                    cursor: 'pointer',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 6,
                    },
                  }}
                  onClick={() => navigate(`/projects/${createSlug(project.title)}/elements`)}
                >
                  <CardContent sx={{ flexGrow: 1, p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                      <Avatar 
                        sx={{ 
                          bgcolor: 'primary.main',
                          background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
                          width: 48,
                          height: 48,
                        }}
                      >
                        🏗️
                      </Avatar>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography 
                          variant="h6" 
                          fontWeight="bold" 
                          sx={{ 
                            mb: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {project.title}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                          <Chip
                            label={project.priority}
                            color={getPriorityColor(project.priority)}
                            size="small"
                          />
                          <Chip
                            label={projectProgress[project._id]?.status || project.status}
                            color={getStatusColor(projectProgress[project._id]?.status || project.status)}
                            size="small"
                          />

                        </Stack>
                      </Box>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <LocationOn fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          {project.location || 'Location not specified'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Assessment fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          Total Surface Area: {projectProgress[project._id]?.totalSurfaceArea?.toFixed(2) || '0.00'} sqm
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Assessment fontSize="small" color="action" />
                        <Typography variant="body2" fontWeight="bold" color="primary.main">
                          Completed: {projectProgress[project._id]?.completedSurfaceArea?.toFixed(2) || '0.00'} sqm 
                          ({projectProgress[project._id]?.surfaceAreaPercentage?.toFixed(1) || '0.0'}%)
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Assessment fontSize="small" color="action" />
                        <Typography variant="body2" fontWeight="bold" color="primary.main">
                          Elements Progress: {projectProgress[project._id]?.completedElements || 0}/
                          {projectProgress[project._id]?.totalElements || 0}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarMonth fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          Created {new Date(project.createdAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>

                  <Divider />
                  <CardActions sx={{ p: 2, pt: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      sx={{
                        borderRadius: 1.5,
                        fontWeight: 'bold',
                        flex: user?.role === 'admin' ? 1 : 1,
                        mr: user?.role === 'admin' ? 1 : 0,
                        '&:hover': {
                          background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
                          color: 'white',
                          borderColor: 'transparent',
                        }
                      }}
                    >
                      View Details
                    </Button>
                    {user?.role === 'admin' && (
                      <>
                        <Button
                          size="small"
                          variant="contained"
                          color="secondary"
                          onClick={(e) => handleManageAccess(project, e)}
                          startIcon={<ManageAccounts />}
                          sx={{
                            borderRadius: 1.5,
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            mr: 1
                          }}
                        >
                          Manage Access
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          onClick={(e) => handleDeleteProject(project, e)}
                          startIcon={<Delete />}
                          sx={{
                            borderRadius: 1.5,
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            '&:hover': {
                              backgroundColor: 'error.main',
                              color: 'white',
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Project Access Manager Dialog */}
        <ProjectAccessManager
          open={accessManagerOpen}
          onClose={handleAccessManagerClose}
          project={selectedProject}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={handleDeleteCancel}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ color: 'error.main', fontWeight: 'bold' }}>
            Delete Project
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete the project <strong>"{projectToDelete?.title}"</strong>?
            </DialogContentText>
            <DialogContentText sx={{ mt: 2, color: 'warning.main' }}>
              ⚠️ This action cannot be undone. All structural elements and jobs associated with this project will also be permanently deleted.
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button
              onClick={handleDeleteCancel}
              variant="outlined"
              sx={{ borderRadius: 2 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              variant="contained"
              color="error"
              startIcon={<Delete />}
              sx={{ borderRadius: 2, ml: 1 }}
            >
              Delete Project
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
};

export default ProjectList;