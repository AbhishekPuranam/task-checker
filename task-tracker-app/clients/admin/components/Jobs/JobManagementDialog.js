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
  Alert
} from '@mui/material';
import { Close, CheckCircle, Cancel, HourglassEmpty, Edit as EditIcon } from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const JOB_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'warning', icon: HourglassEmpty, bgColor: '#fff3cd', textColor: '#856404' },
  { value: 'completed', label: 'Completed', color: 'success', icon: CheckCircle, bgColor: '#d4edda', textColor: '#155724' },
  { value: 'not_applicable', label: 'Non-Clearance', color: 'error', icon: Cancel, bgColor: '#f8d7da', textColor: '#721c24' }
];

export default function JobManagementDialog({ open, onClose, element, onJobsUpdated }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

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
                    {/* Order Badge */}
                    <Chip 
                      label={`#${job.orderIndex || index + 1}`} 
                      size="small"
                      sx={{ 
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        bgcolor: borderColor,
                        color: 'white',
                        minWidth: '50px'
                      }}
                    />
                    
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
                    
                    {/* Current Status Badge */}
                    <Box sx={{ 
                      minWidth: '120px',
                      p: 1,
                      bgcolor: statusInfo.bgColor,
                      borderRadius: 1,
                      border: `1px solid ${borderColor}`,
                      textAlign: 'center'
                    }}>
                      <Typography variant="caption" sx={{ 
                        color: statusInfo.textColor, 
                        fontSize: '0.7rem', 
                        display: 'block',
                        fontWeight: 'bold'
                      }}>
                        STATUS
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        color: statusInfo.textColor,
                        fontWeight: 'bold',
                        fontSize: '0.9rem'
                      }}>
                        {statusInfo.label}
                      </Typography>
                    </Box>
                    
                    {/* Status Change Button */}
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                      <InputLabel>Change Status</InputLabel>
                      <Select
                        value={job.status || 'pending'}
                        label="Change Status"
                        onChange={(e) => handleStatusChange(job._id, e.target.value)}
                        IconComponent={EditIcon}
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
  );
}
