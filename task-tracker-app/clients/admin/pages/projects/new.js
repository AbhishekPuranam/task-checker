import React from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import Navbar from '../../components/Navbar';
import CreateProject from '../../components/Tasks/CreateTask';

export default function NewProjectPage() {
  return (
    <ProtectedRoute adminOnly={true}>
      <Navbar />
      <CreateProject />
    </ProtectedRoute>
  );
}
