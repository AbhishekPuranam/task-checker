import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Refresh,
  Delete,
  Info,
  Schedule,
} from '@mui/icons-material';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const BatchProgressCard = ({ uploadSession, onRefresh }) => {
  const [showBatchDetails, setShowBatchDetails] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const { summary, batches, status, uploadId } = uploadSession;

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'partial_success': return 'warning';
      case 'failed': return 'error';
      case 'in_progress': return 'info';
      default: return 'default';
    }
  };

  const getBatchStatusColor = (status) => {
    switch (status) {
      case 'success': return 'success';
      case 'failed': return 'error';
      case 'processing': return 'info';
      case 'pending': return 'default';
      default: return 'default';
    }
  };

  const handleRetryFailed = async () => {
    try {
      setRetrying(true);
      await api.post(`/upload-sessions/${uploadId}/retry`);
      toast.success('Failed batches marked for retry');
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to retry batches');
    } finally {
      setRetrying(false);
    }
  };

  const handleRetryBatch = async (batchNumber) => {
    try {
      await api.post(`/upload-sessions/${uploadId}/batch/${batchNumber}/retry`);
      toast.success(`Batch ${batchNumber} marked for retry`);
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to retry batch');
    }
  };

  const handleDeleteBatch = async (batchNumber) => {
    if (!confirm(`Delete batch ${batchNumber}? This will remove all elements and jobs created in this batch.`)) {
      return;
    }

    try {
      await api.delete(`/upload-sessions/${uploadId}/batch/${batchNumber}`);
      toast.success(`Batch ${batchNumber} deleted`);
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete batch');
    }
  };

  const handleCleanupFailed = async () => {
    if (!confirm('Delete all failed batches? This will remove elements and jobs from failed batches only.')) {
      return;
    }

    try {
      await api.delete(`/upload-sessions/${uploadId}/failed-batches`);
      toast.success('Failed batches cleaned up');
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cleanup batches');
    }
  };

  const handleDeleteSession = async () => {
    if (!confirm('Delete entire upload session? This will remove ALL elements and jobs created in this upload.')) {
      return;
    }

    try {
      await api.delete(`/upload-sessions/${uploadId}`);
      toast.success('Upload session deleted');
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete session');
    }
  };

  const failedBatches = batches.filter(b => b.status === 'failed');
  const successBatches = batches.filter(b => b.status === 'success');
  const pendingBatches = batches.filter(b => b.status === 'pending');

  return (
    <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">
            {uploadSession.fileName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Upload ID: {uploadId}
          </Typography>
        </Box>
        <Chip
          label={status.replace('_', ' ').toUpperCase()}
          color={getStatusColor(status)}
          size="small"
        />
      </Box>

      {/* Summary Stats */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="success.main">
              {summary.successfulBatches}
            </Typography>
            <Typography variant="caption">Success</Typography>
          </Box>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="error.main">
              {summary.failedBatches}
            </Typography>
            <Typography variant="caption">Failed</Typography>
          </Box>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="info.main">
              {summary.totalElementsCreated}
            </Typography>
            <Typography variant="caption">Elements</Typography>
          </Box>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="primary.main">
              {summary.totalJobsCreated}
            </Typography>
            <Typography variant="caption">Jobs</Typography>
          </Box>
        </Grid>
      </Grid>

      {/* Progress Bar */}
      <Box sx={{ mb: 2 }}>
        <LinearProgress
          variant="determinate"
          value={(summary.successfulBatches / uploadSession.totalBatches) * 100}
          sx={{ height: 8, borderRadius: 1 }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {summary.successfulBatches}/{uploadSession.totalBatches} batches completed
          {summary.duplicatesSkipped > 0 && ` (${summary.duplicatesSkipped} duplicates skipped)`}
        </Typography>
      </Box>

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button
          size="small"
          startIcon={<Info />}
          onClick={() => setShowBatchDetails(true)}
        >
          View Batches
        </Button>

        {failedBatches.length > 0 && (
          <>
            <Button
              size="small"
              startIcon={<Refresh />}
              onClick={handleRetryFailed}
              disabled={retrying}
              color="warning"
            >
              Retry Failed ({failedBatches.length})
            </Button>
            <Button
              size="small"
              startIcon={<Delete />}
              onClick={handleCleanupFailed}
              color="error"
              variant="outlined"
            >
              Cleanup Failed
            </Button>
          </>
        )}

        <Button
          size="small"
          startIcon={<Delete />}
          onClick={handleDeleteSession}
          color="error"
          variant="text"
        >
          Delete All
        </Button>
      </Box>

      {/* Batch Details Dialog */}
      <Dialog
        open={showBatchDetails}
        onClose={() => setShowBatchDetails(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Batch Details - {uploadSession.fileName}
          <Typography variant="caption" display="block" color="text.secondary">
            {uploadSession.totalBatches} total batches
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Batch</TableCell>
                  <TableCell>Rows</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Elements</TableCell>
                  <TableCell>Jobs</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.batchNumber}>
                    <TableCell>#{batch.batchNumber}</TableCell>
                    <TableCell>
                      {batch.startRow}-{batch.endRow}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={batch.status}
                        color={getBatchStatusColor(batch.status)}
                        size="small"
                      />
                      {batch.retryCount > 0 && (
                        <Chip
                          label={`Retry: ${batch.retryCount}`}
                          size="small"
                          sx={{ ml: 0.5 }}
                        />
                      )}
                    </TableCell>
                    <TableCell>{batch.elementsCreated.length}</TableCell>
                    <TableCell>{batch.jobsCreated.length}</TableCell>
                    <TableCell>
                      {batch.status === 'failed' && (
                        <>
                          <Tooltip title="Retry batch">
                            <IconButton
                              size="small"
                              onClick={() => handleRetryBatch(batch.batchNumber)}
                            >
                              <Refresh fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={batch.errorMessage || 'Error'}>
                            <IconButton size="small" color="error">
                              <Info fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      {batch.status === 'success' && (
                        <Tooltip title="Delete batch">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteBatch(batch.batchNumber)}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {failedBatches.length > 0 && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Failed Batches:
              </Typography>
              <List dense>
                {failedBatches.map(batch => (
                  <ListItem key={batch.batchNumber}>
                    <ListItemText
                      primary={`Batch #${batch.batchNumber} (rows ${batch.startRow}-${batch.endRow})`}
                      secondary={batch.errorMessage}
                    />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBatchDetails(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default BatchProgressCard;
