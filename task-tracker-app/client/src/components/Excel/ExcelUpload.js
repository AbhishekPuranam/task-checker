import React, { useState } from 'react';
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
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const ExcelUpload = ({ open, onClose, projectId, onUploadSuccess }) => {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [previewData, setPreviewData] = useState([]);

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
      const response = await api.post('/api/excel/preview', formData, {
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

  const handleUpload = async () => {
    if (!selectedFile || !projectId) {
      toast.error('Please select a file and ensure project is selected');
      return;
    }

    const formData = new FormData();
    formData.append('excelFile', selectedFile);

    try {
      setUploading(true);
      const response = await api.post(`/api/excel/upload/${projectId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setUploadResult(response.data);
      toast.success(`Successfully imported ${response.data.summary.savedElements} structural elements!`);
      
      if (response.data.summary.errors > 0) {
        toast.warning(`${response.data.summary.errors} rows had errors`);
      }

      if (onUploadSuccess) {
        onUploadSuccess(response.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload Excel file');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await api.get('/api/excel/template', {
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
    setSelectedFile(null);
    setUploadResult(null);
    setPreviewData([]);
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{ sx: { minHeight: '500px' } }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Upload Structural Elements</Typography>
        <IconButton onClick={handleClose} size="small">
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
              <>
                <Button
                  variant="outlined"
                  onClick={handlePreview}
                  disabled={uploading}
                  sx={{ mr: 2 }}
                >
                  Preview Data
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  Import Projects
                </Button>
              </>
            )}
          </Box>

          {selectedFile && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Selected file: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </Alert>
          )}

          {uploading && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress />
              <Typography variant="body2" sx={{ mt: 1 }}>
                Processing Excel file...
              </Typography>
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
                      <TableCell>{row.title || 'N/A'}</TableCell>
                      <TableCell>{row.structuralData?.serialNo || 'N/A'}</TableCell>
                      <TableCell>{row.structuralData?.structureNumber || 'N/A'}</TableCell>
                      <TableCell>{row.structuralData?.drawingNo || 'N/A'}</TableCell>
                      <TableCell>{row.structuralData?.level || 'N/A'}</TableCell>
                      <TableCell>{row.structuralData?.memberType || 'N/A'}</TableCell>
                      <TableCell>{row.location || 'N/A'}</TableCell>
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
              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <Chip
                  icon={<Error />}
                  label={`${uploadResult.errors.length} Errors`}
                  color="error"
                />
              )}
            </Box>

            {uploadResult.errors.length > 0 && (
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
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} color="inherit">
          Close
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