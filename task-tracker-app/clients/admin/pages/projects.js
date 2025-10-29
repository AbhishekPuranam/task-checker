import React from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import Navbar from '../components/Navbar';
import ProjectList from '../components/Tasks/TaskList';

export default function ProjectsPage() {
  return (
    <ProtectedRoute adminOnly={true}>
      <Navbar />
      <ProjectList />
    </ProtectedRoute>
  );
}
