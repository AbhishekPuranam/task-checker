import { useEffect } from 'react';
import { useRouter } from 'next/router';
import ProtectedRoute from '../../../components/ProtectedRoute';
import SubProjectManagement from '../../../components/SubProjects/SubProjectManagement';

export default function ProjectSubProjectsPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <SubProjectManagement />
    </ProtectedRoute>
  );
}
