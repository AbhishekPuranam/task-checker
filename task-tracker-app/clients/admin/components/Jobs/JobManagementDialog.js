import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  ListItem,
  Paper,
  Chip,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Alert,
  Tooltip
} from '@mui/material';
import {
  CheckCircle as CompleteIcon,
  Block as NonClearanceIcon,
  Edit as EditIcon,
  Add as AddIcon,
  DragIndicator as DragIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const JobManagementDialog = ({ open, onClose, element, onJobsUpdated }) => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [addingCustomJob, setAddingCustomJob] = useState(false);
  const [insertAfterJobId, setInsertAfterJobId] = useState(null);
  
  // Custom job form
  const [customJobTitle, setCustomJobTitle] = useState('');
  const [customJobDescription, setCustomJobDescription] = useState('');

  useEffect(() => {
    if (open && element?.jobs) {
      setJobs([...element.jobs]);
      setError('');
    }
  }, [open, element]);

  const getStatusColor = (status) => {
    const colors = {
      pending: 'warning',
      in_progress: 'info',
      completed: 'success',
      on_hold: 'default',
      cancelled: 'error',
      not_applicable: 'secondary'
    };
    return colors[status] || 'default';
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed',
      on_hold: 'On Hold',
      cancelled: 'Cancelled',
      not_applicable: 'Non-Clearance'
    };
    return labels[status] || status;
  };

  const handleStatusChange = async (jobId, newStatus) => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('token');
      const response = await axios.patch(
        `${API_URL}/jobs/${jobId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update local jobs array
      setJobs(jobs.map(job => 
        job._id === jobId ? { ...job, status: newStatus, completedDate: response.data.completedDate } : job
      ));

      if (onJobsUpdated) {
        onJobsUpdated();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update job status');
      console.error('Error updating job status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomJob = async () => {
    if (!customJobTitle.trim() || !customJobDescription.trim()) {
      setError('Job title and description are required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/jobs/custom`,
        {
          structuralElement: element._id,
          project: element.project || element.subProject,
          jobTitle: customJobTitle,
          jobDescription: customJobDescription,
          parentFireproofingType: element.fireProofingWorkflow,
          insertAfterJobId: insertAfterJobId
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Add new job to local array
      const newJob = response.data;
      let updatedJobs = [...jobs];
      
      if (insertAfterJobId) {
        const insertIndex = updatedJobs.findIndex(j => j._id === insertAfterJobId);
        if (insertIndex !== -1) {
          updatedJobs.splice(insertIndex + 1, 0, newJob);
        } else {
          updatedJobs.push(newJob);
        }
      } else {
        updatedJobs.push(newJob);
      }

      setJobs(updatedJobs);
      setCustomJobTitle('');
      setCustomJobDescription('');
      setAddingCustomJob(false);
      setInsertAfterJobId(null);

      if (onJobsUpdated) {
        onJobsUpdated();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create custom job');
      console.error('Error creating custom job:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartAddingJob = (afterJobId) => {
    setInsertAfterJobId(afterJobId);
    setAddingCustomJob(true);
    setError('');
  };

  const handleCancelAddJob = () => {
    setAddingCustomJob(false);
    setInsertAfterJobId(null);
    setCustomJobTitle('');
    setCustomJobDescription('');
    setError('');
  };

  if (!element) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{ sx: { minHeight: '60vh', maxHeight: '90vh' } }}
    >
      <DialogTitle>
        <Box>
          <Typography variant="h6">Job Management</Typography>
          <Typography variant="body2" color="text.secondary">
            {element.structureNumber || element.partMarkNo || 'Element'} - {element.memberType || 'N/A'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {jobs.length} job{jobs.length !== 1 ? 's' : ''} total
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <List sx={{ width: '100%' }}>
          {jobs.map((job, index) => (
            <React.Fragment key={job._id}>
              <Paper 
                elevation={2} 
                sx={{ 
                  p: 2, 
                  mb: 2,
                  backgroundColor: job.status === 'completed' || job.status === 'not_applicable' 
                    ? 'action.hover' 
                    : 'background.paper'
                }}
              >
                <Box display="flex" alignItems="flex-start" gap={2}>
                  {/* Job Number */}
                  <Box 
                    sx={{ 
                      minWidth: 40, 
                      minHeight: 40,
                      borderRadius: '50%',
                      backgroundColor: 'primary.main',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold'
                    }}
                  >
                    {index + 1}
                  </Box>

                  {/* Job Details */}
                  <Box flex={1}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {job.jobTitle}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {job.jobDescription}
                    </Typography>
                    
                    <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
                      <Chip 
                        label={getStatusLabel(job.status)} 
                        color={getStatusColor(job.status)}
                        size="small"
                      />
                      <Chip 
                        label={job.jobType === 'custom' ? 'Custom' : job.jobType.replace(/_/g, ' ')} 
                        variant="outlined"
                        size="small"
                      />
                      {job.stepNumber && (
                        <Chip 
                          label={`Step ${job.stepNumber}${job.totalSteps ? `/${job.totalSteps}` : ''}`}
                          variant="outlined"
                          size="small"
                        />
                      )}
                    </Box>
                  </Box>

                  {/* Actions */}
                  <Box display="flex" flexDirection="column" gap={1}>
                    {job.status !== 'completed' && (
                      <Tooltip title="Mark Complete">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleStatusChange(job._id, 'completed')}
                          disabled={loading}
                        >
                          <CompleteIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    
                    {job.status !== 'not_applicable' && job.status !== 'completed' && (
                      <Tooltip title="Mark Non-Clearance">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleStatusChange(job._id, 'not_applicable')}
                          disabled={loading}
                        >
                          <NonClearanceIcon />
                        </IconButton>
                      </Tooltip>
                    )}

                    {job.status !== 'completed' && job.status !== 'not_applicable' && (
                      <Tooltip title="Add Custom Job After This">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleStartAddingJob(job._id)}
                          disabled={loading || addingCustomJob}
                        >
                          <AddIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              </Paper>

              {/* Custom Job Form (appears after this job) */}
              {addingCustomJob && insertAfterJobId === job._id && (
                <Paper 
                  elevation={3} 
                  sx={{ 
                    p: 2, 
                    mb: 2, 
                    ml: 4,
                    backgroundColor: 'info.lighter',
                    border: '2px dashed',
                    borderColor: 'primary.main'
                  }}
                >
                  <Typography variant="subtitle2" color="primary" gutterBottom>
                    ➕ Add Custom Job After "{job.jobTitle}"
                  </Typography>
                  
                  <TextField
                    fullWidth
                    label="Job Title"
                    value={customJobTitle}
                    onChange={(e) => setCustomJobTitle(e.target.value)}
                    margin="dense"
                    size="small"
                    required
                  />
                  
                  <TextField
                    fullWidth
                    label="Job Description"
                    value={customJobDescription}
                    onChange={(e) => setCustomJobDescription(e.target.value)}
                    margin="dense"
                    size="small"
                    multiline
                    rows={2}
                    required
                  />
                  
                  <Box display="flex" gap={1} mt={1}>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={handleAddCustomJob}
                      disabled={loading}
                    >
                      Add Job
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleCancelAddJob}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  </Box>
                </Paper>
              )}
            </React.Fragment>
          ))}

          {/* Add job at the end */}
          {!addingCustomJob && (
            <Button
              fullWidth
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => handleStartAddingJob(null)}
              disabled={loading}
              sx={{ mt: 1 }}
            >
              Add Custom Job at End
            </Button>
          )}

          {addingCustomJob && insertAfterJobId === null && (
            <Paper 
              elevation={3} 
              sx={{ 
                p: 2, 
                mt: 2,
                backgroundColor: 'info.lighter',
                border: '2px dashed',
                borderColor: 'primary.main'
              }}
            >
              <Typography variant="subtitle2" color="primary" gutterBottom>
                ➕ Add Custom Job at End
              </Typography>
              
              <TextField
                fullWidth
                label="Job Title"
                value={customJobTitle}
                onChange={(e) => setCustomJobTitle(e.target.value)}
                margin="dense"
                size="small"
                required
              />
              
              <TextField
                fullWidth
                label="Job Description"
                value={customJobDescription}
                onChange={(e) => setCustomJobDescription(e.target.value)}
                margin="dense"
                size="small"
                multiline
                rows={2}
                required
              />
              
              <Box display="flex" gap={1} mt={1}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddCustomJob}
                  disabled={loading}
                >
                  Add Job
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleCancelAddJob}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </Box>
            </Paper>
          )}
        </List>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default JobManagementDialog;
