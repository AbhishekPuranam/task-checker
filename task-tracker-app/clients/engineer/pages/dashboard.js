import React, { useState, useEffect } from 'react';
import {
  Container, Paper, Typography, Box, AppBar, Toolbar, Button,
  Grid, Card, CardContent, CircularProgress, Chip, Divider, Select, MenuItem, FormControl,
  TextField, InputAdornment, FormControlLabel, Checkbox
} from '@mui/material';
import {
  AccountCircle, LogoutOutlined, Dashboard as DashboardIcon,
  HourglassEmpty, CheckCircle, Cancel, Layers, Search
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import api from '../utils/api';
import toast from 'react-hot-toast';

// Semi-circle gauge component
const SemiCircleGauge = ({ value, total, label, color, icon: Icon }) => {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const radius = 80;
  const strokeWidth = 12;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * Math.PI; // Half circle
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <Card elevation={3} sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2 }}>
          {/* Icon */}
          <Icon sx={{ fontSize: 40, color: color, mb: 2 }} />
          
          {/* Semi-circle gauge */}
          <Box sx={{ position: 'relative', display: 'inline-flex', mb: 2 }}>
            <svg height={radius + strokeWidth} width={(radius + strokeWidth) * 2}>
              {/* Background arc */}
              <path
                d={`M ${strokeWidth / 2},${radius + strokeWidth / 2} A ${normalizedRadius},${normalizedRadius} 0 0,1 ${radius * 2 + strokeWidth / 2},${radius + strokeWidth / 2}`}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
              {/* Progress arc */}
              <path
                d={`M ${strokeWidth / 2},${radius + strokeWidth / 2} A ${normalizedRadius},${normalizedRadius} 0 0,1 ${radius * 2 + strokeWidth / 2},${radius + strokeWidth / 2}`}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
            {/* Percentage in center */}
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -25%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <Typography variant="h3" fontWeight="bold" color={color}>
                {percentage.toFixed(1)}%
              </Typography>
            </Box>
          </Box>
          
          {/* Label and stats */}
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            {label}
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {value.toLocaleString()} of {total.toLocaleString()}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default function EngineerDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  
  // State
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [loading, setLoading] = useState(false);
  const [levels, setLevels] = useState([]);
  const [levelSearch, setLevelSearch] = useState('');
  const [showOnlyNonClearance, setShowOnlyNonClearance] = useState(false);
  
  // Metrics
  const [stats, setStats] = useState({
    pending: { count: 0, sqm: 0, elements: 0 },
    completed: { count: 0, sqm: 0, elements: 0 },
    not_applicable: { count: 0, sqm: 0, elements: 0 },
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
        },
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
      pending: { count: 0, sqm: 0, elements: 0 },
      completed: { count: 0, sqm: 0, elements: 0 },
      not_applicable: { count: 0, sqm: 0, elements: 0 },
      totalJobs: 0,
      completedJobs: 0,
      totalElements: 0,
      completedElements: 0,
      totalSqm: 0,
      completedSqm: 0,
    });
  };

  const filteredLevels = levels.filter(level => {
    const matchesSearch = level.level.toLowerCase().includes(levelSearch.toLowerCase());
    const matchesNonClearance = !showOnlyNonClearance || level.nonClearanceJobs > 0;
    return matchesSearch && matchesNonClearance;
  });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      {/* Top Navigation Bar */}
      <AppBar position="static" sx={{ bgcolor: '#1e293b', boxShadow: 2 }}>
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
            <DashboardIcon />
            <Typography variant="h6">Engineer Portal</Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <Select
                value={selectedProject}
                onChange={(e) => handleProjectChange(e.target.value)}
                displayEmpty
                sx={{
                  color: 'white',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'white' },
                  '.MuiSvgIcon-root': { color: 'white' }
                }}
              >
                <MenuItem value="" disabled>Select Project</MenuItem>
                {projects.map((project) => (
                  <MenuItem key={project._id} value={project._id}>
                    {project.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccountCircle />
              <Typography variant="body2">{user?.name}</Typography>
            </Box>
            
            <Button
              variant="outlined"
              onClick={logout}
              startIcon={<LogoutOutlined />}
              sx={{
                color: 'white',
                borderColor: 'rgba(255,255,255,0.3)',
                '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
              }}
            >
              Logout
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container maxWidth="xl" sx={{ mt: 3, mb: 3 }}>
        {/* Header with Project Selector */}
        <Paper elevation={3} sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)', border: '2px solid #e5e7eb' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 3 }}>
            <Box>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                📊 Dashboard
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Project overview and completion progress
              </Typography>
            </Box>
            <Box sx={{ 
              p: 2, 
              bgcolor: '#3b82f6', 
              borderRadius: 2, 
              boxShadow: 3,
              minWidth: 350
            }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  display: 'block', 
                  mb: 1, 
                  color: 'white', 
                  fontWeight: 'bold',
                  letterSpacing: 1,
                  textTransform: 'uppercase'
                }}
              >
                📁 Select Project
              </Typography>
              <FormControl fullWidth size="large">
                <Select
                  value={selectedProject}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  displayEmpty
                  sx={{
                    bgcolor: 'white',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    '& .MuiOutlinedInput-notchedOutline': { 
                      borderColor: 'white',
                      borderWidth: 2 
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': { 
                      borderColor: '#60a5fa',
                      borderWidth: 2
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { 
                      borderColor: '#3b82f6',
                      borderWidth: 3
                    },
                    boxShadow: 2
                  }}
                >
                  <MenuItem value="" disabled>Select Project</MenuItem>
                  {projects.map((project) => (
                    <MenuItem key={project._id} value={project._id}>
                      {project.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
        </Paper>
        
        {/* Status Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Card sx={{ background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)', border: '3px solid #f59e0b', height: '100%' }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <HourglassEmpty sx={{ fontSize: 60, color: '#f59e0b', mr: 3 }} />
                  <Box>
                    <Typography variant="h2" fontWeight="bold" color="#f59e0b">
                      {stats.pending.count}
                    </Typography>
                    <Typography variant="h5" color="text.secondary" fontWeight="medium">
                      Pending Jobs
                    </Typography>
                  </Box>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="h6" fontWeight="medium" color="text.secondary">
                    SQM
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="#f59e0b">
                    {stats.pending.sqm.toFixed(2)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="h6" fontWeight="medium" color="text.secondary">
                    Elements
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="#f59e0b">
                    {stats.pending.elements}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)', border: '3px solid #10b981', height: '100%' }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <CheckCircle sx={{ fontSize: 60, color: '#10b981', mr: 3 }} />
                  <Box>
                    <Typography variant="h2" fontWeight="bold" color="#10b981">
                      {stats.completed.count}
                    </Typography>
                    <Typography variant="h5" color="text.secondary" fontWeight="medium">
                      Completed Jobs
                    </Typography>
                  </Box>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="h6" fontWeight="medium" color="text.secondary">
                    SQM
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="#10b981">
                    {stats.completed.sqm.toFixed(2)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="h6" fontWeight="medium" color="text.secondary">
                    Elements
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="#10b981">
                    {stats.completed.elements}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)', border: '3px solid #ef4444', height: '100%' }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <Cancel sx={{ fontSize: 60, color: '#ef4444', mr: 3 }} />
                  <Box>
                    <Typography variant="h2" fontWeight="bold" color="#ef4444">
                      {stats.not_applicable.count}
                    </Typography>
                    <Typography variant="h5" color="text.secondary" fontWeight="medium">
                      Non Clearance
                    </Typography>
                  </Box>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="h6" fontWeight="medium" color="text.secondary">
                    SQM
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="#ef4444">
                    {stats.not_applicable.sqm.toFixed(2)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="h6" fontWeight="medium" color="text.secondary">
                    Elements
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="#ef4444">
                    {stats.not_applicable.elements}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Completion Gauges */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Jobs Progress */}
          <Grid item xs={12} md={4}>
            <SemiCircleGauge
              value={stats.completed.count}
              total={stats.totalJobs}
              label="Jobs Completion"
              color="#10b981"
              icon={CheckCircle}
            />
          </Grid>

          {/* Elements Progress */}
          <Grid item xs={12} md={4}>
            <SemiCircleGauge
              value={stats.completed.elements}
              total={stats.totalElements}
              label="Elements Completion"
              color="#3b82f6"
              icon={Layers}
            />
          </Grid>

          {/* SQM Progress */}
          <Grid item xs={12} md={4}>
            <SemiCircleGauge
              value={parseFloat(stats.completed.sqm.toFixed(2))}
              total={parseFloat(stats.totalSqm.toFixed(2))}
              label="SQM Completion"
              color="#f59e0b"
              icon={Cancel}
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 4 }} />

        {/* Building Levels Section */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h5" fontWeight="bold">
              🏢 Building Levels ({filteredLevels.length})
            </Typography>
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={showOnlyNonClearance}
                  onChange={(e) => setShowOnlyNonClearance(e.target.checked)}
                  sx={{
                    color: '#ef4444',
                    '&.Mui-checked': {
                      color: '#ef4444',
                    },
                  }}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body1" fontWeight="medium">
                    Show Only Non-Clearance Levels
                  </Typography>
                  <Chip 
                    label={levels.filter(l => l.nonClearanceJobs > 0).length}
                    size="small"
                    sx={{ 
                      bgcolor: '#ef4444', 
                      color: 'white',
                      fontWeight: 'bold'
                    }}
                  />
                </Box>
              }
            />
          </Box>
          
          {/* Search Bar for Levels */}
          <TextField
            fullWidth
            placeholder="Search levels..."
            value={levelSearch}
            onChange={(e) => setLevelSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{
              bgcolor: 'white',
              borderRadius: 1,
              mb: 3,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#e5e7eb' },
                '&:hover fieldset': { borderColor: '#9ca3af' },
              }
            }}
          />
        </Box>
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress />
          </Box>
        ) : filteredLevels.length === 0 ? (
          <Paper sx={{ p: 5, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              No levels found
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={2} sx={{ mb: 4 }}>
            {filteredLevels.map((level) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={level.level}>
                <Card 
                  onClick={() => handleLevelClick(level)}
                  sx={{ 
                    cursor: 'pointer',
                    height: '100%',
                    transition: 'all 0.3s ease',
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                    border: '3px solid #e5e7eb',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 6,
                      borderColor: '#3b82f6'
                    }
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    {/* Level Name - Large and Centered */}
                    <Box sx={{ textAlign: 'center', mb: 3, pb: 2, borderBottom: '2px solid #e5e7eb' }}>
                      <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 'bold', letterSpacing: 1 }}>
                        LEVEL
                      </Typography>
                      <Typography 
                        variant="h3" 
                        fontWeight="bold" 
                        sx={{ 
                          color: '#1e293b',
                          mt: 0.5
                        }}
                      >
                        {level.level}
                      </Typography>
                    </Box>

                    {/* Large Job Count Cards */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {/* Pending */}
                      <Box sx={{ 
                        bgcolor: '#fff3e0',
                        border: '2px solid #f59e0b',
                        borderRadius: 1,
                        p: 1.5,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <Typography variant="body2" fontWeight="bold" sx={{ color: '#92400e' }}>
                          Pending
                        </Typography>
                        <Typography variant="h4" fontWeight="bold" sx={{ color: '#f59e0b' }}>
                          {level.pendingJobs}
                        </Typography>
                      </Box>

                      {/* Completed */}
                      <Box sx={{ 
                        bgcolor: '#e8f5e9',
                        border: '2px solid #10b981',
                        borderRadius: 1,
                        p: 1.5,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <Typography variant="body2" fontWeight="bold" sx={{ color: '#064e3b' }}>
                          Completed
                        </Typography>
                        <Typography variant="h4" fontWeight="bold" sx={{ color: '#10b981' }}>
                          {level.completedJobs}
                        </Typography>
                      </Box>

                      {/* Non Clearance */}
                      <Box sx={{ 
                        bgcolor: '#fee2e2',
                        border: '2px solid #ef4444',
                        borderRadius: 1,
                        p: 1.5,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <Typography variant="body2" fontWeight="bold" sx={{ color: '#7f1d1d' }}>
                          Non Clearance
                        </Typography>
                        <Typography variant="h4" fontWeight="bold" sx={{ color: '#ef4444' }}>
                          {level.nonClearanceJobs}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  );
}
