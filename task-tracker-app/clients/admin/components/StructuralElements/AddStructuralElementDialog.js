import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  TextField,
  Typography,
  Box,
  IconButton
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const AddStructuralElementDialog = ({ open, onClose, projectId, onElementAdded, editingElement = null }) => {
  const isEditMode = Boolean(editingElement);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    serialNo: '',
    structureNumber: '',
    drawingNo: '',
    level: '',
    memberType: '',
    gridNo: '',
    partMarkNo: '',
    sectionSizes: '',
    lengthMm: '',
    qty: '',
    sectionDepthMm: '',
    flangeWidthMm: '',
    webThicknessMm: '',
    flangeThicknessMm: '',
    fireproofingThickness: '',
    surfaceAreaSqm: '',
    notes: ''
  });

  // Populate form when editing
  React.useEffect(() => {
    if (isEditMode && editingElement) {
      setFormData({
        serialNo: editingElement.serialNo || '',
        structureNumber: editingElement.structureNumber || '',
        drawingNo: editingElement.drawingNo || '',
        level: editingElement.level || '',
        memberType: editingElement.memberType || '',
        gridNo: editingElement.gridNo || '',
        partMarkNo: editingElement.partMarkNo || '',
        sectionSizes: editingElement.sectionSizes || '',
        lengthMm: editingElement.lengthMm || '',
        qty: editingElement.qty || '',
        sectionDepthMm: editingElement.sectionDepthMm || '',
        flangeWidthMm: editingElement.flangeWidthMm || '',
        webThicknessMm: editingElement.webThicknessMm || '',
        flangeThicknessMm: editingElement.flangeThicknessMm || '',
        fireproofingThickness: editingElement.fireproofingThickness || '',
        surfaceAreaSqm: editingElement.surfaceAreaSqm || '',
        notes: editingElement.notes || ''
      });
    } else {
      // Reset form for add mode
      setFormData({
        serialNo: '',
        structureNumber: '',
        drawingNo: '',
        level: '',
        memberType: '',
        gridNo: '',
        partMarkNo: '',
        sectionSizes: '',
        lengthMm: '',
        qty: '',
        sectionDepthMm: '',
        flangeWidthMm: '',
        webThicknessMm: '',
        flangeThicknessMm: '',
        fireproofingThickness: '',
        surfaceAreaSqm: '',
        notes: ''
      });
    }
  }, [isEditMode, editingElement]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async () => {
    if (!formData.structureNumber.trim()) {
      toast.error('Structure Number is required');
      return;
    }

    try {
      setLoading(true);
      
      // Get project info first
      const projectResponse = await api.get(`/projects/${projectId}`);
      const project = projectResponse.data;

      // Convert numeric fields
      const elementData = {
        ...formData,
        project: projectId,
        projectName: project.title || 'Project',
        siteLocation: project.location || 'Site',
        lengthMm: formData.lengthMm ? parseFloat(formData.lengthMm) : null,
        qty: formData.qty ? parseInt(formData.qty) : null,
        sectionDepthMm: formData.sectionDepthMm ? parseFloat(formData.sectionDepthMm) : null,
        flangeWidthMm: formData.flangeWidthMm ? parseFloat(formData.flangeWidthMm) : null,
        webThicknessMm: formData.webThicknessMm ? parseFloat(formData.webThicknessMm) : null,
        flangeThicknessMm: formData.flangeThicknessMm ? parseFloat(formData.flangeThicknessMm) : null,
        fireproofingThickness: formData.fireproofingThickness ? parseFloat(formData.fireproofingThickness) : null,
        surfaceAreaSqm: formData.surfaceAreaSqm ? parseFloat(formData.surfaceAreaSqm) : null,
      };

      // Remove empty string values
      Object.keys(elementData).forEach(key => {
        if (elementData[key] === '') {
          elementData[key] = null;
        }
      });

      if (isEditMode) {
        await api.put(`/structural-elements/${editingElement._id}`, elementData);
        toast.success('Structural element updated successfully!');
      } else {
        await api.post('/structural-elements', elementData);
        toast.success('Structural element added successfully!');
      }
      
      // Reset form
      setFormData({
        serialNo: '',
        structureNumber: '',
        drawingNo: '',
        level: '',
        memberType: '',
        gridNo: '',
        partMarkNo: '',
        sectionSizes: '',
        lengthMm: '',
        qty: '',
        sectionDepthMm: '',
        flangeWidthMm: '',
        webThicknessMm: '',
        flangeThicknessMm: '',
        fireproofingThickness: '',
        surfaceAreaSqm: '',
        notes: ''
      });
      
      if (onElementAdded) {
        onElementAdded();
      }
      
      onClose();
    } catch (error) {
      console.error('Error adding structural element:', error);
      toast.error(error.response?.data?.message || 'Failed to add structural element');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          {isEditMode ? 'Edit Structural Element' : 'Add Structural Element'}
        </Typography>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Grid container spacing={3}>
            {/* Basic Information */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2 }}>Basic Information</Typography>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Serial No."
                name="serialNo"
                value={formData.serialNo}
                onChange={handleChange}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Structure No. *"
                name="structureNumber"
                value={formData.structureNumber}
                onChange={handleChange}
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Drawing No."
                name="drawingNo"
                value={formData.drawingNo}
                onChange={handleChange}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Level"
                name="level"
                value={formData.level}
                onChange={handleChange}
              />
            </Grid>
            
            {/* Member Details */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2, mt: 2 }}>Member Details</Typography>
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Member Type"
                name="memberType"
                value={formData.memberType}
                onChange={handleChange}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Grid No."
                name="gridNo"
                value={formData.gridNo}
                onChange={handleChange}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Part Mark No."
                name="partMarkNo"
                value={formData.partMarkNo}
                onChange={handleChange}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Section Sizes"
                name="sectionSizes"
                value={formData.sectionSizes}
                onChange={handleChange}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Length (mm)"
                name="lengthMm"
                type="number"
                value={formData.lengthMm}
                onChange={handleChange}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Quantity"
                name="qty"
                type="number"
                value={formData.qty}
                onChange={handleChange}
              />
            </Grid>
            
            {/* Section Properties */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2, mt: 2 }}>Section Properties</Typography>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Section Depth (mm)"
                name="sectionDepthMm"
                type="number"
                step="0.1"
                value={formData.sectionDepthMm}
                onChange={handleChange}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Flange Width (mm) B"
                name="flangeWidthMm"
                type="number"
                step="0.1"
                value={formData.flangeWidthMm}
                onChange={handleChange}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Thickness (mm) t Of Web"
                name="webThicknessMm"
                type="number"
                step="0.1"
                value={formData.webThicknessMm}
                onChange={handleChange}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Thickness (mm) TOf Flange"
                name="flangeThicknessMm"
                type="number"
                step="0.1"
                value={formData.flangeThicknessMm}
                onChange={handleChange}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Thickness of Fireproofing"
                name="fireproofingThickness"
                type="number"
                step="0.1"
                value={formData.fireproofingThickness}
                onChange={handleChange}
              />
            </Grid>
            
            {/* Surface Area */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2, mt: 2 }}>Surface Area</Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Surface Area in Sqm"
                name="surfaceAreaSqm"
                type="number"
                step="0.01"
                value={formData.surfaceAreaSqm}
                onChange={handleChange}
              />
            </Grid>
            
            {/* Notes */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !formData.structureNumber.trim()}
        >
          {loading ? (editingElement ? 'Updating...' : 'Adding...') : (editingElement ? 'Update Element' : 'Add Element')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddStructuralElementDialog;