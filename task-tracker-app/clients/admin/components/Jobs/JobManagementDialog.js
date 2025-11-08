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
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  TextField
} from '@mui/material';
import { Close, CheckCircle, Cancel, HourglassEmpty, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const JOB_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'warning', icon: HourglassEmpty, bgColor: '#fff3cd', textColor: '#856404', chipBg: '#ffc107', chipText: 'white' },
  { value: 'completed', label: 'Completed', color: 'success', icon: CheckCircle, bgColor: '#d4edda', textColor: '#155724', chipBg: '#28a745', chipText: 'white' },
  { value: 'not_applicable', label: 'Non-Clearance', color: 'error', icon: Cancel, bgColor: '#f8d7da', textColor: '#721c24', chipBg: '#dc3545', chipText: 'white' }
];

export default function JobManagementDialog({ open, onClose, element, projectId, onJobsUpdated }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
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

  const getStatusInfo = (status) => {
    return JOB_STATUS_OPTIONS.find(opt => opt.value === status) || JOB_STATUS_OPTIONS[0];
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
          jobDescription: editingJob.jobDescription?.trim() || editingJob.jobTitle.trim()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess('Job updated successfully');
      setShowEditDialog(false);
      setEditingJob(null);
      
      // Refresh jobs list
      await fetchJobs();
      
      // Notify parent component
      if (onJobsUpdated) {
        onJobsUpdated();
      }
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating job:', err);
      setError(err.response?.data?.message || 'Failed to update job');
    }
  };

  const handleDeleteClick = (job) => {
    setJobToDelete(job);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!jobToDelete) return;

    try {
      setError(null);
      const token = localStorage.getItem('token');
      
      await axios.delete(
        `${API_URL}/jobs/${jobToDelete._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess('Job deleted successfully');
      setShowDeleteDialog(false);
      setJobToDelete(null);
      
      // Refresh jobs list
      await fetchJobs();
      
      // Notify parent component
      if (onJobsUpdated) {
        onJobsUpdated();
      }
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error deleting job:', err);
      setError(err.response?.data?.message || 'Failed to delete job');
      setShowDeleteDialog(false);
      setJobToDelete(null);
    }
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
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '85vh'
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h5" fontWeight="bold" sx={{ color: '#6a11cb', mb: 1 }}>
              Manage Jobs
            </Typography>
            {element && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip 
                  label={`#${element.serialNo}`} 
                  size="small"
                  sx={{ 
                    fontWeight: 'bold',
                    bgcolor: '#667eea',
                    color: 'white'
                  }}
                />
                <Typography variant="body2" color="text.secondary">
                  {element.structureNumber} • {element.memberType}
                </Typography>
              </Box>
            )}
          </Box>
          <IconButton 
            onClick={handleClose} 
            size="small"
            sx={{
              bgcolor: 'grey.100',
              '&:hover': { bgcolor: 'grey.200' }
            }}
          >
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers sx={{ px: 3, py: 2 }}>
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
          <Box sx={{ 
            textAlign: 'center', 
            py: 6,
            bgcolor: 'grey.50',
            borderRadius: 2
          }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No jobs found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              No jobs have been created for this element yet
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {jobs.map((job, index) => {
              const statusInfo = getStatusInfo(job.status);
              const StatusIcon = statusInfo.icon;
              
              // Determine border color based on status
              let borderColor = '#ffc107'; // pending - yellow
              if (job.status === 'completed') borderColor = '#28a745'; // green
              if (job.status === 'not_applicable') borderColor = '#dc3545'; // red
              
              return (
                <Paper
                  key={job._id}
                  sx={{
                    p: 2,
                    background: 'linear-gradient(to right, rgba(255,255,255,0.95) 0%, rgba(255,255,255,1) 100%)',
                    borderLeft: `5px solid ${borderColor}`,
                    borderRadius: 2,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'translateX(4px)',
                      boxShadow: `0 4px 12px ${borderColor}30`,
                      background: `linear-gradient(to right, ${statusInfo.bgColor} 0%, rgba(255,255,255,1) 100%)`
                    }
                  }}
                >
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2,
                    flexWrap: 'wrap'
                  }}>
                    {/* Job Title & Type */}
                    <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <StatusIcon 
                          fontSize="small" 
                          sx={{ color: borderColor }}
                        />
                        <Typography variant="body1" sx={{ 
                          fontWeight: 'bold', 
                          color: '#333',
                          fontSize: '1rem'
                        }}>
                          {job.jobTitle}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: '#666', fontSize: '0.9rem' }}>
                        {job.jobType?.replace(/_/g, ' ').toUpperCase()}
                      </Typography>
                      {job.jobDescription && job.jobDescription !== job.jobTitle && (
                        <Typography variant="caption" sx={{ color: '#888', display: 'block', mt: 0.5 }}>
                          {job.jobDescription}
                        </Typography>
                      )}
                    </Box>
                    
                    {/* Current Status Chip with Color */}
                    <Chip 
                      label={statusInfo.label}
                      icon={<StatusIcon />}
                      size="medium"
                      sx={{ 
                        bgcolor: statusInfo.chipBg,
                        color: statusInfo.chipText,
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        minWidth: '130px',
                        '& .MuiChip-icon': {
                          color: statusInfo.chipText
                        }
                      }}
                    />
                    {/* Status Change Button */}
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                      <InputLabel>Change Status</InputLabel>
                      <Select
                        value={job.status || 'pending'}
                        label="Change Status"
                        onChange={(e) => handleStatusChange(job._id, e.target.value)}
                        sx={{
                          '& .MuiSelect-select': {
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                          }
                        }}
                      >
                        {JOB_STATUS_OPTIONS.map((option) => {
                          const OptionIcon = option.icon;
                          return (
                            <MenuItem key={option.value} value={option.value}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <OptionIcon fontSize="small" />
                                <Typography variant="body2">{option.label}</Typography>
                              </Box>
                            </MenuItem>
                          );
                        })}
                      </Select>
                    </FormControl>

                    {/* Edit Button */}
                    <IconButton
                      onClick={() => handleEditJob(job)}
                      size="small"
                      sx={{
                        bgcolor: '#2196f3',
                        color: 'white',
                        '&:hover': {
                          bgcolor: '#1976d2',
                          transform: 'scale(1.1)'
                        },
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>

                    {/* Delete Button */}
                    <IconButton
                      onClick={() => handleDeleteClick(job)}
                      size="small"
                      sx={{
                        bgcolor: '#f44336',
                        color: 'white',
                        '&:hover': {
                          bgcolor: '#d32f2f',
                          transform: 'scale(1.1)'
                        },
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}
        
        {/* Summary Footer */}
        {jobs.length > 0 && (
          <Box sx={{ 
            mt: 3, 
            p: 2.5, 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 2,
            display: 'flex',
            justifyContent: 'space-around',
            flexWrap: 'wrap',
            gap: 2
          }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" fontWeight="bold" sx={{ color: 'white' }}>
                {jobs.length}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                Total Jobs
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" fontWeight="bold" sx={{ color: '#4caf50' }}>
                {jobs.filter(j => j.status === 'completed').length}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                Completed
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" fontWeight="bold" sx={{ color: '#ffc107' }}>
                {jobs.filter(j => j.status === 'pending' || j.status === 'in_progress').length}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                Pending
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" fontWeight="bold" sx={{ color: '#f44336' }}>
                {jobs.filter(j => j.status === 'not_applicable').length}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                Non-Clearance
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button 
          onClick={handleClose} 
          variant="contained"
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            fontWeight: 'bold',
            px: 4,
            '&:hover': {
              background: 'linear-gradient(135deg, #5568d3 0%, #63408b 100%)'
            }
          }}
        >
          Close & Refresh
        </Button>
      </DialogActions>
    </Dialog>

    {/* Edit Job Dialog */}
    <Dialog open={showEditDialog} onClose={() => setShowEditDialog(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Job</DialogTitle>
      <DialogContent>
        <TextField
          label="Job Title"
          fullWidth
          value={editingJob?.jobTitle || ''}
          onChange={(e) => setEditingJob({ ...editingJob, jobTitle: e.target.value })}
          margin="normal"
          required
        />
        <TextField
          label="Job Description"
          fullWidth
          multiline
          rows={3}
          value={editingJob?.jobDescription || ''}
          onChange={(e) => setEditingJob({ ...editingJob, jobDescription: e.target.value })}
          margin="normal"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowEditDialog(false)}>Cancel</Button>
        <Button onClick={handleUpdateJob} variant="contained" color="primary">
          Update
        </Button>
      </DialogActions>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} maxWidth="sm">
      <DialogTitle>Confirm Delete</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to delete the job "{jobToDelete?.jobTitle}"?
        </Typography>
        <Alert severity="warning" sx={{ mt: 2 }}>
          <strong>Warning:</strong> This action cannot be undone.
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
        <Button onClick={handleConfirmDelete} variant="contained" color="error">
          Delete
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}
