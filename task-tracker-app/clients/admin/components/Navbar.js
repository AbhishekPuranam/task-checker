import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Box,
  Badge,
} from '@mui/material';
import {
  AccountCircle,
  Dashboard,
  Assignment,
  Add,
  AdminPanelSettings,
  Logout,
  MenuBook,
} from '@mui/icons-material';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleClose();
    // Redirect to auth service login (not /admin/login)
    window.location.href = '/login';
  };

  const handleProfile = () => {
    router.push('/profile');
    handleClose();
  };

  // Get default avatar based on role
  const getDefaultAvatar = () => {
    if (user?.role === 'admin') {
      return '/admin/images/admin-avatar.svg';
    }
    return '/admin/images/engineer-avatar.svg';
  };

  const getUserAvatar = () => {
    if (user?.avatar) {
      return user.avatar;
    }
    return getDefaultAvatar();
  };



  return (
    <AppBar position="static" sx={{ 
      background: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)',
      boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)'
    }}>
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Project Tracker
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {user?.role === 'admin' && (
            <Button
              color="inherit"
              startIcon={<Assignment />}
              onClick={() => router.push('/projects')}
            >
              Projects
            </Button>
          )}
          
          {user?.role === 'admin' && (
            <Button
              color="inherit"
              startIcon={<Add />}
              onClick={() => router.push('/projects/new')}
            >
              New Project
            </Button>
          )}

          {user?.role === 'engineer' && (
            <Button
              color="inherit"
              startIcon={<Dashboard />}
              onClick={() => router.push('/jobs')}
            >
              Jobs
            </Button>
          )}

          {user?.role === 'admin' && (
            <Button
              color="inherit"
              startIcon={<AdminPanelSettings />}
              onClick={() => router.push('/users')}
            >
              User Management
            </Button>
          )}

          <Button
            color="inherit"
            startIcon={<MenuBook />}
            onClick={() => router.push('/docs')}
          >
            Documentation
          </Button>

          <IconButton
            size="large"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleMenu}
            color="inherit"
          >
            <Avatar 
              src={getUserAvatar()}
              sx={{ 
                width: 32, 
                height: 32,
                border: '2px solid white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>
          
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleClose}
          >
            <MenuItem onClick={handleProfile}>
              <AccountCircle sx={{ mr: 1 }} />
              Profile
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <Logout sx={{ mr: 1 }} />
              Logout
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;