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
  Alert
} from '@mui/material';
import { Close, CheckCircle, Cancel, HourglassEmpty } from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const JOB_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'warning', icon: HourglassEmpty },
  { value: 'completed', label: 'Completed', color: 'success', icon: CheckCircle },
  { value: 'not_applicable', label: 'Non-Clearance', color: 'default', icon: Cancel }
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

  const handleClose = () => {
    setError(null);
    setSuccess(null);
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
                    </ListItemSecondaryAction>
                  </ListItem>
                </Box>
              );
            })}
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
