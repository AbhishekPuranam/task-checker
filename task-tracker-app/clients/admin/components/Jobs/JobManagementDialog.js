import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Alert,
  TextField,
  Collapse
} from '@mui/material';
import { Close, CheckCircle, Cancel, HourglassEmpty, Add, ExpandMore, ExpandLess, Edit, Delete } from '@mui/icons-material';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const JOB_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'warning', icon: HourglassEmpty },
  { value: 'completed', label: 'Completed', color: 'success', icon: CheckCircle },
  { value: 'not_applicable', label: 'Non-Clearance', color: 'error', icon: Cancel }
];

export default function JobManagementDialog({ open, onClose, element, projectId, onJobsUpdated }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showCustomJobForm, setShowCustomJobForm] = useState(false);
  const [insertAfterJobId, setInsertAfterJobId] = useState(null);
  const [customJobForm, setCustomJobForm] = useState({
    jobTitle: '',
    jobDescription: ''
  });
  const [editingJob, setEditingJob] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);

  useEffect(() => {
    if (open && element) {
      fetchJobs();
    }
  }, [open, element]);

  const fetchJobs = async () => {
    if (!element?._id) return;
    
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      
      const response = await axios.get(`${API_URL}/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          structuralElement: element._id,
          limit: 100
        }
      });
      
      // Sort jobs by orderIndex
      const sortedJobs = (response.data.jobs || []).sort((a, b) => 
        (a.orderIndex || 0) - (b.orderIndex || 0)
      );
      
      setJobs(sortedJobs);
    } catch (err) {
      console.error('Error fetching jobs:', err);
      setError('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (jobId, newStatus) => {
    try {
      setError(null);
      setSuccess(null);
      const token = localStorage.getItem('token');
      
      await axios.put(
        `${API_URL}/jobs/${jobId}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess('Job status updated successfully');
      
      // Refresh jobs list
      await fetchJobs();
      
      // Notify parent component
      if (onJobsUpdated) {
        onJobsUpdated();
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating job status:', err);
      setError(err.response?.data?.message || 'Failed to update job status');
    }
  };

  const handleCreateCustomJob = async () => {
    if (!customJobForm.jobTitle.trim()) {
      setError('Job title is required');
      return;
    }

    // Get project ID from element.project, or use the projectId prop as fallback
    let finalProjectId = projectId;
    if (element?.project) {
      finalProjectId = typeof element.project === 'object' ? element.project._id : element.project;
    }

    console.log('Debug project ID:', {
      'projectId prop': projectId,
      'element.project': element?.project,
      'finalProjectId': finalProjectId
    });

    if (!finalProjectId) {
      setError('Project information is missing. Please close and reopen this dialog.');
      return;
    }

    try {
      setError(null);
      const token = localStorage.getItem('token');
      
      const jobData = {
        structuralElement: element._id,
        project: finalProjectId,
        jobTitle: customJobForm.jobTitle.trim(),
        jobDescription: customJobForm.jobDescription.trim() || customJobForm.jobTitle.trim(),
        insertAfterJobId: insertAfterJobId || undefined
      };

      console.log('Creating custom job with data:', jobData);

      await axios.post(
        `${API_URL}/jobs/custom`,
        jobData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Custom job created successfully');
      
      // Reset form
      setCustomJobForm({ jobTitle: '', jobDescription: '' });
      setShowCustomJobForm(false);
      setInsertAfterJobId(null);
      
      // Refresh jobs list
      await fetchJobs();
      
      // Notify parent component
      if (onJobsUpdated) {
        onJobsUpdated();
      }
    } catch (err) {
      console.error('Error creating custom job:', err);
      const errorMsg = err.response?.data?.message || 'Failed to create custom job';
      setError(errorMsg);
      toast.error(errorMsg);
      toast.error('Failed to create custom job');
    }
  };

  const handleInsertCustomJobAfter = (jobId) => {
    setInsertAfterJobId(jobId);
    setShowCustomJobForm(true);
  };

  const handleEditJob = (job) => {
    setEditingJob({
      _id: job._id,
      jobTitle: job.jobTitle,
      jobDescription: job.jobDescription || ''
    });
    setShowEditDialog(true);
  };

  const handleUpdateJob = async () => {
    if (!editingJob?.jobTitle?.trim()) {
      setError('Job title is required');
      return;
    }

    try {
      setError(null);
      const token = localStorage.getItem('token');
      
      await axios.put(
        `${API_URL}/jobs/${editingJob._id}`,
        {
          jobTitle: editingJob.jobTitle.trim(),
          jobDescription: editingJob.jobDescription.trim() || editingJob.jobTitle.trim()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Job updated successfully');
      setShowEditDialog(false);
      setEditingJob(null);
      
      // Refresh jobs list
      await fetchJobs();
      
      // Notify parent component
      if (onJobsUpdated) {
        onJobsUpdated();
      }
    } catch (err) {
      console.error('Error updating job:', err);
      const errorMsg = err.response?.data?.message || 'Failed to update job';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleDeleteClick = (job) => {
    setJobToDelete(job);
    setShowDeleteDialog(true);
  };

  const handleDeleteJob = async () => {
    if (!jobToDelete) return;

    try {
      setError(null);
      const token = localStorage.getItem('token');
      
      await axios.delete(
        `${API_URL}/jobs/${jobToDelete._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Job deleted successfully');
      setShowDeleteDialog(false);
      setJobToDelete(null);
      
      // Refresh jobs list
      await fetchJobs();
      
      // Notify parent component
      if (onJobsUpdated) {
        onJobsUpdated();
      }
    } catch (err) {
      console.error('Error deleting job:', err);
      const errorMsg = err.response?.data?.message || 'Failed to delete job';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const getStatusInfo = (status) => {
    return JOB_STATUS_OPTIONS.find(opt => opt.value === status) || JOB_STATUS_OPTIONS[0];
  };

  const handleClose = async () => {
    // Refresh element status before closing
    if (element?._id) {
      try {
        const token = localStorage.getItem('token');
        await axios.post(
          `${API_URL}/jobs/refresh-element-status/${element._id}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('Element status refreshed');
      } catch (err) {
        console.error('Error refreshing element status:', err);
        // Don't show error to user, just log it
      }
    }
    
    setError(null);
    setSuccess(null);
    
    // Notify parent to refresh
    if (onJobsUpdated) {
      onJobsUpdated();
    }
    
    onClose();
  };

  return (
    <>
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">Manage Jobs</Typography>
            {element && (
              <Typography variant="body2" color="text.secondary">
                Element: {element.serialNo} - {element.structureNumber}
              </Typography>
            )}
          </Box>
          <IconButton onClick={handleClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}
        
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography>Loading jobs...</Typography>
          </Box>
        ) : jobs.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              No jobs found for this element
            </Typography>
          </Box>
        ) : (
          <List sx={{ py: 0 }}>
            {jobs.map((job, index) => {
              const statusInfo = getStatusInfo(job.status);
              const StatusIcon = statusInfo.icon;
              
              return (
                <Box key={job._id}>
                  {/* Add Job Button Between Jobs */}
                  {index > 0 && (
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'center', 
                      alignItems: 'center',
                      py: 0.5,
                      position: 'relative'
                    }}>
                      <Divider sx={{ position: 'absolute', width: '100%' }} />
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Add />}
                        onClick={() => handleInsertCustomJobAfter(jobs[index - 1]._id)}
                        sx={{
                          zIndex: 1,
                          bgcolor: 'white',
                          px: 2,
                          py: 0.5,
                          borderRadius: 2,
                          fontSize: '0.75rem',
                          textTransform: 'none',
                          fontWeight: 600,
                          borderColor: 'primary.main',
                          color: 'primary.main',
                          '&:hover': {
                            bgcolor: 'primary.50',
                            borderColor: 'primary.dark',
                            transform: 'scale(1.05)',
                          },
                          transition: 'all 0.2s'
                        }}
                      >
                        Add Job Here
                      </Button>
                    </Box>
                  )}
                  
                  <ListItem
                    sx={{
                      py: 2,
                      '&:hover': {
                        backgroundColor: 'grey.50'
                      }
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 30 }}>
                            #{index + 1}
                          </Typography>
                          <StatusIcon 
                            fontSize="small" 
                            color={statusInfo.color}
                          />
                          <Typography variant="subtitle1" fontWeight="600">
                            {job.jobTitle}
                          </Typography>
                          {job.jobType === 'custom' && (
                            <Chip label="Custom" size="small" color="secondary" />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 1, ml: 5 }}>
                          <Typography variant="body2" color="text.secondary">
                            Type: {job.jobType?.replace(/_/g, ' ')}
                          </Typography>
                          {job.jobDescription && job.jobDescription !== job.jobTitle && (
                            <Typography variant="body2" color="text.secondary">
                              {job.jobDescription}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                          <InputLabel>Status</InputLabel>
                          <Select
                            value={job.status || 'pending'}
                            label="Status"
                            onChange={(e) => handleStatusChange(job._id, e.target.value)}
                          >
                            {JOB_STATUS_OPTIONS.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Chip 
                                    label={option.label} 
                                    color={option.color}
                                    size="small"
                                  />
                                </Box>
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        
                        {/* Edit Button */}
                        <IconButton
                          size="small"
                          onClick={() => handleEditJob(job)}
                          sx={{ 
                            color: 'primary.main',
                            '&:hover': { bgcolor: 'primary.50' }
                          }}
                          title="Edit job"
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                        
                        {/* Delete Button - only for custom jobs */}
                        {job.jobType === 'custom' && (
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteClick(job)}
                            sx={{ 
                              color: 'error.main',
                              '&:hover': { bgcolor: 'error.50' }
                            }}
                            title="Delete job"
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                </Box>
              );
            })}
            
            {/* Add Job at the End */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              py: 1,
              mt: 1
            }}>
              <Button
                size="medium"
                variant="contained"
                startIcon={<Add />}
                onClick={() => {
                  if (jobs.length > 0) {
                    handleInsertCustomJobAfter(jobs[jobs.length - 1]._id);
                  } else {
                    setShowCustomJobForm(true);
                    setInsertAfterJobId(null);
                  }
                }}
                sx={{
                  px: 3,
                  py: 1,
                  borderRadius: 2,
                  fontWeight: 600,
                  boxShadow: 2
                }}
              >
                Add Job at End
              </Button>
            </Box>
          </List>
        )}
        
        <Box sx={{ mt: 2, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            <strong>Total Jobs:</strong> {jobs.length} | 
            <strong> Completed:</strong> {jobs.filter(j => j.status === 'completed').length} | 
            <strong> Pending:</strong> {jobs.filter(j => j.status === 'pending' || j.status === 'in_progress').length} |
            <strong> Non-Clearance:</strong> {jobs.filter(j => j.status === 'not_applicable').length}
          </Typography>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
    
    {/* Custom Job Creation Dialog */}
    <Dialog 
      open={showCustomJobForm} 
      onClose={() => {
        setShowCustomJobForm(false);
        setInsertAfterJobId(null);
        setCustomJobForm({ jobTitle: '', jobDescription: '' });
        setError(null);
      }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Create Custom Job</Typography>
          <IconButton 
            onClick={() => {
              setShowCustomJobForm(false);
              setInsertAfterJobId(null);
              setCustomJobForm({ jobTitle: '', jobDescription: '' });
              setError(null);
            }} 
            size="small"
          >
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        {insertAfterJobId && (
          <Alert severity="info" sx={{ mb: 3 }} icon={<Add />}>
            <Typography variant="body2">
              Job will be inserted after: <strong>{jobs.find(j => j._id === insertAfterJobId)?.jobTitle}</strong>
            </Typography>
          </Alert>
        )}
        
        <TextField
          fullWidth
          required
          label="Job Name"
          placeholder="e.g., Custom Inspection, Special Check"
          value={customJobForm.jobTitle}
          onChange={(e) => setCustomJobForm({ ...customJobForm, jobTitle: e.target.value })}
          sx={{ mb: 3 }}
          helperText="Enter a descriptive name for this custom job"
          autoFocus
        />
        
        <TextField
          fullWidth
          label="Job Description"
          placeholder="Enter detailed description (optional)..."
          multiline
          rows={4}
          value={customJobForm.jobDescription}
          onChange={(e) => setCustomJobForm({ ...customJobForm, jobDescription: e.target.value })}
          helperText="Add additional details about this job (optional)"
        />
      </DialogContent>
      
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={() => {
            setShowCustomJobForm(false);
            setInsertAfterJobId(null);
            setCustomJobForm({ jobTitle: '', jobDescription: '' });
            setError(null);
          }}
          variant="outlined"
        >
          Cancel
        </Button>
        <Button
          onClick={handleCreateCustomJob}
          disabled={!customJobForm.jobTitle.trim()}
          variant="contained"
          startIcon={<Add />}
        >
          Create Job
        </Button>
      </DialogActions>
    </Dialog>
    
    {/* Edit Job Dialog */}
    <Dialog 
      open={showEditDialog} 
      onClose={() => {
        setShowEditDialog(false);
        setEditingJob(null);
        setError(null);
      }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Edit Job</Typography>
          <IconButton 
            onClick={() => {
              setShowEditDialog(false);
              setEditingJob(null);
              setError(null);
            }} 
            size="small"
          >
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        <TextField
          fullWidth
          required
          label="Job Name"
          value={editingJob?.jobTitle || ''}
          onChange={(e) => setEditingJob({ ...editingJob, jobTitle: e.target.value })}
          sx={{ mb: 3 }}
          autoFocus
        />
        
        <TextField
          fullWidth
          label="Job Description"
          placeholder="Enter detailed description (optional)..."
          multiline
          rows={4}
          value={editingJob?.jobDescription || ''}
          onChange={(e) => setEditingJob({ ...editingJob, jobDescription: e.target.value })}
        />
      </DialogContent>
      
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={() => {
            setShowEditDialog(false);
            setEditingJob(null);
            setError(null);
          }}
          variant="outlined"
        >
          Cancel
        </Button>
        <Button
          onClick={handleUpdateJob}
          disabled={!editingJob?.jobTitle?.trim()}
          variant="contained"
          startIcon={<Edit />}
        >
          Update Job
        </Button>
      </DialogActions>
    </Dialog>
    
    {/* Delete Confirmation Dialog */}
    <Dialog 
      open={showDeleteDialog} 
      onClose={() => {
        setShowDeleteDialog(false);
        setJobToDelete(null);
      }}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Delete Job</Typography>
          <IconButton 
            onClick={() => {
              setShowDeleteDialog(false);
              setJobToDelete(null);
            }} 
            size="small"
          >
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          This action cannot be undone!
        </Alert>
        <Typography>
          Are you sure you want to delete this job?
        </Typography>
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            {jobToDelete?.jobTitle}
          </Typography>
          {jobToDelete?.jobDescription && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {jobToDelete.jobDescription}
            </Typography>
          )}
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={() => {
            setShowDeleteDialog(false);
            setJobToDelete(null);
          }}
          variant="outlined"
        >
          Cancel
        </Button>
        <Button
          onClick={handleDeleteJob}
          variant="contained"
          color="error"
          startIcon={<Delete />}
        >
          Delete Job
        </Button>
      </DialogActions>
    </Dialog>
  </>
  );
}
