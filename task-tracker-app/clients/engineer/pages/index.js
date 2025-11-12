import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Grid,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  AppBar,
  Toolbar,
  IconButton,
  TextField,
  Chip,
  InputAdornment,
  Tabs,
  Tab,
  LinearProgress,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Build,
  LogoutOutlined,
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  AccountCircle,
  DirectionsCar,
  EmojiEvents,
  LocalFireDepartment,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

// Tab definitions
const TABS = [
  { id: 'pending', label: 'Pending', color: '#f59e0b', icon: <Build /> },
  { id: 'completed', label: 'Complete', color: '#10b981', icon: <CheckCircle /> },
  { id: 'not_applicable', label: 'No Clearance', color: '#ef4444', icon: <Cancel /> },
];

export default function EngineerDashboard() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingJob, setUpdatingJob] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [groupBy, setGroupBy] = useState('jobTitle'); // Default to jobTitle (job names)
  const [subGroupBy, setSubGroupBy] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [groupMetrics, setGroupMetrics] = useState({}); // Store count/metrics per group
  const [groupJobs, setGroupJobs] = useState({}); // Store actual jobs per group (lazy loaded)
  const [loadingGroups, setLoadingGroups] = useState({}); // Track loading state per group
  const [allJobsCache, setAllJobsCache] = useState({}); // Cache all jobs per status to avoid refetching

  // Stats for metrics
  const [stats, setStats] = useState({
    pending: { count: 0, sqm: 0 },
    completed: { count: 0, sqm: 0 },
    not_applicable: { count: 0, sqm: 0 },
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    console.log('🔄 Engineer Portal v2.1 - Batch Fetching Enabled');
    if (selectedProject) {
      fetchMetrics(); // Only fetch metrics initially, not all jobs
    }
  }, [selectedProject, activeTab, groupBy, subGroupBy]);

  // Clear all caches when project changes
  useEffect(() => {
    setExpandedGroups({});
    setGroupJobs({});
    setGroupMetrics({});
    setAllJobsCache({});
  }, [selectedProject]);

  // Reset expanded groups when filters change
  useEffect(() => {
    setExpandedGroups({});
    setGroupJobs({});
    setGroupMetrics({});
    // Note: Don't clear allJobsCache here - it persists across group/subgroup changes
    // Only clear when activeTab or selectedProject changes
  }, [activeTab, groupBy, subGroupBy, searchTerm]);

  const fetchProjects = async () => {
    try {
      const response = await api.get('/projects');
      setProjects(response.data.tasks || []);
      if (response.data.tasks && response.data.tasks.length > 0) {
        setSelectedProject(response.data.tasks[0]._id);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  // Fetch only metrics and counts (fast, from cache)
  const fetchMetrics = useCallback(async () => {
    if (!selectedProject) return;
    
    try {
      setLoading(true);
      console.log('Fetching metrics for project:', selectedProject);
      
      // Fetch lightweight metrics from dedicated endpoint
      const metricsResponse = await api.get(`/jobs/engineer/metrics?project=${selectedProject}`);
      const metricsData = metricsResponse.data;
      
      console.log('Fetched metrics:', metricsData);
      console.log('Status breakdown:', metricsData.statusBreakdown);
      
      // Update overall stats from metrics endpoint
      setStats({
        pending: { count: metricsData.statusBreakdown.pending?.count || 0, sqm: metricsData.statusBreakdown.pending?.sqm || 0 },
        completed: { count: metricsData.statusBreakdown.completed?.count || 0, sqm: metricsData.statusBreakdown.completed?.sqm || 0 },
        not_applicable: { count: metricsData.statusBreakdown.not_applicable?.count || 0, sqm: metricsData.statusBreakdown.not_applicable?.sqm || 0 }
      });
      
      console.log('Updated stats:', {
        pending: metricsData.statusBreakdown.pending?.count || 0,
        completed: metricsData.statusBreakdown.completed?.count || 0,
        not_applicable: metricsData.statusBreakdown.not_applicable?.count || 0
      });
      
      // Fetch unique group values from backend (very fast - no job data, just distinct values)
      const statusForCurrentTab = activeTab === 'pending' ? '' : activeTab;
      
      try {
        const groupsResponse = await api.get(`/jobs/engineer/groups?project=${selectedProject}${statusForCurrentTab ? `&status=${statusForCurrentTab}` : ''}&groupBy=${groupBy}${subGroupBy ? `&subGroupBy=${subGroupBy}` : ''}`);
        const groupsData = groupsResponse.data;
        
        console.log(`📂 Fetched ${groupsData.groups.length} unique groups for ${groupBy}`);
        
        // Build groupMetrics structure with just group names (no data yet)
        const metrics = {};
        groupsData.groups.forEach(groupName => {
          metrics[groupName] = {
            count: 0,
            jobCount: 0,
            sqm: 0,
            qty: 0,
            subGroups: {}
          };
          
          // Add subgroups if they exist
          if (subGroupBy && groupsData.subGroups[groupName]) {
            groupsData.subGroups[groupName].forEach(subGroupName => {
              metrics[groupName].subGroups[subGroupName] = {
                count: 0,
                jobCount: 0,
                sqm: 0,
                qty: 0
              };
            });
          }
        });
        
        setGroupMetrics(metrics);
        console.log('Group structure created. Job data will be fetched on accordion expansion.');
      } catch (error) {
        console.error('Error fetching groups:', error);
        setGroupMetrics({});
      }
      
      console.log('Metrics loaded. Full job data will be fetched on accordion expansion.');
      
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast.error('Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  }, [selectedProject, activeTab, groupBy, subGroupBy, searchTerm]);

  // Calculate group metrics (element count and sqm per group)
  const calculateGroupMetrics = (jobsData) => {
    const metrics = {};
    
    // Track unique structural elements per group
    const groupElements = {};
    const subGroupElements = {};
    const groupJobCounts = {};
    const subGroupJobCounts = {};
    
    jobsData.forEach(job => {
      const jobStatus = !job.status || job.status === 'in_progress' ? 'pending' : job.status;
      
      // Filter by active tab
      if (jobStatus !== activeTab) return;
      
      // Filter by search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matches = 
          job.jobTitle?.toLowerCase().includes(searchLower) ||
          job.structuralElement?.structureNumber?.toLowerCase().includes(searchLower) ||
          job.structuralElement?.gridNo?.toLowerCase().includes(searchLower) ||
          job.structuralElement?.partMarkNo?.toLowerCase().includes(searchLower) ||
          job.structuralElement?.level?.toLowerCase().includes(searchLower);
        
        if (!matches) return;
      }
      
      const primaryKey = job.structuralElement?.[groupBy] || job[groupBy] || 'Other';
      
      if (!metrics[primaryKey]) {
        metrics[primaryKey] = { count: 0, jobCount: 0, sqm: 0, qty: 0, subGroups: {} };
        groupElements[primaryKey] = new Set();
        groupJobCounts[primaryKey] = 0;
        subGroupElements[primaryKey] = {};
        subGroupJobCounts[primaryKey] = {};
      }
      
      // Count every job
      groupJobCounts[primaryKey]++;
      
      // Track unique structural elements
      const elementId = job.structuralElement?._id?.toString();
      if (elementId) {
        // Add element to group set
        if (!groupElements[primaryKey].has(elementId)) {
          groupElements[primaryKey].add(elementId);
          metrics[primaryKey].sqm += job.structuralElement?.surfaceAreaSqm || 0;
          metrics[primaryKey].qty += job.structuralElement?.qty || 0;
        }
      }
      
      // Track sub-group metrics
      if (subGroupBy) {
        const secondaryKey = job[subGroupBy] || job.structuralElement?.[subGroupBy] || 'Other';
        if (!metrics[primaryKey].subGroups[secondaryKey]) {
          metrics[primaryKey].subGroups[secondaryKey] = { count: 0, jobCount: 0, sqm: 0, qty: 0 };
          subGroupElements[primaryKey][secondaryKey] = new Set();
          subGroupJobCounts[primaryKey][secondaryKey] = 0;
        }
        
        // Count every job in subgroup
        subGroupJobCounts[primaryKey][secondaryKey]++;
        
        // Track unique structural elements for sub-group
        if (elementId && !subGroupElements[primaryKey][secondaryKey].has(elementId)) {
          subGroupElements[primaryKey][secondaryKey].add(elementId);
          metrics[primaryKey].subGroups[secondaryKey].sqm += job.structuralElement?.surfaceAreaSqm || 0;
          metrics[primaryKey].subGroups[secondaryKey].qty += job.structuralElement?.qty || 0;
        }
      }
    });
    
    // Update counts with unique element counts and job counts
    Object.keys(metrics).forEach(primaryKey => {
      metrics[primaryKey].count = groupElements[primaryKey].size;
      metrics[primaryKey].jobCount = groupJobCounts[primaryKey];
      
      if (subGroupBy) {
        Object.keys(metrics[primaryKey].subGroups).forEach(secondaryKey => {
          metrics[primaryKey].subGroups[secondaryKey].count = subGroupElements[primaryKey][secondaryKey].size;
          metrics[primaryKey].subGroups[secondaryKey].jobCount = subGroupJobCounts[primaryKey][secondaryKey];
        });
      }
    });
    
    return metrics;
  };

  // Fetch jobs for a specific group (lazy loading with caching)
  const fetchGroupJobs = useCallback(async (groupKey) => {
    if (groupJobs[groupKey]) return; // Already loaded for this group
    
    try {
      setLoadingGroups(prev => ({ ...prev, [groupKey]: true }));
      console.log('Fetching jobs for group:', groupKey);
      
      // Check if we already have all jobs cached for this status
      let fetchedJobs = allJobsCache[activeTab];
      
      if (!fetchedJobs) {
        // Fetch jobs in smaller batches to avoid timeout
        // We'll fetch iteratively until we have all jobs for this status
        const totalJobsForStatus = stats[activeTab]?.count || 0;
        
        if (totalJobsForStatus === 0) {
          setGroupJobs(prev => ({ ...prev, [groupKey]: { jobs: [] } }));
          setLoadingGroups(prev => ({ ...prev, [groupKey]: false }));
          return;
        }
        
        // Fetch in batches of 10000 to avoid timeout
        const batchSize = 10000;
        const totalBatches = Math.ceil(totalJobsForStatus / batchSize);
        fetchedJobs = [];
        
        console.log(`Fetching ${totalJobsForStatus} jobs in ${totalBatches} batches`);
        
        const statusParam = activeTab === 'pending' ? '' : activeTab;
        
        // Fetch first batch
        const response = await api.get(`/jobs/engineer/jobs?page=1&limit=${batchSize}&project=${selectedProject}${statusParam ? `&status=${statusParam}` : ''}`);
        fetchedJobs = response.data.jobs || [];
        
        console.log(`Fetched batch 1/${totalBatches}: ${fetchedJobs.length} jobs`);
        
        // If there are more jobs, continue fetching in background
        if (fetchedJobs.length >= batchSize && totalBatches > 1) {
          // Use the first batch immediately
          setAllJobsCache(prev => ({ ...prev, [activeTab]: fetchedJobs }));
          
          // Continue fetching remaining batches in background
          (async () => {
            let allJobs = [...fetchedJobs];
            for (let i = 2; i <= totalBatches; i++) {
              try {
                const batchResponse = await api.get(`/jobs/engineer/jobs?page=${i}&limit=${batchSize}&project=${selectedProject}${statusParam ? `&status=${statusParam}` : ''}`);
                const batchJobs = batchResponse.data.jobs || [];
                allJobs = [...allJobs, ...batchJobs];
                console.log(`Fetched batch ${i}/${totalBatches}: ${batchJobs.length} jobs (total: ${allJobs.length})`);
                
                // Update cache with accumulated jobs
                setAllJobsCache(prev => ({ ...prev, [activeTab]: allJobs }));
              } catch (error) {
                console.error(`Error fetching batch ${i}:`, error);
                break;
              }
            }
          })();
        } else {
          // All jobs fetched in first batch
          setAllJobsCache(prev => ({ ...prev, [activeTab]: fetchedJobs }));
        }
      } else {
        console.log(`Using cached ${fetchedJobs.length} jobs for status ${activeTab}`);
      }
      
      // Filter jobs for this specific group from cached data
      const filteredJobs = fetchedJobs.filter(job => {
        const jobStatus = !job.status || job.status === 'in_progress' ? 'pending' : job.status;
        if (jobStatus !== activeTab) return false;
        
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          const matches = 
            job.jobTitle?.toLowerCase().includes(searchLower) ||
            job.structuralElement?.structureNumber?.toLowerCase().includes(searchLower) ||
            job.structuralElement?.gridNo?.toLowerCase().includes(searchLower) ||
            job.structuralElement?.partMarkNo?.toLowerCase().includes(searchLower) ||
            job.structuralElement?.level?.toLowerCase().includes(searchLower);
          
          if (!matches) return false;
        }
        
        const primaryKey = job.structuralElement?.[groupBy] || job[groupBy] || 'Other';
        return primaryKey === groupKey;
      });
      
      // Group by sub-group if needed
      let groupedData;
      if (subGroupBy) {
        groupedData = {};
        filteredJobs.forEach(job => {
          const secondaryKey = job[subGroupBy] || job.structuralElement?.[subGroupBy] || 'Other';
          if (!groupedData[secondaryKey]) {
            groupedData[secondaryKey] = [];
          }
          groupedData[secondaryKey].push(job);
        });
      } else {
        groupedData = { jobs: filteredJobs };
      }
      
      setGroupJobs(prev => ({
        ...prev,
        [groupKey]: groupedData
      }));
      
    } catch (error) {
      console.error('Error fetching group jobs:', error);
      toast.error('Failed to load jobs for this group');
    } finally {
      setLoadingGroups(prev => ({ ...prev, [groupKey]: false }));
    }
  }, [activeTab, groupBy, subGroupBy, searchTerm, selectedProject, groupJobs, allJobsCache, stats]);

  const fetchJobs = useCallback(async () => {
    // Deprecated - now using fetchMetrics and fetchGroupJobs
    await fetchMetrics();
  }, [fetchMetrics]);

  const calculateStats = (jobsData) => {
    const newStats = {
      pending: { count: 0, sqm: 0 },
      completed: { count: 0, sqm: 0 },
      not_applicable: { count: 0, sqm: 0 },
    };

    jobsData.forEach(job => {
      const status = !job.status || job.status === 'in_progress' ? 'pending' : job.status;
      const sqm = job.structuralElement?.surfaceAreaSqm || 0;
      
      if (newStats[status]) {
        newStats[status].count += 1;
        newStats[status].sqm += sqm;
      }
    });

    setStats(newStats);
  };

  const handleStatusUpdate = useCallback(async (jobId, newStatus) => {
    try {
      setUpdatingJob(jobId);
      toast.loading('Updating job status...', { id: 'status-update' });
      
      // Use the new engineer-specific status update endpoint
      await api.patch(`/jobs/engineer/${jobId}/status`, {
        status: newStatus
      });

      toast.success('Job status updated successfully!', { id: 'status-update' });
      
      // Clear all caches completely
      setGroupJobs({});
      setExpandedGroups({});
      setAllJobsCache({});
      setGroupMetrics({});
      
      // Refresh metrics for current tab
      await fetchMetrics();
      
    } catch (error) {
      console.error('Error updating job status:', error);
      toast.error('Failed to update job status', { id: 'status-update' });
    } finally {
      setUpdatingJob(null);
    }
  }, [fetchMetrics]);

  const toggleGroup = async (groupKey) => {
    const isExpanding = !expandedGroups[groupKey];
    
    console.log(`📂 ${isExpanding ? 'Expanding' : 'Collapsing'} group: ${groupKey}`);
    
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: isExpanding
    }));
    
    // Load jobs when expanding for the first time
    if (isExpanding && !groupJobs[groupKey]) {
      console.log(`🚀 Loading jobs for group: ${groupKey}`);
      await fetchGroupJobs(groupKey);
    }
  };

  const getFireProofingLabel = (type) => {
    const labels = {
      cement_fire_proofing: 'Cement Fire Proofing',
      refinery_fire_proofing: 'Refinery Fire Proofing',
      gypsum_fire_proofing: 'Gypsum Fire Proofing',
      intumescent_coatings: 'Intumescent Coatings',
    };
    return labels[type] || type?.replace(/_/g, ' ')?.replace(/\b\w/g, l => l.toUpperCase()) || 'Other';
  };

  // Race Track Visualization Component
  const RaceTrackMetrics = ({ stats }) => {
    // Use element counts for progress tracking
    const total = stats.pending.count + stats.completed.count + stats.not_applicable.count;
    const completedPercentage = total > 0 ? (stats.completed.count / total) * 100 : 0;
    const pendingPercentage = total > 0 ? (stats.pending.count / total) * 100 : 0;

    const totalSqm = stats.pending.sqm + stats.completed.sqm + stats.not_applicable.sqm;
    const completedSqmPercentage = totalSqm > 0 ? (stats.completed.sqm / totalSqm) * 100 : 0;

    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, color: '#6a11cb', fontWeight: 600 }}>
          📊 Progress Tracker
        </Typography>
        
        {/* Jobs Race Track */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" fontWeight="600" sx={{ color: '#666' }}>
              Jobs Progress
            </Typography>
            <Typography variant="body2" fontWeight="600" sx={{ color: '#6a11cb' }}>
              {stats.completed.count} / {total} ({completedPercentage.toFixed(1)}%)
            </Typography>
          </Box>
          
          {/* Race Track */}
          <Box sx={{ 
            position: 'relative',
            height: 60,
            bgcolor: '#f5f5f5',
            borderRadius: 30,
            overflow: 'hidden',
            border: '3px solid #e0e0e0',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
          }}>
            {/* Completed Track */}
            <Box sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${completedPercentage}%`,
              background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
              transition: 'width 1s ease-in-out',
              borderRadius: 30,
            }} />
            
            {/* Car Icon */}
            <Box sx={{
              position: 'absolute',
              left: `calc(${completedPercentage}% - 20px)`,
              top: '50%',
              transform: 'translateY(-50%)',
              transition: 'left 1s ease-in-out',
              zIndex: 2,
            }}>
              <DirectionsCar sx={{ fontSize: 40, color: '#fff', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
            </Box>
            
            {/* Finish Line */}
            <Box sx={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 1,
            }}>
              <EmojiEvents sx={{ fontSize: 36, color: '#fbbf24' }} />
            </Box>
          </Box>

          {/* Stats Below Race Track */}
          <Grid container spacing={1} sx={{ mt: 1 }}>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#fff3cd', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ color: '#856404', fontWeight: 600 }}>
                  Pending
                </Typography>
                <Typography variant="h6" sx={{ color: '#f59e0b', fontWeight: 'bold' }}>
                  {stats.pending.count}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#d4edda', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ color: '#155724', fontWeight: 600 }}>
                  Completed
                </Typography>
                <Typography variant="h6" sx={{ color: '#10b981', fontWeight: 'bold' }}>
                  {stats.completed.count}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#f8d7da', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ color: '#721c24', fontWeight: 600 }}>
                  No Clearance
                </Typography>
                <Typography variant="h6" sx={{ color: '#ef4444', fontWeight: 'bold' }}>
                  {stats.not_applicable.count}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* SQM Race Track */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" fontWeight="600" sx={{ color: '#666' }}>
              SQM Progress
            </Typography>
            <Typography variant="body2" fontWeight="600" sx={{ color: '#6a11cb' }}>
              {stats.completed.sqm.toFixed(2)} / {totalSqm.toFixed(2)} SQM ({completedSqmPercentage.toFixed(1)}%)
            </Typography>
          </Box>
          
          <Box sx={{ 
            position: 'relative',
            height: 60,
            bgcolor: '#f5f5f5',
            borderRadius: 30,
            overflow: 'hidden',
            border: '3px solid #e0e0e0',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <Box sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${completedSqmPercentage}%`,
              background: 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)',
              transition: 'width 1s ease-in-out',
              borderRadius: 30,
            }} />
            
            <Box sx={{
              position: 'absolute',
              left: `calc(${completedSqmPercentage}% - 20px)`,
              top: '50%',
              transform: 'translateY(-50%)',
              transition: 'left 1s ease-in-out',
              zIndex: 2,
            }}>
              <DirectionsCar sx={{ fontSize: 40, color: '#fff', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
            </Box>
            
            <Box sx={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 1,
            }}>
              <EmojiEvents sx={{ fontSize: 36, color: '#fbbf24' }} />
            </Box>
          </Box>

          <Grid container spacing={1} sx={{ mt: 1 }}>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#fff3cd', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ color: '#856404', fontWeight: 600 }}>
                  Pending SQM
                </Typography>
                <Typography variant="h6" sx={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '1rem' }}>
                  {stats.pending.sqm.toFixed(2)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#e0d4ff', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ color: '#6a11cb', fontWeight: 600 }}>
                  Complete SQM
                </Typography>
                <Typography variant="h6" sx={{ color: '#8b5cf6', fontWeight: 'bold', fontSize: '1rem' }}>
                  {stats.completed.sqm.toFixed(2)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#f8d7da', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ color: '#721c24', fontWeight: 600 }}>
                  N/A SQM
                </Typography>
                <Typography variant="h6" sx={{ color: '#ef4444', fontWeight: 'bold', fontSize: '1rem' }}>
                  {stats.not_applicable.sqm.toFixed(2)}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Box>
    );
  };

  if (loading && !selectedProject) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  const selectedProjectName = projects.find(p => p._id === selectedProject)?.name || projects.find(p => p._id === selectedProject)?.title || '';

  return (
    <Box sx={{ flexGrow: 1, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar position="static" sx={{ background: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)' }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            🏗️ Site Engineer Portal
          </Typography>
          <Button
            color="inherit"
            onClick={() => window.open('https://projects.sapcindia.com/admin/projects', '_blank')}
            sx={{ mr: 2, textTransform: 'none' }}
          >
            📋 Admin Projects
          </Button>
          <Typography variant="body1" sx={{ mr: 2 }}>
            {user?.name}
          </Typography>
          <IconButton 
            color="inherit" 
            onClick={() => window.location.href = '/engineer/profile'}
            title="Profile"
          >
            <AccountCircle />
          </IconButton>
          <IconButton color="inherit" onClick={logout} title="Logout">
            <LogoutOutlined />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 2, mb: 4, px: { xs: 1, sm: 2, md: 3 } }}>
        {/* Header */}
        <Paper elevation={3} sx={{ p: { xs: 3, sm: 4, md: 5 }, mb: 2, background: 'white', borderRadius: 3, boxShadow: '0 8px 32px rgba(106, 17, 203, 0.3)' }}>
          <Box sx={{ textAlign: 'center' }}>
            <Build sx={{ fontSize: { xs: 40, sm: 50, md: 60 }, mb: 2, color: '#7b2ff7' }} />
            <Typography variant="h3" component="h1" gutterBottom fontWeight="bold" sx={{ color: '#6a11cb', fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' } }}>
              Hi, {user?.name}! 👋
            </Typography>
            <Typography variant="h5" sx={{ opacity: 0.85, fontStyle: 'italic', mt: 2, fontWeight: 300, color: '#7b2ff7', fontSize: { xs: '1rem', sm: '1.25rem', md: '1.5rem' } }}>
              "We shape our buildings; thereafter they shape us."
            </Typography>
          </Box>
        </Paper>

        {/* Project Selection */}
        <Paper elevation={3} sx={{ p: { xs: 2, sm: 3, md: 4 }, mb: 3, borderRadius: 3, bgcolor: 'white', boxShadow: '0 4px 20px rgba(106, 17, 203, 0.2)' }}>
          <FormControl fullWidth>
            <InputLabel>Project</InputLabel>
            <Select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              label="Project"
            >
              {projects.map((project) => (
                <MenuItem key={project._id} value={project._id}>
                  {project.name || project.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Paper>

        {selectedProject && (
          <>
            {/* Status Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              {TABS.map(tab => {
                const getColorScheme = (color) => {
                  const schemes = {
                    '#f59e0b': { // orange - pending
                      primary: '#f59e0b',
                      light: '#fff3e0',
                      lighter: '#ffe0b2',
                      dark: '#e65100',
                      gradient: 'linear-gradient(135deg, #f59e0b 0%, #fb8c00 100%)'
                    },
                    '#10b981': { // green - complete
                      primary: '#10b981',
                      light: '#e8f5e9',
                      lighter: '#f1f8e9',
                      dark: '#059669',
                      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    },
                    '#ef4444': { // red - no clearance
                      primary: '#ef4444',
                      light: '#fee2e2',
                      lighter: '#fecaca',
                      dark: '#dc2626',
                      gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                    }
                  };
                  return schemes[color] || schemes['#f59e0b'];
                };

                const colors = getColorScheme(tab.color);
                const isActive = activeTab === tab.id;
                const count = stats[tab.id].count || 0;
                const sqm = stats[tab.id].sqm || 0;

                return (
                  <Grid item xs={12} sm={6} md={3} key={tab.id}>
                    <Paper
                      elevation={isActive ? 8 : 2}
                      onClick={() => setActiveTab(tab.id)}
                      sx={{
                        p: 3,
                        cursor: 'pointer',
                        borderRadius: 3,
                        position: 'relative',
                        overflow: 'hidden',
                        background: `linear-gradient(135deg, ${colors.light} 0%, ${colors.lighter} 100%)`,
                        border: isActive ? `3px solid ${colors.primary}` : `2px solid ${colors.primary}`,
                        transform: isActive ? 'scale(1.05)' : 'scale(1)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          transform: 'scale(1.05)',
                          boxShadow: `0 8px 24px ${colors.primary}40`,
                          borderColor: colors.primary
                        },
                        '&::before': isActive ? {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '6px',
                          background: colors.gradient,
                          animation: 'shimmer 2s ease-in-out infinite',
                          '@keyframes shimmer': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0.6 }
                          }
                        } : {}
                      }}
                    >
                      {/* Section Label */}
                      <Typography 
                        variant="h6" 
                        fontWeight="bold" 
                        sx={{ 
                          color: isActive ? colors.dark : colors.primary,
                          mb: 2,
                          fontSize: '1.1rem',
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase'
                        }}
                      >
                        {tab.label}
                      </Typography>
                      
                      {/* Count Metric */}
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.5 }}>
                        <Typography 
                          variant="h3" 
                          fontWeight="900"
                          sx={{ 
                            color: colors.primary,
                            lineHeight: 1,
                            fontSize: '2.5rem',
                            textShadow: isActive ? `0 2px 8px ${colors.primary}40` : 'none'
                          }}
                        >
                          {count}
                        </Typography>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: '#666',
                            fontWeight: 600
                          }}
                        >
                          Jobs
                        </Typography>
                      </Box>
                      
                      {/* SQM Metric */}
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 1,
                          p: 1.5,
                          background: `${colors.primary}20`,
                          borderRadius: 2,
                          border: `1px solid ${colors.primary}40`
                        }}
                      >
                        <Box 
                          sx={{ 
                            width: 8, 
                            height: 8, 
                            borderRadius: '50%',
                            bgcolor: colors.primary,
                            boxShadow: `0 0 10px ${colors.primary}60`
                          }} 
                        />
                        <Typography 
                          variant="h6" 
                          fontWeight="bold"
                          sx={{ 
                            color: colors.dark,
                            fontSize: '1.2rem'
                          }}
                        >
                          {sqm.toFixed(1)}
                        </Typography>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: '#666',
                            fontWeight: 600
                          }}
                        >
                          SQM
                        </Typography>
                      </Box>
                      
                      {/* Active Indicator */}
                      {isActive && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            bgcolor: colors.primary,
                            boxShadow: `0 0 12px ${colors.primary}`,
                            animation: 'pulse 2s ease-in-out infinite',
                            '@keyframes pulse': {
                              '0%, 100%': { transform: 'scale(1)', opacity: 1 },
                              '50%': { transform: 'scale(1.2)', opacity: 0.8 }
                            }
                          }}
                        />
                      )}
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>

            {/* Metrics with Race Track */}
            <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 3, bgcolor: 'white' }}>
              <RaceTrackMetrics stats={stats} />
            </Paper>

            {/* Search and Grouping Controls */}
            <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 3, bgcolor: 'white' }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Search"
                    placeholder="Search jobs, grid, structure..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Group By</InputLabel>
                    <Select
                      value={groupBy}
                      onChange={(e) => setGroupBy(e.target.value)}
                      label="Group By"
                    >
                      <MenuItem value="gridNo">Grid No</MenuItem>
                      <MenuItem value="level">Level</MenuItem>
                      <MenuItem value="partMarkNo">Part Mark</MenuItem>
                      <MenuItem value="lengthMm">Length (mm)</MenuItem>
                      <MenuItem value="surfaceAreaSqm">SQM</MenuItem>
                      <MenuItem value="fpThicknessMm">FP Thickness</MenuItem>
                      <MenuItem value="fireProofingWorkflow">FP Workflow</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Sub-Group By</InputLabel>
                    <Select
                      value={subGroupBy}
                      onChange={(e) => setSubGroupBy(e.target.value)}
                      label="Sub-Group By"
                    >
                      <MenuItem value="">None</MenuItem>
                      <MenuItem value="gridNo">Grid No</MenuItem>
                      <MenuItem value="level">Level</MenuItem>
                      <MenuItem value="partMarkNo">Part Mark</MenuItem>
                      <MenuItem value="lengthMm">Length (mm)</MenuItem>
                      <MenuItem value="surfaceAreaSqm">SQM</MenuItem>
                      <MenuItem value="fpThicknessMm">FP Thickness</MenuItem>
                      <MenuItem value="fireProofingWorkflow">FP Workflow</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Paper>

            {/* Grouped Jobs Display */}
            <Paper elevation={3} sx={{ borderRadius: 3, bgcolor: 'white', overflow: 'hidden' }}>
              {loading ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <CircularProgress />
                  <Typography sx={{ mt: 2, color: '#666' }}>Loading metrics...</Typography>
                </Box>
              ) : Object.keys(groupMetrics).length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Build sx={{ fontSize: 80, color: '#b794f6', mb: 2 }} />
                  <Typography variant="h6" sx={{ color: '#6a11cb', mb: 2 }}>
                    No jobs found for {TABS.find(t => t.id === activeTab)?.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    {Object.values(stats).reduce((sum, s) => sum + s.count, 0) === 0
                      ? "This project doesn't have any jobs yet. Jobs are automatically created when structural elements are uploaded via Excel in the Admin portal."
                      : `All jobs for this project are in other statuses. Try switching tabs to see them.`
                    }
                  </Typography>
                  {Object.values(stats).reduce((sum, s) => sum + s.count, 0) === 0 && (
                    <Box sx={{ 
                      p: 2, 
                      bgcolor: '#f8f7ff', 
                      borderRadius: 2, 
                      border: '1px solid #e0d4ff',
                      display: 'inline-block',
                      textAlign: 'left'
                    }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#6a11cb' }}>
                        📝 How to add jobs:
                      </Typography>
                      <Typography variant="body2" color="text.secondary" component="div">
                        1. Admin uploads Excel with structural elements<br/>
                        2. System creates fire proofing jobs automatically<br/>
                        3. Jobs appear here for site engineers to update
                      </Typography>
                    </Box>
                  )}
                </Box>
              ) : (
                <Box>
                  {Object.keys(groupMetrics).sort().map(groupKey => {
                    const metrics = groupMetrics[groupKey] || { count: 0, sqm: 0, subGroups: {} };
                    const group = groupJobs[groupKey]; // May be undefined if not loaded yet
                    const isExpanded = expandedGroups[groupKey] || false;
                    const isLoading = loadingGroups[groupKey] || false;

                    return (
                      <Accordion
                        key={groupKey}
                        expanded={isExpanded}
                        onChange={() => toggleGroup(groupKey)}
                        sx={{ 
                          mb: 2,
                          border: '1px solid #e0e0e0', 
                          borderRadius: '12px !important',
                          overflow: 'hidden',
                          '&:before': { display: 'none' },
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                        }}
                      >
                        <AccordionSummary 
                          expandIcon={<ExpandMoreIcon />}
                          sx={{ 
                            py: 1.5,
                            px: 2,
                            minHeight: '56px !important',
                            background: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)',
                            '&:hover': { background: 'linear-gradient(135deg, #f5f5f5 0%, #eeeeee 100%)' },
                            '& .MuiAccordionSummary-content': {
                              margin: '8px 0 !important'
                            }
                          }}
                        >
                          {/* Simple Group Header - Metrics will be shown inside after expansion */}
                          <Typography variant="h6" fontWeight="700" sx={{ color: '#333' }}>
                            {groupKey}
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails
                          sx={{
                            p: 3,
                            background: 'linear-gradient(135deg, #fafafa 0%, #ffffff 100%)',
                            borderTop: '2px solid #f0f0f0'
                          }}
                        >
                          {/* Display metrics inside accordion when expanded and jobs are loaded */}
                          {!isLoading && group && (
                            <Box sx={{ 
                              display: 'flex', 
                              gap: 2, 
                              mb: 3, 
                              p: 2, 
                              bgcolor: '#f8f9fa', 
                              borderRadius: 2,
                              flexWrap: 'wrap'
                            }}>
                              {/* Jobs Count */}
                              <Box sx={{ 
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                px: 2,
                                py: 1,
                                background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
                                borderRadius: 2,
                                border: '1px solid #81c784'
                              }}>
                                <Box sx={{ 
                                  width: 32, 
                                  height: 32, 
                                  borderRadius: 1,
                                  background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '1rem'
                                }}>
                                  💼
                                </Box>
                                <Box>
                                  <Typography variant="caption" sx={{ color: '#2e7d32', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', display: 'block', lineHeight: 1 }}>
                                    Jobs
                                  </Typography>
                                  <Typography variant="h6" fontWeight="900" sx={{ color: '#1b5e20', lineHeight: 1, mt: 0.3 }}>
                                    {metrics.jobCount || 0}
                                  </Typography>
                                </Box>
                              </Box>

                              {/* Elements Count */}
                              <Box sx={{ 
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                px: 2,
                                py: 1,
                                background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                                borderRadius: 2,
                                border: '1px solid #90caf9'
                              }}>
                                <Box sx={{ 
                                  width: 32, 
                                  height: 32, 
                                  borderRadius: 1,
                                  background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '1rem'
                                }}>
                                  📊
                                </Box>
                                <Box>
                                  <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', display: 'block', lineHeight: 1 }}>
                                    Elements
                                  </Typography>
                                  <Typography variant="h6" fontWeight="900" sx={{ color: '#1565c0', lineHeight: 1, mt: 0.3 }}>
                                    {metrics.count || 0}
                                  </Typography>
                                </Box>
                              </Box>

                              {/* Total SQM */}
                              <Box sx={{ 
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                px: 2,
                                py: 1,
                                background: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)',
                                borderRadius: 2,
                                border: '1px solid #ce93d8'
                              }}>
                                <Box sx={{ 
                                  width: 32, 
                                  height: 32, 
                                  borderRadius: 1,
                                  background: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '1rem'
                                }}>
                                  📐
                                </Box>
                                <Box>
                                  <Typography variant="caption" sx={{ color: '#7b1fa2', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', display: 'block', lineHeight: 1 }}>
                                    Total SQM
                                  </Typography>
                                  <Typography variant="h6" fontWeight="900" sx={{ color: '#6a1b9a', lineHeight: 1, mt: 0.3 }}>
                                    {(metrics.sqm || 0).toFixed(1)}
                                  </Typography>
                                </Box>
                              </Box>

                              {/* Total Qty (if applicable) */}
                              {metrics.qty > 0 && (
                                <Box sx={{ 
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                  px: 2,
                                  py: 1,
                                  background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
                                  borderRadius: 2,
                                  border: '1px solid #ffb74d'
                                }}>
                                  <Box sx={{ 
                                    width: 32, 
                                    height: 32, 
                                    borderRadius: 1,
                                    background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1rem'
                                  }}>
                                    🔢
                                  </Box>
                                  <Box>
                                    <Typography variant="caption" sx={{ color: '#f57c00', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', display: 'block', lineHeight: 1 }}>
                                      Total Qty
                                    </Typography>
                                    <Typography variant="h6" fontWeight="900" sx={{ color: '#e65100', lineHeight: 1, mt: 0.3 }}>
                                      {metrics.qty || 0}
                                    </Typography>
                                  </Box>
                                </Box>
                              )}
                            </Box>
                          )}

                          {isLoading ? (
                            <Box sx={{ p: 4, textAlign: 'center' }}>
                              <CircularProgress size={30} />
                              <Typography sx={{ mt: 2, color: '#666' }}>Loading jobs...</Typography>
                            </Box>
                          ) : !group || (subGroupBy && !Object.keys(group).length) || (!subGroupBy && (!group.jobs || !group.jobs.length)) ? (
                            <Box sx={{ p: 2, textAlign: 'center' }}>
                              <Typography color="text.secondary">No jobs found in this group</Typography>
                            </Box>
                          ) : subGroupBy && Object.keys(metrics.subGroups || {}).length > 0 ? (
                            // Show sub-groups with collapse
                            Object.keys(metrics.subGroups).sort().map(subGroupKey => {
                              const subGroupMetrics = metrics.subGroups[subGroupKey] || { count: 0, jobCount: 0, sqm: 0 };
                              const subGroupJobsList = group[subGroupKey] || [];
                              if (!Array.isArray(subGroupJobsList)) return null;

                              return (
                                <Accordion key={subGroupKey} sx={{ mb: 2, boxShadow: 1 }}>
                                  <AccordionSummary 
                                    expandIcon={<ExpandMoreIcon />}
                                    sx={{ 
                                      bgcolor: '#f8f9fa',
                                      '&:hover': { bgcolor: '#e9ecef' }
                                    }}
                                  >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                      <LocalFireDepartment sx={{ color: '#ff6b35' }} />
                                      <Typography variant="subtitle1" fontWeight="600" sx={{ color: '#666', flexGrow: 1 }}>
                                        {getFireProofingLabel(subGroupKey)}
                                      </Typography>
                                      <Chip 
                                        label={`${subGroupMetrics.jobCount || 0} Jobs • ${subGroupMetrics.count || 0} Elements (${(subGroupMetrics.sqm || 0).toFixed(2)} SQM)`} 
                                        size="small" 
                                        sx={{ bgcolor: '#e3f2fd', color: '#1976d2' }}
                                      />
                                    </Box>
                                  </AccordionSummary>
                                  <AccordionDetails sx={{ p: 2 }}>
                                  
                                  {/* Compact Table View */}
                                  <TableContainer component={Paper} variant="outlined">
                                    <Table size="small">
                                      <TableHead>
                                        <TableRow>
                                          <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>Job Title</TableCell>
                                          <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>Structure</TableCell>
                                          <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>Level</TableCell>
                                          <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>Grid</TableCell>
                                          <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>Part Mark</TableCell>
                                          <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>Member Type</TableCell>
                                          <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>SQM</TableCell>
                                          <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>FP Workflow</TableCell>
                                          <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold', textAlign: 'center' }}>Actions</TableCell>
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        {subGroupJobsList.map(job => (
                                          <TableRow 
                                            key={job._id}
                                            sx={{ 
                                              '&:hover': { bgcolor: 'action.hover' },
                                              '&:nth-of-type(odd)': { bgcolor: 'grey.50' }
                                            }}
                                          >
                                            <TableCell>
                                              <Typography variant="body2" fontWeight="600">
                                                {job.jobTitle}
                                              </Typography>
                                            </TableCell>
                                            <TableCell>
                                              <Typography variant="body2">
                                                {job.structuralElement?.structureNumber || 'N/A'}
                                              </Typography>
                                            </TableCell>
                                            <TableCell>
                                              <Typography variant="body2">
                                                {job.structuralElement?.level || 'N/A'}
                                              </Typography>
                                            </TableCell>
                                            <TableCell>
                                              <Typography variant="body2">
                                                {job.structuralElement?.gridNo || 'N/A'}
                                              </Typography>
                                            </TableCell>
                                            <TableCell>
                                              <Typography variant="body2">
                                                {job.structuralElement?.partMarkNo || 'N/A'}
                                              </Typography>
                                            </TableCell>
                                            <TableCell>
                                              <Typography variant="body2">
                                                {job.structuralElement?.memberType || 'N/A'}
                                              </Typography>
                                            </TableCell>
                                            <TableCell>
                                              <Typography variant="body2" fontWeight="600">
                                                {job.structuralElement?.surfaceAreaSqm ? job.structuralElement.surfaceAreaSqm.toFixed(2) : 'N/A'}
                                              </Typography>
                                            </TableCell>
                                            <TableCell>
                                              <Chip 
                                                label={job.structuralElement?.fireProofingWorkflow || 'N/A'} 
                                                size="small"
                                                sx={{ fontSize: '0.7rem' }}
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                                                <Button
                                                  variant={activeTab === 'pending' ? 'contained' : 'outlined'}
                                                  color="warning"
                                                  size="small"
                                                  onClick={() => handleStatusUpdate(job._id, 'pending')}
                                                  disabled={updatingJob === job._id}
                                                  sx={{ minWidth: 80, fontSize: '0.7rem', py: 0.5 }}
                                                >
                                                  Pending
                                                </Button>
                                                <Button
                                                  variant={activeTab === 'completed' ? 'contained' : 'outlined'}
                                                  color="success"
                                                  size="small"
                                                  onClick={() => handleStatusUpdate(job._id, 'completed')}
                                                  disabled={updatingJob === job._id}
                                                  sx={{ minWidth: 80, fontSize: '0.7rem', py: 0.5 }}
                                                >
                                                  Complete
                                                </Button>
                                                <Button
                                                  variant={activeTab === 'not_applicable' ? 'contained' : 'outlined'}
                                                  color="error"
                                                  size="small"
                                                  onClick={() => handleStatusUpdate(job._id, 'not_applicable')}
                                                  disabled={updatingJob === job._id}
                                                  sx={{ minWidth: 90, fontSize: '0.7rem', py: 0.5 }}
                                                >
                                                  No Clearance
                                                </Button>
                                              </Box>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </TableContainer>
                                  </AccordionDetails>
                                </Accordion>
                              );
                            })
                          ) : (
                            // Show jobs directly (no sub-grouping)
                            <TableContainer component={Paper} variant="outlined">
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>Job Title</TableCell>
                                    <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>Structure</TableCell>
                                    <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>Level</TableCell>
                                    <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>Grid</TableCell>
                                    <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>Part Mark</TableCell>
                                    <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>Member Type</TableCell>
                                    <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>SQM</TableCell>
                                    <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>FP Workflow</TableCell>
                                    <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold', textAlign: 'center' }}>Actions</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {(group.jobs || []).map(job => (
                                    <TableRow 
                                      key={job._id}
                                      sx={{ 
                                        '&:hover': { bgcolor: 'action.hover' },
                                        '&:nth-of-type(odd)': { bgcolor: 'grey.50' }
                                      }}
                                    >
                                      <TableCell>
                                        <Typography variant="body2" fontWeight="600">
                                          {job.jobTitle}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>
                                        <Typography variant="body2">
                                          {job.structuralElement?.structureNumber || 'N/A'}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>
                                        <Typography variant="body2">
                                          {job.structuralElement?.level || 'N/A'}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>
                                        <Typography variant="body2">
                                          {job.structuralElement?.gridNo || 'N/A'}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>
                                        <Typography variant="body2">
                                          {job.structuralElement?.partMarkNo || 'N/A'}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>
                                        <Typography variant="body2">
                                          {job.structuralElement?.memberType || 'N/A'}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>
                                        <Typography variant="body2" fontWeight="600">
                                          {job.structuralElement?.surfaceAreaSqm ? job.structuralElement.surfaceAreaSqm.toFixed(2) : 'N/A'}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>
                                        <Chip 
                                          label={job.structuralElement?.fireProofingWorkflow || 'N/A'} 
                                          size="small"
                                          sx={{ fontSize: '0.7rem' }}
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                                          <Button
                                            variant={activeTab === 'pending' ? 'contained' : 'outlined'}
                                            color="warning"
                                            size="small"
                                            onClick={() => handleStatusUpdate(job._id, 'pending')}
                                            disabled={updatingJob === job._id}
                                            sx={{ minWidth: 80, fontSize: '0.7rem', py: 0.5 }}
                                          >
                                            Pending
                                          </Button>
                                          <Button
                                            variant={activeTab === 'completed' ? 'contained' : 'outlined'}
                                            color="success"
                                            size="small"
                                            onClick={() => handleStatusUpdate(job._id, 'completed')}
                                            disabled={updatingJob === job._id}
                                            sx={{ minWidth: 80, fontSize: '0.7rem', py: 0.5 }}
                                          >
                                            Complete
                                          </Button>
                                          <Button
                                            variant={activeTab === 'not_applicable' ? 'contained' : 'outlined'}
                                            color="error"
                                            size="small"
                                            onClick={() => handleStatusUpdate(job._id, 'not_applicable')}
                                            disabled={updatingJob === job._id}
                                            sx={{ minWidth: 90, fontSize: '0.7rem', py: 0.5 }}
                                          >
                                            No Clearance
                                          </Button>
                                        </Box>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          )}
                        </AccordionDetails>
                      </Accordion>
                    );
                  })}
                </Box>
              )}
            </Paper>
          </>
        )}
      </Container>
    </Box>
  );
}
