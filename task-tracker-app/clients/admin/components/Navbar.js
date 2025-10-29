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
    router.push('/login');
  };

  const handleProfile = () => {
    router.push('/profile');
    handleClose();
  };



  return (
    <AppBar position="static" sx={{ 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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

          <IconButton
            size="large"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleMenu}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32 }}>
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