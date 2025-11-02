import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Alert,
  Switch,
  FormControlLabel,
  Grid,
  Card,
  CardContent,
  Avatar,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  PersonAdd,
  AdminPanelSettings,
  Engineering,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';

const UserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'site-engineer',
    department: '',
    phoneNumber: '',
    isActive: true,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (user = null) => {
    if (user) {
      setEditMode(true);
      setSelectedUser(user);
      setFormData({
        name: user.name,
        username: user.username,
        email: user.email || '',
        password: '',
        role: user.role,
        department: user.department || '',
        phoneNumber: user.phoneNumber || '',
        isActive: user.isActive,
      });
    } else {
      setEditMode(false);
      setSelectedUser(null);
      setFormData({
        name: '',
        username: '',
        email: '',
        password: '',
        role: 'site-engineer',
        department: '',
        phoneNumber: '',
        isActive: true,
      });
    }
    setOpen(true);
    setError('');
  };

  const handleClose = () => {
    setOpen(false);
    setError('');
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editMode) {
        // Update user
        const updateData = { ...formData };
        if (!updateData.password) {
          delete updateData.password; // Don't update password if not provided
        }
        await api.put(`/users/${selectedUser._id}`, updateData);
        toast.success('User updated successfully');
      } else {
        // Create user
        if (!formData.name || !formData.username || !formData.password) {
          setError('Name, username, and password are required');
          return;
        }
        await api.post('/create-user', formData);
        toast.success('User created successfully');
      }
      
      handleClose();
      fetchUsers();
    } catch (error) {
      setError(error.response?.data?.message || 'Operation failed');
    }
  };

  const getRoleColor = (role) => {
    return role === 'admin' ? 'error' : 'primary';
  };

  const getRoleIcon = (role) => {
    return role === 'admin' ? <AdminPanelSettings /> : <Engineering />;
  };

  const getDefaultAvatar = (role) => {
    if (role === 'admin') {
      return '/admin/images/admin-avatar.svg';
    }
    return '/admin/images/engineer-avatar.svg';
  };

  const getUserAvatar = (user) => {
    if (user?.avatar) {
      return user.avatar;
    }
    return getDefaultAvatar(user?.role);
  };

  if (!user || user.role !== 'admin') {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 8 }}>
          <Alert severity="error">
            Access denied. Admin privileges required.
          </Alert>
        </Box>
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
            p: { xs: 2, sm: 3, md: 4 }, 
            mb: 3, 
            background: 'white', 
            color: '#6a11cb',
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(106, 17, 203, 0.3)'
          }}
        >
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} sx={{ flexWrap: 'wrap' }}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <Box 
                sx={{ 
                  width: { xs: 40, sm: 44, md: 48 }, 
                  height: { xs: 40, sm: 44, md: 48 }, 
                  borderRadius: 2, 
                  background: 'linear-gradient(135deg, #7b2ff7 0%, #f107a3 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(123, 47, 247, 0.3)'
                }}
              >
                <Typography sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>👥</Typography>
              </Box>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#6a11cb', fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem' } }}>
                  User Management
                </Typography>
                <Typography variant="body2" sx={{ color: '#9D50BB', mt: 0.5 }}>
                  Manage system users and access control
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpen()}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                px: 3,
                py: 1,
                borderRadius: 2,
                fontWeight: 'bold',
                textTransform: 'none',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5568d3 0%, #6a3a8a 100%)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 20px rgba(102, 126, 234, 0.5)'
                },
                transition: 'all 0.3s ease'
              }}
            >
              Add User
            </Button>
          </Box>
        </Paper>

        {/* User Stats */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card 
              elevation={3}
              sx={{ 
                borderRadius: 3,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 30px rgba(102, 126, 234, 0.4)'
                }
              }}
            >
              <CardContent>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                  Total Users
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                  {users.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card 
              elevation={3}
              sx={{ 
                borderRadius: 3,
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: 'white',
                boxShadow: '0 4px 20px rgba(240, 147, 251, 0.3)',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 30px rgba(240, 147, 251, 0.4)'
                }
              }}
            >
              <CardContent>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                  Admins
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                  {users.filter(u => u.role === 'admin').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card 
              elevation={3}
              sx={{ 
                borderRadius: 3,
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                color: 'white',
                boxShadow: '0 4px 20px rgba(79, 172, 254, 0.3)',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 30px rgba(79, 172, 254, 0.4)'
                }
              }}
            >
              <CardContent>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                  Site Engineers
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                  {users.filter(u => u.role === 'site-engineer').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card 
              elevation={3}
              sx={{ 
                borderRadius: 3,
                background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                color: 'white',
                boxShadow: '0 4px 20px rgba(67, 233, 123, 0.3)',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 30px rgba(67, 233, 123, 0.4)'
                }
              }}
            >
              <CardContent>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                  Active Users
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                  {users.filter(u => u.isActive).length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Users Table */}
        <Paper 
          elevation={3}
          sx={{ 
            borderRadius: 3,
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(106, 17, 203, 0.2)'
          }}
        >
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Avatar</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Name</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Username</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Email</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Role</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Department</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Created</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow 
                    key={user._id}
                    sx={{
                      '&:hover': {
                        backgroundColor: 'rgba(102, 126, 234, 0.05)'
                      }
                    }}
                  >
                    <TableCell>
                      <Avatar 
                        src={getUserAvatar(user)}
                        sx={{ 
                          width: 40, 
                          height: 40,
                          border: '2px solid #6a11cb',
                          boxShadow: '0 2px 8px rgba(106, 17, 203, 0.2)'
                        }}
                      >
                        {user.name?.charAt(0).toUpperCase()}
                      </Avatar>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{user.name}</TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{user.email || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip
                        icon={getRoleIcon(user.role)}
                        label={user.role === 'site-engineer' ? 'Site Engineer' : 'Admin'}
                        color={getRoleColor(user.role)}
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                    </TableCell>
                    <TableCell>{user.department || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.isActive ? 'Active' : 'Inactive'}
                        color={user.isActive ? 'success' : 'default'}
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleOpen(user)}
                        sx={{
                          color: '#6a11cb',
                          backgroundColor: 'rgba(106, 17, 203, 0.1)',
                          '&:hover': {
                            backgroundColor: 'rgba(106, 17, 203, 0.2)',
                            transform: 'scale(1.1)'
                          },
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Add/Edit User Dialog */}
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editMode ? 'Edit User' : 'Add New User'}
          </DialogTitle>
          <DialogContent>
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
                name="name"
                label="Full Name"
                value={formData.name}
                onChange={handleChange}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="username"
                label="Username"
                value={formData.username}
                onChange={handleChange}
                helperText="Minimum 3 characters"
              />
              <TextField
                margin="normal"
                fullWidth
                name="email"
                label="Email (Optional)"
                type="email"
                value={formData.email}
                onChange={handleChange}
              />
              {!editMode && (
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="password"
                  label="Password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  helperText="Minimum 6 characters"
                />
              )}
              {editMode && (
                <TextField
                  margin="normal"
                  fullWidth
                  name="password"
                  label="New Password (Leave blank to keep current)"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                />
              )}
              <FormControl fullWidth margin="normal">
                <InputLabel>Role</InputLabel>
                <Select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  label="Role"
                >
                  <MenuItem value="site-engineer">Site Engineer</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </Select>
              </FormControl>
              <TextField
                margin="normal"
                fullWidth
                name="department"
                label="Department"
                value={formData.department}
                onChange={handleChange}
              />
              <TextField
                margin="normal"
                fullWidth
                name="phoneNumber"
                label="Phone Number"
                value={formData.phoneNumber}
                onChange={handleChange}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={handleChange}
                    name="isActive"
                  />
                }
                label="Active User"
                sx={{ mt: 2 }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained">
              {editMode ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
};

export default UserManagement;