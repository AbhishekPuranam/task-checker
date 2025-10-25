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
  Menu
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
  Delete as DeleteIcon
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
  
  // Search, filter, and group state
  const [searchTerm, setSearchTerm] = useState('');
  const [memberTypeFilter, setMemberTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [surfaceAreaRange, setSurfaceAreaRange] = useState([0, 1000]);
  const [quantityRange, setQuantityRange] = useState([1, 100]);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [groupBy, setGroupBy] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [showGroupedView, setShowGroupedView] = useState(false);
  
  // Column visibility state - Default visible columns
  const [visibleColumns, setVisibleColumns] = useState({
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
          // Get jobs for this specific element from the pre-fetched data
          const jobs = jobsByElement[element._id] || [];
          
          let calculatedStatus;
          if (jobs.length === 0) {
            calculatedStatus = 'no jobs';
          } else {
            // Calculate completion percentage based on jobs
            const completedJobs = jobs.filter(job => job.status === 'completed').length;
            const totalJobs = jobs.length;
            const completionPercentage = (completedJobs / totalJobs) * 100;
            
            // Calculate average progress percentage
            const avgProgress = jobs.reduce((sum, job) => sum + (job.progressPercentage || 0), 0) / jobs.length;
            
            // Calculate status based on job completion
            if (completionPercentage === 100 && avgProgress === 100) {
              calculatedStatus = 'complete'; // Mark complete when all jobs done
            } else if (completionPercentage > 0 || avgProgress > 0) {
              calculatedStatus = 'active'; // Some work done but not complete
            } else {
              calculatedStatus = 'pending'; // No work started
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
      setTotalElements(elementsWithStatus.length);
      
      // Update ranges based on actual data
      const maxArea = Math.max(...elementsWithStatus.map(e => e.surfaceAreaSqm || 0), 1000);
      const maxQty = Math.max(...elementsWithStatus.map(e => e.qty || 0), 100);
      setSurfaceAreaRange([0, maxArea]);
      setQuantityRange([1, maxQty]);
      
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

  const handleDeleteJob = async (job) => {
    if (!window.confirm(`Are you sure you want to delete the job "${job.jobTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/api/jobs/${job._id}`);
      toast.success('Job deleted successfully');
      
      // Refresh jobs list and elements table
      fetchElementJobs(selectedElement._id);
      fetchElements(); // Refresh the main elements table to show updated status
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
      
      // Refresh jobs list
      fetchElementJobs(selectedElement._id);
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
      case 'start':
        handleQuickStatusUpdate(selectedJobForMenu, 'in_progress');
        break;
      case 'pause':
        handleQuickStatusUpdate(selectedJobForMenu, 'on_hold');
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
      case 'no jobs': return 'secondary';
      case 'completed': return 'success'; // fallback
      case 'on_hold': return 'warning'; // fallback
      case 'cancelled': return 'error'; // fallback
      default: return 'default';
    }
  };

  const getJobStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'primary';
      case 'pending': return 'warning';
      case 'on_hold': return 'info';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  // Filter and search logic
  const filteredElements = useMemo(() => {
    return elements.filter(element => {
      // Search term filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const structureMatch = element.structureNumber?.toLowerCase().includes(searchLower);
        const drawingMatch = element.drawingNo?.toLowerCase().includes(searchLower);
        const memberTypeMatch = element.memberType?.toLowerCase().includes(searchLower);
        const sectionMatch = element.sectionSizes?.toLowerCase().includes(searchLower);
        if (!structureMatch && !drawingMatch && !memberTypeMatch && !sectionMatch) return false;
      }

      // Member type filter
      if (memberTypeFilter && element.memberType !== memberTypeFilter) return false;

      // Status filter
      if (statusFilter && element.status !== statusFilter) return false;

      // Surface area filter
      const elementSurfaceArea = element.surfaceAreaSqm || 0;
      if (elementSurfaceArea < surfaceAreaRange[0] || elementSurfaceArea > surfaceAreaRange[1]) {
        return false;
      }

      // Quantity filter
      const elementQty = element.qty || 0;
      if (elementQty < quantityRange[0] || elementQty > quantityRange[1]) {
        return false;
      }

      return true;
    });
  }, [elements, searchTerm, memberTypeFilter, statusFilter, surfaceAreaRange, quantityRange]);

  // Available columns configuration - All structural element fields
  const availableColumns = [
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
    { key: 'progress', label: 'Progress', sortable: true },
    { key: 'actions', label: 'Actions', sortable: false }
  ];

  // Available grouping options - All structural element fields
  const groupingOptions = [
    { value: 'memberType', label: 'Member Type' },
    { value: 'status', label: 'Status' },
    { value: 'serialNo', label: 'Serial No.' },
    { value: 'structureNumber', label: 'Structure Number' },
    { value: 'drawingNo', label: 'Drawing Number' },
    { value: 'level', label: 'Level' },
    { value: 'gridNo', label: 'Grid No.' },
    { value: 'partMarkNo', label: 'Part Mark No.' },
    { value: 'sectionSizes', label: 'Section Sizes' },
    { value: 'projectName', label: 'Project Name' },
    { value: 'siteLocation', label: 'Site Location' },
    { value: 'lengthRange', label: 'Length Range' },
    { value: 'quantityRange', label: 'Quantity Range' },
    { value: 'surfaceAreaRange', label: 'Surface Area Range' },
    { value: 'sectionDepthRange', label: 'Section Depth Range' },
    { value: 'flangeWidthRange', label: 'Flange Width Range' },
    { value: 'structurePrefix', label: 'Structure Prefix (First 3 chars)' },
    { value: 'memberTypeAndStatus', label: 'Member Type + Status' },
    { value: 'gridAndLevel', label: 'Grid No. + Level' },
    { value: 'projectAndSite', label: 'Project + Site Location' }
  ];

  // Dynamic grouping logic
  const groupedElements = useMemo(() => {
    if (!groupBy || !showGroupedView) return { 'All Elements': filteredElements };

    const groups = {};
    filteredElements.forEach(element => {
      let groupKey;
      
      switch (groupBy) {
        // Basic field groupings
        case 'memberType':
          groupKey = element.memberType || 'Unknown Type';
          break;
        case 'status':
          groupKey = element.status || 'Unknown Status';
          break;
        case 'serialNo':
          groupKey = element.serialNo || 'Unknown Serial';
          break;
        case 'structureNumber':
          groupKey = element.structureNumber || 'Unknown Structure';
          break;
        case 'drawingNo':
          groupKey = element.drawingNo || 'Unknown Drawing';
          break;
        case 'level':
          groupKey = element.level || 'Unknown Level';
          break;
        case 'gridNo':
          groupKey = element.gridNo || 'Unknown Grid';
          break;
        case 'partMarkNo':
          groupKey = element.partMarkNo || 'Unknown Part Mark';
          break;
        case 'sectionSizes':
          groupKey = element.sectionSizes || 'Unknown Section';
          break;
        case 'projectName':
          groupKey = element.projectName || 'Unknown Project';
          break;
        case 'siteLocation':
          groupKey = element.siteLocation || 'Unknown Site';
          break;
        
        // Range-based groupings
        case 'lengthRange':
          const length = element.lengthMm || 0;
          if (length <= 1000) groupKey = '≤ 1m';
          else if (length <= 3000) groupKey = '1-3m';
          else if (length <= 6000) groupKey = '3-6m';
          else if (length <= 12000) groupKey = '6-12m';
          else groupKey = '> 12m';
          break;
        case 'quantityRange':
          const qty = element.qty || 0;
          if (qty === 1) groupKey = '1 piece';
          else if (qty <= 5) groupKey = '2-5 pieces';
          else if (qty <= 10) groupKey = '6-10 pieces';
          else groupKey = '> 10 pieces';
          break;
        case 'surfaceAreaRange':
          const area = element.surfaceAreaSqm || 0;
          if (area <= 1) groupKey = '≤ 1 sqm';
          else if (area <= 5) groupKey = '1-5 sqm';
          else if (area <= 10) groupKey = '5-10 sqm';
          else groupKey = '> 10 sqm';
          break;
        case 'sectionDepthRange':
          const depth = element.sectionDepthMm || 0;
          if (depth <= 100) groupKey = '≤ 100mm';
          else if (depth <= 200) groupKey = '100-200mm';
          else if (depth <= 300) groupKey = '200-300mm';
          else if (depth <= 500) groupKey = '300-500mm';
          else groupKey = '> 500mm';
          break;
        case 'flangeWidthRange':
          const flange = element.flangeWidthMm || 0;
          if (flange <= 100) groupKey = '≤ 100mm';
          else if (flange <= 150) groupKey = '100-150mm';
          else if (flange <= 200) groupKey = '150-200mm';
          else if (flange <= 300) groupKey = '200-300mm';
          else groupKey = '> 300mm';
          break;
        
        // Custom combination groupings
        case 'structurePrefix':
          groupKey = element.structureNumber?.substring(0, 3) || 'Unknown';
          break;
        case 'memberTypeAndStatus':
          groupKey = `${element.memberType || 'Unknown'} - ${element.status || 'Unknown'}`;
          break;
        case 'gridAndLevel':
          groupKey = `Grid ${element.gridNo || 'Unknown'} - Level ${element.level || 'Unknown'}`;
          break;
        case 'projectAndSite':
          groupKey = `${element.projectName || 'Unknown Project'} - ${element.siteLocation || 'Unknown Site'}`;
          break;
        
        default:
          // For any other field, use the field value directly
          groupKey = element[groupBy] || `Unknown ${groupBy}`;
      }
      
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(element);
    });

    // Sort groups by key
    const sortedGroups = {};
    Object.keys(groups).sort().forEach(key => {
      sortedGroups[key] = groups[key];
    });

    return sortedGroups;
  }, [filteredElements, groupBy, showGroupedView]);

  // Get unique values for filter dropdowns
  const uniqueMemberTypes = [...new Set(elements.map(e => e.memberType))].filter(Boolean);
  const uniqueStatuses = [...new Set(elements.map(e => e.status))].filter(Boolean);
  
  // Calculate ranges for sliders
  const maxSurfaceArea = Math.max(...elements.map(e => e.surfaceAreaSqm || 0), 1000);
  const maxQuantity = Math.max(...elements.map(e => e.qty || 0), 100);
  
  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm('');
    setMemberTypeFilter('');
    setStatusFilter('');
    setSurfaceAreaRange([0, maxSurfaceArea]);
    setQuantityRange([1, maxQuantity]);
    setGroupBy('');
    setShowGroupedView(false);
  };

  // Check if any filters are active
  const hasActiveFilters = searchTerm || memberTypeFilter || statusFilter || 
    surfaceAreaRange[0] > 0 || surfaceAreaRange[1] < maxSurfaceArea || 
    quantityRange[0] > 1 || quantityRange[1] < maxQuantity || groupBy;

  // Toggle group expansion
  const toggleGroupExpansion = (groupKey) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

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
            color={getStatusColor(element.status)}
            sx={{ 
              borderRadius: 1,
              fontWeight: 500,
              textTransform: 'capitalize'
            }}
          />
        );
      case 'progress':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" fontWeight="600">
              {element.completionPercentage || 0}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ({element.jobsCompleted || 0}/{element.totalJobs || 0})
            </Typography>
          </Box>
        );
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

  // Initialize expanded groups when groupBy changes
  useEffect(() => {
    if (showGroupedView && groupBy) {
      const newExpandedGroups = {};
      Object.keys(groupedElements).forEach(key => {
        newExpandedGroups[key] = true; // Expand all groups by default
      });
      setExpandedGroups(newExpandedGroups);
    }
  }, [groupBy, showGroupedView, groupedElements]);

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
              <Box sx={{ mt: 1, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
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
                      default: return 'default';
                    }
                  };
                  
                  return (
                    <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Project Status</Typography>
                        <Chip 
                          label={projectStatus.replace('_', ' ')} 
                          color={getProjectStatusColor(projectStatus)}
                          sx={{ fontWeight: 'bold', textTransform: 'capitalize' }}
                        />
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Total Surface Area</Typography>
                        <Typography variant="h6" fontWeight="bold">{totalSurfaceArea.toFixed(2)} sqm</Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Completed Surface Area</Typography>
                        <Typography variant="h6" fontWeight="bold" color="success.main">
                          {completedSurfaceArea.toFixed(2)} sqm ({completionPercentage.toFixed(1)}%)
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Elements Progress</Typography>
                        <Typography variant="h6" fontWeight="bold">
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
            <Typography variant="h4" gutterBottom>
              Structural Elements
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowAddDialog(true)}
            >
              Add Element
            </Button>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setShowUploadDialog(true)}
            >
              Upload Excel
            </Button>
          </Box>
        </Box>

        {/* Search and Filters Section - ArmorCode Style */}
        <Paper sx={{ 
          p: 3, 
          mb: 3,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          {/* Search Bar */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <TextField
              fullWidth
              placeholder="Search by structure number, drawing number, member type, or section sizes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'primary.main' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'white',
                  borderRadius: 2,
                  '& fieldset': { border: 'none' },
                  '&:hover fieldset': { border: 'none' },
                  '&.Mui-focused fieldset': { border: '2px solid', borderColor: 'primary.main' }
                },
                '& .MuiInputBase-input': {
                  fontSize: '0.95rem',
                  fontWeight: 500
                }
              }}
            />
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 2,
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: 2,
              px: 2,
              minWidth: 220
            }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" fontWeight="600">
                  {showGroupedView 
                    ? Object.keys(groupedElements).length
                    : filteredElements.length
                  }
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  {showGroupedView ? 'Groups' : 'Elements'}
                </Typography>
              </Box>
              <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.3)' }} />
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" fontWeight="600">
                  {filteredElements.length}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  Total Elements
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Group By Toggle and Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showGroupedView}
                  onChange={(e) => {
                    setShowGroupedView(e.target.checked);
                    if (!e.target.checked) setGroupBy('');
                  }}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ViewModuleIcon />
                  <Typography>Grouped View</Typography>
                </Box>
              }
            />
            {showGroupedView && (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel sx={{ color: 'white', '&.Mui-focused': { color: 'white' } }}>Group By</InputLabel>
                <Select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  label="Group By"
                  sx={{
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    color: 'white',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                    '& .MuiSvgIcon-root': { color: 'white' }
                  }}
                >
                  {groupingOptions.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            
            {/* Column Settings Button */}
            <Button
              variant="outlined"
              startIcon={<ViewModuleIcon />}
              onClick={() => setShowColumnSettings(true)}
              sx={{
                color: 'white',
                borderColor: 'rgba(255,255,255,0.3)',
                backgroundColor: 'rgba(255,255,255,0.1)',
                '&:hover': {
                  borderColor: 'white',
                  backgroundColor: 'rgba(255,255,255,0.2)'
                }
              }}
            >
              Columns
            </Button>
          </Box>

          {/* Filters Accordion */}
          <Accordion 
            expanded={filtersExpanded} 
            onChange={(e, isExpanded) => setFiltersExpanded(isExpanded)}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FilterListIcon />
                <Typography>Advanced Filters</Typography>
                {hasActiveFilters && (
                  <Chip 
                    label="Filters Active" 
                    size="small" 
                    color="primary" 
                    variant="outlined" 
                  />
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                {/* Member Type Filter */}
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Member Type</InputLabel>
                    <Select
                      value={memberTypeFilter}
                      onChange={(e) => setMemberTypeFilter(e.target.value)}
                      label="Member Type"
                    >
                      <MenuItem value="">All Types</MenuItem>
                      {uniqueMemberTypes.map(type => (
                        <MenuItem key={type} value={type}>
                          <Chip
                            label={type}
                            size="small"
                            variant="outlined"
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Status Filter */}
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      label="Status"
                    >
                      <MenuItem value="">All Statuses</MenuItem>
                      {uniqueStatuses.map(status => (
                        <MenuItem key={status} value={status}>
                          <Chip
                            label={status}
                            color={getStatusColor(status)}
                            size="small"
                            variant="outlined"
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Surface Area Range Filter */}
                <Grid item xs={12} sm={6} md={3}>
                  <Typography gutterBottom>
                    Surface Area: {surfaceAreaRange[0]} - {surfaceAreaRange[1]} sqm
                  </Typography>
                  <Slider
                    value={surfaceAreaRange}
                    onChange={(e, newValue) => setSurfaceAreaRange(newValue)}
                    valueLabelDisplay="auto"
                    min={0}
                    max={maxSurfaceArea}
                    step={0.1}
                  />
                </Grid>

                {/* Quantity Range Filter */}
                <Grid item xs={12} sm={6} md={3}>
                  <Typography gutterBottom>
                    Quantity: {quantityRange[0]} - {quantityRange[1]}
                  </Typography>
                  <Slider
                    value={quantityRange}
                    onChange={(e, newValue) => setQuantityRange(newValue)}
                    valueLabelDisplay="auto"
                    min={1}
                    max={maxQuantity}
                    step={1}
                  />
                </Grid>

                {/* Clear Filters Button */}
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    startIcon={<ClearIcon />}
                    onClick={clearAllFilters}
                    disabled={!hasActiveFilters}
                  >
                    Clear All Filters & Groups
                  </Button>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Paper>

        {elements.length === 0 && !loading ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            No structural elements found. Add elements individually or upload an Excel file to get started.
          </Alert>
        ) : (
          <>
            {/* Render Table - Regular or Grouped View */}
            {showGroupedView && groupBy ? (
              // Grouped View - ArmorCode Style
              <Box sx={{ backgroundColor: '#f8fafc' }}>
                {Object.entries(groupedElements).map(([groupKey, groupElements]) => {
                  const totalSurfaceArea = groupElements.reduce((sum, el) => sum + (el.surfaceAreaSqm || 0), 0);
                  const statusCounts = groupElements.reduce((acc, el) => {
                    acc[el.status] = (acc[el.status] || 0) + 1;
                    return acc;
                  }, {});
                  
                  return (
                    <Paper 
                      key={groupKey} 
                      sx={{ 
                        mb: 3,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: expandedGroups[groupKey] ? 'primary.main' : 'divider',
                        overflow: 'hidden',
                        '&:hover': {
                          borderColor: 'primary.main',
                          boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                        }
                      }}
                    >
                      {/* Group Header - ArmorCode Style */}
                      <Box
                        sx={{
                          p: 2.5,
                          background: expandedGroups[groupKey] 
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                          color: 'white',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            transform: 'translateY(-1px)'
                          }
                        }}
                        onClick={() => toggleGroupExpansion(groupKey)}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          {/* Left Side - Title and Stats */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              backgroundColor: 'rgba(255,255,255,0.15)',
                              borderRadius: '50%',
                              p: 0.5,
                              transition: 'transform 0.2s ease'
                            }}>
                              {expandedGroups[groupKey] ? 
                                <KeyboardArrowDownIcon sx={{ fontSize: 20 }} /> : 
                                <KeyboardArrowRightIcon sx={{ fontSize: 20 }} />
                              }
                            </Box>
                            
                            <Box>
                              <Typography variant="h6" fontWeight="600" sx={{ mb: 0.5 }}>
                                {groupKey}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                                <Chip
                                  label={`${groupElements.length} elements`}
                                  size="small"
                                  sx={{ 
                                    backgroundColor: 'rgba(255,255,255,0.2)',
                                    color: 'white',
                                    fontWeight: 500,
                                    '& .MuiChip-label': { px: 1 }
                                  }}
                                />
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                  {Object.entries(statusCounts).map(([status, count]) => (
                                    <Chip
                                      key={status}
                                      label={`${status}: ${count}`}
                                      size="small"
                                      sx={{ 
                                        backgroundColor: 'rgba(255,255,255,0.1)',
                                        color: 'white',
                                        fontSize: '0.75rem',
                                        height: 20,
                                        '& .MuiChip-label': { px: 0.8 }
                                      }}
                                    />
                                  ))}
                                </Box>
                              </Box>
                            </Box>
                          </Box>

                          {/* Right Side - Summary Metrics */}
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="h6" fontWeight="600" sx={{ mb: 0.5 }}>
                              {totalSurfaceArea.toFixed(2)} sqm
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                              Total Surface Area
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                      
                      {/* Group Content */}
                      <Collapse in={expandedGroups[groupKey]} timeout={300}>
                        <Box sx={{ backgroundColor: 'white' }}>
                          {/* Mini Summary Bar */}
                          <Box sx={{ 
                            p: 1.5, 
                            backgroundColor: 'grey.50',
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <Typography variant="body2" color="text.secondary" fontWeight="500">
                              Showing {groupElements.length} elements in {groupKey}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                              <Typography variant="body2" color="text.secondary">
                                Avg Surface Area: {(totalSurfaceArea / groupElements.length).toFixed(2)} sqm
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Total Quantity: {groupElements.reduce((sum, el) => sum + (el.qty || 0), 0)}
                              </Typography>
                            </Box>
                          </Box>

                          {/* Elements Table */}
                          <TableContainer>
                            <Table size="small">
                              <TableHead sx={{ backgroundColor: 'grey.50' }}>
                                <TableRow>
                                  {getVisibleColumns().map(column => (
                                    <TableCell 
                                      key={column.key} 
                                      sx={{ fontWeight: 600, color: 'text.primary' }}
                                    >
                                      {column.label}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {groupElements.map((element, index) => (
                                  <TableRow 
                                    key={element._id} 
                                    hover
                                    sx={{
                                      '&:hover': {
                                        backgroundColor: 'primary.50',
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
                        </Box>
                      </Collapse>
                    </Paper>
                  );
                })}
              </Box>
            ) : (
              // Regular Table View
              <TableContainer>
                <Table>
                  <TableHead sx={{ backgroundColor: 'grey.50' }}>
                    <TableRow>
                      {getVisibleColumns().map(column => (
                        <TableCell 
                          key={column.key} 
                          sx={{ fontWeight: 600, color: 'text.primary' }}
                        >
                          {column.label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredElements.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((element) => (
                      <TableRow 
                        key={element._id} 
                        hover
                        sx={{
                          '&:hover': {
                            backgroundColor: 'primary.50',
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
            )}

            {!showGroupedView && (
              <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={filteredElements.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
              />
            )}
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
        <DialogTitle>
          {selectedElement && (
            <Box>
              <Typography variant="h6">
                Jobs for {selectedElement.structureNumber}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedElement.memberType} - {selectedElement.sectionSizes}
              </Typography>
            </Box>
          )}
        </DialogTitle>

        <DialogContent>
          {/* Select Fire Proofing Type */}
          <Box sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="subtitle1" gutterBottom>
              Select Fire Proofing Type
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Choose a fire proofing type to create all required jobs automatically in the correct sequence.
            </Typography>
            
            <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
              <InputLabel>Fire Proofing Type</InputLabel>
              <Select
                value={selectedJobTypeForPredefined}
                onChange={(e) => setSelectedJobTypeForPredefined(e.target.value)}
                label="Fire Proofing Type"
              >
                {Object.entries(availableJobTypes).map(([key, label]) => (
                  <MenuItem key={key} value={key}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedJobTypeForPredefined && predefinedJobsData[selectedJobTypeForPredefined] && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Jobs that will be created:
                </Typography>
                <Box sx={{ pl: 1 }}>
                  {predefinedJobsData[selectedJobTypeForPredefined].map((jobTitle, index) => (
                    <Typography key={index} variant="body2" color="text.secondary">
                      {index + 1}. {jobTitle}
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="contained"
                startIcon={<PlaylistAddIcon />}
                onClick={handleCreatePredefinedJobs}
                disabled={!selectedJobTypeForPredefined}
                size="large"
              >
                Create Jobs ({selectedJobTypeForPredefined && predefinedJobsData[selectedJobTypeForPredefined] ? predefinedJobsData[selectedJobTypeForPredefined].length : 0} jobs)
              </Button>
            </Box>
          </Box>

          {/* Existing Jobs List */}
          <Typography variant="subtitle1" gutterBottom>
            Existing Jobs ({elementJobs.length})
          </Typography>
          {elementJobs.length === 0 ? (
            <Alert severity="info">No jobs found for this structural element.</Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Job Title</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Due Date</TableCell>
                    <TableCell>Progress</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {elementJobs.map((job) => (
                    <TableRow key={job._id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {job.jobTitle}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {job.jobDescription}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={job.jobType} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={job.priority} 
                          size="small" 
                          color={job.priority === 'urgent' ? 'error' : job.priority === 'high' ? 'warning' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={job.status.replace('_', ' ')} 
                          size="small" 
                          color={getJobStatusColor(job.status)}
                        />
                      </TableCell>
                      <TableCell>
                        {job.dueDate ? new Date(job.dueDate).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {job.progressPercentage}%
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Edit Job">
                            <IconButton
                              size="small"
                              onClick={() => handleEditJob(job)}
                              color="primary"
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Quick Actions">
                            <IconButton
                              size="small"
                              onClick={(e) => handleJobMenuOpen(e, job)}
                            >
                              <MoreVertIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
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
        <DialogTitle>
          Edit Job
          {editingJob && (
            <Typography variant="body2" color="text.secondary">
              {editingJob.jobTitle}
            </Typography>
          )}
        </DialogTitle>

        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Job Title *"
                value={jobEditForm.jobTitle}
                onChange={(e) => setJobEditForm({ ...jobEditForm, jobTitle: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Job Type</InputLabel>
                <Select
                  value={jobEditForm.jobType}
                  onChange={(e) => setJobEditForm({ ...jobEditForm, jobType: e.target.value })}
                  label="Job Type"
                >
                  {jobTypes.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Job Description *"
                value={jobEditForm.jobDescription}
                onChange={(e) => setJobEditForm({ ...jobEditForm, jobDescription: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={jobEditForm.priority}
                  onChange={(e) => setJobEditForm({ ...jobEditForm, priority: e.target.value })}
                  label="Priority"
                >
                  {priorities.map(priority => (
                    <MenuItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={jobEditForm.status}
                  onChange={(e) => setJobEditForm({ ...jobEditForm, status: e.target.value })}
                  label="Status"
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
              <TextField
                fullWidth
                type="number"
                label="Progress %"
                value={jobEditForm.progressPercentage}
                onChange={(e) => setJobEditForm({ ...jobEditForm, progressPercentage: e.target.value })}
                inputProps={{ min: 0, max: 100 }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                label="Estimated Hours"
                value={jobEditForm.estimatedHours}
                onChange={(e) => setJobEditForm({ ...jobEditForm, estimatedHours: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="date"
                label="Due Date"
                value={jobEditForm.dueDate}
                onChange={(e) => setJobEditForm({ ...jobEditForm, dueDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={jobEditForm.qualityCheckRequired}
                    onChange={(e) => setJobEditForm({ ...jobEditForm, qualityCheckRequired: e.target.checked })}
                  />
                }
                label="Quality Check Required"
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseJobEditDialog}>Cancel</Button>
          <Button 
            onClick={handleUpdateJob}
            variant="contained"
            disabled={!jobEditForm.jobTitle.trim() || !jobEditForm.jobDescription.trim()}
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
            {selectedJobForMenu.status === 'pending' && (
              <MenuItem onClick={() => handleJobMenuAction('start')}>
                <PlayArrowIcon sx={{ mr: 1 }} />
                Start Job
              </MenuItem>
            )}
            {selectedJobForMenu.status === 'in_progress' && (
              <MenuItem onClick={() => handleJobMenuAction('pause')}>
                <PauseIcon sx={{ mr: 1 }} />
                Put On Hold
              </MenuItem>
            )}
            {(selectedJobForMenu.status === 'on_hold' || selectedJobForMenu.status === 'completed') && (
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



    </Container>
  );
};

export default StructuralElementsList;