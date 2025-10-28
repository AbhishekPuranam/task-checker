import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Alert,
  Tooltip,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Slider,
  Switch,
  FormControlLabel,
  Collapse,
  Divider,
  Menu,
  Checkbox,
  Toolbar,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemButton
} from '@mui/material';
import {
  Add as AddIcon,
  PlaylistAdd as PlaylistAddIcon,
  Work as WorkIcon,
  Visibility as ViewIcon,
  Assignment as AssignmentIcon,
  Edit as EditIcon,
  MoreVert as MoreVertIcon,
  Check as CheckIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  Upload as UploadIcon,
  Settings as SettingsIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowRight as KeyboardArrowRightIcon,
  ViewModule as ViewModuleIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { useParams } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import AddStructuralElementDialog from './AddStructuralElementDialog';
import ExcelUpload from '../Excel/ExcelUpload';

const StructuralElementsList = () => {
  const { projectName } = useParams();
  const { user, token } = useAuth();
  const [elements, setElements] = useState([]);
  const [jobsByElement, setJobsByElement] = useState({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalElements, setTotalElements] = useState(0);
  const [selectedElement, setSelectedElement] = useState(null);
  const [showJobDialog, setShowJobDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingElement, setEditingElement] = useState(null);
  const [project, setProject] = useState(null);
  const [projectId, setProjectId] = useState(null); // Store the actual project ID
  const [elementJobs, setElementJobs] = useState([]);
  
  // Global filter state removed - now using individual section filters only
  
  // Individual section filters for status-based sections with column-specific filters
  const [sectionFilters, setSectionFilters] = useState({
    'non clearance': {
      searchTerm: '',
      memberTypeFilter: '',
      expanded: true,
      groupBy: '',
      page: 0,
      rowsPerPage: 10,
      expandedGroups: {},
      columnFilters: {
        structureNumber: [],
        memberType: [],
        gridNo: [],
        sectionSizes: [],
        surfaceAreaSqm: { min: '', max: '' },
        status: [],
        currentPendingJob: [],
        progress: { min: '', max: '' }
      }
    },
    'no jobs': {
      searchTerm: '',
      memberTypeFilter: '',
      expanded: true,
      groupBy: '',
      page: 0,
      rowsPerPage: 10,
      expandedGroups: {},
      columnFilters: {
        structureNumber: [],
        memberType: [],
        gridNo: [],
        sectionSizes: [],
        surfaceAreaSqm: { min: '', max: '' },
        status: [],
        currentPendingJob: [],
        progress: { min: '', max: '' }
      }
    },
    'active': {
      searchTerm: '',
      memberTypeFilter: '',
      expanded: true,
      groupBy: '',
      page: 0,
      rowsPerPage: 10,
      expandedGroups: {},
      columnFilters: {
        structureNumber: [],
        memberType: [],
        gridNo: [],
        sectionSizes: [],
        surfaceAreaSqm: { min: '', max: '' },
        status: [],
        currentPendingJob: [],
        progress: { min: '', max: '' }
      }
    },
    'complete': {
      searchTerm: '',
      memberTypeFilter: '',
      expanded: true,
      groupBy: '',
      page: 0,
      rowsPerPage: 10,
      expandedGroups: {},
      columnFilters: {
        structureNumber: [],
        memberType: [],
        gridNo: [],
        sectionSizes: [],
        surfaceAreaSqm: { min: '', max: '' },
        status: [],
        currentPendingJob: [],
        progress: { min: '', max: '' }
      }
    }
  });
  
  // Column visibility state - Default visible columns
  const [visibleColumns, setVisibleColumns] = useState({
    select: true,
    serialNo: false,
    structureNumber: true,
    drawingNo: false, // Hidden by user action
    level: false,
    memberType: true,
    gridNo: true, // NEW: Now visible by default
    partMarkNo: false,
    sectionSizes: true,
    lengthMm: false,
    qty: false, // Hidden by user action
    sectionDepthMm: false,
    flangeWidthMm: false,
    webThicknessMm: false,
    flangeThicknessMm: false,
    fireproofingThickness: false,
    surfaceAreaSqm: true,
    projectName: false,
    siteLocation: false,
    status: true,
    currentPendingJob: true,
    progress: true,
    actions: true
  });
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  
  // Project edit state
  const [showProjectEditDialog, setShowProjectEditDialog] = useState(false);
  const [projectEditForm, setProjectEditForm] = useState({
    title: '',
    description: '',
    location: '',
    category: '',
    status: '',
    priority: '',
    dueDate: ''
  });

  // Remove manual job form - only using predefined jobs now

  // Job editing state
  const [editingJob, setEditingJob] = useState(null);
  const [showJobEditDialog, setShowJobEditDialog] = useState(false);
  const [jobEditForm, setJobEditForm] = useState({
    jobTitle: '',
    jobType: 'fabrication',
    status: 'pending',
    progressPercentage: 0
  });

  // Job types state
  const [availableJobTypes, setAvailableJobTypes] = useState({});
  const [predefinedJobsData, setPredefinedJobsData] = useState({});
  const [showPredefinedJobDialog, setShowPredefinedJobDialog] = useState(false);
  const [selectedJobTypeForPredefined, setSelectedJobTypeForPredefined] = useState('');

  // Menu state for job actions
  const [jobMenuAnchor, setJobMenuAnchor] = useState(null);
  const [selectedJobForMenu, setSelectedJobForMenu] = useState(null);

  // Manual job creation state
  const [showManualJobForm, setShowManualJobForm] = useState(false);
  const [showJobCreationDialog, setShowJobCreationDialog] = useState(false);
  const [insertionIndex, setInsertionIndex] = useState(null); // Track where to insert the job
  const [manualJobForm, setManualJobForm] = useState({
    jobTitle: '',
    fireproofingType: '',
    status: 'pending'
  });

  // Delete confirmation state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);

  // Bulk selection state
  const [selectedElements, setSelectedElements] = useState([]);
  const [showBulkJobDialog, setShowBulkJobDialog] = useState(false);
  const [bulkJobForm, setBulkJobForm] = useState({
    jobType: '',
    fireproofingType: ''
  });

  const jobTypes = [
    { value: 'cement_fire_proofing', label: 'Cement Fire Proofing' },
    { value: 'gypsum_fire_proofing', label: 'Gypsum Fire Proofing' },
    { value: 'intumescent_coatings', label: 'Intumescent Coatings' },
    { value: 'refinery_fire_proofing', label: 'Refinery Fire Proofing' }
  ];

  const priorities = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' }
  ];

  const jobStatuses = [
    { value: 'pending', label: 'Pending', color: '#ff9800' },
    { value: 'completed', label: 'Completed', color: '#4caf50' },
    { value: 'not_applicable', label: 'Non clearance', color: '#f44336' }
  ];



  // Bulk selection handlers
  const handleSelectElement = (elementId) => {
    setSelectedElements(prev => {
      if (prev.includes(elementId)) {
        return prev.filter(id => id !== elementId);
      } else {
        return [...prev, elementId];
      }
    });
  };



  const handleBulkCreateJobs = async () => {
    if (selectedElements.length === 0) {
      toast.error('Please select at least one element');
      return;
    }

    if (!bulkJobForm.jobType) {
      toast.error('Please select a fire proofing type');
      return;
    }

    try {
      const response = await api.post('/api/jobs/bulk-create', {
        elementIds: selectedElements,
        jobType: bulkJobForm.jobType
      });

      toast.success(`Successfully created jobs for ${selectedElements.length} elements`);
      setSelectedElements([]);
      setShowBulkJobDialog(false);
      setBulkJobForm({ jobType: '', fireproofingType: '' });
      fetchElements(); // Refresh the list
    } catch (error) {
      console.error('Error creating bulk jobs:', error);
      toast.error(error.response?.data?.message || 'Failed to create jobs');
    }
  };

  // Fetch job types and predefined jobs data
  const fetchJobTypesData = async () => {
    try {
      const response = await api.get('/api/jobs/job-types');
      setAvailableJobTypes(response.data.jobTypes);
      setPredefinedJobsData(response.data.predefinedJobs);
    } catch (error) {
      console.error('Error fetching job types:', error);
    }
  };

  // Create predefined jobs for selected job type
  const handleCreatePredefinedJobs = async () => {
    if (!selectedElement || !selectedJobTypeForPredefined) {
      toast.error('Please select a job type');
      return;
    }

    try {
      const response = await api.post('/api/jobs/create-predefined', {
        jobType: selectedJobTypeForPredefined,
        structuralElement: selectedElement._id,
        project: projectId
      });

      toast.success(response.data.message);
      setShowPredefinedJobDialog(false);
      setSelectedJobTypeForPredefined('');
      
      // Refresh jobs and elements
      fetchElementJobs(selectedElement._id);
      fetchElements();
    } catch (error) {
      console.error('Error creating predefined jobs:', error);
      toast.error(error.response?.data?.message || 'Failed to create predefined jobs');
    }
  };

  // Create manual/custom job
  const handleCreateManualJob = async () => {
    if (!selectedElement || !manualJobForm.jobTitle.trim()) {
      toast.error('Please fill in job title');
      return;
    }

    try {
      let orderIndex;
      
      // Calculate orderIndex if inserting at a specific position
      if (insertionIndex !== null) {
        console.log(`🎯 Inserting job at position ${insertionIndex + 1}. Current jobs:`, elementJobs.length);
        console.log('Current jobs order:', elementJobs.map((job, idx) => ({
          index: idx,
          title: job.jobTitle,
          stepNumber: job.stepNumber,
          orderIndex: job.orderIndex
        })));
        
        if (elementJobs.length === 0) {
          orderIndex = 100;
          console.log(`📍 No existing jobs - setting orderIndex to ${orderIndex}`);
        } else if (insertionIndex === 0) {
          // Insert at beginning
          const orders = elementJobs.map(j => {
            if (j.orderIndex !== undefined && j.orderIndex !== null) return j.orderIndex;
            if (j.stepNumber !== undefined && j.stepNumber !== null) return j.stepNumber * 10;
            return 1000;
          });
          const minOrder = Math.min(...orders);
          orderIndex = minOrder - 10;
          console.log(`📍 Inserting at beginning - minOrder: ${minOrder}, new orderIndex: ${orderIndex}`);
        } else if (insertionIndex >= elementJobs.length) {
          // Insert at end
          const orders = elementJobs.map(j => {
            if (j.orderIndex !== undefined && j.orderIndex !== null) return j.orderIndex;
            if (j.stepNumber !== undefined && j.stepNumber !== null) return j.stepNumber * 10;
            return 0;
          });
          const maxOrder = Math.max(...orders);
          orderIndex = maxOrder + 10;
          console.log(`📍 Inserting at end - maxOrder: ${maxOrder}, new orderIndex: ${orderIndex}`);
        } else {
          // Insert between existing jobs
          const prevJob = elementJobs[insertionIndex - 1];
          const nextJob = elementJobs[insertionIndex];
          
          console.log(`📍 Inserting between jobs:`, {
            prevJob: { title: prevJob?.jobTitle, stepNumber: prevJob?.stepNumber, orderIndex: prevJob?.orderIndex },
            nextJob: { title: nextJob?.jobTitle, stepNumber: nextJob?.stepNumber, orderIndex: nextJob?.orderIndex }
          });
          
          let prevOrder, nextOrder;
          
          // Get previous job order
          if (prevJob?.orderIndex !== undefined && prevJob?.orderIndex !== null) {
            prevOrder = prevJob.orderIndex;
          } else if (prevJob?.stepNumber !== undefined && prevJob?.stepNumber !== null) {
            prevOrder = prevJob.stepNumber * 10;
          } else {
            prevOrder = 0;
          }
          
          // Get next job order
          if (nextJob?.orderIndex !== undefined && nextJob?.orderIndex !== null) {
            nextOrder = nextJob.orderIndex;
          } else if (nextJob?.stepNumber !== undefined && nextJob?.stepNumber !== null) {
            nextOrder = nextJob.stepNumber * 10;
          } else {
            nextOrder = prevOrder + 20; // Default gap
          }
          
          orderIndex = (prevOrder + nextOrder) / 2;
          
          // Ensure we have enough precision
          if (nextOrder - prevOrder < 1) {
            orderIndex = prevOrder + 0.1;
          }
          
          console.log(`📍 Between insertion - prevOrder: ${prevOrder}, nextOrder: ${nextOrder}, calculated orderIndex: ${orderIndex}`);
        }
      }

      const jobData = {
        structuralElement: selectedElement._id,
        project: projectId,
        jobTitle: manualJobForm.jobTitle.trim(),
        jobDescription: manualJobForm.jobTitle.trim(), // Use title as description for simplicity
        status: manualJobForm.status,
        jobType: manualJobForm.fireproofingType || 'custom', // Use fireproofingType or default to custom
        priority: 'medium' // Default priority
      };

      // Add orderIndex if we're inserting at a specific position
      if (orderIndex !== undefined) {
        jobData.orderIndex = orderIndex;
        console.log('🚀 Sending job data with orderIndex:', orderIndex);
      }

      console.log('📤 Final job data being sent:', jobData);
      const response = await api.post('/api/jobs', jobData);
      
      if (insertionIndex !== null) {
        toast.success(`Custom job created and inserted at position ${insertionIndex + 1}`);
      } else {
        toast.success('Manual job created successfully');
      }
      
      // Reset form and state
      setManualJobForm({
        jobTitle: '',
        fireproofingType: '',
        status: 'pending'
      });
      setShowManualJobForm(false);
      setShowJobCreationDialog(false);
      setInsertionIndex(null); // Reset insertion index
      
      // Refresh jobs and elements
      fetchElementJobs(selectedElement._id);
      fetchElements();
    } catch (error) {
      console.error('Error creating manual job:', error);
      toast.error(error.response?.data?.message || 'Failed to create manual job');
    }
  };

  const fetchElements = async () => {
    try {
      setLoading(true);
      // Fetch ALL elements for the project without pagination limit
      const response = await api.get(`/api/structural-elements?project=${projectId}&limit=10000`);
      
      // Fetch ALL jobs for the project in one API call to avoid rate limiting
      const jobsResponse = await api.get(`/api/jobs?project=${projectId}&limit=10000`);
      const allJobs = jobsResponse.data.jobs || [];
      
      // Group jobs by structural element ID for quick lookup
      const jobsByElement = {};
      allJobs.forEach(job => {
        const elementId = job.structuralElement?._id || job.structuralElement;
        if (!jobsByElement[elementId]) {
          jobsByElement[elementId] = [];
        }
        jobsByElement[elementId].push(job);
      });
      
      // Calculate status for each element based on its jobs
      const elementsWithStatus = response.data.elements.map((element) => {
        try {
          // Get jobs for this specific element - use element.jobs if available, otherwise fallback to lookup
          const jobs = element.jobs || jobsByElement[element._id] || [];
          

          
          let calculatedStatus;
          
          if (jobs.length === 0) {
            calculatedStatus = 'no jobs';
          } else {
            // Check if any jobs are marked as not_applicable (non clearance) - this always takes priority
            const hasNonClearanceJobs = jobs.some(job => job.status === 'not_applicable');
            
            if (hasNonClearanceJobs) {
              calculatedStatus = 'non clearance'; // Always override with non clearance if any job is not_applicable
            } else {
              // Calculate status from jobs first - this is more reliable than backend status
              const completedJobs = jobs.filter(job => job.status === 'completed').length;
              const totalJobs = jobs.length;
              const completionPercentage = (completedJobs / totalJobs) * 100;
              
              // Calculate average progress percentage
              const avgProgress = jobs.reduce((sum, job) => sum + (job.progressPercentage || 0), 0) / jobs.length;
              
              // Debug logging for E00097 elements
              if (element.structureNumber === 'E00097' && element.gridNo === 'B-A TO 1-2') {
                console.log('DEBUG E00097 B-A TO 1-2 STATUS CALCULATION:');
                console.log('- Jobs:', jobs.length);
                console.log('- Completed jobs:', completedJobs);
                console.log('- Completion percentage:', completionPercentage);
                console.log('- Average progress:', avgProgress);
                console.log('- Backend status:', element.status);
                console.log('- Jobs detail:', jobs.map(j => ({ title: j.jobTitle, status: j.status, progress: j.progressPercentage })));
              }
              
              // Calculate status based on job completion - prioritize actual completion over backend status
              if (completionPercentage === 100) {
                calculatedStatus = 'complete'; // Mark complete when all jobs are done (removed avgProgress requirement)
              } else if (completionPercentage > 0 || avgProgress > 0) {
                calculatedStatus = 'active'; // Some work done but not complete
              } else if (element.status && ['completed', 'active', 'pending', 'no jobs'].includes(element.status)) {
                // Only use backend status if jobs show no progress at all
                calculatedStatus = element.status;
              } else {
                calculatedStatus = 'no jobs'; // No work started - treat same as no jobs
              }
              
              // Debug final status for E00097 elements
              if (element.structureNumber === 'E00097' && element.gridNo === 'B-A TO 1-2') {
                console.log('- Final calculated status:', calculatedStatus);
              }
            }
          }
          
          // Calculate completion metrics
          const completedJobs = jobs.filter(job => job.status === 'completed').length;
          const totalJobs = jobs.length;
          const completionPercentage = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;
          const avgProgress = jobs.length > 0 ? jobs.reduce((sum, job) => sum + (job.progressPercentage || 0), 0) / jobs.length : 0;

          return {
            ...element,
            status: calculatedStatus,
            jobsCompleted: completedJobs,
            totalJobs: totalJobs,
            completionPercentage: Math.round(completionPercentage),
            avgProgress: Math.round(avgProgress),
            jobs: jobs // Include jobs for reference
          };
        } catch (error) {
          console.error(`Error calculating status for element ${element._id}:`, error);
          return {
            ...element,
            status: 'no jobs' // Default if error
          };
        }
      });
      
      setElements(elementsWithStatus);
      setJobsByElement(jobsByElement); // Store jobsByElement in state
      setTotalElements(elementsWithStatus.length);
      
      // Range calculations removed - no longer needed without global filters
      
      // Auto-correct project status if needed (after elements are loaded)
      setTimeout(() => {
        if (project && elementsWithStatus.length > 0) {
          const completedElements = elementsWithStatus.filter(el => el.status === 'complete');
          const shouldBeComplete = completedElements.length === elementsWithStatus.length;
          
          if (project.status === 'completed' && !shouldBeComplete) {
            console.warn('🔧 Auto-correcting project status - not all elements complete');
            handleCorrectProjectStatus();
          }
        }
      }, 1000);
    } catch (error) {
      console.error('Error fetching elements:', error);
      toast.error('Failed to load structural elements');
    } finally {
      setLoading(false);
    }
  };

  const fetchProject = async () => {
    if (!token || !projectName) {
      return;
    }
    
    try {
      const response = await api.get(`/api/projects/by-name/${projectName}`);
      setProject(response.data);
      setProjectId(response.data._id); // Store the actual project ID
    } catch (error) {
      console.error('Error fetching project:', error);
      if (error.response?.status === 401) {
        toast.error('Please log in to view project details');
      } else if (error.response?.status === 404) {
        toast.error('Project not found');
      } else {
        toast.error('Failed to load project details');
      }
    }
  };

  const fetchElementJobs = async (elementId) => {
    try {
      const response = await api.get(`/api/jobs/by-element/${elementId}`);
      // Backend already sorts by orderIndex, stepNumber, createdAt - just use the response directly
      setElementJobs(response.data);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to load jobs for this element');
    }
  };

  // Fetch project first when component mounts
  useEffect(() => {
    if (projectName && token) {
      fetchProject();
    }
  }, [projectName, token]);

  // Fetch elements once we have the projectId
  useEffect(() => {
    if (projectId && token) {
      fetchElements();
      fetchJobTypesData();
    }
  }, [projectId, token]);

  // Debug useEffect removed - global filters no longer needed

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleElementAdded = () => {
    fetchElements(); // Refresh the list
  };

  const handleViewJobs = (element) => {
    setSelectedElement(element);
    fetchElementJobs(element._id);
    setShowJobDialog(true);
  };

  const handleEditElement = (element) => {
    setEditingElement(element);
    setShowEditDialog(true);
  };

  const handleInsertJobAt = (insertAtIndex) => {
    if (!selectedElement) {
      toast.error('Please select an element first');
      return;
    }

    // Set the insertion index and show the job creation dialog
    setInsertionIndex(insertAtIndex);
    setManualJobForm({
      jobTitle: '',
      fireproofingType: '',
      status: 'pending'
    });
    setShowJobCreationDialog(true);
  };

  const handleEditProject = () => {
    if (project) {
      setProjectEditForm({
        title: project.title || '',
        description: project.description || '',
        location: project.location || '',
        category: project.category || '',
        status: project.status || '',
        priority: project.priority || '',
        dueDate: project.dueDate ? new Date(project.dueDate).toISOString().split('T')[0] : ''
      });
      setShowProjectEditDialog(true);
    }
  };

  const handleSaveProject = async () => {
    try {
      const response = await api.put(`/api/projects/${projectId}`, projectEditForm);
      setProject(response.data);
      setShowProjectEditDialog(false);
      toast.success('Project updated successfully');
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Failed to update project');
    }
  };

  // Removed manual job creation - only using predefined jobs

  const handleCloseJobDialog = () => {
    setShowJobDialog(false);
    setSelectedElement(null);
    setElementJobs([]);
    setSelectedJobTypeForPredefined('');
  };

  const handleEditJob = (job) => {
    setEditingJob(job);
    setJobEditForm({
      jobTitle: job.jobTitle || '',
      jobDescription: job.jobDescription || '',
      jobType: job.jobType || 'fabrication',
      priority: job.priority || 'medium',
      status: job.status || 'pending',
      estimatedHours: job.estimatedHours || '',
      dueDate: job.dueDate ? new Date(job.dueDate).toISOString().split('T')[0] : '',
      assignedTo: job.assignedTo?._id || '',
      qualityCheckRequired: job.qualityCheckRequired || false,
      progressPercentage: job.progressPercentage || 0
    });
    setShowJobEditDialog(true);
  };

  const handleUpdateJob = async () => {
    if (!editingJob || !jobEditForm.jobTitle.trim() || !jobEditForm.jobDescription.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      // Prepare job data with proper type conversions
      const jobData = {
        jobTitle: jobEditForm.jobTitle.trim(),
        jobDescription: jobEditForm.jobDescription.trim(),
        jobType: jobEditForm.jobType,
        priority: jobEditForm.priority,
        status: jobEditForm.status,
        qualityCheckRequired: Boolean(jobEditForm.qualityCheckRequired),
        estimatedHours: jobEditForm.estimatedHours ? parseFloat(jobEditForm.estimatedHours) : null,
        dueDate: jobEditForm.dueDate ? new Date(jobEditForm.dueDate).toISOString() : null,
        progressPercentage: Math.max(0, Math.min(100, parseInt(jobEditForm.progressPercentage) || 0))
      };

      // Only include assignedTo if it has a value
      if (jobEditForm.assignedTo && jobEditForm.assignedTo.trim()) {
        jobData.assignedTo = jobEditForm.assignedTo.trim();
      }

      console.log('Updating job with data:', jobData); // Debug log
      console.log('Job ID:', editingJob._id); // Debug job ID

      const response = await api.put(`/api/jobs/${editingJob._id}`, jobData);
      console.log('Update response:', response.data); // Debug response
      
      // Check if project status changed unexpectedly
      const projectBefore = project;
      setTimeout(async () => {
        try {
          const updatedProject = await api.get(`/api/projects/by-name/${projectName}`);
          if (updatedProject.data.status !== projectBefore.status) {
            console.warn('⚠️ Project status changed automatically:', {
              before: projectBefore.status,
              after: updatedProject.data.status,
              shouldNot: 'change automatically'
            });
            // Refresh project data to show current status
            setProject(updatedProject.data);
          }
        } catch (error) {
          console.error('Error checking project status:', error);
        }
      }, 1000); // Check after 1 second
      toast.success('Job updated successfully');
      
      // Close dialog and refresh jobs and elements table
      setShowJobEditDialog(false);
      setEditingJob(null);
      fetchElementJobs(selectedElement._id);
      fetchElements(); // Refresh the main elements table to show updated status
    } catch (error) {
      console.error('Error updating job:', error);
      console.error('Full error response:', error.response); // More detailed error logging
      toast.error(error.response?.data?.message || 'Failed to update job');
    }
  };

  const handleCloseJobEditDialog = () => {
    setShowJobEditDialog(false);
    setEditingJob(null);
    setJobEditForm({
      jobTitle: '',
      jobDescription: '',
      jobType: 'fabrication',
      priority: 'medium',
      status: 'pending',
      estimatedHours: '',
      dueDate: '',
      assignedTo: '',
      qualityCheckRequired: false,
      progressPercentage: 0
    });
  };

  const handleDeleteJob = (job) => {
    setJobToDelete(job);
    setShowDeleteDialog(true);
  };

  const confirmDeleteJob = async () => {
    if (!jobToDelete) return;

    try {
      await api.delete(`/api/jobs/${jobToDelete._id}`);
      toast.success('Job deleted successfully');
      
      // Refresh jobs list and elements table
      fetchElementJobs(selectedElement._id);
      fetchElements(); // Refresh the main elements table to show updated status
      
      // Reset delete dialog state
      setShowDeleteDialog(false);
      setJobToDelete(null);
    } catch (error) {
      console.error('Error deleting job:', error);
      toast.error(error.response?.data?.message || 'Failed to delete job');
    }
  };

  const handleQuickStatusUpdate = async (job, newStatus) => {
    try {
      const updateData = { status: newStatus };
      
      // If marking as completed, set progress to 100%
      if (newStatus === 'completed') {
        updateData.progressPercentage = 100;
      }

      console.log('Quick status update:', updateData); // Debug log

      await api.put(`/api/jobs/${job._id}`, updateData);
      toast.success(`Job status updated to ${newStatus.replace('_', ' ')}`);
      
      // Check if project status changed unexpectedly
      const projectBefore = project;
      setTimeout(async () => {
        try {
          const updatedProject = await api.get(`/api/projects/by-name/${projectName}`);
          if (updatedProject.data.status !== projectBefore.status) {
            console.warn('⚠️ Project status changed automatically after job update:', {
              before: projectBefore.status,
              after: updatedProject.data.status,
              jobUpdated: job.jobTitle,
              newJobStatus: newStatus
            });
            // Show warning to user
            toast.warning('Project status changed automatically - this should not happen!');
            setProject(updatedProject.data);
          }
        } catch (error) {
          console.error('Error checking project status:', error);
        }
      }, 1000);
      
      // Refresh jobs list and main elements table
      fetchElementJobs(selectedElement._id);
      fetchElements(); // Refresh the main elements table to update the "Current Pending Job" column
    } catch (error) {
      console.error('Error updating job status:', error);
      console.error('Full error response:', error.response);
      toast.error(error.response?.data?.message || 'Failed to update job status');
    }
  };

  const handleJobMenuOpen = (event, job) => {
    setJobMenuAnchor(event.currentTarget);
    setSelectedJobForMenu(job);
  };

  const handleJobMenuClose = () => {
    setJobMenuAnchor(null);
    setSelectedJobForMenu(null);
  };

  const handleJobMenuAction = (action) => {
    if (!selectedJobForMenu) return;

    switch (action) {
      case 'edit':
        handleEditJob(selectedJobForMenu);
        break;
      case 'complete':
        handleQuickStatusUpdate(selectedJobForMenu, 'completed');
        break;
      case 'not_applicable':
        handleQuickStatusUpdate(selectedJobForMenu, 'not_applicable');
        break;
      case 'pending':
        handleQuickStatusUpdate(selectedJobForMenu, 'pending');
        break;
      case 'delete':
        handleDeleteJob(selectedJobForMenu);
        break;
      default:
        break;
    }
    
    handleJobMenuClose();
  };

  // Function to correct project status if it gets marked complete incorrectly
  const handleCorrectProjectStatus = async () => {
    if (!project || !elements.length) return;
    
    const completedElements = elements.filter(el => el.status === 'complete');
    const shouldBeComplete = completedElements.length === elements.length;
    
    if (project.status === 'completed' && !shouldBeComplete) {
      try {
        // Reset project status to in_progress
        await api.put(`/api/projects/${projectId}`, {
          ...project,
          status: 'in_progress'
        });
        
        const updatedProject = await api.get(`/api/projects/by-name/${projectName}`);
        setProject(updatedProject.data);
        
        toast.success('Project status corrected - not all elements are complete yet');
      } catch (error) {
        console.error('Error correcting project status:', error);
        toast.error('Failed to correct project status');
      }
    }
  };



  const getStatusColor = (status) => {
    switch (status) {
      case 'complete': return 'success';
      case 'active': return 'primary';
      case 'pending': return 'warning';
      case 'no jobs': return 'purple';
      case 'non clearance': return 'error';
      case 'completed': return 'success'; // fallback
      case 'on_hold': return 'warning'; // fallback
      case 'cancelled': return 'error'; // fallback
      default: return 'default';
    }
  };

  const getJobStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'not_applicable': return 'error';
      case 'pending': return 'warning';
      case 'in_progress': return 'primary';
      case 'on_hold': return 'info';
      case 'cancelled': return 'error';
      default: return 'warning';
    }
  };

  // Helper function to get unique values for column filters
  const getUniqueColumnValues = (elements, columnKey) => {
    const values = new Set();
    
    // Debug logging for currentPendingJob
    if (columnKey === 'currentPendingJob') {
      console.log(`[DEBUG] Getting unique values for currentPendingJob:`, {
        elementsCount: elements.length,
        elementStatuses: elements.map(el => el.status),
        elementIds: elements.slice(0, 3).map(el => el._id)
      });
    }
    
    elements.forEach(element => {
      let value;
      switch (columnKey) {
        case 'structureNumber':
          value = element.memberNumber;
          break;
        case 'memberType':
          value = element.memberType;
          break;
        case 'gridNo':
          value = element.gridLocation;
          break;
        case 'sectionSizes':
          value = element.sectionSize;
          break;
        case 'status':
          value = element.status;
          break;
        case 'currentPendingJob':
          // Get the actual current pending job value for this element
          const jobs = element.jobs || jobsByElement[element._id] || [];
          if (jobs.length === 0) {
            value = 'No jobs';
          } else {
            const pendingJob = jobs.find(job => job.status === 'pending' || job.status === 'in_progress');
            value = pendingJob ? pendingJob.jobTitle : 'All jobs complete';
          }
          
          // Debug logging for currentPendingJob
          if (columnKey === 'currentPendingJob') {
            console.log(`[DEBUG] Element ${element.structureNumber} (${element.status}):`, {
              jobsCount: jobs.length,
              pendingJobTitle: value,
              allJobTitles: jobs.map(j => j.jobTitle)
            });
          }
          break;
        default:
          value = element[columnKey];
      }
      if (value !== null && value !== undefined && value !== '') {
        values.add(String(value));
      }
    });
    
    const result = Array.from(values).sort();
    
    // Debug logging for currentPendingJob
    if (columnKey === 'currentPendingJob') {
      console.log(`[DEBUG] Final unique currentPendingJob values:`, result);
    }
    
    return result;
  };

  // Function to apply column filters
  const applyColumnFilters = (elements, columnFilters) => {
    return elements.filter(element => {
      return Object.entries(columnFilters).every(([columnKey, filterValue]) => {
        if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0) || 
            (typeof filterValue === 'object' && filterValue.min === '' && filterValue.max === '')) {
          return true; // No filter applied
        }

        // Special handling for currentPendingJob column
        if (columnKey === 'currentPendingJob' && Array.isArray(filterValue)) {
          const elementJobs = element.jobs || jobsByElement[element._id] || [];
          
          if (elementJobs.length === 0) {
            return filterValue.includes('No jobs');
          }
          
          // Check if any job title in this element matches the filter
          const hasMatchingJobTitle = elementJobs.some(job => filterValue.includes(job.jobTitle));
          
          // Check if "All jobs complete" is selected and element has all jobs completed
          const pendingJob = elementJobs.find(job => 
            job.status === 'pending' || job.status === 'in_progress' || job.status === 'not_applicable'
          );
          const isAllComplete = !pendingJob && filterValue.includes('All jobs complete');
          
          return hasMatchingJobTitle || isAllComplete;
        }

        let elementValue;
        switch (columnKey) {
          case 'structureNumber':
            elementValue = element.memberNumber;
            break;
          case 'memberType':
            elementValue = element.memberType;
            break;
          case 'gridNo':
            elementValue = element.gridLocation;
            break;
          case 'sectionSizes':
            elementValue = element.sectionSize;
            break;
          case 'status':
            elementValue = element.status;
            break;
          case 'surfaceAreaSqm':
            elementValue = parseFloat(element.surfaceAreaSqm) || 0;
            break;
          case 'progress':
            // Calculate progress percentage
            const jobs = element.jobs || jobsByElement[element._id] || [];
            if (jobs.length === 0) {
              elementValue = 0;
            } else {
              const completedJobs = jobs.filter(job => job.status === 'completed').length;
              elementValue = Math.round((completedJobs / jobs.length) * 100);
            }
            break;
          case 'currentPendingJob':
            // This case is handled above for better logic
            const elementJobs = element.jobs || jobsByElement[element._id] || [];
            if (elementJobs.length === 0) {
              elementValue = 'No jobs';
            } else {
              const pendingJob = elementJobs.find(job => job.status === 'pending' || job.status === 'in_progress');
              elementValue = pendingJob ? pendingJob.jobTitle : 'All jobs complete';
            }
            break;
          default:
            elementValue = element[columnKey];
        }

        if (Array.isArray(filterValue)) {
          // Multi-select filter
          return filterValue.includes(String(elementValue));
        } else if (typeof filterValue === 'object') {
          // Range filter for numbers
          const numValue = parseFloat(elementValue) || 0;
          const min = filterValue.min === '' ? -Infinity : parseFloat(filterValue.min);
          const max = filterValue.max === '' ? Infinity : parseFloat(filterValue.max);
          return numValue >= min && numValue <= max;
        }

        return true;
      });
    });
  };

  // Global filtering logic moved to individual sections

  // Available columns configuration - All structural element fields
  const availableColumns = [
    { key: 'select', label: '', sortable: false },
    { key: 'serialNo', label: 'Serial No.', sortable: true },
    { key: 'structureNumber', label: 'Structure No.', sortable: true },
    { key: 'drawingNo', label: 'Drawing No.', sortable: true },
    { key: 'level', label: 'Level', sortable: true },
    { key: 'memberType', label: 'Member Type', sortable: true },
    { key: 'gridNo', label: 'Grid No.', sortable: true },
    { key: 'partMarkNo', label: 'Part Mark No.', sortable: true },
    { key: 'sectionSizes', label: 'Section Sizes', sortable: true },
    { key: 'lengthMm', label: 'Length (mm)', sortable: true },
    { key: 'qty', label: 'Quantity', sortable: true },
    { key: 'sectionDepthMm', label: 'Section Depth (mm)', sortable: true },
    { key: 'flangeWidthMm', label: 'Flange Width (mm)', sortable: true },
    { key: 'webThicknessMm', label: 'Web Thickness (mm)', sortable: true },
    { key: 'flangeThicknessMm', label: 'Flange Thickness (mm)', sortable: true },
    { key: 'fireproofingThickness', label: 'Fireproofing Thickness', sortable: true },
    { key: 'surfaceAreaSqm', label: 'Surface Area (sqm)', sortable: true },
    { key: 'projectName', label: 'Project Name', sortable: true },
    { key: 'siteLocation', label: 'Site Location', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'currentPendingJob', label: 'Current Pending Job', sortable: false },
    { key: 'progress', label: 'Progress', sortable: true },
    { key: 'actions', label: 'Actions', sortable: false }
  ];

  // Column Filter Component
  const ColumnFilter = ({ column, sectionKey, elements }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const sectionFilter = sectionFilters[sectionKey];
    const columnFilter = sectionFilter?.columnFilters?.[column.key] || [];

    if (column.key === 'select' || column.key === 'actions') {
      return column.label;
    }

    const handleClick = (event) => {
      setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
      setAnchorEl(null);
    };

    const updateColumnFilter = (newFilter) => {
      setSectionFilters(prev => ({
        ...prev,
        [sectionKey]: {
          ...prev[sectionKey],
          columnFilters: {
            ...prev[sectionKey].columnFilters,
            [column.key]: newFilter
          }
        }
      }));
    };

    const clearFilter = () => {
      if (column.key === 'surfaceAreaSqm' || column.key === 'progress') {
        updateColumnFilter({ min: '', max: '' });
      } else {
        updateColumnFilter([]);
      }
    };

    const uniqueValues = getUniqueColumnValues(elements, column.key);
    const isActive = Array.isArray(columnFilter) ? columnFilter.length > 0 : 
                    (columnFilter.min !== '' || columnFilter.max !== '');

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {column.label}
        </Typography>
        <IconButton 
          size="small" 
          onClick={handleClick}
          sx={{ 
            p: 0.25,
            color: isActive ? 'primary.main' : 'text.secondary',
            '&:hover': { backgroundColor: 'action.hover' }
          }}
        >
          <FilterListIcon fontSize="small" />
        </IconButton>
        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
        >
          <Box sx={{ p: 2, minWidth: 200, maxWidth: 300 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2">Filter {column.label}</Typography>
              {isActive && (
                <Button size="small" onClick={clearFilter} color="error">
                  Clear
                </Button>
              )}
            </Box>

            {(column.key === 'surfaceAreaSqm' || column.key === 'progress') ? (
              // Range filter for numeric columns
              <Box>
                <TextField
                  label="Min"
                  type="number"
                  size="small"
                  value={columnFilter.min || ''}
                  onChange={(e) => updateColumnFilter({ ...columnFilter, min: e.target.value })}
                  sx={{ mb: 1, mr: 1, width: '45%' }}
                />
                <TextField
                  label="Max"
                  type="number"
                  size="small"
                  value={columnFilter.max || ''}
                  onChange={(e) => updateColumnFilter({ ...columnFilter, max: e.target.value })}
                  sx={{ mb: 1, width: '45%' }}
                />
              </Box>
            ) : (
              // Multi-select filter for text columns
              <List sx={{ maxHeight: 200, overflow: 'auto' }}>
                {uniqueValues.map((value) => (
                  <ListItemButton
                    key={value}
                    dense
                    onClick={() => {
                      const currentFilter = Array.isArray(columnFilter) ? columnFilter : [];
                      const newFilter = currentFilter.includes(value)
                        ? currentFilter.filter(v => v !== value)
                        : [...currentFilter, value];
                      updateColumnFilter(newFilter);
                    }}
                  >
                    <Checkbox
                      edge="start"
                      checked={Array.isArray(columnFilter) && columnFilter.includes(value)}
                      size="small"
                    />
                    <ListItemText primary={value} />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Box>
        </Popover>
      </Box>
    );
  };

  // Old grouping options removed - now using individual section grouping

  // Old grouping logic removed - now using status-based sections with individual grouping

  // Selection logic now handled per section - old global selection logic removed

  // Handle selecting all elements within a specific group
  // Removed old handleSelectGroup function - no longer needed with new status-based sections

  // Get unique values for filter dropdowns
  const uniqueMemberTypes = [...new Set(elements.map(e => e.memberType))].filter(Boolean);
  const uniqueStatuses = [...new Set(elements.map(e => e.status))].filter(Boolean);
  
  // Get unique current pending jobs
  const uniqueCurrentJobs = useMemo(() => {
    const jobTitles = new Set();
    let hasNoJobsElements = false;
    let hasAllCompleteElements = false;
    
    elements.forEach(element => {
      if (!element.jobs || element.jobs.length === 0) {
        hasNoJobsElements = true;
      } else {
        const sortedJobs = [...element.jobs].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
        const pendingJob = sortedJobs.find(job => 
          job.status === 'pending' || job.status === 'in_progress' || job.status === 'not_applicable'
        );
        
        if (pendingJob) {
          jobTitles.add(pendingJob.jobTitle);
        } else {
          hasAllCompleteElements = true;
        }
      }
    });
    
    const result = [...jobTitles].sort();
    if (hasAllCompleteElements) result.unshift('all-complete');
    if (hasNoJobsElements) result.unshift('no-jobs');
    
    return result;
  }, [elements]);
  
  // Range calculations removed - no longer needed without global filters
  
  // Global filter functions removed - now using individual section filters

  // Old toggleGroupExpansion function removed - now handled per section

  // Column visibility functions
  const toggleColumnVisibility = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }));
  };

  const getVisibleColumns = () => {
    return availableColumns.filter(col => visibleColumns[col.key]);
  };

  // Render cell content dynamically
  const renderCellContent = (element, columnKey) => {
    switch (columnKey) {
      case 'select':
        return (
          <Checkbox
            checked={selectedElements.includes(element._id)}
            onChange={() => handleSelectElement(element._id)}
            size="small"
            color="primary"
          />
        );
      case 'structureNumber':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: 'primary.main'
            }} />
            <Typography variant="body2" fontWeight="600" color="primary.main">
              {element.structureNumber}
            </Typography>
          </Box>
        );
      case 'drawingNo':
        return (
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
            {element.drawingNo}
          </Typography>
        );
      case 'memberType':
        return (
          <Chip 
            label={element.memberType} 
            size="small" 
            variant="outlined"
            sx={{ 
              borderRadius: 1,
              fontWeight: 500,
              backgroundColor: 'primary.50',
              borderColor: 'primary.200'
            }}
          />
        );
      case 'sectionSizes':
        return (
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {element.sectionSizes}
          </Typography>
        );
      case 'qty':
        return (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: 'info.50',
            borderRadius: 1,
            px: 1,
            py: 0.5,
            minWidth: 40
          }}>
            <Typography variant="body2" fontWeight="600" color="info.main">
              {element.qty}
            </Typography>
          </Box>
        );
      case 'surfaceAreaSqm':
        return (
          <Typography variant="body2" fontWeight="600" color="success.main">
            {element.surfaceAreaSqm?.toFixed(2)}
          </Typography>
        );
      case 'status':
        return (
          <Chip 
            label={element.status} 
            size="small" 
            color={['warning', 'purple', 'error'].includes(getStatusColor(element.status)) ? undefined : getStatusColor(element.status)}
            sx={{ 
              borderRadius: 1,
              fontWeight: 500,
              textTransform: 'capitalize',
              // Custom styling for warning/orange status
              ...(getStatusColor(element.status) === 'warning' && {
                backgroundColor: '#ff9800',
                color: '#ffffff',
                border: 'none',
                '& .MuiChip-label': {
                  color: '#ffffff'
                }
              }),
              // Improved styling for purple status (no jobs) for better readability
              ...(getStatusColor(element.status) === 'purple' && {
                backgroundColor: '#ede7f6', // lighter purple
                color: '#4a148c', // dark purple text
                border: 'none',
                '& .MuiChip-label': {
                  color: '#4a148c',
                  fontWeight: 700
                }
              }),
              // Custom styling for error status (non clearance) - red
              ...(getStatusColor(element.status) === 'error' && {
                backgroundColor: '#f44336',
                color: '#ffffff',
                border: 'none',
                '& .MuiChip-label': {
                  color: '#ffffff'
                }
              })
            }}
          />
        );
      case 'currentPendingJob':
        return (() => {
          // Use the same fallback logic as status calculation - get jobs from element or lookup
          const jobs = element.jobs || jobsByElement[element._id] || [];
          
          if (jobs.length === 0) {
            return (
              <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                No jobs
              </Typography>
            );
          }
          
          // Sort jobs by orderIndex and find the first pending job in the correct sequence
          // Include not_applicable jobs as they are similar to pending
          const sortedJobs = [...jobs].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
          const pendingJob = sortedJobs.find(job => 
            job.status === 'pending' || job.status === 'in_progress' || job.status === 'not_applicable'
          );
          
          if (!pendingJob) {
            return (
              <Typography variant="body2" color="success.main" sx={{ fontWeight: 500 }}>
                All jobs complete
              </Typography>
            );
          }
          
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: 'warning.main',
                animation: 'pulse 2s infinite'
              }} />
              <Typography variant="body2" color="warning.dark" sx={{ fontWeight: 500 }}>
                {pendingJob.jobTitle}
              </Typography>
            </Box>
          );
        })();
      case 'progress':
        return (() => {
          // Use the same fallback logic as status calculation - get jobs from element or lookup
          const jobs = element.jobs || jobsByElement[element._id] || [];
          
          if (jobs.length === 0) {
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" fontWeight="600">0%</Typography>
                <Typography variant="caption" color="text.secondary">(0/0)</Typography>
              </Box>
            );
          }
          
          const totalJobs = jobs.length;
          const completedJobs = jobs.filter(job => job.status === 'completed').length;
          const completionPercentage = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;
          
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" fontWeight="600">
                {completionPercentage}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ({completedJobs}/{totalJobs})
              </Typography>
            </Box>
          );
        })();
      // New field cases for better formatting
      case 'serialNo':
        return (
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
            {element.serialNo}
          </Typography>
        );
      case 'level':
        return (
          <Chip 
            label={element.level} 
            size="small" 
            variant="outlined"
            sx={{ 
              borderRadius: 1,
              backgroundColor: 'secondary.50',
              borderColor: 'secondary.200'
            }}
          />
        );
      case 'gridNo':
        return (
          <Typography variant="body2" fontWeight="600" color="secondary.main">
            {element.gridNo}
          </Typography>
        );
      case 'partMarkNo':
        return (
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
            {element.partMarkNo}
          </Typography>
        );
      case 'lengthMm':
        return element.lengthMm ? (
          <Typography variant="body2" color="text.secondary">
            {element.lengthMm.toLocaleString()} mm
          </Typography>
        ) : '-';
      case 'sectionDepthMm':
      case 'flangeWidthMm':
      case 'webThicknessMm':
      case 'flangeThicknessMm':
      case 'fireproofingThickness':
        return element[columnKey] ? (
          <Typography variant="body2" color="text.secondary">
            {element[columnKey]} mm
          </Typography>
        ) : '-';
      case 'projectName':
        return (
          <Typography variant="body2" fontWeight="500" color="primary.dark">
            {element.projectName}
          </Typography>
        );
      case 'siteLocation':
        return (
          <Typography variant="body2" color="text.secondary">
            {element.siteLocation}
          </Typography>
        );
      case 'actions':
        return (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Edit Element" placement="top">
              <IconButton
                size="small"
                onClick={() => handleEditElement(element)}
                sx={{ 
                  backgroundColor: 'primary.50',
                  '&:hover': { backgroundColor: 'primary.100' }
                }}
              >
                <EditIcon sx={{ fontSize: 16, color: 'primary.main' }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="View/Add Jobs" placement="top">
              <IconButton
                size="small"
                onClick={() => handleViewJobs(element)}
                sx={{ 
                  backgroundColor: 'success.50',
                  '&:hover': { backgroundColor: 'success.100' }
                }}
              >
                <WorkIcon sx={{ fontSize: 16, color: 'success.main' }} />
              </IconButton>
            </Tooltip>
          </Box>
        );
      default:
        return element[columnKey] || '-';
    }
  };

  // Old useEffect for expanding groups removed - now handled per section

  if (!token) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Box textAlign="center" py={4}>
            <Typography variant="h5" gutterBottom>
              Authentication Required
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Please log in to view project details and structural elements.
            </Typography>
            <Button 
              variant="contained" 
              href="/login"
              size="large"
            >
              Go to Login
            </Button>
          </Box>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            {project ? (
              <Box display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
                <Typography variant="h5" color="primary" sx={{ fontWeight: 'bold' }}>
                  📋 {project.title || project.projectName || `Project ${projectId}`}
                </Typography>
                <Tooltip title={`Edit Project Details\nLocation: ${project.location || 'N/A'}\nStatus: ${project.status || 'N/A'}`}>
                  <IconButton 
                    size="small" 
                    onClick={handleEditProject}
                    sx={{ color: 'primary.main' }}
                  >
                    <SettingsIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ) : (
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                {projectName ? `Loading project ${projectName.replace(/-/g, ' ')}...` : 'Loading project...'}
              </Typography>
            )}
            
            {/* Project Completion Summary */}
            {elements.length > 0 && (
              <Box sx={{ 
                mt: 1, 
                p: 2, 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                borderRadius: 2,
                boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)'
              }}>
                {(() => {
                  const completedElements = elements.filter(el => el.status === 'complete');
                  const totalSurfaceArea = elements.reduce((sum, el) => sum + (el.surfaceAreaSqm || 0), 0);
                  const completedSurfaceArea = completedElements.reduce((sum, el) => sum + (el.surfaceAreaSqm || 0), 0);
                  const completionPercentage = totalSurfaceArea > 0 ? (completedSurfaceArea / totalSurfaceArea) * 100 : 0;
                  
                  // Calculate actual project status based on elements
                  let projectStatus = 'pending';
                  if (completedElements.length === elements.length && elements.length > 0) {
                    projectStatus = 'complete';
                  } else if (completedElements.length > 0) {
                    projectStatus = 'in_progress';
                  }
                  
                  const getProjectStatusColor = (status) => {
                    switch (status) {
                      case 'complete': return 'success';
                      case 'in_progress': return 'warning';
                      case 'pending': return { backgroundColor: '#ff9800', color: 'white' }; // Orange for pending
                      default: return 'default';
                    }
                  };
                  
                  return (
                    <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      <Box>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>Project Status</Typography>
                        <Chip 
                          label={projectStatus.replace('_', ' ')} 
                          color={projectStatus !== 'pending' && getProjectStatusColor(projectStatus) !== 'warning' ? getProjectStatusColor(projectStatus) : undefined}
                          sx={{ 
                            fontWeight: 'bold', 
                            textTransform: 'capitalize',
                            // Custom styling for warning/orange status (in_progress, etc.)
                            ...(getProjectStatusColor(projectStatus) === 'warning' && {
                              backgroundColor: '#ff9800',
                              color: '#ffffff',
                              border: 'none',
                              '& .MuiChip-label': {
                                color: '#ffffff'
                              }
                            }),
                            // Other status colors
                            ...(projectStatus === 'complete' && { 
                              color: 'success.main' 
                            })
                          }}
                        />
                      </Box>
                      <Box>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>Total Surface Area</Typography>
                        <Typography variant="h6" fontWeight="bold" color="white">{totalSurfaceArea.toFixed(2)} sqm</Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>Completed Surface Area</Typography>
                        <Typography variant="h6" fontWeight="bold" sx={{ color: '#4caf50' }}>
                          {completedSurfaceArea.toFixed(2)} sqm ({completionPercentage.toFixed(1)}%)
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>Elements Progress</Typography>
                        <Typography variant="h6" fontWeight="bold" color="white">
                          {completedElements.length}/{elements.length} elements
                        </Typography>
                      </Box>
                      
                      {/* Show correction button if project is wrongly marked complete */}
                      {project.status === 'completed' && projectStatus !== 'complete' && (
                        <Box>
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            onClick={handleCorrectProjectStatus}
                            sx={{ mt: 1 }}
                          >
                            ⚠️ Fix Project Status
                          </Button>
                          <Typography variant="caption" color="error" display="block">
                            Project marked complete incorrectly
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  );
                })()}
              </Box>
            )}
          </Box>
        </Box>

        {/* Bulk Actions Toolbar */}
        {selectedElements.length > 0 && (
          <Paper sx={{ 
            p: 2, 
            mb: 2, 
            backgroundColor: 'primary.50',
            border: '1px solid',
            borderColor: 'primary.200'
          }}>
            <Toolbar sx={{ minHeight: '48px !important', px: '0 !important' }}>
              <Typography variant="body1" sx={{ flex: 1, fontWeight: 600, color: 'primary.main' }}>
                {selectedElements.length} element{selectedElements.length > 1 ? 's' : ''} selected
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  startIcon={<WorkIcon />}
                  onClick={() => setShowBulkJobDialog(true)}
                  size="small"
                >
                  Assign Fire Proofing Workflow
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setSelectedElements([]);
                  }}
                  size="small"
                >
                  Clear Selection
                </Button>
              </Box>
            </Toolbar>
          </Paper>
        )}

        {/* Compact Controls Toolbar */}
        <Paper sx={{ 
          p: 2, 
          mb: 3,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: 2,
          boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            {/* Old grouped view controls removed - now using status-based sections */}
            
            {/* Add Element Button */}
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowAddDialog(true)}
              sx={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.3)',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.3)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(255,255,255,0.2)'
                }
              }}
            >
              Add Element
            </Button>
            
            {/* Upload Excel Button */}
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setShowUploadDialog(true)}
              sx={{
                borderColor: 'rgba(255,255,255,0.5)',
                color: 'white',
                '&:hover': {
                  borderColor: 'white',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: 'white'
                }
              }}
            >
              Upload Excel
            </Button>
            
            {/* Elements Count */}
            <Box sx={{ 
              ml: 'auto',
              px: 2,
              py: 1,
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: 1,
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)'
            }}>
              <Typography variant="body2" fontWeight="bold">
                {elements.length} Elements
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Global filter panel removed - now using individual section filters */}

        {elements.length === 0 && !loading ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            No structural elements found. Add elements individually or upload an Excel file to get started.
          </Alert>
        ) : (
          <>
            {/* Status-Based Sections */}
            <Box sx={{ backgroundColor: '#f8fafc' }}>
              {/* Helper function to render status section */}
              {(() => {
                const renderStatusSection = (statusName, statusTitle, statusColor, iconColor) => {
                  const sectionElements = elements.filter(el => el.status === statusName);
                  const sectionFilter = sectionFilters[statusName];
                  
                  // Filter elements within this section (section-specific filters + column filters)
                  let filteredSectionElements = sectionElements.filter(element => {
                    // Section-specific search term filter
                    if (sectionFilter.searchTerm && !Object.values(element).some(value => 
                      value?.toString().toLowerCase().includes(sectionFilter.searchTerm.toLowerCase())
                    )) {
                      return false;
                    }
                    
                    // Section-specific member type filter
                    if (sectionFilter.memberTypeFilter && element.memberType !== sectionFilter.memberTypeFilter) {
                      return false;
                    }
                    
                    return true;
                  });

                  // Apply column-specific filters
                  if (sectionFilter.columnFilters) {
                    filteredSectionElements = applyColumnFilters(filteredSectionElements, sectionFilter.columnFilters);
                  }
                  
                  // Helper function to get current pending job for grouping
                  const getCurrentPendingJobTitle = (element) => {
                    const jobs = element.jobs || jobsByElement[element._id] || [];
                    
                    if (jobs.length === 0) {
                      return 'No jobs';
                    }
                    
                    const sortedJobs = [...jobs].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
                    const pendingJob = sortedJobs.find(job => 
                      job.status === 'pending' || job.status === 'in_progress' || job.status === 'not_applicable'
                    );
                    
                    if (!pendingJob) {
                      return 'All jobs complete';
                    }
                    
                    return pendingJob.jobTitle || 'Unknown job';
                  };

                  // Group elements if groupBy is selected
                  const groupedSectionElements = (() => {
                    if (!sectionFilter.groupBy) return { 'All Elements': filteredSectionElements };
                    
                    const grouped = filteredSectionElements.reduce((acc, element) => {
                      let groupKey;
                      
                      if (sectionFilter.groupBy === 'currentPendingJob') {
                        groupKey = getCurrentPendingJobTitle(element);
                      } else {
                        groupKey = element[sectionFilter.groupBy] || 'Unknown';
                      }
                      
                      if (!acc[groupKey]) acc[groupKey] = [];
                      acc[groupKey].push(element);
                      return acc;
                    }, {});
                    
                    // Filter out groups with 0 elements (this shouldn't happen but just in case)
                    return Object.fromEntries(
                      Object.entries(grouped).filter(([groupKey, groupElements]) => groupElements.length > 0)
                    );
                  })();
                  
                  // Pagination for non-grouped view
                  const paginatedElements = sectionFilter.groupBy ? 
                    filteredSectionElements : 
                    filteredSectionElements.slice(
                      sectionFilter.page * sectionFilter.rowsPerPage, 
                      sectionFilter.page * sectionFilter.rowsPerPage + sectionFilter.rowsPerPage
                    );
                  
                  const totalSurfaceArea = filteredSectionElements.reduce((sum, el) => sum + (el.surfaceAreaSqm || 0), 0);
                  
                  // Helper functions for section state management
                  const updateSectionFilter = (updates) => {
                    setSectionFilters(prev => ({
                      ...prev,
                      [statusName]: { ...prev[statusName], ...updates }
                    }));
                  };
                  
                  const handlePageChange = (event, newPage) => {
                    updateSectionFilter({ page: newPage });
                  };
                  
                  const handleRowsPerPageChange = (event) => {
                    updateSectionFilter({ 
                      page: 0, 
                      rowsPerPage: parseInt(event.target.value, 10) 
                    });
                  };
                  
                  const toggleSectionGroupExpansion = (groupKey) => {
                    updateSectionFilter({
                      expandedGroups: {
                        ...sectionFilter.expandedGroups,
                        [groupKey]: !sectionFilter.expandedGroups[groupKey]
                      }
                    });
                  };
                  
                  return sectionElements.length > 0 ? (
                    <Paper 
                      key={statusName}
                      sx={{ 
                        mb: 3,
                        borderRadius: 2,
                        border: '2px solid',
                        borderColor: sectionFilters[statusName].expanded ? statusColor : 'divider',
                        overflow: 'hidden',
                        '&:hover': {
                          borderColor: statusColor,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                        }
                      }}
                    >
                      {/* Section Header */}
                      <Box
                        sx={{
                          p: 3,
                          background: statusName === 'non clearance' 
                            ? 'linear-gradient(135deg, #fef7f7 0%, #fdf2f2 100%)'
                            : sectionFilters[statusName].expanded 
                              ? `linear-gradient(135deg, ${statusColor}22 0%, ${statusColor}44 100%)`
                              : `linear-gradient(135deg, ${statusColor}22 0%, ${statusColor}44 100%)`,
                          borderBottom: `3px solid ${statusColor}`,
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            background: statusName === 'non clearance'
                              ? 'linear-gradient(135deg, #fdecec 0%, #fce6e6 100%)'
                              : `linear-gradient(135deg, ${statusColor}33 0%, ${statusColor}55 100%)`,
                            transform: 'translateY(-1px)'
                          }
                        }}
                        onClick={() => setSectionFilters(prev => ({
                          ...prev,
                          [statusName]: {
                            ...prev[statusName],
                            expanded: !prev[statusName].expanded
                          }
                        }))}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              backgroundColor: statusColor,
                              borderRadius: '50%',
                              p: 1,
                              color: 'white'
                            }}>
                              {sectionFilters[statusName].expanded ? 
                                <KeyboardArrowDownIcon sx={{ fontSize: 24 }} /> : 
                                <KeyboardArrowRightIcon sx={{ fontSize: 24 }} />
                              }
                            </Box>
                            
                            <Box>
                              <Typography variant="h5" fontWeight="700" sx={{ mb: 0.5, color: statusColor }}>
                                {statusTitle}
                              </Typography>
                              <Typography variant="body1" color="text.secondary">
                                {filteredSectionElements.length} elements • {totalSurfaceArea.toFixed(1)} sqm
                              </Typography>
                            </Box>
                          </Box>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Chip
                              label={`${filteredSectionElements.length} / ${sectionElements.length}`}
                              size="medium"
                              sx={{ 
                                backgroundColor: statusColor,
                                color: 'white',
                                fontWeight: 600,
                                fontSize: '0.875rem'
                              }}
                            />
                          </Box>
                        </Box>
                      </Box>

                      {/* Section Content */}
                      <Collapse in={sectionFilters[statusName].expanded} timeout={300}>
                        <Box sx={{ p: 2, backgroundColor: 'white' }}>
                          {/* Section Filters */}
                          <Box sx={{ 
                            mb: 2, 
                            p: 2, 
                            backgroundColor: 'grey.50',
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'divider'
                          }}>
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: statusColor }}>
                              Filter & Group {statusTitle}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                              <TextField
                                label="Search"
                                value={sectionFilter.searchTerm}
                                onChange={(e) => updateSectionFilter({ searchTerm: e.target.value, page: 0 })}
                                variant="outlined"
                                size="small"
                                sx={{ minWidth: 200 }}
                                InputProps={{
                                  startAdornment: (
                                    <InputAdornment position="start">
                                      <SearchIcon sx={{ color: statusColor }} />
                                    </InputAdornment>
                                  ),
                                }}
                              />
                              <FormControl variant="outlined" size="small" sx={{ minWidth: 150 }}>
                                <InputLabel>Member Type</InputLabel>
                                <Select
                                  value={sectionFilter.memberTypeFilter}
                                  onChange={(e) => updateSectionFilter({ memberTypeFilter: e.target.value, page: 0 })}
                                  label="Member Type"
                                >
                                  <MenuItem value="">All Types</MenuItem>
                                  {[...new Set(sectionElements.map(el => el.memberType))].map(type => (
                                    <MenuItem key={type} value={type}>{type}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                              <FormControl variant="outlined" size="small" sx={{ minWidth: 150 }}>
                                <InputLabel>Group By</InputLabel>
                                <Select
                                  value={sectionFilter.groupBy}
                                  onChange={(e) => updateSectionFilter({ 
                                    groupBy: e.target.value, 
                                    page: 0,
                                    expandedGroups: {} 
                                  })}
                                  label="Group By"
                                >
                                  <MenuItem value="">No Grouping</MenuItem>
                                  <MenuItem value="memberType">Member Type</MenuItem>
                                  <MenuItem value="level">Level</MenuItem>
                                  <MenuItem value="gridNo">Grid No</MenuItem>
                                  <MenuItem value="sectionSizes">Section Size</MenuItem>
                                  <MenuItem value="drawingNo">Drawing No</MenuItem>
                                  <MenuItem value="currentPendingJob">Current Pending Job</MenuItem>
                                </Select>
                              </FormControl>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<ViewModuleIcon />}
                                onClick={() => setShowColumnSettings(true)}
                                sx={{ 
                                  borderColor: statusColor,
                                  color: statusColor,
                                  '&:hover': {
                                    backgroundColor: `${statusColor}11`,
                                    borderColor: statusColor
                                  }
                                }}
                              >
                                Columns
                              </Button>
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => updateSectionFilter({
                                  searchTerm: '',
                                  memberTypeFilter: '',
                                  groupBy: '',
                                  page: 0,
                                  expandedGroups: {}
                                })}
                                sx={{ 
                                  borderColor: statusColor,
                                  color: statusColor,
                                  '&:hover': {
                                    backgroundColor: `${statusColor}11`,
                                    borderColor: statusColor
                                  }
                                }}
                              >
                                Clear All
                              </Button>
                            </Box>
                          </Box>

                          {/* Elements Table - Grouped or Regular View */}
                          {sectionFilter.groupBy ? (
                            // Grouped View
                            <Box>
                              {Object.entries(groupedSectionElements).map(([groupKey, groupElements]) => (
                                <Paper 
                                  key={groupKey}
                                  sx={{ 
                                    mb: 2,
                                    borderRadius: 1,
                                    border: '1px solid',
                                    borderColor: sectionFilter.expandedGroups[groupKey] ? statusColor : 'divider',
                                    overflow: 'hidden'
                                  }}
                                >
                                  {/* Group Header */}
                                  <Box
                                    sx={{
                                      p: 1.5,
                                      background: sectionFilter.expandedGroups[groupKey] 
                                        ? `${statusColor}22` 
                                        : 'grey.100',
                                      cursor: 'pointer',
                                      borderBottom: '1px solid',
                                      borderColor: 'divider',
                                      '&:hover': {
                                        background: `${statusColor}33`
                                      }
                                    }}
                                    onClick={() => toggleSectionGroupExpansion(groupKey)}
                                  >
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {sectionFilter.expandedGroups[groupKey] ? 
                                          <KeyboardArrowDownIcon sx={{ fontSize: 20, color: statusColor }} /> : 
                                          <KeyboardArrowRightIcon sx={{ fontSize: 20, color: statusColor }} />
                                        }
                                        <Typography variant="subtitle1" fontWeight="600" sx={{ color: statusColor }}>
                                          {groupKey}
                                        </Typography>
                                        <Chip
                                          label={`${groupElements.length} elements`}
                                          size="small"
                                          sx={{ 
                                            backgroundColor: statusColor,
                                            color: 'white',
                                            fontSize: '0.75rem'
                                          }}
                                        />
                                      </Box>
                                      <Typography variant="body2" color="text.secondary">
                                        {groupElements.reduce((sum, el) => sum + (el.surfaceAreaSqm || 0), 0).toFixed(1)} sqm
                                      </Typography>
                                    </Box>
                                  </Box>

                                  {/* Group Content */}
                                  <Collapse in={sectionFilter.expandedGroups[groupKey]} timeout={200}>
                                    <TableContainer>
                                      <Table size="small">
                                        <TableHead sx={{ backgroundColor: 'grey.50' }}>
                                          <TableRow>
                                            {getVisibleColumns().map(column => (
                                              <TableCell 
                                                key={column.key} 
                                                sx={{ fontWeight: 600, color: 'text.primary' }}
                                              >
                                                {column.key === 'select' ? (
                                                  <Checkbox
                                                    checked={groupElements.every(el => selectedElements.includes(el._id))}
                                                    indeterminate={
                                                      groupElements.some(el => selectedElements.includes(el._id)) && 
                                                      !groupElements.every(el => selectedElements.includes(el._id))
                                                    }
                                                    onChange={(e) => {
                                                      if (e.target.checked) {
                                                        const newSelected = [...selectedElements];
                                                        groupElements.forEach(el => {
                                                          if (!newSelected.includes(el._id)) {
                                                            newSelected.push(el._id);
                                                          }
                                                        });
                                                        setSelectedElements(newSelected);
                                                      } else {
                                                        setSelectedElements(prev => 
                                                          prev.filter(id => !groupElements.map(el => el._id).includes(id))
                                                        );
                                                      }
                                                    }}
                                                    size="small"
                                                    color="primary"
                                                  />
                                                ) : (
                                                  <ColumnFilter 
                                                    column={column} 
                                                    sectionKey={statusName}
                                                    elements={sectionElements}
                                                  />
                                                )}
                                              </TableCell>
                                            ))}
                                          </TableRow>
                                        </TableHead>
                                        <TableBody>
                                          {groupElements.map((element) => (
                                            <TableRow 
                                              key={element._id} 
                                              hover
                                              sx={{
                                                '&:hover': {
                                                  backgroundColor: `${statusColor}08`,
                                                },
                                                '&:nth-of-type(even)': {
                                                  backgroundColor: 'grey.25'
                                                }
                                              }}
                                            >
                                              {getVisibleColumns().map(column => (
                                                <TableCell key={column.key}>
                                                  {renderCellContent(element, column.key)}
                                                </TableCell>
                                              ))}
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </TableContainer>
                                  </Collapse>
                                </Paper>
                              ))}
                            </Box>
                          ) : (
                            // Regular Paginated View
                            <>
                              <TableContainer>
                                <Table>
                                  <TableHead sx={{ backgroundColor: 'grey.50' }}>
                                    <TableRow>
                                      {getVisibleColumns().map(column => (
                                        <TableCell 
                                          key={column.key} 
                                          sx={{ fontWeight: 600, color: 'text.primary' }}
                                        >
                                          {column.key === 'select' ? (
                                            <Checkbox
                                              checked={paginatedElements.every(el => selectedElements.includes(el._id))}
                                              indeterminate={
                                                paginatedElements.some(el => selectedElements.includes(el._id)) && 
                                                !paginatedElements.every(el => selectedElements.includes(el._id))
                                              }
                                              onChange={(e) => {
                                                if (e.target.checked) {
                                                  const newSelected = [...selectedElements];
                                                  paginatedElements.forEach(el => {
                                                    if (!newSelected.includes(el._id)) {
                                                      newSelected.push(el._id);
                                                    }
                                                  });
                                                  setSelectedElements(newSelected);
                                                } else {
                                                  setSelectedElements(prev => 
                                                    prev.filter(id => !paginatedElements.map(el => el._id).includes(id))
                                                  );
                                                }
                                              }}
                                              size="small"
                                              color="primary"
                                            />
                                          ) : (
                                            <ColumnFilter 
                                              column={column} 
                                              sectionKey={statusName}
                                              elements={sectionElements}
                                            />
                                          )}
                                        </TableCell>
                                      ))}
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {paginatedElements.map((element) => (
                                      <TableRow 
                                        key={element._id} 
                                        hover
                                        sx={{
                                          '&:hover': {
                                            backgroundColor: `${statusColor}08`,
                                          },
                                          '&:nth-of-type(even)': {
                                            backgroundColor: 'grey.25'
                                          }
                                        }}
                                      >
                                        {getVisibleColumns().map(column => (
                                          <TableCell key={column.key}>
                                            {renderCellContent(element, column.key)}
                                          </TableCell>
                                        ))}
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                              
                              {/* Pagination */}
                              <TablePagination
                                rowsPerPageOptions={[5, 10, 25, 50]}
                                component="div"
                                count={filteredSectionElements.length}
                                rowsPerPage={sectionFilter.rowsPerPage}
                                page={sectionFilter.page}
                                onPageChange={handlePageChange}
                                onRowsPerPageChange={handleRowsPerPageChange}
                                sx={{
                                  borderTop: '1px solid',
                                  borderColor: 'divider',
                                  '& .MuiTablePagination-actions': {
                                    color: statusColor
                                  }
                                }}
                              />
                            </>
                          )}
                          
                          {filteredSectionElements.length === 0 && (
                            <Box sx={{ textAlign: 'center', py: 4 }}>
                              <Typography variant="body2" color="text.secondary">
                                No elements match the current filters
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Collapse>
                    </Paper>
                  ) : null;
                };

                // Render all status sections
                return (
                  <>
                    {renderStatusSection('non clearance', '🔴 Non Clearance', '#f44336', '#d32f2f')}
                    {renderStatusSection('no jobs', '🟣 No Jobs', '#9c27b0', '#7b1fa2')}
                    {renderStatusSection('active', '🔵 Active Work', '#2196f3', '#1976d2')}
                    {renderStatusSection('complete', '🟢 Complete', '#4caf50', '#388e3c')}
                  </>
                );
              })()}
            </Box>
          </>
        )}
      </Paper>

      {/* Column Settings Dialog */}
      <Dialog 
        open={showColumnSettings} 
        onClose={() => setShowColumnSettings(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ViewModuleIcon />
            <Typography variant="h6">Customize Columns</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Select which columns to show in the table. You can show or hide any column based on your needs.
          </Typography>
          
          <Grid container spacing={2}>
            {availableColumns.map(column => (
              <Grid item xs={12} sm={6} key={column.key}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={visibleColumns[column.key]}
                      onChange={() => toggleColumnVisibility(column.key)}
                      color="primary"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight={visibleColumns[column.key] ? 600 : 400}>
                        {column.label}
                      </Typography>
                      {column.key === 'actions' && (
                        <Chip 
                          label="Required" 
                          size="small" 
                          color="warning" 
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                      )}
                    </Box>
                  }
                  sx={{ 
                    width: '100%',
                    m: 0,
                    p: 1,
                    borderRadius: 1,
                    '&:hover': {
                      backgroundColor: 'grey.50'
                    }
                  }}
                />
              </Grid>
            ))}
          </Grid>

          <Box sx={{ mt: 3, p: 2, backgroundColor: 'info.50', borderRadius: 1 }}>
            <Typography variant="body2" color="info.main" fontWeight="500">
              💡 Tip: You can group by any field and customize which columns to display. 
              The Actions column is always recommended to keep visible for editing elements.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              // Reset to default columns - All available
              setVisibleColumns({
                serialNo: false,
                structureNumber: true,
                drawingNo: true,
                level: false,
                memberType: true,
                gridNo: true,
                partMarkNo: false,
                sectionSizes: true,
                lengthMm: false,
                qty: true,
                sectionDepthMm: false,
                flangeWidthMm: false,
                webThicknessMm: false,
                flangeThicknessMm: false,
                fireproofingThickness: false,
                surfaceAreaSqm: true,
                projectName: false,
                siteLocation: false,
                status: true,
                currentPendingJob: true,
                progress: true,
                actions: true
              });
            }}
          >
            Reset to Default
          </Button>
          <Button
            onClick={() => setShowColumnSettings(false)}
            variant="contained"
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Element Dialog */}
      <AddStructuralElementDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        projectId={projectId}
        onElementAdded={handleElementAdded}
      />

      {/* Edit Element Dialog */}
      <AddStructuralElementDialog
        open={showEditDialog}
        onClose={() => {
          setShowEditDialog(false);
          setEditingElement(null);
        }}
        projectId={projectId}
        editingElement={editingElement}
        onElementAdded={handleElementAdded}
      />

      {/* Excel Upload Dialog */}
      <ExcelUpload
        open={showUploadDialog}
        onClose={() => setShowUploadDialog(false)}
        projectId={projectId}
        onUploadSuccess={() => {
          handleElementAdded();
          setShowUploadDialog(false);
        }}
      />

      {/* Project Edit Dialog */}
      <Dialog 
        open={showProjectEditDialog} 
        onClose={() => setShowProjectEditDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Edit Project Details
        </DialogTitle>

        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Project Title *"
                value={projectEditForm.title}
                onChange={(e) => setProjectEditForm({ ...projectEditForm, title: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Location"
                value={projectEditForm.location}
                onChange={(e) => setProjectEditForm({ ...projectEditForm, location: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                value={projectEditForm.description}
                onChange={(e) => setProjectEditForm({ ...projectEditForm, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={projectEditForm.status}
                  onChange={(e) => setProjectEditForm({ ...projectEditForm, status: e.target.value })}
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="on_hold">On Hold</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={projectEditForm.priority}
                  onChange={(e) => setProjectEditForm({ ...projectEditForm, priority: e.target.value })}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="date"
                label="Due Date"
                value={projectEditForm.dueDate}
                onChange={(e) => setProjectEditForm({ ...projectEditForm, dueDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Category"
                value={projectEditForm.category}
                onChange={(e) => setProjectEditForm({ ...projectEditForm, category: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setShowProjectEditDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveProject}
            variant="contained"
            disabled={!projectEditForm.title.trim()}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Jobs Dialog */}
      <Dialog 
        open={showJobDialog} 
        onClose={handleCloseJobDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          m: 0,
          position: 'relative',
          overflow: 'hidden'
        }}>
          <Box sx={{ 
            position: 'absolute', 
            top: -20, 
            right: -20, 
            width: 60, 
            height: 60, 
            borderRadius: '50%', 
            bgcolor: 'rgba(255,255,255,0.1)' 
          }} />
          {selectedElement && (
            <Box sx={{ position: 'relative', zIndex: 1, py: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <WorkIcon sx={{ fontSize: 32 }} />
                <Box>
                  <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>
                    🏗️ Jobs for {selectedElement.structureNumber}
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    {selectedElement.memberType} - {selectedElement.sectionSizes}
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {/* Select Fire Proofing Type */}
          <Paper elevation={2} sx={{ 
            mb: 4, 
            p: 3, 
            borderRadius: 2,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <Box sx={{ 
              position: 'absolute', 
              top: -50, 
              right: -50, 
              width: 100, 
              height: 100, 
              borderRadius: '50%', 
              bgcolor: 'rgba(255,255,255,0.1)' 
            }} />
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <WorkIcon sx={{ mr: 2, fontSize: 28 }} />
                <Typography variant="h6" fontWeight="bold">
                  🔥 Fire Proofing Workflows
                </Typography>
              </Box>
              <Typography variant="body1" sx={{ mb: 3, opacity: 0.9 }}>
                Select a predefined fire proofing type to automatically create all required jobs in the correct sequence.
              </Typography>
              
              <FormControl fullWidth sx={{ 
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.95)',
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' }
                },
                '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.7)' },
                '& .MuiSelect-select': { color: 'rgba(0,0,0,0.87)' }
              }}>
                <InputLabel>Fire Proofing Type</InputLabel>
                <Select
                  value={selectedJobTypeForPredefined}
                  onChange={(e) => setSelectedJobTypeForPredefined(e.target.value)}
                  label="Fire Proofing Type"
                >
                  {Object.entries(availableJobTypes).map(([key, label]) => (
                    <MenuItem key={key} value={key}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AssignmentIcon sx={{ fontSize: 20 }} />
                        {label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selectedJobTypeForPredefined && predefinedJobsData[selectedJobTypeForPredefined] && (
                <Paper elevation={1} sx={{ 
                  mt: 2, 
                  p: 2, 
                  bgcolor: 'rgba(255,255,255,0.95)', 
                  borderRadius: 2,
                  border: '1px solid rgba(255,255,255,0.3)'
                }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ 
                    color: 'primary.main', 
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}>
                    <PlaylistAddIcon /> Jobs to be created ({predefinedJobsData[selectedJobTypeForPredefined].length}):
                  </Typography>
                  <Box sx={{ pl: 1 }}>
                    {predefinedJobsData[selectedJobTypeForPredefined].map((jobTitle, index) => (
                      <Box key={index} sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        py: 0.8,
                        color: 'text.secondary',
                        borderLeft: '3px solid',
                        borderColor: 'primary.main',
                        pl: 2,
                        ml: 1,
                        mb: 0.5,
                        bgcolor: 'rgba(255,255,255,0.7)',
                        borderRadius: '0 8px 8px 0'
                      }}>
                        <Chip 
                          label={`Step ${index + 1}`} 
                          size="small" 
                          sx={{ 
                            mr: 2, 
                            minWidth: 60,
                            bgcolor: 'primary.main',
                            color: 'white',
                            fontSize: '0.75rem',
                            fontWeight: 'bold'
                          }} 
                        />
                        <Typography variant="body2" sx={{ fontWeight: 'medium', fontSize: '0.95rem' }}>
                          {jobTitle}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Paper>
              )}
            </Box>
          </Paper>

          {/* Existing Jobs List */}
          <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ 
              p: 3, 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <AssignmentIcon sx={{ fontSize: 28 }} />
                  <Typography variant="h6" fontWeight="bold">
                    📋 Existing Jobs ({elementJobs.length})
                  </Typography>
                </Box>
                {elementJobs.length > 0 && elementJobs.some(job => job.stepNumber) && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Workflow Progress:
                    </Typography>
                    <Chip 
                      label={`${elementJobs.filter(job => job.status === 'completed').length}/${elementJobs.length} Steps`}
                      size="small"
                      sx={{ 
                        bgcolor: 'rgba(255,255,255,0.2)',
                        color: 'white',
                        fontWeight: 'bold'
                      }}
                    />
                  </Box>
                )}
              </Box>
            </Box>
            
            {elementJobs.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <WorkIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Alert 
                  severity="info" 
                  sx={{ 
                    borderRadius: 2,
                    '& .MuiAlert-message': { fontSize: '1rem' }
                  }}
                >
                  No jobs found for this structural element. Create your first job using the options above!
                </Alert>
              </Box>
            ) : (
              <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ 
                        bgcolor: 'grey.50', 
                        fontWeight: 'bold',
                        borderBottom: 2,
                        borderColor: 'primary.main',
                        fontSize: '1.1rem'
                      }}>
                        Job Title
                      </TableCell>
                      <TableCell sx={{ 
                        bgcolor: 'grey.50', 
                        fontWeight: 'bold',
                        borderBottom: 2,
                        borderColor: 'primary.main',
                        fontSize: '1.1rem',
                        textAlign: 'center'
                      }}>
                        Fireproofing Type
                      </TableCell>
                      <TableCell sx={{ 
                        bgcolor: 'grey.50', 
                        fontWeight: 'bold',
                        borderBottom: 2,
                        borderColor: 'primary.main',
                        fontSize: '1.1rem',
                        textAlign: 'center'
                      }}>
                        Status
                      </TableCell>
                      <TableCell sx={{ 
                        bgcolor: 'grey.50', 
                        fontWeight: 'bold',
                        borderBottom: 2,
                        borderColor: 'primary.main',
                        fontSize: '1.1rem',
                        textAlign: 'center'
                      }}>
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {/* Insert Job at Beginning Button */}
                    <TableRow sx={{ 
                      backgroundColor: 'transparent',
                      '&:hover .insert-job-btn': { opacity: 1 },
                      height: '32px'
                    }}>
                      <TableCell 
                        colSpan={4} 
                        sx={{ 
                          padding: 0, 
                          borderBottom: 'none',
                          textAlign: 'center',
                          position: 'relative'
                        }}
                      >
                        <Box 
                          className="insert-job-btn"
                          sx={{ 
                            opacity: 0, 
                            transition: 'opacity 0.2s ease',
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 1
                          }}
                        >
                          <Tooltip title="Insert custom job at the beginning" arrow>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => handleInsertJobAt(0)}
                              sx={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                minWidth: 140,
                                height: 28,
                                fontSize: '0.75rem',
                                borderRadius: 2,
                                fontWeight: 'bold',
                                '&:hover': { 
                                  background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                                  transform: 'translateY(-1px)',
                                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                                },
                                transition: 'all 0.3s ease'
                              }}
                            >
                              Insert Job Here
                            </Button>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>

                    {elementJobs.map((job, index) => (
                      <React.Fragment key={job._id}>
                        {/* Main Job Row */}
                        <TableRow 
                          sx={{
                            '&:hover': { 
                              bgcolor: 'action.hover',
                              transform: 'scale(1.005)',
                              transition: 'all 0.2s ease'
                            },
                            '&:nth-of-type(even)': { bgcolor: 'grey.50' },
                            position: 'relative'
                          }}
                        >
                        <TableCell sx={{ py: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            {job.stepNumber && (
                              <Chip 
                                label={`${job.stepNumber}/${job.totalSteps || '?'}`}
                                size="small"
                                variant="outlined"
                                sx={{ 
                                  minWidth: 50,
                                  fontWeight: 'bold',
                                  fontSize: '0.8rem'
                                }}
                              />
                            )}
                            <Typography variant="h6" fontWeight="bold" sx={{ fontSize: '1.1rem' }}>
                              {job.jobTitle}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 3, textAlign: 'center' }}>
                          <Chip 
                            label={job.jobType ? job.jobType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Custom'} 
                            size="medium"
                            variant="outlined"
                            sx={{ 
                              borderRadius: 3,
                              fontWeight: 'bold',
                              fontSize: '0.85rem',
                              px: 2,
                              py: 1,
                              minWidth: 140,
                              borderColor: 'primary.main',
                              color: 'primary.main',
                              '&:hover': {
                                bgcolor: 'primary.light',
                                color: 'white',
                                transform: 'scale(1.05)'
                              },
                              transition: 'all 0.2s ease'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ py: 3, textAlign: 'center' }}>
                          <Chip 
                            label={job.status === 'pending' ? 'Pending' : 
                                  job.status === 'completed' ? 'Completed' : 
                                  job.status === 'not_applicable' ? 'Non clearance' :
                                  job.status.replace('_', ' ')} 
                            size="medium"
                            sx={{ 
                              borderRadius: 3,
                              fontWeight: 'bold',
                              fontSize: '0.9rem',
                              px: 2,
                              py: 1,
                              minWidth: 120,
                              bgcolor: job.status === 'pending' ? '#ff9800' : 
                                      job.status === 'completed' ? '#4caf50' : 
                                      job.status === 'not_applicable' ? '#f44336' : '#ff9800',
                              color: 'white',
                              '&:hover': {
                                bgcolor: job.status === 'pending' ? '#f57c00' : 
                                        job.status === 'completed' ? '#388e3c' : 
                                        job.status === 'not_applicable' ? '#d32f2f' : '#f57c00',
                                transform: 'scale(1.05)'
                              },
                              transition: 'all 0.2s ease'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ py: 3, textAlign: 'center' }}>
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                            <Tooltip title="Edit Job" arrow>
                              <IconButton
                                size="small"
                                onClick={() => handleEditJob(job)}
                                sx={{
                                  color: 'primary.main',
                                  '&:hover': { 
                                    bgcolor: 'primary.light',
                                    color: 'white',
                                    transform: 'scale(1.1)'
                                  },
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Job" arrow>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteJob(job)}
                                sx={{
                                  color: 'error.main',
                                  '&:hover': { 
                                    bgcolor: 'error.light',
                                    color: 'white',
                                    transform: 'scale(1.1)'
                                  },
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Quick Actions" arrow>
                              <IconButton
                                size="small"
                                onClick={(e) => handleJobMenuOpen(e, job)}
                                sx={{
                                  color: 'text.secondary',
                                  '&:hover': { 
                                    bgcolor: 'grey.200',
                                    transform: 'scale(1.1)'
                                  },
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <MoreVertIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                        </TableRow>

                        {/* Insert Job After Button */}
                        <TableRow sx={{ 
                          backgroundColor: 'transparent',
                          '&:hover .insert-job-after': { opacity: 1 },
                          height: '32px'
                        }}>
                          <TableCell 
                            colSpan={4} 
                            sx={{ 
                              padding: 0, 
                              borderBottom: 'none',
                              textAlign: 'center',
                              position: 'relative'
                            }}
                          >
                            <Box 
                              className="insert-job-after"
                              sx={{ 
                                opacity: 0, 
                                transition: 'opacity 0.2s ease',
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                zIndex: 1
                              }}
                            >
                              <Tooltip title={`Insert custom job after ${job.jobTitle}`} arrow>
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => handleInsertJobAt(index + 1)}
                                  sx={{
                                    backgroundColor: 'success.main',
                                    color: 'white',
                                    minWidth: 140,
                                    height: 28,
                                    fontSize: '0.75rem',
                                    '&:hover': { 
                                      backgroundColor: 'success.dark',
                                      transform: 'scale(1.05)'
                                    }
                                  }}
                                >
                                  + Insert Job Here
                                </Button>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseJobDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Job Edit Dialog */}
      <Dialog 
        open={showJobEditDialog} 
        onClose={handleCloseJobEditDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          m: 0
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}>
            <EditIcon sx={{ fontSize: 28 }} />
            <Box>
              <Typography variant="h6" fontWeight="bold">
                ✏️ Edit Job
              </Typography>
              {editingJob && (
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {editingJob.jobTitle}
                </Typography>
              )}
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Job Title *"
                value={jobEditForm.jobTitle}
                onChange={(e) => setJobEditForm({ ...jobEditForm, jobTitle: e.target.value })}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&:hover fieldset': { borderColor: 'primary.main' }
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Fireproofing Type</InputLabel>
                <Select
                  value={jobEditForm.jobType}
                  onChange={(e) => setJobEditForm({ ...jobEditForm, jobType: e.target.value })}
                  label="Fireproofing Type"
                  sx={{ borderRadius: 2 }}
                >
                  {jobTypes.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WorkIcon sx={{ fontSize: 18 }} />
                        {type.label}
                      </Box>
                    </MenuItem>
                  ))}
                  <MenuItem value="custom">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <WorkIcon sx={{ fontSize: 18 }} />
                      Custom
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={jobEditForm.status}
                  onChange={(e) => setJobEditForm({ ...jobEditForm, status: e.target.value })}
                  label="Status"
                  sx={{ borderRadius: 2 }}
                >
                  {jobStatuses.map(status => (
                    <MenuItem key={status.value} value={status.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ 
                          width: 12, 
                          height: 12, 
                          borderRadius: '50%', 
                          bgcolor: status.color 
                        }} />
                        <Typography sx={{ fontSize: '1rem', fontWeight: 'medium' }}>
                          {status.label}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button 
            onClick={handleCloseJobEditDialog}
            sx={{
              borderRadius: 2,
              px: 3,
              py: 1.2,
              fontSize: '1rem',
              borderWidth: 2,
              '&:hover': {
                borderWidth: 2,
                transform: 'translateY(-1px)'
              },
              transition: 'all 0.3s ease'
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleUpdateJob}
            variant="contained"
            disabled={!jobEditForm.jobTitle.trim()}
            sx={{
              borderRadius: 2,
              px: 4,
              py: 1.2,
              fontSize: '1rem',
              fontWeight: 'bold',
              background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #1976D2 30%, #1CB5E0 90%)',
                transform: 'translateY(-1px)',
                boxShadow: '0 6px 20px rgba(33, 150, 243, 0.4)'
              },
              '&:disabled': {
                background: 'rgba(0,0,0,0.12)'
              },
              transition: 'all 0.3s ease'
            }}
          >
            Update Job
          </Button>
        </DialogActions>
      </Dialog>

      {/* Job Actions Menu */}
      <Menu
        anchorEl={jobMenuAnchor}
        open={Boolean(jobMenuAnchor)}
        onClose={handleJobMenuClose}
      >
        {selectedJobForMenu && (
          <>
            <MenuItem onClick={() => handleJobMenuAction('edit')}>
              <EditIcon sx={{ mr: 1 }} />
              Edit Job
            </MenuItem>
            {selectedJobForMenu.status !== 'completed' && (
              <MenuItem onClick={() => handleJobMenuAction('complete')}>
                <CheckIcon sx={{ mr: 1 }} />
                Mark Complete
              </MenuItem>
            )}
            {selectedJobForMenu.status !== 'not_applicable' && (
              <MenuItem onClick={() => handleJobMenuAction('not_applicable')}>
                <CheckCircleIcon sx={{ mr: 1 }} />
                Non clearance
              </MenuItem>
            )}
            {(selectedJobForMenu.status === 'completed' || selectedJobForMenu.status === 'not_applicable') && (
              <MenuItem onClick={() => handleJobMenuAction('pending')}>
                <PlayArrowIcon sx={{ mr: 1 }} />
                Mark Pending
              </MenuItem>
            )}
            <MenuItem onClick={() => handleJobMenuAction('delete')} sx={{ color: 'error.main' }}>
              <DeleteIcon sx={{ mr: 1 }} />
              Delete Job
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Bulk Job Creation Dialog */}
      <Dialog 
        open={showBulkJobDialog} 
        onClose={() => setShowBulkJobDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <WorkIcon color="primary" />
            <Box>
              <Typography variant="h6">
                Assign Fire Proofing Workflow
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Create jobs for {selectedElements.length} selected element{selectedElements.length > 1 ? 's' : ''}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Fire Proofing Type *</InputLabel>
              <Select
                value={bulkJobForm.jobType}
                onChange={(e) => setBulkJobForm({ ...bulkJobForm, jobType: e.target.value })}
                label="Fire Proofing Type *"
              >
                {jobTypes.map(type => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Alert severity="info" sx={{ mt: 2 }}>
              This will create predefined job workflows for all selected elements. 
              Each element will receive the complete sequence of jobs for the selected fire proofing type.
            </Alert>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button 
            onClick={() => setShowBulkJobDialog(false)}
            color="inherit"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleBulkCreateJobs}
            variant="contained"
            startIcon={<WorkIcon />}
            disabled={!bulkJobForm.jobType}
          >
            Create Jobs for {selectedElements.length} Element{selectedElements.length > 1 ? 's' : ''}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Job Creation Dialog */}
      <Dialog
        open={showJobCreationDialog}
        onClose={() => {
          setShowJobCreationDialog(false);
          setInsertionIndex(null);
          setManualJobForm({
            jobTitle: '',
            fireproofingType: '',
            status: 'pending'
          });
        }}
        maxWidth="md"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: 3,
            boxShadow: '0 24px 48px rgba(0,0,0,0.15)',
            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          textAlign: 'center',
          py: 3
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <AddIcon sx={{ fontSize: 32 }} />
            <Typography variant="h5" fontWeight="bold">
              Create Custom Job
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 4 }}>
          {insertionIndex !== null && (
            <Box sx={{ 
              mb: 3, 
              p: 2, 
              bgcolor: 'rgba(33, 150, 243, 0.1)', 
              borderRadius: 2,
              border: '1px solid rgba(33, 150, 243, 0.3)'
            }}>
              <Typography variant="body1" color="primary" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                🎯 <span>Insertion Position: {insertionIndex + 1}</span>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                This job will be inserted at step {insertionIndex + 1} in the workflow
              </Typography>
            </Box>
          )}

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Job Title *"
                value={manualJobForm.jobTitle}
                onChange={(e) => setManualJobForm({ ...manualJobForm, jobTitle: e.target.value })}
                placeholder="Enter job title (e.g., 'Custom Inspection' or 'Step 6: Quality Check')"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    fontSize: '1.1rem',
                    bgcolor: 'rgba(255,255,255,0.7)',
                    '&:hover fieldset': { borderColor: 'primary.main' },
                    '&.Mui-focused fieldset': { borderWidth: 2 }
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel sx={{ fontSize: '1.1rem' }}>Fireproofing Type</InputLabel>
                <Select
                  value={manualJobForm.fireproofingType || ''}
                  onChange={(e) => setManualJobForm({ ...manualJobForm, fireproofingType: e.target.value })}
                  label="Fireproofing Type"
                  sx={{ 
                    borderRadius: 2,
                    fontSize: '1.1rem',
                    bgcolor: 'rgba(255,255,255,0.7)'
                  }}
                >
                  {jobTypes.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WorkIcon sx={{ fontSize: 18 }} />
                        {type.label}
                      </Box>
                    </MenuItem>
                  ))}
                  <MenuItem value="custom">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <WorkIcon sx={{ fontSize: 18 }} />
                      Custom
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel sx={{ fontSize: '1.1rem' }}>Status</InputLabel>
                <Select
                  value={manualJobForm.status}
                  onChange={(e) => setManualJobForm({ ...manualJobForm, status: e.target.value })}
                  label="Status"
                  sx={{ 
                    borderRadius: 2,
                    fontSize: '1.1rem',
                    bgcolor: 'rgba(255,255,255,0.7)'
                  }}
                >
                  {jobStatuses.map(status => (
                    <MenuItem key={status.value} value={status.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ 
                          width: 12, 
                          height: 12, 
                          borderRadius: '50%', 
                          bgcolor: status.color 
                        }} />
                        <Typography sx={{ fontSize: '1rem', fontWeight: 'medium' }}>
                          {status.label}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.5)' }}>
          <Button
            onClick={() => {
              setShowJobCreationDialog(false);
              setInsertionIndex(null);
              setManualJobForm({
                jobTitle: '',
                fireproofingType: '',
                status: 'pending'
              });
              toast('❌ Job creation cancelled');
            }}
            variant="outlined"
            sx={{
              borderRadius: 2,
              px: 3,
              py: 1,
              borderWidth: 2,
              '&:hover': { borderWidth: 2 }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              handleCreateManualJob();
              setShowJobCreationDialog(false);
            }}
            variant="contained"
            disabled={!manualJobForm.jobTitle.trim()}
            startIcon={<AddIcon />}
            sx={{
              borderRadius: 2,
              px: 4,
              py: 1,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                transform: 'translateY(-1px)',
                boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)'
              }
            }}
          >
            Create Job
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setJobToDelete(null);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'linear-gradient(135deg, #ffebee 0%, #fce4ec 100%)',
            border: '2px solid rgba(244, 67, 54, 0.1)',
            boxShadow: '0 20px 40px rgba(244, 67, 54, 0.15)',
          }
        }}
      >
        <DialogTitle sx={{ 
          textAlign: 'center',
          pt: 4,
          pb: 2,
          color: '#d32f2f'
        }}>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: 2 
          }}>
            <Box sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ff5252 0%, #f44336 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'pulse 2s infinite',
              '@keyframes pulse': {
                '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(244, 67, 54, 0.4)' },
                '50%': { transform: 'scale(1.05)', boxShadow: '0 0 0 20px rgba(244, 67, 54, 0)' },
                '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(244, 67, 54, 0)' }
              }
            }}>
              <WarningIcon sx={{ fontSize: 40, color: 'white' }} />
            </Box>
            <Typography variant="h5" fontWeight="bold" color="#d32f2f">
              Confirm Deletion
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ textAlign: 'center', px: 4, pb: 2 }}>
          <Typography variant="body1" sx={{ mb: 2, color: '#424242', fontSize: '1.1rem' }}>
            Are you absolutely sure you want to delete this job?
          </Typography>
          
          {jobToDelete && (
            <Box sx={{ 
              p: 3, 
              mt: 2,
              borderRadius: 2,
              background: 'rgba(244, 67, 54, 0.08)',
              border: '1px solid rgba(244, 67, 54, 0.2)'
            }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 1, color: '#d32f2f' }}>
                📋 {jobToDelete.jobTitle}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Job Type: {jobToDelete.jobType ? jobToDelete.jobType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Custom'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Status: {jobToDelete.status}
              </Typography>
            </Box>
          )}

          <Box sx={{ 
            mt: 3, 
            p: 2, 
            borderRadius: 2,
            background: 'rgba(255, 193, 7, 0.1)',
            border: '1px solid rgba(255, 193, 7, 0.3)'
          }}>
            <Typography variant="body2" fontWeight="bold" color="#f57c00" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              ⚠️ <span>This action cannot be undone!</span>
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Once deleted, this job and all its associated data will be permanently removed from the system.
            </Typography>
          </Box>
        </DialogContent>

        <DialogActions sx={{ 
          p: 3, 
          gap: 2,
          justifyContent: 'center',
          background: 'rgba(255, 255, 255, 0.7)'
        }}>
          <Button
            onClick={() => {
              setShowDeleteDialog(false);
              setJobToDelete(null);
            }}
            variant="outlined"
            size="large"
            sx={{
              minWidth: 120,
              borderRadius: 3,
              borderWidth: 2,
              borderColor: '#757575',
              color: '#424242',
              '&:hover': { 
                borderWidth: 2,
                borderColor: '#424242',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(117, 117, 117, 0.3)'
              },
              transition: 'all 0.3s ease'
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDeleteJob}
            variant="contained"
            size="large"
            startIcon={<DeleteIcon />}
            sx={{
              minWidth: 120,
              borderRadius: 3,
              background: 'linear-gradient(45deg, #f44336 30%, #d32f2f 90%)',
              color: 'white',
              fontWeight: 'bold',
              '&:hover': {
                background: 'linear-gradient(45deg, #d32f2f 30%, #b71c1c 90%)',
                transform: 'translateY(-1px)',
                boxShadow: '0 6px 20px rgba(244, 67, 54, 0.4)'
              },
              transition: 'all 0.3s ease'
            }}
          >
            Delete Job
          </Button>
        </DialogActions>
      </Dialog>

    </Container>
  );
};

export default StructuralElementsList;