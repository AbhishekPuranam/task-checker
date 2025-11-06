import { useState } from 'react';
import { useRouter } from 'next/router';
import ProtectedRoute from '../../../../../components/ProtectedRoute';
import Navbar from '../../../../../components/Navbar';
import ExcelUpload from '../../../../../components/Excel/ExcelUpload';

export default function SubProjectUploadPage() {
  const router = useRouter();
  const { projectId, subProjectId } = router.query;
  const [uploadOpen, setUploadOpen] = useState(true);

  const handleUploadClose = () => {
    setUploadOpen(false);
    // Navigate back to subproject detail page
    if (projectId && subProjectId) {
      router.push(`/projects/${projectId}/subprojects/${subProjectId}`);
    }
  };

  const handleUploadSuccess = () => {
    // Refresh or navigate back after successful upload
    if (projectId && subProjectId) {
      router.push(`/projects/${projectId}/subprojects/${subProjectId}`);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <Navbar />
      <ExcelUpload
        open={uploadOpen}
        onClose={handleUploadClose}
        projectId={projectId}
        subProjectId={subProjectId}
        onUploadSuccess={handleUploadSuccess}
      />
    </ProtectedRoute>
  );
}
