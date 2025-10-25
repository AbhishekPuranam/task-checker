import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  CircularProgress,
  Alert,
  Divider,
  Stack,
  Avatar,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Person,
  PersonAdd,
  PersonRemove,
  Engineering,
  Close
} from '@mui/icons-material';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

function ProjectAccessManager({ open, onClose, project }) {
  const [engineers, setEngineers] = useState([]);
  const [assignedEngineers, setAssignedEngineers] = useState([]);
  const [selectedEngineers, setSelectedEngineers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingEngineers, setLoadingEngineers] = useState(false);
  const [error, setError] = useState('');

  // Fetch all engineers and assigned engineers when dialog opens
  useEffect(() => {
    if (open && project) {
      fetchEngineers();
      fetchAssignedEngineers();
    }
  }, [open, project]);

  const fetchEngineers = async () => {
    try {
      setLoadingEngineers(true);
      const response = await api.get('/api/projects/engineers');
      setEngineers(response.data);
    } catch (error) {
      console.error('Error fetching engineers:', error);
      setError('Failed to load engineers');
    } finally {
      setLoadingEngineers(false);
    }
  };

  const fetchAssignedEngineers = async () => {
    try {
      const response = await api.get(`/api/projects/${project._id}/assigned-engineers`);
      setAssignedEngineers(response.data.assignedEngineers || []);
      setSelectedEngineers(response.data.assignedEngineers?.map(eng => eng._id) || []);
    } catch (error) {
      console.error('Error fetching assigned engineers:', error);
      setError('Failed to load assigned engineers');
    }
  };

  const handleAssignEngineers = async () => {
    try {
      setLoading(true);
      setError('');

      await api.post(`/api/projects/${project._id}/assign-engineers`, {
        engineerIds: selectedEngineers
      });

      toast.success('Engineers assigned successfully');
      await fetchAssignedEngineers(); // Refresh assigned engineers
      onClose();
    } catch (error) {
      console.error('Error assigning engineers:', error);
      const errorMessage = error.response?.data?.message || 'Failed to assign engineers';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveEngineer = async (engineerId) => {
    try {
      await api.delete(`/api/projects/${project._id}/remove-engineer/${engineerId}`);
      toast.success('Engineer removed successfully');
      await fetchAssignedEngineers(); // Refresh assigned engineers
    } catch (error) {
      console.error('Error removing engineer:', error);
      const errorMessage = error.response?.data?.message || 'Failed to remove engineer';
      toast.error(errorMessage);
    }
  };

  const handleSelectionChange = (event) => {
    const value = event.target.value;
    setSelectedEngineers(typeof value === 'string' ? value.split(',') : value);
  };

  const getUnassignedEngineers = () => {
    const assignedIds = assignedEngineers.map(eng => eng._id);
    return engineers.filter(eng => !assignedIds.includes(eng._id));
  };

  if (!project) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '500px' }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <Engineering color="primary" />
            <Typography variant="h6">
              Manage Project Access
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {project.title}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Currently Assigned Engineers */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Person />
            Currently Assigned Engineers ({assignedEngineers.length})
          </Typography>
          
          {assignedEngineers.length === 0 ? (
            <Alert severity="info">
              No engineers are currently assigned to this project.
            </Alert>
          ) : (
            <Stack spacing={1}>
              {assignedEngineers.map((engineer) => (
                <Box
                  key={engineer._id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'background.paper'
                  }}
                >
                  <Box display="flex" alignItems="center" gap={2}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      {engineer.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="body1" fontWeight="medium">
                        {engineer.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {engineer.email}
                      </Typography>
                      {engineer.department && (
                        <Typography variant="caption" color="text.secondary">
                          Department: {engineer.department}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  <Tooltip title="Remove from project">
                    <IconButton
                      color="error"
                      onClick={() => handleRemoveEngineer(engineer._id)}
                      size="small"
                    >
                      <PersonRemove />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
            </Stack>
          )}
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Add New Engineers */}
        <Box>
          <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonAdd />
            Assign Additional Engineers
          </Typography>

          {loadingEngineers ? (
            <Box display="flex" justifyContent="center" p={2}>
              <CircularProgress />
            </Box>
          ) : (
            <FormControl fullWidth>
              <InputLabel>Select Engineers</InputLabel>
              <Select
                multiple
                value={selectedEngineers.filter(id => !assignedEngineers.some(ae => ae._id === id))}
                onChange={handleSelectionChange}
                input={<OutlinedInput label="Select Engineers" />}
                MenuProps={MenuProps}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => {
                      const engineer = engineers.find(eng => eng._id === value);
                      return (
                        <Chip
                          key={value}
                          label={engineer?.name || value}
                          size="small"
                          sx={{ m: 0.25 }}
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {getUnassignedEngineers().map((engineer) => (
                  <MenuItem key={engineer._id} value={engineer._id}>
                    <Box display="flex" alignItems="center" gap={1} width="100%">
                      <Avatar sx={{ width: 24, height: 24, fontSize: '0.8rem' }}>
                        {engineer.name.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="body2">{engineer.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {engineer.email}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {getUnassignedEngineers().length === 0 && !loadingEngineers && (
            <Alert severity="info" sx={{ mt: 2 }}>
              All available engineers are already assigned to this project.
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleAssignEngineers}
          variant="contained"
          disabled={loading || selectedEngineers.filter(id => !assignedEngineers.some(ae => ae._id === id)).length === 0}
          startIcon={loading ? <CircularProgress size={18} /> : <PersonAdd />}
        >
          {loading ? 'Assigning...' : 'Assign Engineers'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ProjectAccessManager;