import React, { useState, useEffect } from 'react';
import {
  Container, Paper, Typography, Box, AppBar, Toolbar, Button, IconButton,
  Grid, Card, CardContent, List, ListItem, ListItemButton, ListItemText,
  Drawer, CircularProgress, Chip, Divider, Select, MenuItem, FormControl,
  TextField, InputAdornment, LinearProgress
} from '@mui/material';
import {
  AccountCircle, LogoutOutlined, Dashboard as DashboardIcon,
  HourglassEmpty, CheckCircle, Cancel, Layers, Search
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import api from '../utils/api';
import toast from 'react-hot-toast';

const DRAWER_WIDTH = 280;

export default function EngineerDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  
  // State
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [loading, setLoading] = useState(false);
  const [levels, setLevels] = useState([]);
  const [levelSearch, setLevelSearch] = useState('');
  
  // Metrics
  const [stats, setStats] = useState({
    totalJobs: 0,
    completedJobs: 0,
    totalElements: 0,
    completedElements: 0,
    totalSqm: 0,
    completedSqm: 0,
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchMetrics();
      fetchLevels();
    }
  }, [selectedProject]);

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
        totalJobs: data.totalJobs || 0,
        completedJobs: data.statusBreakdown.completed?.count || 0,
        totalElements: data.totalElements || 0,
        completedElements: data.statusBreakdown.completed?.elementCount || 0,
        totalSqm: data.totalSqm || 0,
        completedSqm: data.statusBreakdown.completed?.sqm || 0,
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const fetchLevels = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/jobs/engineer/levels?project=${selectedProject}`);
      setLevels(response.data.levels || []);
    } catch (error) {
      console.error('Error fetching levels:', error);
      toast.error('Failed to fetch levels');
    } finally {
      setLoading(false);
    }
  };

  const handleLevelClick = (level) => {
    router.push(`/level/${encodeURIComponent(level.level)}?project=${selectedProject}`);
  };

  const handleProjectChange = (projectId) => {
    setSelectedProject(projectId);
    setLevels([]);
    setLevelSearch('');
    setStats({
      totalJobs: 0,
      completedJobs: 0,
      totalElements: 0,
      completedElements: 0,
      totalSqm: 0,
      completedSqm: 0,
    });
  };

  const filteredLevels = levels.filter(level => 
    level.level.toLowerCase().includes(levelSearch.toLowerCase())
  );

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
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mb: 1, display: 'block' }}>
            PROJECT
          </Typography>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <Select
              value={selectedProject}
              onChange={(e) => handleProjectChange(e.target.value)}
              sx={{
                color: 'white',
                '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'white' },
                '.MuiSvgIcon-root': { color: 'white' }
              }}
            >
              {projects.map((project) => (
                <MenuItem key={project._id} value={project._id}>
                  {project.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)', my: 2 }} />

          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mb: 1, display: 'block' }}>
            LEVELS ({filteredLevels.length})
          </Typography>
          
          <TextField
            fullWidth
            size="small"
            placeholder="Search levels..."
            value={levelSearch}
            onChange={(e) => setLevelSearch(e.target.value)}
            sx={{
              mb: 1,
              '& .MuiOutlinedInput-root': {
                color: 'white',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                '&.Mui-focused fieldset': { borderColor: 'white' },
              },
              '& .MuiInputBase-input::placeholder': { color: 'rgba(255,255,255,0.5)' }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: 'rgba(255,255,255,0.5)' }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <List sx={{ overflow: 'auto', flex: 1 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress size={24} sx={{ color: 'white' }} />
            </Box>
          ) : filteredLevels.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                No levels found
              </Typography>
            </Box>
          ) : (
            filteredLevels.map((level) => (
              <ListItem key={level.level} disablePadding>
                <ListItemButton onClick={() => handleLevelClick(level)}>
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
            ))
          )}
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
            📊 Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Project completion progress
          </Typography>
        </Paper>

        {/* Race Track Progress Bars */}
        <Grid container spacing={3}>
          {/* Jobs Progress */}
          <Grid item xs={12}>
            <Card elevation={3}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <CheckCircle sx={{ fontSize: 40, color: '#10b981' }} />
                    <Box>
                      <Typography variant="h6" fontWeight="bold">
                        Jobs Completion
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {stats.completedJobs} of {stats.totalJobs} jobs completed
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="h4" fontWeight="bold" color="#10b981">
                    {stats.totalJobs > 0 ? ((stats.completedJobs / stats.totalJobs) * 100).toFixed(1) : 0}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={stats.totalJobs > 0 ? (stats.completedJobs / stats.totalJobs) * 100 : 0}
                  sx={{
                    height: 20,
                    borderRadius: 10,
                    bgcolor: '#e5e7eb',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 10,
                      bgcolor: '#10b981'
                    }
                  }}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Elements Progress */}
          <Grid item xs={12}>
            <Card elevation={3}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Layers sx={{ fontSize: 40, color: '#3b82f6' }} />
                    <Box>
                      <Typography variant="h6" fontWeight="bold">
                        Elements Completion
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {stats.completedElements} of {stats.totalElements} elements completed
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="h4" fontWeight="bold" color="#3b82f6">
                    {stats.totalElements > 0 ? ((stats.completedElements / stats.totalElements) * 100).toFixed(1) : 0}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={stats.totalElements > 0 ? (stats.completedElements / stats.totalElements) * 100 : 0}
                  sx={{
                    height: 20,
                    borderRadius: 10,
                    bgcolor: '#e5e7eb',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 10,
                      bgcolor: '#3b82f6'
                    }
                  }}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* SQM Progress */}
          <Grid item xs={12}>
            <Card elevation={3}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Cancel sx={{ fontSize: 40, color: '#f59e0b' }} />
                    <Box>
                      <Typography variant="h6" fontWeight="bold">
                        SQM Completion
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {stats.completedSqm.toFixed(2)} of {stats.totalSqm.toFixed(2)} SQM completed
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="h4" fontWeight="bold" color="#f59e0b">
                    {stats.totalSqm > 0 ? ((stats.completedSqm / stats.totalSqm) * 100).toFixed(1) : 0}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={stats.totalSqm > 0 ? (stats.completedSqm / stats.totalSqm) * 100 : 0}
                  sx={{
                    height: 20,
                    borderRadius: 10,
                    bgcolor: '#e5e7eb',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 10,
                      bgcolor: '#f59e0b'
                    }
                  }}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
