import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { CircularProgress, Box } from '@mui/material';
import ProtectedRoute from '../../../../../components/ProtectedRoute';
import Navbar from '../../../../../components/Navbar';
import ExcelUpload from '../../../../../components/Excel/ExcelUpload';
import api from '../../../../../utils/api';

export default function SubProjectUploadPage() {
  const router = useRouter();
  const { projectId: projectSlug, subProjectId: subProjectSlug } = router.query;
  const [uploadOpen, setUploadOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [subProject, setSubProject] = useState(null);

  // Fetch project and subproject by slug to get real IDs
  useEffect(() => {
    const fetchData = async () => {
      if (!projectSlug || !subProjectSlug) return;

      try {
        // Fetch project by name (slug)
        const projectResponse = await api.get(`/projects/by-name/${projectSlug}`);
        const projectData = projectResponse.data;
        setProject(projectData);

        // Fetch subproject by name
        const subProjectResponse = await api.get(`/subprojects/by-name/${projectData._id}/${subProjectSlug}`);
        setSubProject(subProjectResponse.data);

        setLoading(false);
      } catch (error) {
        console.error('Error fetching project/subproject:', error);
        // If not found, navigate back
        router.push('/projects');
      }
    };

    fetchData();
  }, [projectSlug, subProjectSlug]);

  const handleUploadClose = () => {
    setUploadOpen(false);
    // Navigate back to subproject detail page
    if (projectSlug && subProjectSlug) {
      router.push(`/projects/${projectSlug}/subprojects/${subProjectSlug}`);
    }
  };

  const handleUploadSuccess = () => {
    // Refresh or navigate back after successful upload
    if (projectSlug && subProjectSlug) {
      router.push(`/projects/${projectSlug}/subprojects/${subProjectSlug}`);
    }
  };

  if (loading || !project || !subProject) {
    return (
      <ProtectedRoute allowedRoles={['admin']}>
        <Navbar />
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
          <CircularProgress />
        </Box>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <Navbar />
      <ExcelUpload
        open={uploadOpen}
        onClose={handleUploadClose}
        projectId={project._id}
        subProjectId={subProject._id}
        onUploadSuccess={handleUploadSuccess}
      />
    </ProtectedRoute>
  );
}
