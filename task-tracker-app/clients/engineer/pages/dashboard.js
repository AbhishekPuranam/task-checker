import React, { useState, useEffect } from 'react';
import {
  Container, Paper, Typography, Box, AppBar, Toolbar, Button,
  Grid, Card, CardContent, CircularProgress, Chip, Divider, Select, MenuItem, FormControl,
  TextField, InputAdornment
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

  const filteredLevels = levels.filter(level => 
    level.level.toLowerCase().includes(levelSearch.toLowerCase())
  );

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
        {/* Header */}
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            📊 Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Project overview and completion progress
          </Typography>
        </Paper>

        {/* Search Bar for Levels */}
        <Box sx={{ mb: 3 }}>
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
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#e5e7eb' },
                '&:hover fieldset': { borderColor: '#9ca3af' },
              }
            }}
          />
        </Box>

        {/* Building Floors - Bento Box Grid */}
        <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 2 }}>
          🏢 Building Levels ({filteredLevels.length})
        </Typography>
        
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
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    background: 'linear-gradient(180deg, #1e293b 0%, #334155 100%)',
                    border: '2px solid #475569',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 6,
                      borderColor: '#64748b'
                    }
                  }}
                >
                  <CardContent sx={{ pb: 2 }}>
                    {/* Floor Number Badge */}
                    <Box sx={{ 
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      bgcolor: 'rgba(255,255,255,0.1)',
                      color: 'white',
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 1,
                      fontSize: '0.75rem',
                      fontWeight: 'bold'
                    }}>
                      LEVEL
                    </Box>

                    {/* Floor Name */}
                    <Typography 
                      variant="h5" 
                      fontWeight="bold" 
                      sx={{ 
                        color: 'white',
                        mb: 2,
                        pr: 6
                      }}
                    >
                      {level.level}
                    </Typography>

                    {/* Building Floor Lines */}
                    <Box sx={{ mb: 2 }}>
                      {[0, 1, 2, 3].map((i) => (
                        <Box 
                          key={i}
                          sx={{ 
                            height: '16px',
                            borderBottom: '2px solid rgba(255,255,255,0.2)',
                            mb: 0.5,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            px: 1
                          }}
                        >
                          {/* Window-like dots */}
                          <Box sx={{ 
                            width: 6, 
                            height: 6, 
                            borderRadius: '50%', 
                            bgcolor: 'rgba(255,255,255,0.3)' 
                          }} />
                          <Box sx={{ 
                            width: 6, 
                            height: 6, 
                            borderRadius: '50%', 
                            bgcolor: 'rgba(255,255,255,0.3)' 
                          }} />
                          <Box sx={{ 
                            width: 6, 
                            height: 6, 
                            borderRadius: '50%', 
                            bgcolor: 'rgba(255,255,255,0.3)' 
                          }} />
                        </Box>
                      ))}
                    </Box>

                    {/* Status Indicators as Floor Sections */}
                    <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                      <Box sx={{ 
                        flex: level.pendingJobs,
                        height: 8,
                        bgcolor: '#f59e0b',
                        borderRadius: 0.5,
                        minWidth: level.pendingJobs > 0 ? 20 : 0
                      }} />
                      <Box sx={{ 
                        flex: level.completedJobs,
                        height: 8,
                        bgcolor: '#10b981',
                        borderRadius: 0.5,
                        minWidth: level.completedJobs > 0 ? 20 : 0
                      }} />
                      <Box sx={{ 
                        flex: level.nonClearanceJobs,
                        height: 8,
                        bgcolor: '#ef4444',
                        borderRadius: 0.5,
                        minWidth: level.nonClearanceJobs > 0 ? 20 : 0
                      }} />
                    </Box>

                    {/* Status Chips */}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
                      <Chip 
                        label={`${level.pendingJobs} Pending`}
                        size="small" 
                        sx={{ 
                          bgcolor: '#f59e0b', 
                          color: 'white', 
                          fontWeight: 'bold',
                          fontSize: '0.75rem'
                        }} 
                      />
                      <Chip 
                        label={`${level.completedJobs} Done`}
                        size="small" 
                        sx={{ 
                          bgcolor: '#10b981', 
                          color: 'white', 
                          fontWeight: 'bold',
                          fontSize: '0.75rem'
                        }} 
                      />
                      <Chip 
                        label={`${level.nonClearanceJobs} NC`}
                        size="small" 
                        sx={{ 
                          bgcolor: '#ef4444', 
                          color: 'white', 
                          fontWeight: 'bold',
                          fontSize: '0.75rem'
                        }} 
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        <Divider sx={{ my: 4 }} />

        {/* Status Cards */}
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

        {/* Completion Gauges */}
        <Grid container spacing={3}>
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
      </Container>
    </Box>
  );
}
