import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  Assignment,
  Schedule,
  CheckCircle,
  Cancel,
  Add,
  TrendingUp,
  Person,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentProjects, setRecentProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [projectsResponse, statsResponse] = await Promise.all([
        api.get('/api/projects?limit=5&sortBy=createdAt&sortOrder=desc'),
        user.role === 'admin' ? api.get('/api/projects/stats/overview') : Promise.resolve({ data: null })
      ]);

      setRecentProjects(projectsResponse.data.tasks);
      if (statsResponse.data) {
        setStats(statsResponse.data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'complete': return 'success';
      case 'pending': return 'warning';
      case 'in_progress': return 'info'; // fallback
      case 'completed': return 'success'; // fallback
      case 'cancelled': return 'error'; // fallback
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'complete': return <CheckCircle />;
      case 'pending': return <Schedule />;
      case 'in_progress': return <TrendingUp />; // fallback
      case 'completed': return <CheckCircle />; // fallback
      case 'cancelled': return <Cancel />; // fallback
      default: return <Assignment />;
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      {/* Hero Section */}
      <Box 
        sx={{ 
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.9) 0%, rgba(118, 75, 162, 0.9) 100%)',
          color: 'white',
          py: 8,
          textAlign: 'center',
        }}
      >
        <Container maxWidth="lg">
          <Typography 
            variant="h2" 
            fontWeight="bold" 
            gutterBottom
            sx={{
              fontSize: { xs: '2rem', md: '3.5rem' },
              mb: 2,
            }}
          >
            Welcome back, {user?.name}! 👋
          </Typography>
          <Typography 
            variant="h5" 
            sx={{ 
              opacity: 0.9,
              fontSize: { xs: '1.1rem', md: '1.5rem' },
              mb: 4,
            }}
          >
            Ready to manage your structural engineering projects?
          </Typography>
          
          {/* Quick Action Buttons */}
          <Grid container spacing={2} justifyContent="center" sx={{ mb: 4 }}>
            <Grid item>
              <Button
                variant="contained"
                size="large"
                startIcon={<Add />}
                onClick={() => navigate('/projects/new')}
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(10px)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  px: 3,
                  py: 1.5,
                  borderRadius: 2,
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.3)',
                    transform: 'translateY(-2px)',
                  }
                }}
              >
                Create New Project
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="outlined"
                size="large"
                startIcon={<Assignment />}
                onClick={() => navigate('/projects')}
                sx={{
                  color: 'white',
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                  px: 3,
                  py: 1.5,
                  borderRadius: 2,
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  '&:hover': {
                    borderColor: 'white',
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                    transform: 'translateY(-2px)',
                  }
                }}
              >
                View All Projects
              </Button>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxWidth="lg" sx={{ py: 6, transform: 'translateY(-60px)' }}>
        <Grid container spacing={4}>
          {/* Quick Stats */}
          {user.role === 'admin' && stats && (
            <>
              {stats.statusStats?.map((stat, index) => (
                <Grid item xs={12} sm={6} md={3} key={stat._id}>
                  <Card 
                    sx={{ 
                      height: '100%',
                      background: `linear-gradient(135deg, ${
                        index === 0 ? '#667eea 0%, #764ba2 100%' :
                        index === 1 ? '#f093fb 0%, #f5576c 100%' :
                        index === 2 ? '#4facfe 0%, #00f2fe 100%' :
                        '#fa709a 0%, #fee140 100%'
                      })`,
                      color: 'white',
                      borderRadius: 3,
                      boxShadow: 4,
                      transition: 'all 0.3s ease-in-out',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 8,
                      }
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography variant="h3" fontWeight="bold" gutterBottom>
                            {stat.count}
                          </Typography>
                          <Typography variant="body1" sx={{ opacity: 0.9, fontWeight: 500 }}>
                            {stat._id.replace('_', ' ').toUpperCase()}
                          </Typography>
                        </Box>
                        <Box sx={{ opacity: 0.7 }}>
                          {React.cloneElement(getStatusIcon(stat._id), { sx: { fontSize: 48 } })}
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </>
          )}

          {/* Feature Highlights */}
          <Grid item xs={12}>
            <Paper 
              sx={{ 
                p: 4, 
                borderRadius: 3, 
                boxShadow: 4,
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <Typography variant="h4" fontWeight="bold" gutterBottom color="primary">
                🚀 Platform Features
              </Typography>
              <Grid container spacing={3} sx={{ mt: 2 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center" sx={{ p: 2 }}>
                    <TrendingUp sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                      Project Management
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Organize and track your structural engineering projects with ease
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center" sx={{ p: 2 }}>
                    <Assignment sx={{ fontSize: 60, color: 'secondary.main', mb: 2 }} />
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                      Real-time Analytics
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Monitor progress with comprehensive dashboards and reports
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center" sx={{ p: 2 }}>
                    <Person sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                      Team Collaboration
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Work seamlessly with your engineering team members
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center" sx={{ p: 2 }}>
                    <Schedule sx={{ fontSize: 60, color: 'warning.main', mb: 2 }} />
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                      Task Scheduling
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Efficient task management with deadlines and priorities
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Recent Projects */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recent Projects
            </Typography>
            {recentProjects.length > 0 ? (
              <List>
                {recentProjects.map((project) => (
                  <ListItem
                    key={project._id}
                    button
                    onClick={() => navigate(`/projects/${project._id}/elements`)}
                    className={`project-card ${project.status}`}
                  >
                    <ListItemIcon>
                      {getStatusIcon(project.status)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="subtitle1">
                            {project.title}
                          </Typography>
                          <Chip
                            label={project.status.replace('_', ' ')}
                            color={getStatusColor(project.status)}
                            size="small"
                          />
                          <Chip
                            label={project.priority}
                            variant="outlined"
                            size="small"
                            className={`priority-${project.priority}`}
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            {project.description.substring(0, 100)}...
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            Created: {formatDate(project.createdAt)} • Location: {project.location}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="textSecondary">
                No projects found. Create your first project!
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* User Info */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Your Profile
            </Typography>
            <Box display="flex" flexDirection="column" gap={2}>
              <Box display="flex" alignItems="center" gap={1}>
                <Person />
                <Typography>{user?.name}</Typography>
              </Box>
              <Typography variant="body2" color="textSecondary">
                Role: {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
              </Typography>
              {user?.department && (
                <Typography variant="body2" color="textSecondary">
                  Department: {user.department}
                </Typography>
              )}
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate('/profile')}
              >
                Edit Profile
              </Button>
            </Box>
          </Paper>
        </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Dashboard;