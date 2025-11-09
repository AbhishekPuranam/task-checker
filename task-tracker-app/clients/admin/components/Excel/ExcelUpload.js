import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Alert,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import {
  CloudUpload,
  FileDownload,
  CheckCircle,
  Error,
  Close,
} from '@mui/icons-material';
import { useRouter } from 'next/router';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import BatchProgressCard from './BatchProgressCard';

const ExcelUpload = ({ open, onClose, projectId, subProjectId, onUploadSuccess }) => {
  const navigate = useRouter();
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [progressInterval, setProgressInterval] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [uploadId, setUploadId] = useState(null); // For batch mode
  const [isBatchMode, setIsBatchMode] = useState(false); // Batch mode detection
  const [uploadSession, setUploadSession] = useState(null); // Current upload session
  const completionNotifiedRef = useRef(false);
  const fileInputRef = useRef(null);

  // Cleanup interval on unmount or when dialog closes
  useEffect(() => {
    return () => {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    };
  }, [progressInterval]);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.type === 'application/vnd.ms-excel' ||
          file.name.endsWith('.xlsx') || 
          file.name.endsWith('.xls')) {
        setSelectedFile(file);
        setUploadResult(null);
        setPreviewData([]);
      } else {
        toast.error('Please select a valid Excel file (.xlsx or .xls)');
      }
    }
  };

  const handlePreview = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('excel', selectedFile);

    try {
      setUploading(true);
      const response = await api.post('/excel/preview', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setPreviewData(response.data.preview);
      toast.success(`Preview loaded: ${response.data.preview.length} rows found`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to preview Excel file');
    } finally {
      setUploading(false);
    }
  };

  const pollProgress = async (sessionId) => {
    try {
      const response = await api.get(`/excel/upload-progress/${sessionId}`);
      const progress = response.data;
      
      setUploadProgress(progress);
      
      // Stop polling when completed or error
      if (progress.stage === 'completed' || progress.stage === 'error') {
        if (progressInterval) {
          clearInterval(progressInterval);
          setProgressInterval(null);
        }
        
        // Show final completion notification only once using ref
        if (progress.stage === 'completed' && !completionNotifiedRef.current) {
          completionNotifiedRef.current = true;
          const jobMessage = progress.jobsCreated > 0 ? ` and ${progress.jobsCreated} Fire Proofing Workflow jobs` : '';
          toast.success(`Successfully imported ${progress.elementsProcessed} elements${jobMessage}!`);
        }
      }
    } catch (error) {
      console.error('Error polling progress:', error);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !projectId) {
      toast.error('Please select a file and ensure project is selected');
      return;
    }

    const formData = new FormData();
    formData.append('excelFile', selectedFile);
    if (subProjectId) {
      formData.append('subProjectId', subProjectId);
    }

    try {
      setUploading(true);
      completionNotifiedRef.current = false;
      setUploadProgress({ stage: 'queued', percent: 0, message: 'Uploading file...', saved: 0, jobsCreated: 0 });
      
      // Use subproject-specific endpoint if subProjectId is provided
      const uploadEndpoint = subProjectId 
        ? `/excel/upload/${projectId}/${subProjectId}`
        : `/excel/upload/${projectId}`;
      
      const response = await api.post(uploadEndpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      // Check if batch mode or legacy mode
      if (response.data.uploadId) {
        // Batch mode
        setUploadId(response.data.uploadId);
        setIsBatchMode(true);
        toast.success('File uploaded! Processing in batches...');
        
        // Start polling for upload session status - pass interval ID to pollUploadSession
        const interval = setInterval(() => pollUploadSession(response.data.uploadId, interval), 2000);
        setProgressInterval(interval);
      } else if (response.data.jobId) {
        // Legacy mode with BullMQ
        setJobId(response.data.jobId);
        setIsBatchMode(false);
        toast.success('File uploaded! Processing in background...');
        
        // Start polling for job status - pass interval ID to pollJobStatus
        const interval = setInterval(() => pollJobStatus(response.data.jobId, interval), 1000);
        setProgressInterval(interval);
      }
      
    } catch (error) {
      console.error('Upload error:', error);
      
      // Extract detailed error information
      const errorResponse = error.response?.data;
      const errorCode = errorResponse?.errorCode;
      const errorMessage = errorResponse?.error || errorResponse?.message;
      
      // Provide user-friendly error messages based on error code
      let displayMessage = 'Failed to upload Excel file';
      
      if (errorCode === 'NO_FILE') {
        displayMessage = 'No file selected. Please choose an Excel file to upload.';
      } else if (errorCode === 'PROJECT_NOT_FOUND') {
        displayMessage = 'Project not found. Please refresh the page and try again.';
      } else if (errorCode === 'SUBPROJECT_NOT_FOUND') {
        displayMessage = 'SubProject not found. Please verify the subproject exists.';
      } else if (errorCode === 'PERMISSION_DENIED') {
        displayMessage = 'Permission denied. You do not have access to upload files to this project.';
      } else if (errorCode === 'VALIDATION_ERROR') {
        displayMessage = `Validation error: ${errorMessage || 'Invalid file format'}`;
      } else if (errorCode === 'FILE_SYSTEM_ERROR') {
        displayMessage = 'File upload error. Please try again.';
      } else if (errorCode === 'DATABASE_ERROR') {
        displayMessage = 'Database error. Please contact support.';
      } else if (errorMessage) {
        displayMessage = errorMessage;
      }
      
      // Show detailed error message to user
      toast.error(displayMessage, {
        duration: 6000,
        style: {
          maxWidth: '500px',
        }
      });
      
      // Log technical details for debugging
      if (errorResponse?.technical) {
        console.error('Technical error details:', errorResponse.technical);
      }
      
      setUploadProgress(null);
      setUploading(false);
    }
  };

  const pollJobStatus = async (jobId, intervalId) => {
    try {
      const response = await api.get(`/excel/job-status/${jobId}`);
      const status = response.data;
      
      // Update progress from job data
      if (status.progress) {
        setUploadProgress({
          stage: status.progress.stage || status.state,
          percent: status.progress.percent || 0,
          message: status.progress.message || `Status: ${status.state}`,
          saved: status.progress.saved || 0,
          jobsCreated: status.progress.jobsCreated || 0,
          validated: status.progress.validated || 0,
          errors: status.progress.errors || 0,
        });
      }
      
      // Check if job is complete
      if (status.state === 'completed') {
        clearInterval(intervalId);
        setProgressInterval(null);
        
        setUploading(false);
        
        // Set upload result from job return value
        if (status.result) {
          setUploadResult({
            summary: {
              savedElements: status.result.savedElements || 0,
              duplicateElements: status.result.duplicateElements || 0,
              errors: status.result.errors?.length || 0,
              jobsCreated: status.result.jobsCreated || 0,
              totalRows: status.result.totalRows || 0,
            },
            errors: status.result.errors || [],
          });
        }
        
        // Show final completion notification
        if (!completionNotifiedRef.current) {
          completionNotifiedRef.current = true;
          const jobMessage = status.result?.jobsCreated > 0 
            ? ` and ${status.result.jobsCreated} Fire Proofing jobs` 
            : '';
          toast.success(`Successfully imported ${status.result?.savedElements || 0} elements${jobMessage}!`);
        }
        
        if (onUploadSuccess) {
          onUploadSuccess(status.result);
        }
      }
      
      // Check if job failed
      if (status.state === 'failed') {
        clearInterval(intervalId);
        setProgressInterval(null);
        
        setUploading(false);
        toast.error(status.error || 'Excel processing failed');
        setUploadProgress(null);
      }
      
    } catch (error) {
      console.error('Error polling job status:', error);
    }
  };

  const pollUploadSession = async (uploadId, intervalId) => {
    try {
      const response = await api.get(`/upload-sessions/${uploadId}`);
      const session = response.data;
      setUploadSession(session);
      
      // Update progress based on batch completion
      const totalBatches = session.batches.length;
      const completedBatches = session.batches.filter(
        b => b.status === 'success' || b.status === 'failed'
      ).length;
      const successfulBatches = session.batches.filter(b => b.status === 'success').length;
      
      const percent = totalBatches > 0 ? (completedBatches / totalBatches) * 100 : 0;
      
      setUploadProgress({
        stage: session.status,
        percent,
        message: `Processing batches: ${completedBatches}/${totalBatches} complete`,
        saved: session.summary.totalElementsCreated || 0,
        jobsCreated: session.summary.totalJobsCreated || 0,
        validated: completedBatches,
        errors: session.summary.failedBatches || 0,
      });
      
      // Check if all batches are complete
      if (session.status === 'completed' || session.status === 'failed') {
        clearInterval(intervalId);
        setProgressInterval(null);
        
        setUploading(false);
        
        // Show final notification
        if (!completionNotifiedRef.current) {
          completionNotifiedRef.current = true;
          if (session.status === 'completed') {
            const jobMessage = session.summary.totalJobsCreated > 0 
              ? ` and ${session.summary.totalJobsCreated} Fire Proofing jobs` 
              : '';
            toast.success(`Successfully imported ${session.summary.totalElementsCreated || 0} elements${jobMessage}! (${successfulBatches}/${totalBatches} batches succeeded)`);
          } else {
            toast.error(`Upload completed with errors. ${session.summary.failedBatches} batches failed.`);
          }
        }
        
        if (onUploadSuccess && session.status === 'completed') {
          onUploadSuccess({
            savedElements: session.summary.totalElementsCreated,
            jobsCreated: session.summary.totalJobsCreated,
            totalBatches,
            successfulBatches,
          });
        }
      }
      
    } catch (error) {
      console.error('Error polling upload session:', error);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await api.get('/excel/template', {
        responseType: 'blob',
      });
      
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'structural_elements_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Template downloaded successfully!');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const handleClose = () => {
    // Prevent closing while upload is in progress
    if (uploading && !uploadResult) {
      toast.error('Please wait for the upload to complete before closing. Jobs are still being created.');
      return;
    }
    
    // Clean up progress polling
    if (progressInterval) {
      clearInterval(progressInterval);
      setProgressInterval(null);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    setSelectedFile(null);
    setUploadResult(null);
    setPreviewData([]);
    setUploadProgress(null);
    setJobId(null);
    setUploadId(null);
    setIsBatchMode(false);
    setUploadSession(null);
    completionNotifiedRef.current = false;
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={(event, reason) => {
        // Prevent closing via backdrop click or escape key while uploading
        if ((reason === 'backdropClick' || reason === 'escapeKeyDown') && uploading && !uploadResult) {
          toast.error('Please wait for the upload to complete before closing. Jobs are still being created.');
          return;
        }
        handleClose();
      }}
      maxWidth="md" 
      fullWidth
      PaperProps={{ sx: { minHeight: '500px' } }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Upload Structural Elements</Typography>
        <IconButton 
          onClick={handleClose} 
          size="small"
          disabled={uploading && !uploadResult}
          title={uploading && !uploadResult ? 'Please wait for upload to complete' : 'Close'}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {/* Template Download */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload an Excel file containing structural engineering details. Download the template first to see the required format.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<FileDownload />}
            onClick={downloadTemplate}
            sx={{ mb: 2 }}
          >
            Download Excel Template
          </Button>
          
          {/* Fire Proofing Workflow Guide */}
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Fire Proofing Workflow Column Guide:
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Use one of these values in the "Fire Proofing Workflow" column:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
              <Chip size="small" label="cement_fire_proofing" variant="outlined" />
              <Chip size="small" label="gypsum_fire_proofing" variant="outlined" />
              <Chip size="small" label="intumescent_coatings" variant="outlined" />
              <Chip size="small" label="refinery_fire_proofing" variant="outlined" />
            </Box>
            <Typography variant="body2" color="text.secondary">
              💡 Tip: Leave empty for no workflow assignment. Each workflow creates multiple jobs automatically (8-12 jobs per element).
            </Typography>
          </Alert>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* File Upload */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Select Excel File
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <input
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              id="excel-upload"
              type="file"
              onChange={handleFileSelect}
              ref={fileInputRef}
            />
            <label htmlFor="excel-upload">
              <Button
                variant="contained"
                component="span"
                startIcon={<CloudUpload />}
                sx={{ mr: 2 }}
              >
                Select Excel File
              </Button>
            </label>
            
            {selectedFile && (
              <Button
                variant="outlined"
                onClick={handlePreview}
                disabled={uploading}
              >
                Preview Data
              </Button>
            )}
          </Box>

          {selectedFile && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Selected file: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </Alert>
          )}

          {(uploading || uploadProgress) && (
            <Box sx={{ mb: 2 }}>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight={600}>
                  ⏳ Upload in progress - Please wait
                </Typography>
                <Typography variant="caption">
                  Jobs are being created in the background. Do not close this dialog until the process completes.
                  {uploadProgress?.jobsCreated > 0 && ` (${uploadProgress.jobsCreated} jobs created so far)`}
                </Typography>
              </Alert>
              <LinearProgress 
                variant={uploadProgress && uploadProgress.percent !== undefined ? "determinate" : "indeterminate"}
                value={uploadProgress?.percent || 0}
              />
              <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">
                  {uploadProgress ? uploadProgress.message : 'Processing Excel file...'}
                </Typography>
                {uploadProgress && uploadProgress.percent !== undefined && (
                  <Typography variant="body2" color="text.secondary">
                    {Math.round(uploadProgress.percent)}%
                  </Typography>
                )}
              </Box>
              {uploadProgress && (uploadProgress.saved > 0 || uploadProgress.jobsCreated > 0) && (
                <Box sx={{ mt: 1 }}>
                  <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                    {uploadProgress.saved > 0 && (
                      <Chip 
                        size="small" 
                        label={`Elements: ${uploadProgress.saved}${uploadProgress.validated ? `/${uploadProgress.validated}` : ''}`}
                        color="primary"
                        variant="outlined"
                      />
                    )}
                    {uploadProgress.jobsCreated > 0 && (
                      <Chip 
                        size="small" 
                        label={`Jobs Created: ${uploadProgress.jobsCreated}`}
                        color="success"
                        variant="outlined"
                      />
                    )}
                  </Box>
                  
                  {/* Job Creation Progress Bar */}
                  {uploadProgress.elementsProcessed > 0 && uploadProgress.jobsCreated > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                        Fire Proofing Workflow Jobs Progress
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={uploadProgress.elementsProcessed > 0 ? 
                          (uploadProgress.elementsProcessed / uploadProgress.totalElements) * 100 : 0
                        }
                        sx={{ 
                          height: 6, 
                          borderRadius: 3,
                          backgroundColor: 'rgba(0,0,0,0.1)',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: '#4caf50'
                          }
                        }}
                      />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Creating jobs for Fire Proofing Workflows...
                        </Typography>
                        <Typography variant="caption" color="success.main">
                          {uploadProgress.jobsCreated} jobs created
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* Preview Data */}
        {previewData.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Preview Data ({previewData.length} rows)
            </Typography>
            <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Project Name</TableCell>
                    <TableCell>Serial No</TableCell>
                    <TableCell>Structure Number</TableCell>
                    <TableCell>Drawing No</TableCell>
                    <TableCell>Level</TableCell>
                    <TableCell>Member Type</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewData.slice(0, 10).map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>{row.projectName || 'N/A'}</TableCell>
                      <TableCell>{row.serialNo || 'N/A'}</TableCell>
                      <TableCell>{row.structureNumber || 'N/A'}</TableCell>
                      <TableCell>{row.drawingNo || 'N/A'}</TableCell>
                      <TableCell>{row.level || 'N/A'}</TableCell>
                      <TableCell>{row.memberType || 'N/A'}</TableCell>
                      <TableCell>{row.gridNo || 'N/A'}</TableCell>
                      <TableCell>
                        <Chip
                          label="Ready to import"
                          color="primary"
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {previewData.length > 10 && (
              <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                Showing first 10 rows. Total: {previewData.length} rows
              </Typography>
            )}
          </Box>
        )}

        {/* Upload Results */}
        {uploadResult && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Import Results
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Chip
                icon={<CheckCircle />}
                label={`${uploadResult.summary?.savedElements || 0} Successful`}
                color="success"
              />
              {uploadResult.summary?.errors > 0 && (
                <Chip
                  icon={<Error />}
                  label={`${uploadResult.summary.errors} Errors`}
                  color="error"
                />
              )}
            </Box>

            {uploadResult.errors && uploadResult.errors.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Errors:
                </Typography>
                {uploadResult.errors.slice(0, 5).map((error, index) => (
                  <Alert severity="error" key={index} sx={{ mb: 1 }}>
                    Row {error.row}: {error.message}
                  </Alert>
                ))}
                {uploadResult.errors.length > 5 && (
                  <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                    ... and {uploadResult.errors.length - 5} more errors
                  </Typography>
                )}
              </Box>
            )}

            {uploadResult && (
              <Box sx={{ mt: 3 }}>
                <Alert severity="success">
                  Upload completed! {uploadResult.summary.savedElements} elements imported successfully.
                </Alert>
              </Box>
            )}
          </Box>
        )}

        {/* Batch Mode Upload Session */}
        {isBatchMode && uploadSession && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Batch Upload Progress
            </Typography>
            <BatchProgressCard
              uploadSession={uploadSession}
              onRetrySuccess={() => {
                // Refresh session data
                if (uploadId) {
                  pollUploadSession(uploadId);
                }
              }}
              onDeleteSuccess={() => {
                // Clear session and close
                setUploadSession(null);
                setUploadId(null);
                setIsBatchMode(false);
                toast.success('Upload session deleted');
              }}
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button 
          onClick={handleClose} 
          color="inherit"
          disabled={uploading && !uploadResult}
        >
          {uploading && !uploadResult ? 'Processing...' : 'Close'}
        </Button>
        {selectedFile && !uploadResult && (
          <Button onClick={handleUpload} variant="contained" disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ExcelUpload;