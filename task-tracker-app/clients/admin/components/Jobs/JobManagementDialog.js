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
import { Close, CheckCircle, Cancel, HourglassEmpty, Add, ExpandMore, ExpandLess } from '@mui/icons-material';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const JOB_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'warning', icon: HourglassEmpty },
  { value: 'completed', label: 'Completed', color: 'success', icon: CheckCircle },
  { value: 'not_applicable', label: 'Non-Clearance', color: 'error', icon: Cancel }
];

export default function JobManagementDialog({ open, onClose, element, onJobsUpdated }) {
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

    if (!element?.project) {
      setError('Project information is missing. Please close and reopen this dialog.');
      return;
    }

    try {
      setError(null);
      const token = localStorage.getItem('token');
      
      // Get project ID - handle both ObjectId and populated project
      const projectId = typeof element.project === 'object' ? element.project._id : element.project;
      
      const jobData = {
        structuralElement: element._id,
        project: projectId,
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
          <List>
            {jobs.map((job, index) => {
              const statusInfo = getStatusInfo(job.status);
              const StatusIcon = statusInfo.icon;
              
              return (
                <Box key={job._id}>
                  {index > 0 && <Divider />}
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
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            Type: {job.jobType?.replace(/_/g, ' ')}
                          </Typography>
                          {job.jobDescription && job.jobDescription !== job.jobTitle && (
                            <Typography variant="body2" color="text.secondary">
                              {job.jobDescription}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary">
                            Order: #{job.orderIndex || 0}
                          </Typography>
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
                        <Button
                          size="small"
                          startIcon={<Add />}
                          onClick={() => handleInsertCustomJobAfter(job._id)}
                          sx={{ minWidth: 'auto' }}
                        >
                          Add After
                        </Button>
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                </Box>
              );
            })}
            
            {/* Add custom job form */}
            <Box sx={{ mt: 3 }}>
              <Divider sx={{ mb: 2 }} />
              <Button
                fullWidth
                variant={showCustomJobForm ? "outlined" : "contained"}
                color={showCustomJobForm ? "error" : "primary"}
                startIcon={showCustomJobForm ? <Close /> : <Add />}
                onClick={() => {
                  setShowCustomJobForm(!showCustomJobForm);
                  if (showCustomJobForm) {
                    setInsertAfterJobId(null);
                    setCustomJobForm({ jobTitle: '', jobDescription: '' });
                    setError(null);
                  }
                }}
                sx={{
                  py: 1.5,
                  fontWeight: 600,
                  boxShadow: showCustomJobForm ? 'none' : 2
                }}
              >
                {showCustomJobForm ? 'Cancel Custom Job' : 'Add Custom Job'}
              </Button>
              
              <Collapse in={showCustomJobForm}>
                <Box sx={{ mt: 3, p: 3, bgcolor: 'primary.50', borderRadius: 2, border: '2px solid', borderColor: 'primary.200' }}>
                  {insertAfterJobId && (
                    <Alert severity="info" sx={{ mb: 2 }} icon={<Add />}>
                      <Typography variant="body2" fontWeight={600}>
                        Job will be inserted after: <strong>{jobs.find(j => j._id === insertAfterJobId)?.jobTitle}</strong>
                      </Typography>
                    </Alert>
                  )}
                  
                  <Typography variant="subtitle2" color="primary" gutterBottom fontWeight={600} sx={{ mb: 2 }}>
                    Create Custom Job
                  </Typography>
                  
                  <TextField
                    fullWidth
                    required
                    label="Job Name"
                    placeholder="e.g., Custom Inspection, Special Check"
                    value={customJobForm.jobTitle}
                    onChange={(e) => setCustomJobForm({ ...customJobForm, jobTitle: e.target.value })}
                    sx={{ 
                      mb: 2,
                      '& .MuiOutlinedInput-root': {
                        bgcolor: 'white'
                      }
                    }}
                    helperText="Enter a descriptive name for this custom job"
                  />
                  <TextField
                    fullWidth
                    label="Job Description"
                    placeholder="Enter detailed description (optional)..."
                    multiline
                    rows={3}
                    value={customJobForm.jobDescription}
                    onChange={(e) => setCustomJobForm({ ...customJobForm, jobDescription: e.target.value })}
                    sx={{ 
                      mb: 3,
                      '& .MuiOutlinedInput-root': {
                        bgcolor: 'white'
                      }
                    }}
                  />
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      onClick={handleCreateCustomJob}
                      disabled={!customJobForm.jobTitle.trim()}
                      sx={{
                        py: 1.5,
                        fontWeight: 600,
                        boxShadow: 3
                      }}
                    >
                      Create Custom Job
                    </Button>
                    <Button
                      variant="outlined"
                      size="large"
                      onClick={() => {
                        setShowCustomJobForm(false);
                        setInsertAfterJobId(null);
                        setCustomJobForm({ jobTitle: '', jobDescription: '' });
                        setError(null);
                      }}
                      sx={{ minWidth: 100 }}
                    >
                      Cancel
                    </Button>
                  </Box>
                </Box>
              </Collapse>
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
  );
}
