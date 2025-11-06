import ProtectedRoute from '../../../../components/ProtectedRoute';
import SubProjectDetail from '../../../../components/SubProjects/SubProjectDetail';

export default function SubProjectPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <SubProjectDetail />
    </ProtectedRoute>
  );
}
