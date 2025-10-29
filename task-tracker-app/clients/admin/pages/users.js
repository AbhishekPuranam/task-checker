import React from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import Navbar from '../components/Navbar';
import UserManagement from '../components/Admin/UserManagement';

export default function UsersPage() {
  return (
    <ProtectedRoute adminOnly={true}>
      <Navbar />
      <UserManagement />
    </ProtectedRoute>
  );
}
