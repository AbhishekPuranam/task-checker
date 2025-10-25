import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Login from './components/Auth/Login';
import Dashboard from './components/Dashboard/Dashboard';
import ProjectList from './components/Tasks/TaskList';
import CreateProject from './components/Tasks/CreateTask';
import StructuralElementsList from './components/StructuralElements/StructuralElementsList';
import UserManagement from './components/Admin/UserManagement';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div className="App">
      {isAuthenticated && <Navbar />}
      
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={!isAuthenticated ? <Login /> : <Navigate to="/projects" />}
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={<Navigate to="/projects" />}
        />
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <ProjectList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/new"
          element={
            <ProtectedRoute adminOnly={true}>
              <CreateProject />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectName/elements"
          element={
            <ProtectedRoute>
              <StructuralElementsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute adminOnly={true}>
              <UserManagement />
            </ProtectedRoute>
          }
        />

        {/* Catch all route */}
        <Route path="*" element={<Navigate to="/projects" />} />
      </Routes>
    </div>
  );
}

export default App;