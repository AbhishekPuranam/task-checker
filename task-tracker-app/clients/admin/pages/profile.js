import React from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import Navbar from '../components/Navbar';
import ProfileManagement from '../components/Admin/ProfileManagement';

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <Navbar />
      <ProfileManagement />
    </ProtectedRoute>
  );
}
