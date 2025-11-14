import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  Container, Paper, Typography, Box, Grid, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, CircularProgress, Button, Drawer, List, ListItem, ListItemButton, ListItemText,
  IconButton, Divider, InputAdornment, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import {
  HourglassEmpty, CheckCircle, Cancel, Search, Refresh, AccountCircle,
  LogoutOutlined, Dashboard as DashboardIcon, ArrowBack, ExpandMore as ExpandMoreIcon,
  LocalFireDepartment
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const DRAWER_WIDTH = 280;

const TABS = [
  { id: 'pending', label: 'Pending', color: '#f59e0b' },
  { id: 'completed', label: 'Completed', color: '#10b981' },
  { id: 'not_applicable', label: 'Non Clearance', color: '#ef4444' }
];

export default function LevelDetailPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { levelId } = router.query;
  const projectId = router.query.project;
  
  // State
  const [projects, setProjects] = useState([]);
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingJob, setUpdatingJob] = useState(null);
  
  // Grouping state
  const [activeTab, setActiveTab] = useState('pending');
  const [groupBy, setGroupBy] = useState('jobTitle');
  const [subGroupBy, setSubGroupBy] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [groupMetrics, setGroupMetrics] = useState({});
  const [allStatusMetrics, setAllStatusMetrics] = useState({}); // Store metrics for all statuses
  const [groupJobs, setGroupJobs] = useState({});
  const [loadingGroups, setLoadingGroups] = useState({});
  const [allJobsCache, setAllJobsCache] = useState({});
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  
  // Level search
  const [levelSearch, setLevelSearch] = useState('');

  useEffect(() => {
    fetchProjects();
    if (projectId) {
      fetchLevels();
    }
  }, [projectId]);

  useEffect(() => {
    setExpandedGroups({});
    setGroupJobs({});
    setGroupMetrics({});
  }, [activeTab, groupBy, subGroupBy, searchTerm]);

  useEffect(() => {
    if (projectId && levelId) {
      fetchMetrics();
    }
  }, [projectId, levelId, activeTab, groupBy, subGroupBy, searchTerm]);

  const fetchProjects = async () => {
    try {
      const response = await api.get('/projects');
      const tasks = response.data.tasks || [];
      setProjects(tasks);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchLevels = async () => {
    try {
      const response = await api.get(`/jobs/engineer/levels?project=${projectId}`);
      setLevels(response.data.levels || []);
    } catch (error) {
      console.error('Error fetching levels:', error);
    }
  };

  const fetchMetrics = useCallback(async () => {
    if (!projectId || !levelId) return;
    
    try {
      setLoading(true);
      
      // Fetch metrics for all statuses to display in the cards
      const allMetrics = {};
      for (const tab of TABS) {
        try {
          const groupsResponse = await api.get(`/jobs/engineer/groups?project=${projectId}&level=${decodeURIComponent(levelId)}&status=${tab.id}&groupBy=${groupBy}${subGroupBy ? `&subGroupBy=${subGroupBy}` : ''}`);
          const groupsData = groupsResponse.data;
          
          let totalElements = 0;
          let totalJobCount = 0;
          let totalSqm = 0;
          
          groupsData.groups.forEach(groupName => {
            const apiMetrics = groupsData.metrics?.[groupName];
            totalElements += apiMetrics?.elementCount || 0;
            totalJobCount += apiMetrics?.jobCount || 0;
            totalSqm += apiMetrics?.sqm || 0;
          });
          
          allMetrics[tab.id] = {
            elementCount: totalElements,
            jobCount: totalJobCount,
            sqm: totalSqm
          };
        } catch (error) {
          console.error(`Error fetching metrics for ${tab.id}:`, error);
          allMetrics[tab.id] = { elementCount: 0, jobCount: 0, sqm: 0 };
        }
      }
      
      setAllStatusMetrics(allMetrics);
      
      // Fetch groups for the active tab only
      const statusForCurrentTab = activeTab || '';
      
      try {
        const groupsResponse = await api.get(`/jobs/engineer/groups?project=${projectId}&level=${decodeURIComponent(levelId)}${statusForCurrentTab ? `&status=${statusForCurrentTab}` : ''}&groupBy=${groupBy}${subGroupBy ? `&subGroupBy=${subGroupBy}` : ''}`);
        const groupsData = groupsResponse.data;
        
        console.log(`📂 Fetched ${groupsData.groups.length} unique groups for ${groupBy}`);
        
        // Use metrics from API response if available
        const metrics = {};
        groupsData.groups.forEach(groupName => {
          const apiMetrics = groupsData.metrics?.[groupName];
          
          metrics[groupName] = {
            count: apiMetrics?.elementCount || 0,
            jobCount: apiMetrics?.jobCount || 0,
            sqm: apiMetrics?.sqm || 0,
            qty: 0,
            subGroups: {}
          };
          
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
        console.log('📊 Group metrics loaded:', Object.keys(metrics).length, 'groups');
      } catch (error) {
        console.error('Error fetching groups:', error);
        setGroupMetrics({});
      }
      
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast.error('Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  }, [projectId, levelId, activeTab, groupBy, subGroupBy, searchTerm]);

  const calculateGroupMetrics = (jobsData) => {
    const metrics = {};
    const groupElements = {};
    const subGroupElements = {};
    const groupJobCounts = {};
    const subGroupJobCounts = {};
    
    jobsData.forEach(job => {
      const jobStatus = !job.status || job.status === 'in_progress' ? 'pending' : job.status;
      
      if (activeTab && jobStatus !== activeTab) return;
      
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
      
      groupJobCounts[primaryKey]++;
      
      const elementId = job.structuralElement?._id?.toString();
      if (elementId) {
        if (!groupElements[primaryKey].has(elementId)) {
          groupElements[primaryKey].add(elementId);
          metrics[primaryKey].sqm += job.structuralElement?.surfaceAreaSqm || 0;
          metrics[primaryKey].qty += job.structuralElement?.qty || 0;
        }
      }
      
      if (subGroupBy) {
        const secondaryKey = job[subGroupBy] || job.structuralElement?.[subGroupBy] || 'Other';
        if (!metrics[primaryKey].subGroups[secondaryKey]) {
          metrics[primaryKey].subGroups[secondaryKey] = { count: 0, jobCount: 0, sqm: 0, qty: 0 };
          subGroupElements[primaryKey][secondaryKey] = new Set();
          subGroupJobCounts[primaryKey][secondaryKey] = 0;
        }
        
        subGroupJobCounts[primaryKey][secondaryKey]++;
        
        if (elementId && !subGroupElements[primaryKey][secondaryKey].has(elementId)) {
          subGroupElements[primaryKey][secondaryKey].add(elementId);
          metrics[primaryKey].subGroups[secondaryKey].sqm += job.structuralElement?.surfaceAreaSqm || 0;
          metrics[primaryKey].subGroups[secondaryKey].qty += job.structuralElement?.qty || 0;
        }
      }
    });
    
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

  const fetchGroupJobs = useCallback(async (groupKey) => {
    try {
      setLoadingGroups(prev => ({ ...prev, [groupKey]: true }));
      console.log('Fetching jobs for group:', groupKey);
      
      // Fetch jobs filtered by the group key directly from API
      let allFetchedJobs = [];
      let currentPage = 1;
      const pageSize = 500;
      let hasMore = true;
      
      while (hasMore) {
        const statusParam = activeTab ? `&status=${activeTab}` : '';
        // Add filter for the groupBy field value
        const groupFilterParam = `&${groupBy}=${encodeURIComponent(groupKey)}`;
        const response = await api.get(`/jobs/engineer/jobs?project=${projectId}&level=${decodeURIComponent(levelId)}${statusParam}${groupFilterParam}&page=${currentPage}&limit=${pageSize}`);
        const jobs = response.data.jobs || [];
        allFetchedJobs = allFetchedJobs.concat(jobs);
        
        console.log(`Fetched page ${currentPage}: ${jobs.length} jobs for ${groupKey}`);
        
        if (jobs.length < pageSize) {
          hasMore = false;
        } else {
          currentPage++;
        }
        
        if (currentPage > 20) {
          console.warn('Reached maximum page limit');
          hasMore = false;
        }
      }
      
      console.log(`Total jobs fetched for ${groupKey}: ${allFetchedJobs.length}`);
      
      // Apply search filter if needed
      let fetchedJobs = allFetchedJobs;
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        fetchedJobs = allFetchedJobs.filter(job => {
          return job.jobTitle?.toLowerCase().includes(searchLower) ||
            job.structuralElement?.structureNumber?.toLowerCase().includes(searchLower) ||
            job.structuralElement?.gridNo?.toLowerCase().includes(searchLower) ||
            job.structuralElement?.partMarkNo?.toLowerCase().includes(searchLower) ||
            job.structuralElement?.level?.toLowerCase().includes(searchLower);
        });
      }
      
      console.log(`After search filter: ${fetchedJobs.length} jobs`);
      
      let groupedData;
      if (subGroupBy) {
        groupedData = {};
        fetchedJobs.forEach(job => {
          const secondaryKey = job[subGroupBy] || job.structuralElement?.[subGroupBy] || 'Other';
          if (!groupedData[secondaryKey]) {
            groupedData[secondaryKey] = [];
          }
          groupedData[secondaryKey].push(job);
        });
      } else {
        groupedData = { jobs: fetchedJobs };
      }
      
      setGroupJobs(prev => ({
        ...prev,
        [groupKey]: groupedData
      }));
      
      // Calculate metrics for this group
      const groupMetricsData = calculateGroupMetrics(fetchedJobs);
      setGroupMetrics(prev => ({
        ...prev,
        [groupKey]: groupMetricsData[groupKey] || { count: 0, jobCount: 0, sqm: 0, qty: 0, subGroups: {} }
      }));
      
    } catch (error) {
      console.error('Error fetching group jobs:', error);
      toast.error('Failed to load jobs for this group');
    } finally {
      setLoadingGroups(prev => ({ ...prev, [groupKey]: false }));
    }
  }, [activeTab, groupBy, subGroupBy, searchTerm, projectId, levelId]);

  const toggleGroup = (groupKey) => {
    const isExpanded = expandedGroups[groupKey] || false;
    
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !isExpanded
    }));
    
    // Always fetch when expanding to ensure we have data
    if (!isExpanded) {
      fetchGroupJobs(groupKey);
    }
  };

  const handleStatusUpdate = async (jobId, newStatus) => {
    try {
      setUpdatingJob(jobId);
      await api.patch(`/jobs/engineer/${jobId}/status`, { status: newStatus });
      toast.success('Status updated successfully!');
      
      // Clear cache and fetch fresh data
      setAllJobsCache({});
      
      // Store currently expanded groups before clearing
      const currentlyExpandedGroups = Object.keys(expandedGroups).filter(key => expandedGroups[key]);
      
      // Clear group jobs
      setGroupJobs({});
      
      // Fetch metrics first
      await fetchMetrics();
      
      // Refetch jobs for all currently expanded groups
      for (const groupKey of currentlyExpandedGroups) {
        await fetchGroupJobs(groupKey);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setUpdatingJob(null);
    }
  };

  const getFireProofingLabel = (workflow) => {
    const labels = {
      'spray': '🔴 Spray',
      'wrap': '🟡 Wrap',
      'intumescent': '🔵 Intumescent',
      'board': '🟢 Board'
    };
    return labels[workflow] || workflow;
  };

  const filteredLevels = levels.filter(level => 
    level.level.toLowerCase().includes(levelSearch.toLowerCase())
  );

  const getStatusColor = (status) => {
    const colors = {
      pending: '#f59e0b',
      completed: '#10b981',
      not_applicable: '#ef4444'
    };
    return colors[status] || '#9ca3af';
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            bgcolor: '#1e293b',
            color: 'white'
          },
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DashboardIcon /> Engineer Portal
          </Typography>
        </Box>

        <Box sx={{ p: 2 }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => router.push('/dashboard')}
            sx={{
              color: 'white',
              borderColor: 'rgba(255,255,255,0.2)',
              '&:hover': { borderColor: 'white' },
              mb: 2
            }}
          >
            Dashboard
          </Button>

          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mb: 1, display: 'block' }}>
            PROJECT
          </Typography>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <Select
              value={projectId || ''}
              onChange={(e) => {
                const newProjectId = e.target.value;
                router.push(`/dashboard?project=${newProjectId}`);
              }}
              sx={{
                color: 'white',
                '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'white' },
                '.MuiSvgIcon-root': { color: 'white' }
              }}
            >
              {projects.map((project) => (
                <MenuItem key={project._id} value={project._id}>
                  {project.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)', my: 2 }} />

          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mb: 1, display: 'block' }}>
            LEVELS ({filteredLevels.length})
          </Typography>
          
          <TextField
            fullWidth
            size="small"
            placeholder="Search levels..."
            value={levelSearch}
            onChange={(e) => setLevelSearch(e.target.value)}
            sx={{
              mb: 1,
              '& .MuiOutlinedInput-root': {
                color: 'white',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                '&.Mui-focused fieldset': { borderColor: 'white' },
              },
              '& .MuiInputBase-input::placeholder': { color: 'rgba(255,255,255,0.5)' }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: 'rgba(255,255,255,0.5)' }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <List sx={{ overflow: 'auto', flex: 1 }}>
          {filteredLevels.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                No levels found
              </Typography>
            </Box>
          ) : (
            filteredLevels.map((level) => (
            <ListItem key={level.level} disablePadding>
              <ListItemButton
                selected={decodeURIComponent(levelId) === level.level}
                onClick={() => router.push(`/level/${encodeURIComponent(level.level)}?project=${projectId}`)}
              >
                <ListItemText
                  primary={level.level}
                  secondary={
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                      <Chip label={level.pendingJobs} size="small" sx={{ bgcolor: '#f59e0b', color: 'white', fontSize: '0.85rem', height: 24 }} />
                      <Chip label={level.completedJobs} size="small" sx={{ bgcolor: '#10b981', color: 'white', fontSize: '0.85rem', height: 24 }} />
                      <Chip label={level.nonClearanceJobs} size="small" sx={{ bgcolor: '#ef4444', color: 'white', fontSize: '0.85rem', height: 24 }} />
                    </Box>
                  }
                  secondaryTypographyProps={{ component: 'div' }}
                  sx={{ '& .MuiListItemText-primary': { color: 'white', fontSize: '1.1rem', fontWeight: 500 } }}
                />
              </ListItemButton>
            </ListItem>
            ))
          )}
        </List>

        <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <AccountCircle />
            <Typography variant="body2">{user?.name}</Typography>
          </Box>
          <Button
            fullWidth
            variant="outlined"
            onClick={logout}
            startIcon={<LogoutOutlined />}
            sx={{
              color: 'white',
              borderColor: 'rgba(255,255,255,0.2)',
              '&:hover': { borderColor: 'white' }
            }}
          >
            Logout
          </Button>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        {/* Header */}
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            🏗️ {levelId && decodeURIComponent(levelId)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Jobs and elements for this level
          </Typography>
        </Paper>

        {/* Status Metric Cards - Replace Tabs */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {TABS.map(tab => {
            // Get metrics for this specific status from allStatusMetrics
            const statusMetrics = allStatusMetrics[tab.id] || { elementCount: 0, jobCount: 0, sqm: 0 };
            
            const isSelected = activeTab === tab.id;
            
            return (
              <Grid item xs={12} md={4} key={tab.id}>
                <Card
                  onClick={() => setActiveTab(tab.id)}
                  sx={{
                    cursor: 'pointer',
                    background: isSelected 
                      ? `linear-gradient(135deg, ${tab.color}15 0%, ${tab.color}25 100%)`
                      : 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
                    border: isSelected ? `3px solid ${tab.color}` : '2px solid #e5e7eb',
                    transition: 'all 0.3s ease',
                    height: '100%',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4,
                      borderColor: tab.color
                    }
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      {tab.id === 'pending' && <HourglassEmpty sx={{ fontSize: 50, color: tab.color, mr: 2 }} />}
                      {tab.id === 'completed' && <CheckCircle sx={{ fontSize: 50, color: tab.color, mr: 2 }} />}
                      {tab.id === 'not_applicable' && <Cancel sx={{ fontSize: 50, color: tab.color, mr: 2 }} />}
                      <Box>
                        <Typography variant="h2" fontWeight="bold" sx={{ color: tab.color }}>
                          {statusMetrics.jobCount}
                        </Typography>
                        <Typography variant="h6" color="text.secondary" fontWeight="medium">
                          {tab.label}
                        </Typography>
                      </Box>
                    </Box>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body1" fontWeight="medium" color="text.secondary">
                        Jobs
                      </Typography>
                      <Typography variant="h6" fontWeight="bold" sx={{ color: tab.color }}>
                        {statusMetrics.jobCount}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body1" fontWeight="medium" color="text.secondary">
                        Elements
                      </Typography>
                      <Typography variant="h6" fontWeight="bold" sx={{ color: tab.color }}>
                        {statusMetrics.elementCount}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body1" fontWeight="medium" color="text.secondary">
                        SQM
                      </Typography>
                      <Typography variant="h6" fontWeight="bold" sx={{ color: tab.color }}>
                        {statusMetrics.sqm.toFixed(2)}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {/* Search and Grouping Controls */}
        <Paper elevation={3} sx={{ p: 3, mb: 2, borderRadius: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Group By</InputLabel>
                <Select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  label="Group By"
                >
                  <MenuItem value="jobTitle">Job Title</MenuItem>
                  <MenuItem value="gridNo">Grid No</MenuItem>
                  <MenuItem value="partMarkNo">Part Mark</MenuItem>
                  <MenuItem value="lengthMm">Length (mm)</MenuItem>
                  <MenuItem value="surfaceAreaSqm">SQM</MenuItem>
                  <MenuItem value="fpThicknessMm">FP Thickness</MenuItem>
                  <MenuItem value="fireProofingWorkflow">FP Workflow</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Sub-Group By</InputLabel>
                <Select
                  value={subGroupBy}
                  onChange={(e) => setSubGroupBy(e.target.value)}
                  label="Sub-Group By"
                >
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value="jobTitle">Job Title</MenuItem>
                  <MenuItem value="gridNo">Grid No</MenuItem>
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
              <Typography sx={{ mt: 2 }}>Loading groups...</Typography>
            </Box>
          ) : (
            <Box>
              {Object.keys(groupMetrics).length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="h6" color="text.secondary">
                    No jobs found for {TABS.find(t => t.id === activeTab)?.label || 'this level'}
                  </Typography>
                </Box>
              ) : (
                <Box>
                  {Object.keys(groupMetrics).sort().map(groupKey => {
                    const metrics = groupMetrics[groupKey] || { count: 0, jobCount: 0, sqm: 0, subGroups: {} };
                    const group = groupJobs[groupKey];
                    const isExpanded = expandedGroups[groupKey] || false;
                    const isLoading = loadingGroups[groupKey] || false;

                    // Skip accordion if no jobs in this group
                    if (metrics.jobCount === 0) {
                      return null;
                    }

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
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                            <Typography variant="h6" fontWeight="700" sx={{ color: '#333', flexGrow: 1 }}>
                              {groupKey}
                            </Typography>
                            {metrics.jobCount > 0 && (
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Chip 
                                  label={`${metrics.jobCount} Jobs`} 
                                  size="small" 
                                  sx={{ bgcolor: '#e3f2fd', color: '#1976d2', fontWeight: 'bold' }}
                                />
                                <Chip 
                                  label={`${metrics.count} Elements`} 
                                  size="small" 
                                  sx={{ bgcolor: '#f3e5f5', color: '#7b1fa2', fontWeight: 'bold' }}
                                />
                                <Chip 
                                  label={`${metrics.sqm.toFixed(2)} SQM`} 
                                  size="small" 
                                  sx={{ bgcolor: '#fff3e0', color: '#e65100', fontWeight: 'bold' }}
                                />
                              </Box>
                            )}
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails
                          sx={{
                            p: 3,
                            bgcolor: '#fafafa'
                          }}
                        >
                          {isLoading ? (
                            <Box sx={{ p: 2, textAlign: 'center' }}>
                              <CircularProgress size={24} />
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Loading jobs...
                              </Typography>
                            </Box>
                          ) : !group ? (
                            <Box sx={{ p: 2, textAlign: 'center' }}>
                              <Typography color="text.secondary">No data loaded</Typography>
                            </Box>
                          ) : Object.keys(group).length === 0 || (group.jobs && group.jobs.length === 0) ? (
                            <Box sx={{ p: 2, textAlign: 'center' }}>
                              <Typography color="text.secondary">No jobs found in this group</Typography>
                            </Box>
                          ) : subGroupBy && Object.keys(metrics.subGroups || {}).length > 0 ? (
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
                                  
                                  <TableContainer component={Paper} variant="outlined">
                                    <Table size="small">
                                      <TableHead>
                                        <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                          <TableCell sx={{ fontWeight: 'bold' }}>Job Title</TableCell>
                                          <TableCell sx={{ fontWeight: 'bold' }}>Grid</TableCell>
                                          <TableCell sx={{ fontWeight: 'bold' }}>Part Mark</TableCell>
                                          <TableCell sx={{ fontWeight: 'bold' }}>Length</TableCell>
                                          <TableCell sx={{ fontWeight: 'bold' }}>SQM</TableCell>
                                          <TableCell sx={{ fontWeight: 'bold' }}>Qty</TableCell>
                                          <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Status</TableCell>
                                          <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Actions</TableCell>
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        {subGroupJobsList.map((job) => (
                                          <TableRow key={job._id} sx={{ '&:hover': { bgcolor: '#f8f9fa' } }}>
                                            <TableCell>{job.jobTitle}</TableCell>
                                            <TableCell>{job.structuralElement?.gridNo || 'N/A'}</TableCell>
                                            <TableCell>{job.structuralElement?.partMarkNo || 'N/A'}</TableCell>
                                            <TableCell>{job.structuralElement?.lengthMm ? `${job.structuralElement.lengthMm} mm` : 'N/A'}</TableCell>
                                            <TableCell>{job.structuralElement?.surfaceAreaSqm?.toFixed(2) || '0.00'}</TableCell>
                                            <TableCell>{job.structuralElement?.qty || 'N/A'}</TableCell>
                                            <TableCell align="center">
                                              <Chip
                                                label={job.status === 'not_applicable' ? 'NC' : job.status || 'pending'}
                                                size="small"
                                                sx={{
                                                  bgcolor: job.status === 'pending' ? '#f59e0b' : job.status === 'completed' ? '#10b981' : '#ef4444',
                                                  color: 'white',
                                                  fontWeight: 'bold',
                                                  fontSize: '0.7rem'
                                                }}
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                                <Button
                                                  size="small"
                                                  variant={job.status === 'pending' ? 'contained' : 'outlined'}
                                                  onClick={() => handleStatusUpdate(job._id, 'pending')}
                                                  disabled={updatingJob === job._id}
                                                  sx={{
                                                    minWidth: '60px',
                                                    bgcolor: job.status === 'pending' ? '#f59e0b' : 'transparent',
                                                    color: job.status === 'pending' ? 'white' : '#f59e0b',
                                                    borderColor: '#f59e0b',
                                                    '&:hover': { bgcolor: '#f59e0b', color: 'white' },
                                                    textTransform: 'none',
                                                    fontSize: '0.7rem',
                                                    py: 0.5
                                                  }}
                                                >
                                                  P
                                                </Button>
                                                <Button
                                                  size="small"
                                                  variant={job.status === 'completed' ? 'contained' : 'outlined'}
                                                  onClick={() => handleStatusUpdate(job._id, 'completed')}
                                                  disabled={updatingJob === job._id}
                                                  sx={{
                                                    minWidth: '60px',
                                                    bgcolor: job.status === 'completed' ? '#10b981' : 'transparent',
                                                    color: job.status === 'completed' ? 'white' : '#10b981',
                                                    borderColor: '#10b981',
                                                    '&:hover': { bgcolor: '#10b981', color: 'white' },
                                                    textTransform: 'none',
                                                    fontSize: '0.7rem',
                                                    py: 0.5
                                                  }}
                                                >
                                                  C
                                                </Button>
                                                <Button
                                                  size="small"
                                                  variant={job.status === 'not_applicable' ? 'contained' : 'outlined'}
                                                  onClick={() => handleStatusUpdate(job._id, 'not_applicable')}
                                                  disabled={updatingJob === job._id}
                                                  sx={{
                                                    minWidth: '60px',
                                                    bgcolor: job.status === 'not_applicable' ? '#ef4444' : 'transparent',
                                                    color: job.status === 'not_applicable' ? 'white' : '#ef4444',
                                                    borderColor: '#ef4444',
                                                    '&:hover': { bgcolor: '#ef4444', color: 'white' },
                                                    textTransform: 'none',
                                                    fontSize: '0.7rem',
                                                    py: 0.5
                                                  }}
                                                >
                                                  NC
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
                            <TableContainer component={Paper} variant="outlined">
                              <Table size="small">
                                <TableHead>
                                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Job Title</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Grid</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Part Mark</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Length</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>SQM</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Qty</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Status</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Actions</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {(group.jobs || []).map((job) => (
                                    <TableRow key={job._id} sx={{ '&:hover': { bgcolor: '#f8f9fa' } }}>
                                      <TableCell>{job.jobTitle}</TableCell>
                                      <TableCell>{job.structuralElement?.gridNo || 'N/A'}</TableCell>
                                      <TableCell>{job.structuralElement?.partMarkNo || 'N/A'}</TableCell>
                                      <TableCell>{job.structuralElement?.lengthMm ? `${job.structuralElement.lengthMm} mm` : 'N/A'}</TableCell>
                                      <TableCell>{job.structuralElement?.surfaceAreaSqm?.toFixed(2) || '0.00'}</TableCell>
                                      <TableCell>{job.structuralElement?.qty || 'N/A'}</TableCell>
                                      <TableCell align="center">
                                        <Chip
                                          label={job.status === 'not_applicable' ? 'NC' : job.status || 'pending'}
                                          size="small"
                                          sx={{
                                            bgcolor: job.status === 'pending' ? '#f59e0b' : job.status === 'completed' ? '#10b981' : '#ef4444',
                                            color: 'white',
                                            fontWeight: 'bold',
                                            fontSize: '0.7rem'
                                          }}
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                          <Button
                                            size="small"
                                            variant={job.status === 'pending' ? 'contained' : 'outlined'}
                                            onClick={() => handleStatusUpdate(job._id, 'pending')}
                                            disabled={updatingJob === job._id}
                                            sx={{
                                              minWidth: '60px',
                                              bgcolor: job.status === 'pending' ? '#f59e0b' : 'transparent',
                                              color: job.status === 'pending' ? 'white' : '#f59e0b',
                                              borderColor: '#f59e0b',
                                              '&:hover': { bgcolor: '#f59e0b', color: 'white' },
                                              textTransform: 'none',
                                              fontSize: '0.7rem',
                                              py: 0.5
                                            }}
                                          >
                                            P
                                          </Button>
                                          <Button
                                            size="small"
                                            variant={job.status === 'completed' ? 'contained' : 'outlined'}
                                            onClick={() => handleStatusUpdate(job._id, 'completed')}
                                            disabled={updatingJob === job._id}
                                            sx={{
                                              minWidth: '60px',
                                              bgcolor: job.status === 'completed' ? '#10b981' : 'transparent',
                                              color: job.status === 'completed' ? 'white' : '#10b981',
                                              borderColor: '#10b981',
                                              '&:hover': { bgcolor: '#10b981', color: 'white' },
                                              textTransform: 'none',
                                              fontSize: '0.7rem',
                                              py: 0.5
                                            }}
                                          >
                                            C
                                          </Button>
                                          <Button
                                            size="small"
                                            variant={job.status === 'not_applicable' ? 'contained' : 'outlined'}
                                            onClick={() => handleStatusUpdate(job._id, 'not_applicable')}
                                            disabled={updatingJob === job._id}
                                            sx={{
                                              minWidth: '60px',
                                              bgcolor: job.status === 'not_applicable' ? '#ef4444' : 'transparent',
                                              color: job.status === 'not_applicable' ? 'white' : '#ef4444',
                                              borderColor: '#ef4444',
                                              '&:hover': { bgcolor: '#ef4444', color: 'white' },
                                              textTransform: 'none',
                                              fontSize: '0.7rem',
                                              py: 0.5
                                            }}
                                          >
                                            NC
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
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
