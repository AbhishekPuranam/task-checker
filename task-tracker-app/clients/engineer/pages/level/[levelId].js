import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Container, Paper, Typography, Box, Grid, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, CircularProgress, Button, Drawer, List, ListItem, ListItemButton, ListItemText,
  IconButton, Divider
} from '@mui/material';
import {
  HourglassEmpty, CheckCircle, Cancel, Search, Refresh, AccountCircle,
  LogoutOutlined, Dashboard as DashboardIcon, ArrowBack
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const DRAWER_WIDTH = 280;

export default function LevelDetailPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { levelId } = router.query;
  const projectId = router.query.project;
  
  // State
  const [projects, setProjects] = useState([]);
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingJob, setUpdatingJob] = useState(null);
  
  // Level metrics
  const [levelStats, setLevelStats] = useState({
    pending: { count: 0, sqm: 0 },
    completed: { count: 0, sqm: 0 },
    not_applicable: { count: 0, sqm: 0 },
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
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  // Filter options
  const [jobTitles, setJobTitles] = useState([]);
  const [grids, setGrids] = useState([]);
  
  // Filtered stats
  const [filteredStats, setFilteredStats] = useState({
    totalJobs: 0,
    totalSqm: 0,
    totalElements: 0
  });

  useEffect(() => {
    fetchProjects();
    if (projectId) {
      fetchLevels();
    }
  }, [projectId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (projectId && levelId) {
      fetchLevelMetrics();
      fetchFilterOptions();
      fetchJobs();
    }
  }, [projectId, levelId, statusFilter, page, rowsPerPage, jobTitleFilter, gridFilter, debouncedSearchTerm]);

  const fetchProjects = async () => {
    try {
      const response = await api.get('/projects');
      const tasks = response.data.tasks || [];
      setProjects(tasks);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchLevels = async () => {
    try {
      const response = await api.get(`/jobs/engineer/levels?project=${projectId}`);
      setLevels(response.data.levels || []);
    } catch (error) {
      console.error('Error fetching levels:', error);
    }
  };

  const fetchLevelMetrics = async () => {
    try {
      const response = await api.get(`/jobs/engineer/metrics?project=${projectId}`);
      const data = response.data;
      
      // For now, using overall metrics - TODO: filter by level
      setLevelStats({
        pending: { 
          count: data.statusBreakdown.pending?.count || 0, 
          sqm: data.statusBreakdown.pending?.sqm || 0
        },
        completed: { 
          count: data.statusBreakdown.completed?.count || 0, 
          sqm: data.statusBreakdown.completed?.sqm || 0
        },
        not_applicable: { 
          count: data.statusBreakdown.not_applicable?.count || 0, 
          sqm: data.statusBreakdown.not_applicable?.sqm || 0
        }
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const statusParam = statusFilter ? `&status=${statusFilter}` : '';
      
      const jobTitlesResponse = await api.get(`/jobs/engineer/groups?project=${projectId}&groupBy=jobTitle${statusParam}`);
      setJobTitles(jobTitlesResponse.data.groups || []);
      
      const gridsResponse = await api.get(`/jobs/engineer/groups?project=${projectId}&groupBy=gridNo${statusParam}`);
      setGrids(gridsResponse.data.groups || []);
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const fetchJobs = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        project: projectId,
        page: page + 1,
        limit: rowsPerPage,
        level: decodeURIComponent(levelId)
      });
      
      if (statusFilter) params.append('status', statusFilter);
      if (jobTitleFilter) params.append('jobTitle', jobTitleFilter);
      if (gridFilter) params.append('gridNo', gridFilter);
      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
      
      const response = await api.get(`/jobs/engineer/jobs?${params.toString()}`);
      
      const jobsData = response.data.jobs || [];
      setJobs(jobsData);
      setTotalJobs(response.data.pagination?.totalJobs || 0);
      
      const totalSqm = jobsData.reduce((sum, job) => sum + (job.structuralElement?.surfaceAreaSqm || 0), 0);
      const uniqueElements = new Set(jobsData.map(job => job.structuralElement?._id)).size;
      
      setFilteredStats({
        totalJobs: response.data.pagination?.totalJobs || 0,
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
      fetchLevelMetrics();
      fetchJobs();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setUpdatingJob(null);
    }
  };

  const clearFilters = () => {
    setJobTitleFilter('');
    setGridFilter('');
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
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            bgcolor: '#1e293b',
            color: 'white'
          },
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DashboardIcon /> Engineer Portal
          </Typography>
        </Box>

        <Box sx={{ p: 2 }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => router.push('/dashboard')}
            sx={{
              color: 'white',
              borderColor: 'rgba(255,255,255,0.2)',
              '&:hover': { borderColor: 'white' },
              mb: 2
            }}
          >
            Dashboard
          </Button>

          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mb: 1, display: 'block' }}>
            PROJECT
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, fontWeight: 'bold' }}>
            {projects.find(p => p._id === projectId)?.title || 'Loading...'}
          </Typography>

          <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)', my: 2 }} />

          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mb: 1, display: 'block' }}>
            LEVELS ({levels.length})
          </Typography>
        </Box>

        <List sx={{ overflow: 'auto', flex: 1 }}>
          {levels.map((level) => (
            <ListItem key={level.level} disablePadding>
              <ListItemButton
                selected={decodeURIComponent(levelId) === level.level}
                onClick={() => router.push(`/level/${encodeURIComponent(level.level)}?project=${projectId}`)}
              >
                <ListItemText
                  primary={level.level}
                  secondary={
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                      <Chip label={level.pendingJobs} size="small" sx={{ bgcolor: '#f59e0b', color: 'white', fontSize: '0.7rem', height: 20 }} />
                      <Chip label={level.completedJobs} size="small" sx={{ bgcolor: '#10b981', color: 'white', fontSize: '0.7rem', height: 20 }} />
                      <Chip label={level.nonClearanceJobs} size="small" sx={{ bgcolor: '#ef4444', color: 'white', fontSize: '0.7rem', height: 20 }} />
                    </Box>
                  }
                  secondaryTypographyProps={{ component: 'div' }}
                  sx={{ '& .MuiListItemText-primary': { color: 'white', fontSize: '0.9rem' } }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <AccountCircle />
            <Typography variant="body2">{user?.name}</Typography>
          </Box>
          <Button
            fullWidth
            variant="outlined"
            onClick={logout}
            startIcon={<LogoutOutlined />}
            sx={{
              color: 'white',
              borderColor: 'rgba(255,255,255,0.2)',
              '&:hover': { borderColor: 'white' }
            }}
          >
            Logout
          </Button>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        {/* Header */}
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            🏗️ {levelId && decodeURIComponent(levelId)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Jobs and elements for this level
          </Typography>
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
                      {levelStats.pending.count}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pending Jobs
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {levelStats.pending.sqm.toFixed(2)} SQM
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
                      {levelStats.completed.count}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completed Jobs
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {levelStats.completed.sqm.toFixed(2)} SQM
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
                      {levelStats.not_applicable.count}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Non Clearance
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {levelStats.not_applicable.sqm.toFixed(2)} SQM
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filtered Results Metrics */}
        {(jobTitleFilter || gridFilter || searchTerm || statusFilter) && (
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

            <Grid item xs={12} md={3}>
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

            <Grid item xs={12} md={4}>
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
                    <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                      <CircularProgress />
                      <Typography sx={{ mt: 2 }}>Loading jobs...</Typography>
                    </TableCell>
                  </TableRow>
                ) : jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
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

          <TablePagination
            component="div"
            count={totalJobs}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[25, 50, 100]}
            sx={{ borderTop: '1px solid #e0e0e0' }}
          />
        </Paper>
      </Box>
    </Box>
  );
}
