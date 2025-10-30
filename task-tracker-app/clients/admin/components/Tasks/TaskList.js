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
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import ProjectAccessManager from '../Admin/ProjectAccessManager';

const ProjectList = () => {
  const router = useRouter();
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
      const response = await api.get('/projects');
      setProjects(response.data.tasks || []);
      
      // Fetch surface area totals and progress for each project
      const totals = {};
      const progress = {};
      await Promise.all(
        (response.data.tasks || []).map(async (project) => {
          try {
            // Fetch structural elements for this project to get area data
          const elementsResponse = await api.get(`/structural-elements?project=${project._id}&limit=10000`);
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
            const jobsResponse = await api.get(`/jobs?project=${project._id}`);
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
      await api.delete(`/projects/${projectToDelete._id}`);
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
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        py: 3
      }}
    >
      <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2, md: 3 } }}>
        {/* Header Section */}
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
            <Assessment sx={{ fontSize: { xs: 40, sm: 50, md: 60 }, mb: 2, color: '#7b2ff7' }} />
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
              "Excellence is not a destination; it is a continuous journey that never ends."
            </Typography>
          </Box>
        </Paper>

        {/* Create New Project Button Section */}
        {user?.role === 'admin' && (
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box 
                  sx={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 2, 
                    background: 'linear-gradient(135deg, #7b2ff7 0%, #f107a3 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(123, 47, 247, 0.3)'
                  }}
                >
                  <Add sx={{ color: 'white', fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight="bold" sx={{ color: '#6a11cb' }}>
                    Create New Project
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9D50BB', mt: 0.5 }}>
                    Start a new structural engineering project
                  </Typography>
                </Box>
              </Box>
              <Button
                variant="contained"
                size="large"
                startIcon={<Add />}
                onClick={() => router.push('/projects/new')}
                sx={{
                  py: 1.5,
                  px: 4,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #7b2ff7 0%, #f107a3 100%)',
                  boxShadow: '0 4px 12px rgba(123, 47, 247, 0.4)',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 16px rgba(123, 47, 247, 0.5)',
                  }
                }}
              >
                New Project
              </Button>
            </Box>
          </Paper>
        )}

        {/* Statistics Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={4}>
            <Paper 
              elevation={2}
              sx={{ 
                p: { xs: 2, sm: 2.5 }, 
                borderRadius: 2, 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                color: 'white',
                boxShadow: '0 4px 20px rgba(106, 17, 203, 0.3)'
              }}
            >
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
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Paper 
              elevation={2}
              sx={{ 
                p: { xs: 2, sm: 2.5 }, 
                borderRadius: 2, 
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', 
                color: 'white',
                boxShadow: '0 4px 20px rgba(79, 172, 254, 0.3)'
              }}
            >
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
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Paper 
              elevation={2}
              sx={{ 
                p: { xs: 2, sm: 2.5 }, 
                borderRadius: 2, 
                background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', 
                color: 'white',
                boxShadow: '0 4px 20px rgba(250, 112, 154, 0.3)'
              }}
            >
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
            </Paper>
          </Grid>
        </Grid>

        {/* Search and Filters Section */}
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
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Search sx={{ color: '#6a11cb', fontSize: 24 }} />
              <Typography variant="h6" sx={{ color: '#6a11cb', fontWeight: 600 }}>
                Search & Filter Projects
              </Typography>
              {hasActiveFilters && (
                <Chip 
                  label="Filters Active" 
                  sx={{ 
                    bgcolor: '#7b2ff7', 
                    color: 'white',
                    fontWeight: 500
                  }}
                  size="small"
                  onDelete={clearFilters}
                  deleteIcon={<Clear sx={{ color: 'white !important' }} />}
                />
              )}
            </Box>
          </Box>

          {/* Search Bar */}
          <TextField
            fullWidth
            label="Search Projects"
            placeholder="Search by project title or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: '#6a11cb' }} />
                </InputAdornment>
              ),
            }}
            sx={{ 
              mb: 3,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                '& fieldset': {
                  borderColor: '#e0d4ff',
                  borderWidth: 2,
                },
                '&:hover fieldset': {
                  borderColor: '#b794f6',
                  borderWidth: 2,
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#7b2ff7',
                  borderWidth: 2,
                },
              },
              '& .MuiInputLabel-root': {
                color: '#6a11cb',
                fontWeight: 500,
                '&.Mui-focused': {
                  color: '#7b2ff7'
                }
              }
            }}
          />

          {/* Filters Accordion */}
          <Accordion 
            expanded={filtersExpanded} 
            onChange={(e, isExpanded) => setFiltersExpanded(isExpanded)}
            sx={{ 
              boxShadow: 'none', 
              '&:before': { display: 'none' },
              bgcolor: 'transparent'
            }}
          >
            <AccordionSummary 
              expandIcon={<ExpandMore sx={{ color: '#7b2ff7' }} />}
              sx={{ 
                bgcolor: '#f8f7ff', 
                borderRadius: 2,
                border: '2px solid #e0d4ff',
                '&:hover': { bgcolor: '#f0ebff' },
                minHeight: 48,
                '&.Mui-expanded': {
                  minHeight: 48,
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <FilterList sx={{ color: '#7b2ff7' }} />
                <Typography fontWeight="bold" sx={{ color: '#6a11cb' }}>
                  Advanced Filters
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 3, bgcolor: 'white' }}>
              <Grid container spacing={2}>
                {/* Priority Filter */}
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ 
                      color: '#6a11cb',
                      fontWeight: 500,
                      '&.Mui-focused': {
                        color: '#7b2ff7'
                      }
                    }}>
                      Priority
                    </InputLabel>
                    <Select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      label="Priority"
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
                      }}
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
                    <InputLabel sx={{ 
                      color: '#6a11cb',
                      fontWeight: 500,
                      '&.Mui-focused': {
                        color: '#7b2ff7'
                      }
                    }}>
                      Status
                    </InputLabel>
                    <Select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      label="Status"
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
                      }}
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
                    variant="contained"
                    startIcon={<Clear />}
                    onClick={clearAllFilters}
                    disabled={!hasActiveFilters}
                    sx={{ 
                      borderRadius: 2,
                      background: hasActiveFilters ? 'linear-gradient(135deg, #7b2ff7 0%, #f107a3 100%)' : undefined,
                      '&:hover': hasActiveFilters ? {
                        background: 'linear-gradient(135deg, #6a11cb 0%, #d6068a 100%)',
                      } : undefined
                    }}
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
          <Paper 
            elevation={2}
            sx={{ 
              p: 6, 
              textAlign: 'center', 
              borderRadius: 3, 
              bgcolor: 'white',
              boxShadow: '0 4px 20px rgba(106, 17, 203, 0.2)'
            }}
          >
            <Engineering sx={{ fontSize: 80, color: '#e0d4ff', mb: 2 }} />
            <Typography variant="h5" sx={{ color: '#6a11cb' }} gutterBottom>
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
                onClick={() => router.push('/projects/new')}
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
                  onClick={() => {
                    if (user?.role === 'engineer') {
                      router.push(`/projects/${project._id}/jobs`);
                    } else {
                      router.push(`/projects/${createSlug(project.title)}/elements`);
                    }
                  }}
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
                      {user?.role === 'engineer' ? 'View Jobs' : 'View Details'}
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