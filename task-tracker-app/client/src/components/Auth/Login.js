import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Grid,
} from '@mui/material';
import {
  Lock,
  Person,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handlePaste = (e) => {
    // Allow paste functionality
    const pastedText = e.clipboardData.getData('text');
    if (pastedText) {
      setFormData({
        ...formData,
        [e.target.name]: pastedText,
      });
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    const result = await login(formData.username, formData.password);
    
    if (result.success) {
      toast.success('Login successful!');
      navigate('/projects');
    } else {
      setError(result.message);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
      }}
    >
      <Container component="main" maxWidth="md">
        <Grid container spacing={0} sx={{ boxShadow: 24, borderRadius: 3, overflow: 'hidden' }}>
          {/* Left Side - Welcome Panel */}
          <Grid item xs={12} md={6}>
            <Box
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                p: 6,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
              }}
            >
              <Typography variant="h3" fontWeight="bold" gutterBottom>
                🏗️ Project Tracker
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.9, mb: 4 }}>
                Streamline Your Structural Engineering Projects
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <Typography variant="body1" sx={{ opacity: 0.85, mb: 1 }}>
                  ✅ Track structural elements and tasks
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.85, mb: 1 }}>
                  📊 Real-time project insights and reporting
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.85, mb: 1 }}>
                  👥 Collaborate with your engineering team
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.85 }}>
                  📋 Comprehensive project management
                </Typography>
              </Box>
              
              <Typography variant="body2" sx={{ opacity: 0.75, mt: 'auto' }}>
                Trusted by engineering teams worldwide
              </Typography>
            </Box>
          </Grid>

          {/* Right Side - Login Form */}
          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ p: 6, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Typography component="h1" variant="h4" align="center" fontWeight="bold" gutterBottom>
                Welcome Back
              </Typography>
              <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 4 }}>
                Sign in to access your project dashboard
              </Typography>
              
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="username"
                  label="Username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={formData.username}
                  onChange={handleChange}
                  onPaste={handlePaste}
                  InputProps={{
                    startAdornment: <Person sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                  inputProps={{
                    'data-testid': 'username-input',
                    spellCheck: false,
                    autoCorrect: 'off',
                    autoCapitalize: 'off'
                  }}
                />
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="password"
                  label="Password"
                  type="password"
                  id="password"
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: <Lock sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  sx={{ 
                    mt: 3, 
                    mb: 2,
                    py: 1.5,
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
                    boxShadow: '0 3px 5px 2px rgba(25, 118, 210, .3)',
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Login;