import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { titleToSlug, getSubProjectUrl } from '../../utils/slug';
import {
  Container,
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
} from '@mui/material';
import { Add, Upload, Download, Folder, ArrowBack, Edit, Delete } from '@mui/icons-material';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function SubProjectManagement() {
  const router = useRouter();
  const { projectId } = router.query;

  const [subProjects, setSubProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [projectStats, setProjectStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedSubProject, setSelectedSubProject] = useState(null);
  const [newSubProject, setNewSubProject] = useState({
    name: '',
    code: '',
    description: '',
    status: 'active'
  });

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Check if projectId looks like a MongoDB ObjectId (24 hex characters)
      const isMongoId = /^[0-9a-fA-F]{24}$/.test(projectId);
      const projectEndpoint = isMongoId 
        ? `${API_URL}/projects/${projectId}`
        : `${API_URL}/projects/by-name/${encodeURIComponent(projectId)}`;
      
      // First, fetch the project to get the actual ID
      const projectRes = await axios.get(projectEndpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const fetchedProject = projectRes.data;
      const actualProjectId = fetchedProject._id;
      
      // Update URL to use slug if we got an ID-based URL
      if (isMongoId && fetchedProject.title) {
        const slug = titleToSlug(fetchedProject.title);
        router.replace(`/projects/${slug}`, undefined, { shallow: true });
      }
      
      // Now fetch subprojects and stats using the actual project ID
      const [subProjectsRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/subprojects/project/${actualProjectId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/subprojects/project/${actualProjectId}/statistics`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setProject(fetchedProject);
      setSubProjects(subProjectsRes.data.subProjects || []);
      setProjectStats(statsRes.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubProject = async (e) => {
    e.preventDefault();
    
    if (!project) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/subprojects`,
        {
          projectId: project._id,
          ...newSubProject
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setShowCreateModal(false);
      setNewSubProject({ name: '', code: '', description: '', status: 'active' });
      fetchData();
    } catch (err) {
      console.error('Error creating SubProject:', err);
      alert(err.response?.data?.error || 'Failed to create SubProject');
    }
  };

  const handleEditSubProject = (subProject, e) => {
    e.stopPropagation();
    setSelectedSubProject(subProject);
    setShowEditModal(true);
  };

  const handleUpdateSubProject = async (e) => {
    e.preventDefault();
    
    if (!selectedSubProject) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/subprojects/${selectedSubProject._id}`,
        {
          name: selectedSubProject.name,
          code: selectedSubProject.code,
          description: selectedSubProject.description,
          status: selectedSubProject.status
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setShowEditModal(false);
      setSelectedSubProject(null);
      fetchData();
    } catch (err) {
      console.error('Error updating SubProject:', err);
      alert(err.response?.data?.error || 'Failed to update SubProject');
    }
  };

  const handleDeleteSubProject = (subProject, e) => {
    e.stopPropagation();
    setSelectedSubProject(subProject);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedSubProject) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/subprojects/${selectedSubProject._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setShowDeleteDialog(false);
      setSelectedSubProject(null);
      fetchData();
    } catch (err) {
      console.error('Error deleting SubProject:', err);
      alert(err.response?.data?.error || 'Failed to delete SubProject. It may contain structural elements.');
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteDialog(false);
    setSelectedSubProject(null);
  };

  const navigateToSubProject = (subProject) => {
    if (!project || !subProject) return;
    const url = getSubProjectUrl(project, subProject);
    router.push(url);
  };

  const navigateToExcelUpload = (subProject) => {
    if (!project || !subProject) return;
    const url = getSubProjectUrl(project, subProject);
    router.push(`${url}/upload`);
  };

  const downloadReport = async (subProjectId, status = null) => {
    if (!project) return;
    
    try {
      const token = localStorage.getItem('token');
      const url = subProjectId
        ? `${API_URL}/reports/excel/subproject/${subProjectId}${status ? `?status=${status}` : ''}`
        : `${API_URL}/reports/excel/project/${project._id}${status ? `?status=${status}` : ''}`;

      window.open(url + `&token=${token}`, '_blank');
    } catch (err) {
      console.error('Error downloading report:', err);
      alert('Failed to download report');
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Paper sx={{ p: 4, bgcolor: '#fee', color: '#c00' }}>
          <Typography variant="h6">Error: {error}</Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Box 
      sx={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        py: 3
      }}
    >
      <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2, md: 3 } }}>
        {/* Project Header */}
        <Paper 
          elevation={3} 
          sx={{ 
            p: { xs: 3, sm: 4, md: 5 }, 
            mb: 3, 
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(106, 17, 203, 0.3)'
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 3 }}>
            <Box>
              <Typography variant="h3" component="h1" fontWeight="bold" sx={{ color: '#6a11cb', mb: 1 }}>
                {project?.title}
              </Typography>
              {project?.description && (
                <Typography variant="body1" sx={{ color: '#666', mb: 1 }}>
                  {project.description}
                </Typography>
              )}
              {project?.location && (
                <Typography variant="body2" sx={{ color: '#999' }}>
                  📍 {project.location}
                </Typography>
              )}
            </Box>
            <Button
              startIcon={<ArrowBack />}
              variant="outlined"
              onClick={() => router.push('/projects')}
              sx={{ borderColor: '#6a11cb', color: '#6a11cb' }}
            >
              Back to Projects
            </Button>
          </Box>
          
          {/* Project-level Statistics */}
          {projectStats && (
            <Grid container spacing={2} sx={{ mt: 2 }}>
              <Grid item xs={6} md={3}>
                <Box sx={{ 
                  background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                  p: 3,
                  borderRadius: 2,
                  border: '1px solid #90caf9'
                }}>
                  <Typography variant="h4" fontWeight="bold" sx={{ color: '#1565c0', mb: 0.5 }}>
                    {projectStats.totalElements || 0}
                  </Typography>
                  <Typography variant="body2" fontWeight="medium" sx={{ color: '#1976d2' }}>
                    Total Elements
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Box sx={{ 
                  background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
                  p: 3,
                  borderRadius: 2,
                  border: '1px solid #81c784'
                }}>
                  <Typography variant="h4" fontWeight="bold" sx={{ color: '#2e7d32', mb: 0.5 }}>
                    {projectStats.completedElements || 0}
                  </Typography>
                  <Typography variant="body2" fontWeight="medium" sx={{ color: '#388e3c' }}>
                    Completed
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#4caf50' }}>
                    {projectStats.totalElements > 0 ? Math.round((projectStats.completedElements / projectStats.totalElements) * 100) : 0}% complete
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Box sx={{ 
                  background: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)',
                  p: 3,
                  borderRadius: 2,
                  border: '1px solid #ce93d8'
                }}>
                  <Typography variant="h4" fontWeight="bold" sx={{ color: '#6a1b9a', mb: 0.5 }}>
                    {projectStats.totalSqm?.toFixed(2) || '0.00'}
                  </Typography>
                  <Typography variant="body2" fontWeight="medium" sx={{ color: '#7b1fa2' }}>
                    Total SQM
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Box sx={{ 
                  background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
                  p: 3,
                  borderRadius: 2,
                  border: '1px solid #ffb74d'
                }}>
                  <Typography variant="h4" fontWeight="bold" sx={{ color: '#e65100', mb: 0.5 }}>
                    {projectStats.completedSqm?.toFixed(2) || '0.00'}
                  </Typography>
                  <Typography variant="body2" fontWeight="medium" sx={{ color: '#ef6c00' }}>
                    Completed SQM
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#f57c00' }}>
                    {projectStats.totalSqm > 0 ? Math.round((projectStats.completedSqm / projectStats.totalSqm) * 100) : 0}% complete
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          )}

          {/* Project-level Actions */}
          <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={() => downloadReport(null)}
              sx={{ 
                bgcolor: '#4caf50', 
                '&:hover': { bgcolor: '#45a049' },
                textTransform: 'none',
                fontWeight: 600
              }}
            >
              Download Full Project Report
            </Button>
            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={() => downloadReport(null, 'active')}
              sx={{ 
                bgcolor: '#2196f3', 
                '&:hover': { bgcolor: '#1976d2' },
                textTransform: 'none',
                fontWeight: 600
              }}
            >
              Active Report
            </Button>
            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={() => downloadReport(null, 'non clearance')}
              sx={{ 
                bgcolor: '#f44336', 
                '&:hover': { bgcolor: '#d32f2f' },
                textTransform: 'none',
                fontWeight: 600
              }}
            >
              Non-Clearance Report
            </Button>
            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={() => downloadReport(null, 'no jobs')}
              sx={{ 
                bgcolor: '#9c27b0', 
                '&:hover': { bgcolor: '#7b1fa2' },
                textTransform: 'none',
                fontWeight: 600
              }}
            >
              No Job Report
            </Button>
            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={() => downloadReport(null, 'complete')}
              sx={{ 
                bgcolor: '#4caf50', 
                '&:hover': { bgcolor: '#45a049' },
                textTransform: 'none',
                fontWeight: 600
              }}
            >
              Complete Report
            </Button>
          </Box>
        </Paper>

        {/* SubProjects Section */}
        <Paper 
          elevation={3} 
          sx={{ 
            p: { xs: 3, sm: 4, md: 5 }, 
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(106, 17, 203, 0.3)'
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" fontWeight="bold" sx={{ color: '#333' }}>
                Sub-Projects
              </Typography>
              <Typography variant="body2" sx={{ color: '#777', mt: 0.5 }}>
                Organize your project into manageable sub-projects
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setShowCreateModal(true)}
              sx={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': { 
                  background: 'linear-gradient(135deg, #5568d3 0%, #63408b 100%)'
                },
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
                py: 1.5
              }}
            >
              Create Sub-Project
            </Button>
          </Box>

          {subProjects.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 10 }}>
              <Folder sx={{ fontSize: 80, color: '#ccc', mb: 2 }} />
              <Typography variant="h5" fontWeight="600" sx={{ color: '#666', mb: 1 }}>
                No Sub-Projects Yet
              </Typography>
              <Typography sx={{ color: '#999', mb: 4 }}>
                Create your first sub-project to start organizing your structural elements.
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setShowCreateModal(true)}
                sx={{ 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  '&:hover': { 
                    background: 'linear-gradient(135deg, #5568d3 0%, #63408b 100%)'
                  },
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 4,
                  py: 1.5
                }}
              >
                Create Your First Sub-Project
              </Button>
            </Box>
          ) : (
            <Grid container spacing={3}>
              {subProjects.map((subProject) => (
                <Grid item xs={12} md={6} lg={4} key={subProject._id}>
                  <Card 
                    sx={{ 
                      height: '100%',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      '&:hover': {
                        boxShadow: '0 12px 24px rgba(106, 17, 203, 0.2)',
                        transform: 'translateY(-4px)',
                        borderColor: '#6a11cb'
                      },
                      border: '1px solid #e0e0e0',
                      borderRadius: 2
                    }}
                    onClick={() => navigateToSubProject(subProject)}
                  >
                    <CardContent sx={{ p: 3 }}>
                      {/* Header Section */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 3 }}>
                        <Typography variant="h6" fontWeight="bold" sx={{ color: '#333' }}>
                          {subProject.name}
                        </Typography>
                        <Chip 
                          label={subProject.status.toUpperCase()}
                          size="small"
                          sx={{
                            bgcolor: subProject.status === 'active' ? '#e8f5e9' : 
                                     subProject.status === 'completed' ? '#f5f5f5' : '#fff3e0',
                            color: subProject.status === 'active' ? '#2e7d32' : 
                                   subProject.status === 'completed' ? '#616161' : '#e65100',
                            border: `1px solid ${subProject.status === 'active' ? '#81c784' : 
                                    subProject.status === 'completed' ? '#bdbdbd' : '#ffb74d'}`,
                            fontWeight: 600
                          }}
                        />
                      </Box>
                      
                      <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
                        Code: <Box component="span" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{subProject.code}</Box>
                      </Typography>

                      {/* Bento Grid Layout */}
                      <Box sx={{ 
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gridTemplateRows: 'auto auto',
                        gap: 1.5,
                        mb: 3
                      }}>
                        {/* Large Upload Button - Spans 2 columns and 2 rows */}
                        <Box sx={{ 
                          gridColumn: 'span 2',
                          gridRow: 'span 2',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          borderRadius: 2,
                          p: 2.5,
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          position: 'relative',
                          overflow: 'hidden',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: '0 12px 24px rgba(102, 126, 234, 0.4)'
                          },
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)',
                            pointerEvents: 'none'
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToExcelUpload(subProject);
                        }}
                        >
                          <Box sx={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 1.5 }}>
                            <Upload sx={{ fontSize: 48, color: 'white', opacity: 0.9 }} />
                            <Typography variant="h6" sx={{ color: 'white', fontWeight: 700, textAlign: 'center' }}>
                              Upload Excel
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', textAlign: 'center', fontSize: '0.7rem' }}>
                              Import structural elements
                            </Typography>
                          </Box>
                        </Box>

                        {/* Total Elements */}
                        <Box sx={{ 
                          bgcolor: '#e3f2fd', 
                          p: 1.5, 
                          borderRadius: 2, 
                          border: '2px solid #90caf9',
                          textAlign: 'center',
                          transition: 'transform 0.2s',
                          '&:hover': { transform: 'scale(1.05)' }
                        }}>
                          <Typography variant="h6" fontWeight="900" sx={{ color: '#1565c0', fontSize: '1.5rem' }}>
                            {subProject.statistics?.totalElements || 0}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 600, fontSize: '0.65rem' }}>
                            Elements
                          </Typography>
                        </Box>

                        {/* Completed Elements */}
                        <Box sx={{ 
                          bgcolor: '#e8f5e9', 
                          p: 1.5, 
                          borderRadius: 2, 
                          border: '2px solid #81c784',
                          textAlign: 'center',
                          transition: 'transform 0.2s',
                          '&:hover': { transform: 'scale(1.05)' }
                        }}>
                          <Typography variant="h6" fontWeight="900" sx={{ color: '#2e7d32', fontSize: '1.5rem' }}>
                            {subProject.statistics?.completedElements || 0}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#388e3c', fontWeight: 600, fontSize: '0.65rem' }}>
                            Completed
                          </Typography>
                        </Box>

                        {/* Total SQM */}
                        <Box sx={{ 
                          bgcolor: '#f3e5f5', 
                          p: 1.5, 
                          borderRadius: 2, 
                          border: '2px solid #ce93d8',
                          textAlign: 'center',
                          transition: 'transform 0.2s',
                          '&:hover': { transform: 'scale(1.05)' }
                        }}>
                          <Typography variant="h6" fontWeight="900" sx={{ color: '#6a1b9a', fontSize: '1.5rem' }}>
                            {subProject.statistics?.totalSqm?.toFixed(1) || 0}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#7b1fa2', fontWeight: 600, fontSize: '0.65rem' }}>
                            Total SQM
                          </Typography>
                        </Box>

                        {/* Completed SQM */}
                        <Box sx={{ 
                          bgcolor: '#fff3e0', 
                          p: 1.5, 
                          borderRadius: 2, 
                          border: '2px solid #ffb74d',
                          textAlign: 'center',
                          transition: 'transform 0.2s',
                          '&:hover': { transform: 'scale(1.05)' }
                        }}>
                          <Typography variant="h6" fontWeight="900" sx={{ color: '#e65100', fontSize: '1.5rem' }}>
                            {subProject.statistics?.completedSqm?.toFixed(1) || 0}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#ef6c00', fontWeight: 600, fontSize: '0.65rem' }}>
                            Completed SQM
                          </Typography>
                        </Box>
                      </Box>

                      {/* Section Status Breakdown */}
                      <Box sx={{ 
                        display: 'flex', 
                        gap: 1.5, 
                        mb: 2.5,
                        flexWrap: 'wrap'
                      }}>
                        <Chip 
                          label={`Active: ${subProject.statistics?.sections?.active?.count || 0}`}
                          size="small"
                          sx={{ 
                            bgcolor: '#e3f2fd', 
                            color: '#1565c0',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            border: '1px solid #90caf9'
                          }}
                        />
                        <Chip 
                          label={`Non-Clearance: ${subProject.statistics?.sections?.nonClearance?.count || 0}`}
                          size="small"
                          sx={{ 
                            bgcolor: '#ffebee', 
                            color: '#c62828',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            border: '1px solid #ef5350'
                          }}
                        />
                        <Chip 
                          label={`No Job: ${subProject.statistics?.sections?.noJob?.count || 0}`}
                          size="small"
                          sx={{ 
                            bgcolor: '#f3e5f5', 
                            color: '#6a1b9a',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            border: '1px solid #ce93d8'
                          }}
                        />
                        <Chip 
                          label={`Complete: ${subProject.statistics?.sections?.complete?.count || 0}`}
                          size="small"
                          sx={{ 
                            bgcolor: '#e8f5e9', 
                            color: '#2e7d32',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            border: '1px solid #81c784'
                          }}
                        />
                      </Box>

                      {/* Action Buttons */}
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          variant="outlined"
                          fullWidth
                          startIcon={<Edit />}
                          onClick={(e) => handleEditSubProject(subProject, e)}
                          sx={{ 
                            borderColor: '#ff9800',
                            color: '#ff9800',
                            '&:hover': { 
                              borderColor: '#f57c00',
                              bgcolor: '#fff3e0'
                            },
                            textTransform: 'none',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outlined"
                          fullWidth
                          startIcon={<Delete />}
                          onClick={(e) => handleDeleteSubProject(subProject, e)}
                          sx={{ 
                            borderColor: '#f44336',
                            color: '#f44336',
                            '&:hover': { 
                              borderColor: '#d32f2f',
                              bgcolor: '#ffebee'
                            },
                            textTransform: 'none',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}
                        >
                          Delete
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>

        {/* Create SubProject Modal */}
        <Dialog 
          open={showCreateModal} 
          onClose={() => setShowCreateModal(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 3 }
          }}
        >
          <DialogTitle sx={{ borderBottom: '1px solid #e0e0e0' }}>
            <Typography variant="h5" fontWeight="bold" sx={{ color: '#333' }}>
              Create New Sub-Project
            </Typography>
            <Typography variant="body2" sx={{ color: '#777', mt: 0.5 }}>
              Add a new sub-project to organize your structural elements
            </Typography>
          </DialogTitle>
          
          <form onSubmit={handleCreateSubProject}>
            <DialogContent sx={{ pt: 3 }}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight="600" sx={{ mb: 1, color: '#333' }}>
                  Name *
                </Typography>
                <TextField
                  fullWidth
                  required
                  value={newSubProject.name}
                  onChange={(e) => setNewSubProject({ ...newSubProject, name: e.target.value })}
                  placeholder="e.g., Building A - Floor 1"
                  variant="outlined"
                />
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight="600" sx={{ mb: 1, color: '#333' }}>
                  Code *
                </Typography>
                <TextField
                  fullWidth
                  required
                  value={newSubProject.code}
                  onChange={(e) => setNewSubProject({ ...newSubProject, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., BA-F1"
                  variant="outlined"
                  inputProps={{ style: { fontFamily: 'monospace' } }}
                />
                <Typography variant="caption" sx={{ color: '#777', mt: 0.5, display: 'block' }}>
                  Unique identifier for this sub-project
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight="600" sx={{ mb: 1, color: '#333' }}>
                  Description
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  value={newSubProject.description}
                  onChange={(e) => setNewSubProject({ ...newSubProject, description: e.target.value })}
                  placeholder="Optional description"
                  variant="outlined"
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight="600" sx={{ mb: 1, color: '#333' }}>
                  Status
                </Typography>
                <TextField
                  fullWidth
                  select
                  value={newSubProject.status}
                  onChange={(e) => setNewSubProject({ ...newSubProject, status: e.target.value })}
                  variant="outlined"
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="on_hold">On Hold</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </TextField>
              </Box>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 3, pt: 2, borderTop: '1px solid #e0e0e0' }}>
              <Button
                onClick={() => setShowCreateModal(false)}
                variant="outlined"
                sx={{ 
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                sx={{ 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  '&:hover': { 
                    background: 'linear-gradient(135deg, #5568d3 0%, #63408b 100%)'
                  },
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3
                }}
              >
                Create Sub-Project
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Edit SubProject Modal */}
        <Dialog 
          open={showEditModal} 
          onClose={() => setShowEditModal(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 3 }
          }}
        >
          <DialogTitle sx={{ borderBottom: '1px solid #e0e0e0' }}>
            <Typography variant="h5" fontWeight="bold" sx={{ color: '#333' }}>
              Edit Sub-Project
            </Typography>
            <Typography variant="body2" sx={{ color: '#777', mt: 0.5 }}>
              Update sub-project details
            </Typography>
          </DialogTitle>
          
          <form onSubmit={handleUpdateSubProject}>
            <DialogContent sx={{ pt: 3 }}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight="600" sx={{ mb: 1, color: '#333' }}>
                  Name *
                </Typography>
                <TextField
                  fullWidth
                  required
                  value={selectedSubProject?.name || ''}
                  onChange={(e) => setSelectedSubProject({ ...selectedSubProject, name: e.target.value })}
                  placeholder="e.g., Building A - Floor 1"
                  variant="outlined"
                />
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight="600" sx={{ mb: 1, color: '#333' }}>
                  Code *
                </Typography>
                <TextField
                  fullWidth
                  required
                  value={selectedSubProject?.code || ''}
                  onChange={(e) => setSelectedSubProject({ ...selectedSubProject, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., BA-F1"
                  variant="outlined"
                  inputProps={{ style: { fontFamily: 'monospace' } }}
                />
                <Typography variant="caption" sx={{ color: '#777', mt: 0.5, display: 'block' }}>
                  Unique identifier for this sub-project
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight="600" sx={{ mb: 1, color: '#333' }}>
                  Description
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  value={selectedSubProject?.description || ''}
                  onChange={(e) => setSelectedSubProject({ ...selectedSubProject, description: e.target.value })}
                  placeholder="Optional description"
                  variant="outlined"
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight="600" sx={{ mb: 1, color: '#333' }}>
                  Status
                </Typography>
                <TextField
                  fullWidth
                  select
                  value={selectedSubProject?.status || 'active'}
                  onChange={(e) => setSelectedSubProject({ ...selectedSubProject, status: e.target.value })}
                  variant="outlined"
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="on_hold">On Hold</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </TextField>
              </Box>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 3, pt: 2, borderTop: '1px solid #e0e0e0' }}>
              <Button
                onClick={() => setShowEditModal(false)}
                variant="outlined"
                sx={{ 
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                sx={{ 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  '&:hover': { 
                    background: 'linear-gradient(135deg, #5568d3 0%, #63408b 100%)'
                  },
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3
                }}
              >
                Update Sub-Project
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={showDeleteDialog}
          onClose={handleCancelDelete}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 3 }
          }}
        >
          <DialogTitle sx={{ borderBottom: '1px solid #e0e0e0' }}>
            <Typography variant="h5" fontWeight="bold" sx={{ color: '#d32f2f' }}>
              Delete Sub-Project
            </Typography>
          </DialogTitle>
          
          <DialogContent sx={{ pt: 3 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Are you sure you want to delete <strong>{selectedSubProject?.name}</strong>?
            </Typography>
            <Typography variant="body2" sx={{ color: '#f57c00', bgcolor: '#fff3e0', p: 2, borderRadius: 1 }}>
              ⚠️ Warning: This action cannot be undone. The sub-project can only be deleted if it contains no structural elements.
            </Typography>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 3, pt: 2, borderTop: '1px solid #e0e0e0' }}>
            <Button
              onClick={handleCancelDelete}
              variant="outlined"
              sx={{ 
                textTransform: 'none',
                fontWeight: 600,
                px: 3
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              variant="contained"
              sx={{ 
                bgcolor: '#d32f2f',
                '&:hover': { 
                  bgcolor: '#c62828'
                },
                textTransform: 'none',
                fontWeight: 600,
                px: 3
              }}
            >
              Delete Sub-Project
            </Button>
            </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}
