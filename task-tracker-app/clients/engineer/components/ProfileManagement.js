import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  Grid,
  Avatar,
  IconButton,
  Card,
  CardContent,
  Alert,
} from '@mui/material';
import {
  PhotoCamera,
  Lock as LockIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

const ProfileManagement = () => {
  const { user, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phoneNumber: user?.phoneNumber || '',
    department: user?.department || '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  // Get default avatar based on role
  const getDefaultAvatar = () => {
    if (user?.role === 'admin') {
      return '/engineer/images/admin-avatar.svg';
    }
    return '/engineer/images/engineer-avatar.svg';
  };
  
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || getDefaultAvatar());
  const [avatarFile, setAvatarFile] = useState(null);

  const handleProfileChange = (e) => {
    setProfileData({
      ...profileData,
      [e.target.name]: e.target.value,
    });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value,
    });
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileUpdate = async () => {
    try {
      setLoading(true);
      const formData = new FormData();
      
      Object.keys(profileData).forEach(key => {
        if (profileData[key]) {
          formData.append(key, profileData[key]);
        }
      });

      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      await api.put('/auth/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('Profile updated successfully');
      updateProfile(profileData);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      await api.put('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });

      toast.success('Password changed successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        py: 3
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 1, sm: 2, md: 3 } }}>
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
              <Typography sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>👤</Typography>
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#6a11cb', fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem' } }}>
                My Profile
              </Typography>
              <Typography variant="body2" sx={{ color: '#9D50BB', mt: 0.5 }}>
                Manage your account settings and preferences
              </Typography>
            </Box>
          </Box>
        </Paper>

        <Grid container spacing={3}>
          {/* Profile Picture Card */}
          <Grid item xs={12} md={4}>
            <Card
              elevation={3}
              sx={{
                borderRadius: 3,
                boxShadow: '0 4px 20px rgba(106, 17, 203, 0.2)',
                height: '100%'
              }}
            >
              <CardContent>
                <Typography variant="h6" sx={{ mb: 3, color: '#6a11cb', fontWeight: 'bold' }}>
                  Profile Picture
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ position: 'relative' }}>
                    <Avatar
                      src={avatarPreview}
                      sx={{
                        width: 150,
                        height: 150,
                        border: '4px solid',
                        borderColor: 'primary.main',
                        boxShadow: '0 4px 20px rgba(106, 17, 203, 0.3)'
                      }}
                    >
                      <PersonIcon sx={{ fontSize: 80 }} />
                    </Avatar>
                    <IconButton
                      component="label"
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #5568d3 0%, #6a3a8a 100%)',
                        }
                      }}
                    >
                      <PhotoCamera />
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handleAvatarChange}
                      />
                    </IconButton>
                  </Box>
                  <Typography variant="body2" color="textSecondary" align="center">
                    Click the camera icon to upload a new photo
                    <br />
                    (Max 5MB, JPG, PNG)
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Profile Information Card */}
          <Grid item xs={12} md={8}>
            <Card
              elevation={3}
              sx={{
                borderRadius: 3,
                boxShadow: '0 4px 20px rgba(106, 17, 203, 0.2)',
                mb: 3
              }}
            >
              <CardContent>
                <Typography variant="h6" sx={{ mb: 3, color: '#6a11cb', fontWeight: 'bold' }}>
                  Profile Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Full Name"
                      name="name"
                      value={profileData.name}
                      onChange={handleProfileChange}
                      InputProps={{
                        startAdornment: <PersonIcon sx={{ mr: 1, color: '#6a11cb' }} />,
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '&:hover fieldset': {
                            borderColor: '#6a11cb',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#6a11cb',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#6a11cb',
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Email"
                      name="email"
                      type="email"
                      value={profileData.email}
                      onChange={handleProfileChange}
                      InputProps={{
                        startAdornment: <EmailIcon sx={{ mr: 1, color: '#6a11cb' }} />,
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '&:hover fieldset': {
                            borderColor: '#6a11cb',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#6a11cb',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#6a11cb',
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Phone Number"
                      name="phoneNumber"
                      value={profileData.phoneNumber}
                      onChange={handleProfileChange}
                      InputProps={{
                        startAdornment: <PhoneIcon sx={{ mr: 1, color: '#6a11cb' }} />,
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '&:hover fieldset': {
                            borderColor: '#6a11cb',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#6a11cb',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#6a11cb',
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Department"
                      name="department"
                      value={profileData.department}
                      onChange={handleProfileChange}
                      InputProps={{
                        startAdornment: <BusinessIcon sx={{ mr: 1, color: '#6a11cb' }} />,
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '&:hover fieldset': {
                            borderColor: '#6a11cb',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#6a11cb',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#6a11cb',
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                      Username: <strong>{user?.username}</strong> | Role: <strong>{user?.role}</strong>
                    </Alert>
                  </Grid>
                </Grid>
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleProfileUpdate}
                    disabled={loading}
                    sx={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      px: 4,
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
                    Save Changes
                  </Button>
                </Box>
              </CardContent>
            </Card>

            {/* Change Password Card */}
            <Card
              elevation={3}
              sx={{
                borderRadius: 3,
                boxShadow: '0 4px 20px rgba(106, 17, 203, 0.2)'
              }}
            >
              <CardContent>
                <Typography variant="h6" sx={{ mb: 3, color: '#6a11cb', fontWeight: 'bold' }}>
                  Change Password
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Current Password"
                      name="currentPassword"
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      InputProps={{
                        startAdornment: <LockIcon sx={{ mr: 1, color: '#6a11cb' }} />,
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '&:hover fieldset': {
                            borderColor: '#6a11cb',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#6a11cb',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#6a11cb',
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="New Password"
                      name="newPassword"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      helperText="Minimum 6 characters"
                      InputProps={{
                        startAdornment: <LockIcon sx={{ mr: 1, color: '#6a11cb' }} />,
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '&:hover fieldset': {
                            borderColor: '#6a11cb',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#6a11cb',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#6a11cb',
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Confirm New Password"
                      name="confirmPassword"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      helperText="Re-enter new password"
                      InputProps={{
                        startAdornment: <LockIcon sx={{ mr: 1, color: '#6a11cb' }} />,
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '&:hover fieldset': {
                            borderColor: '#6a11cb',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#6a11cb',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#6a11cb',
                        },
                      }}
                    />
                  </Grid>
                </Grid>
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    startIcon={<LockIcon />}
                    onClick={handlePasswordUpdate}
                    disabled={loading || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                    sx={{
                      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                      color: 'white',
                      px: 4,
                      py: 1,
                      borderRadius: 2,
                      fontWeight: 'bold',
                      textTransform: 'none',
                      boxShadow: '0 4px 12px rgba(240, 147, 251, 0.4)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #d87ee6 0%, #e04458 100%)',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 6px 20px rgba(240, 147, 251, 0.5)'
                      },
                      '&:disabled': {
                        background: 'rgba(0, 0, 0, 0.12)',
                        color: 'rgba(0, 0, 0, 0.26)'
                      },
                      transition: 'all 0.3s ease'
                    }}
                  >
                    Change Password
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default ProfileManagement;
