import React, { useState, useEffect } from 'react';
import {
  Container, Paper, Typography, Box, AppBar, Toolbar, Button, IconButton,
  Grid, Card, CardContent, List, ListItem, ListItemButton, ListItemText,
  Drawer, CircularProgress, Chip, Divider, Select, MenuItem, FormControl
} from '@mui/material';
import {
  AccountCircle, LogoutOutlined, Dashboard as DashboardIcon,
  HourglassEmpty, CheckCircle, Cancel, Layers
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
  
  // Metrics
  const [stats, setStats] = useState({
    pending: { count: 0, sqm: 0, elements: 0 },
    completed: { count: 0, sqm: 0, elements: 0 },
    not_applicable: { count: 0, sqm: 0, elements: 0 },
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
    setStats({
      pending: { count: 0, sqm: 0, elements: 0 },
      completed: { count: 0, sqm: 0, elements: 0 },
      not_applicable: { count: 0, sqm: 0, elements: 0 },
    });
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
            LEVELS ({levels.length})
          </Typography>
        </Box>

        <List sx={{ overflow: 'auto', flex: 1 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress size={24} sx={{ color: 'white' }} />
            </Box>
          ) : (
            levels.map((level) => (
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
            Overview of all levels and job statuses
          </Typography>
        </Paper>

        {/* Metrics Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Card sx={{ background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)', border: '2px solid #f59e0b' }}>
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
            <Card sx={{ background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)', border: '2px solid #10b981' }}>
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
            <Card sx={{ background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)', border: '2px solid #ef4444' }}>
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

        {/* Levels Summary */}
        <Paper elevation={2} sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <Layers />
            <Typography variant="h6" fontWeight="bold">
              All Levels ({levels.length})
            </Typography>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={2}>
              {levels.map((level) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={level.level}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
                    }}
                    onClick={() => handleLevelClick(level)}
                  >
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        {level.level}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                        <Chip
                          label={`${level.pendingJobs} Pending`}
                          size="small"
                          sx={{ bgcolor: '#f59e0b', color: 'white', fontSize: '0.75rem' }}
                        />
                        <Chip
                          label={`${level.completedJobs} Done`}
                          size="small"
                          sx={{ bgcolor: '#10b981', color: 'white', fontSize: '0.75rem' }}
                        />
                        <Chip
                          label={`${level.nonClearanceJobs} NC`}
                          size="small"
                          sx={{ bgcolor: '#ef4444', color: 'white', fontSize: '0.75rem' }}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {level.totalJobs} Total Jobs | {level.elementCount} Elements
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
