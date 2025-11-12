import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Paper, Typography, Box, AppBar, Toolbar, Button, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, CircularProgress, Grid, Card, CardContent
} from '@mui/material';
import {
  AccountCircle, LogoutOutlined, Build, CheckCircle, HourglassEmpty,
  Cancel, Search, Refresh
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function EngineerJobsTable() {
  const { user, logout } = useAuth();
  
  // State
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [loading, setLoading] = useState(false);
  const [updatingJob, setUpdatingJob] = useState(null);
  
  // Metrics
  const [stats, setStats] = useState({
    pending: { count: 0, sqm: 0, elements: 0 },
    completed: { count: 0, sqm: 0, elements: 0 },
    not_applicable: { count: 0, sqm: 0, elements: 0 },
  });
  
  // Filtered metrics (based on current filters)
  const [filteredStats, setFilteredStats] = useState({
    totalJobs: 0,
    totalSqm: 0,
    totalElements: 0
  });
  
  // Table data
  const [jobs, setJobs] = useState([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [jobTitleFilter, setJobTitleFilter] = useState('');
  const [gridFilter, setGridFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter options (populated from backend)
  const [jobTitles, setJobTitles] = useState([]);
  const [grids, setGrids] = useState([]);
  const [levels, setLevels] = useState([]);
  
  // Debounced search term
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);
  
  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (selectedProject) {
      fetchMetrics();
      fetchFilterOptions();
      fetchJobs();
    }
  }, [selectedProject, statusFilter, page, rowsPerPage, jobTitleFilter, gridFilter, levelFilter, debouncedSearchTerm]);

  const fetchProjects = async () => {
    try {
      const response = await api.get('/projects');
      const tasks = response.data.tasks || [];
      setProjects(tasks);
      if (tasks.length > 0) {
        setSelectedProject(tasks[0]._id);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to fetch projects');
    }
  };

  const fetchMetrics = async () => {
    try {
      const response = await api.get(`/jobs/engineer/metrics?project=${selectedProject}`);
      const data = response.data;
      
      setStats({
        pending: { 
          count: data.statusBreakdown.pending?.count || 0, 
          sqm: data.statusBreakdown.pending?.sqm || 0,
          elements: data.statusBreakdown.pending?.elementCount || 0
        },
        completed: { 
          count: data.statusBreakdown.completed?.count || 0, 
          sqm: data.statusBreakdown.completed?.sqm || 0,
          elements: data.statusBreakdown.completed?.elementCount || 0
        },
        not_applicable: { 
          count: data.statusBreakdown.not_applicable?.count || 0, 
          sqm: data.statusBreakdown.not_applicable?.sqm || 0,
          elements: data.statusBreakdown.not_applicable?.elementCount || 0
        }
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const statusParam = statusFilter ? `&status=${statusFilter}` : '';
      
      // Fetch unique job titles
      const jobTitlesResponse = await api.get(`/jobs/engineer/groups?project=${selectedProject}&groupBy=jobTitle${statusParam}`);
      setJobTitles(jobTitlesResponse.data.groups || []);
      
      // Fetch unique grids
      const gridsResponse = await api.get(`/jobs/engineer/groups?project=${selectedProject}&groupBy=gridNo${statusParam}`);
      setGrids(gridsResponse.data.groups || []);
      
      // Fetch unique levels
      const levelsResponse = await api.get(`/jobs/engineer/groups?project=${selectedProject}&groupBy=level${statusParam}`);
      setLevels(levelsResponse.data.groups || []);
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const fetchJobs = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        project: selectedProject,
        page: page + 1,
        limit: rowsPerPage
      });
      
      if (statusFilter) params.append('status', statusFilter);
      if (jobTitleFilter) params.append('jobTitle', jobTitleFilter);
      if (gridFilter) params.append('gridNo', gridFilter);
      if (levelFilter) params.append('level', levelFilter);
      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
      
      console.log('🔍 Fetching jobs with filters:', {
        project: selectedProject,
        status: statusFilter,
        jobTitle: jobTitleFilter,
        grid: gridFilter,
        level: levelFilter,
        search: debouncedSearchTerm,
        page: page + 1,
        limit: rowsPerPage
      });
      
      const response = await api.get(`/jobs/engineer/jobs?${params.toString()}`);
      
      const jobsData = response.data.jobs || [];
      setJobs(jobsData);
      setTotalJobs(response.data.pagination?.totalJobs || 0);
      
      // Calculate filtered metrics from current page
      const totalSqm = jobsData.reduce((sum, job) => sum + (job.structuralElement?.surfaceAreaSqm || 0), 0);
      const uniqueElements = new Set(jobsData.map(job => job.structuralElement?._id)).size;
      
      setFilteredStats({
        totalJobs: response.data.pagination?.totalJobs || 0, // Total matching records, not just current page
        totalSqm: totalSqm,
        totalElements: uniqueElements
      });
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (jobId, newStatus) => {
    try {
      setUpdatingJob(jobId);
      
      await api.patch(`/jobs/engineer/${jobId}/status`, { status: newStatus });
      
      toast.success('Status updated successfully!');
      
      // Refresh data
      fetchMetrics();
      fetchJobs();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setUpdatingJob(null);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const clearFilters = () => {
    setJobTitleFilter('');
    setGridFilter('');
    setLevelFilter('');
    setSearchTerm('');
    setPage(0);
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#f59e0b',
      completed: '#10b981',
      not_applicable: '#ef4444'
    };
    return colors[status] || '#9ca3af';
  };

  return (
    <Box sx={{ flexGrow: 1, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar position="static" sx={{ background: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)' }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            🏗️ Site Engineer Portal
          </Typography>
          <Button
            color="inherit"
            onClick={() => window.open('https://projects.sapcindia.com/admin/projects', '_blank')}
            sx={{ mr: 2, textTransform: 'none' }}
          >
            📋 Admin Projects
          </Button>
          <Typography variant="body1" sx={{ mr: 2 }}>
            {user?.name}
          </Typography>
          <IconButton color="inherit" onClick={logout} title="Logout">
            <LogoutOutlined />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 3, mb: 4 }}>
        {/* Project Selection */}
        <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Project</InputLabel>
            <Select
              value={selectedProject}
              onChange={(e) => {
                setSelectedProject(e.target.value);
                setPage(0);
              }}
              label="Project"
            >
              {projects.map((project) => (
                <MenuItem key={project._id} value={project._id}>
                  {project.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Paper>

        {/* Metrics Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Card
              onClick={() => setStatusFilter('pending')}
              sx={{
                cursor: 'pointer',
                background: statusFilter === 'pending' ? 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)' : '#fff',
                border: statusFilter === 'pending' ? '3px solid #f59e0b' : '2px solid #e0e0e0',
                transition: 'all 0.3s',
                '&:hover': { transform: 'scale(1.02)' }
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <HourglassEmpty sx={{ fontSize: 40, color: '#f59e0b', mr: 2 }} />
                  <Box>
                    <Typography variant="h4" fontWeight="bold" color="#f59e0b">
                      {stats.pending.count}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pending Jobs
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {stats.pending.sqm.toFixed(2)} SQM | {stats.pending.elements} Elements
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card
              onClick={() => setStatusFilter('completed')}
              sx={{
                cursor: 'pointer',
                background: statusFilter === 'completed' ? 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' : '#fff',
                border: statusFilter === 'completed' ? '3px solid #10b981' : '2px solid #e0e0e0',
                transition: 'all 0.3s',
                '&:hover': { transform: 'scale(1.02)' }
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <CheckCircle sx={{ fontSize: 40, color: '#10b981', mr: 2 }} />
                  <Box>
                    <Typography variant="h4" fontWeight="bold" color="#10b981">
                      {stats.completed.count}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completed Jobs
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {stats.completed.sqm.toFixed(2)} SQM | {stats.completed.elements} Elements
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card
              onClick={() => setStatusFilter('not_applicable')}
              sx={{
                cursor: 'pointer',
                background: statusFilter === 'not_applicable' ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)' : '#fff',
                border: statusFilter === 'not_applicable' ? '3px solid #ef4444' : '2px solid #e0e0e0',
                transition: 'all 0.3s',
                '&:hover': { transform: 'scale(1.02)' }
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Cancel sx={{ fontSize: 40, color: '#ef4444', mr: 2 }} />
                  <Box>
                    <Typography variant="h4" fontWeight="bold" color="#ef4444">
                      {stats.not_applicable.count}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Non Clearance
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {stats.not_applicable.sqm.toFixed(2)} SQM | {stats.not_applicable.elements} Elements
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filtered Results Metrics Card */}
        {(jobTitleFilter || gridFilter || levelFilter || searchTerm || statusFilter) && (
          <Paper elevation={3} sx={{ p: 2, mb: 3, bgcolor: '#e3f2fd', borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ color: '#1976d2', fontWeight: 'bold' }}>
              📊 Filtered Results
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" fontWeight="bold" color="primary">
                    {filteredStats.totalJobs}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Jobs Shown
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" fontWeight="bold" color="primary">
                    {filteredStats.totalSqm.toFixed(2)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total SQM
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" fontWeight="bold" color="primary">
                    {filteredStats.totalElements}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Unique Elements
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* Filters */}
        <Paper elevation={3} sx={{ p: 3, mb: 2, borderRadius: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Job Title</InputLabel>
                <Select
                  value={jobTitleFilter}
                  onChange={(e) => {
                    setJobTitleFilter(e.target.value);
                    setPage(0);
                  }}
                  label="Job Title"
                >
                  <MenuItem value="">All</MenuItem>
                  {jobTitles.map((title) => (
                    <MenuItem key={title} value={title}>{title}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Grid</InputLabel>
                <Select
                  value={gridFilter}
                  onChange={(e) => {
                    setGridFilter(e.target.value);
                    setPage(0);
                  }}
                  label="Grid"
                >
                  <MenuItem value="">All</MenuItem>
                  {grids.map((grid) => (
                    <MenuItem key={grid} value={grid}>{grid}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Level</InputLabel>
                <Select
                  value={levelFilter}
                  onChange={(e) => {
                    setLevelFilter(e.target.value);
                    setPage(0);
                  }}
                  label="Level"
                >
                  <MenuItem value="">All</MenuItem>
                  {levels.map((level) => (
                    <MenuItem key={level} value={level}>{level}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                onClick={clearFilters}
                startIcon={<Refresh />}
              >
                Clear
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Jobs Table */}
        <Paper elevation={3} sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>Job Title</TableCell>
                  <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>Level</TableCell>
                  <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>Grid</TableCell>
                  <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>Part Mark</TableCell>
                  <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>Length</TableCell>
                  <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>SQM</TableCell>
                  <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>Qty</TableCell>
                  <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>FP Thickness</TableCell>
                  <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>FP Workflow</TableCell>
                  <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold', textAlign: 'center' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                      <CircularProgress />
                      <Typography sx={{ mt: 2 }}>Loading jobs...</Typography>
                    </TableCell>
                  </TableRow>
                ) : jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No jobs found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((job) => (
                    <TableRow
                      key={job._id}
                      sx={{
                        '&:hover': { bgcolor: 'action.hover' },
                        '&:nth-of-type(odd)': { bgcolor: 'grey.50' }
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="600">
                          {job.jobTitle}
                        </Typography>
                      </TableCell>
                      <TableCell>{job.structuralElement?.level || 'N/A'}</TableCell>
                      <TableCell>{job.structuralElement?.gridNo || 'N/A'}</TableCell>
                      <TableCell>{job.structuralElement?.partMarkNo || 'N/A'}</TableCell>
                      <TableCell>{job.structuralElement?.lengthMm ? `${job.structuralElement.lengthMm} mm` : 'N/A'}</TableCell>
                      <TableCell>{job.structuralElement?.surfaceAreaSqm?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell>{job.structuralElement?.qty || 'N/A'}</TableCell>
                      <TableCell>{job.structuralElement?.fireproofingThickness ? `${job.structuralElement.fireproofingThickness} mm` : 'N/A'}</TableCell>
                      <TableCell>{job.structuralElement?.fireProofingWorkflow || 'N/A'}</TableCell>
                      <TableCell>
                        <Chip
                          label={job.status === 'not_applicable' ? 'Non Clearance' : job.status || 'pending'}
                          size="small"
                          sx={{
                            bgcolor: getStatusColor(job.status || 'pending'),
                            color: 'white',
                            fontWeight: 'bold'
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                          <Button
                            size="small"
                            fullWidth
                            variant={job.status === 'pending' ? 'contained' : 'outlined'}
                            onClick={() => handleStatusUpdate(job._id, 'pending')}
                            disabled={updatingJob === job._id}
                            sx={{
                              bgcolor: job.status === 'pending' ? '#f59e0b' : 'transparent',
                              color: job.status === 'pending' ? 'white' : '#f59e0b',
                              borderColor: '#f59e0b',
                              '&:hover': { bgcolor: '#f59e0b', color: 'white' },
                              textTransform: 'none',
                              fontSize: '0.75rem'
                            }}
                          >
                            Pending
                          </Button>
                          <Button
                            size="small"
                            fullWidth
                            variant={job.status === 'completed' ? 'contained' : 'outlined'}
                            onClick={() => handleStatusUpdate(job._id, 'completed')}
                            disabled={updatingJob === job._id}
                            sx={{
                              bgcolor: job.status === 'completed' ? '#10b981' : 'transparent',
                              color: job.status === 'completed' ? 'white' : '#10b981',
                              borderColor: '#10b981',
                              '&:hover': { bgcolor: '#10b981', color: 'white' },
                              textTransform: 'none',
                              fontSize: '0.75rem'
                            }}
                          >
                            Complete
                          </Button>
                          <Button
                            size="small"
                            fullWidth
                            variant={job.status === 'not_applicable' ? 'contained' : 'outlined'}
                            onClick={() => handleStatusUpdate(job._id, 'not_applicable')}
                            disabled={updatingJob === job._id}
                            sx={{
                              bgcolor: job.status === 'not_applicable' ? '#ef4444' : 'transparent',
                              color: job.status === 'not_applicable' ? 'white' : '#ef4444',
                              borderColor: '#ef4444',
                              '&:hover': { bgcolor: '#ef4444', color: 'white' },
                              textTransform: 'none',
                              fontSize: '0.75rem'
                            }}
                          >
                            Non Clearance
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          <TablePagination
            component="div"
            count={totalJobs}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[25, 50, 100]}
            sx={{ borderTop: '1px solid #e0e0e0' }}
          />
        </Paper>
      </Container>
    </Box>
  );
}
