import { useState } from 'react';
import Navbar from '../components/Navbar';
import {
  MenuBook,
  RocketLaunch,
  Settings,
  Shield,
  Description,
  Group,
  BarChart,
  CloudUpload,
  Check,
  Close
} from '@mui/icons-material';
import {
  Container,
  Box,
  Typography,
  Paper,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Link,
  Card,
  CardContent
} from '@mui/material';

export default function Documentation() {
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', name: 'Overview', icon: MenuBook },
    { id: 'getting-started', name: 'Getting Started', icon: RocketLaunch },
    { id: 'projects', name: 'Project Management', icon: Description },
    { id: 'jobs', name: 'Job Management', icon: BarChart },
    { id: 'users', name: 'User Management', icon: Group },
    { id: 'excel', name: 'Excel Upload', icon: CloudUpload },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return <OverviewSection />;
      case 'getting-started':
        return <GettingStartedSection />;
      case 'projects':
        return <ProjectsSection />;
      case 'jobs':
        return <JobsSection />;
      case 'users':
        return <UsersSection />;
      case 'excel':
        return <ExcelSection />;
      case 'security':
        return <SecuritySection />;
      case 'settings':
        return <SettingsSection />;
      default:
        return <OverviewSection />;
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      <Navbar />
      
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
            Documentation
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Complete guide to using the Project Tracker application
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Sidebar Navigation */}
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, position: 'sticky', top: 16 }}>
              <List component="nav">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <ListItemButton
                      key={section.id}
                      selected={activeSection === section.id}
                      onClick={() => setActiveSection(section.id)}
                      sx={{
                        borderRadius: 1,
                        mb: 0.5,
                        '&.Mui-selected': {
                          bgcolor: 'primary.light',
                          color: 'primary.main',
                          '&:hover': {
                            bgcolor: 'primary.light',
                          },
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Icon color={activeSection === section.id ? 'primary' : 'action'} />
                      </ListItemIcon>
                      <ListItemText primary={section.name} />
                    </ListItemButton>
                  );
                })}
              </List>
              
              <Divider sx={{ my: 2 }} />
              
              <ListItemButton
                component="a"
                href="/api/docs"
                target="_blank"
                sx={{ borderRadius: 1 }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Description />
                </ListItemIcon>
                <ListItemText primary="API Documentation" />
              </ListItemButton>
            </Paper>
          </Grid>

          {/* Main Content */}
          <Grid item xs={12} md={9}>
            <Paper sx={{ p: 4 }}>
              {renderContent()}
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

// Overview Section
function OverviewSection() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>Overview</Typography>
      <Typography paragraph>
        The Project Tracker is a comprehensive project management system designed for construction
        and engineering projects. It enables teams to manage projects, track tasks, monitor progress,
        and collaborate effectively.
      </Typography>

      <Typography variant="h5" sx={{ mt: 4, mb: 2 }}>Key Features</Typography>
      <Box component="ul" sx={{ pl: 3 }}>
        <li><strong>Project Management</strong> - Create and manage multiple projects</li>
        <li><strong>Job Tracking</strong> - Jobs are automatically created from Excel uploads</li>
        <li><strong>Structural Elements</strong> - Define structural components with fireproofing types</li>
        <li><strong>Excel Integration</strong> - Download template, fill data, and upload to auto-create jobs</li>
        <li><strong>Progress Monitoring</strong> - Track job status: Pending, Complete, Non-Clearance</li>
        <li><strong>User Management</strong> - Role-based access control (Admin, Engineers)</li>
        <li><strong>Secure</strong> - Enterprise-grade security with encrypted data storage</li>
      </Box>

      <Typography variant="h5" sx={{ mt: 4, mb: 2 }}>User Roles</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" color="primary" gutterBottom>
                Admin Users
              </Typography>
              <Box component="ul" sx={{ pl: 2, fontSize: '0.9rem' }}>
                <li>Create and manage projects</li>
                <li>Define structural elements with fireproofing types</li>
                <li>Upload Excel templates to create jobs</li>
                <li>Assign jobs to engineers</li>
                <li>Generate reports</li>
                <li>Manage users and permissions</li>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" color="success.main" gutterBottom>
                Site Engineers
              </Typography>
              <Box component="ul" sx={{ pl: 2, fontSize: '0.9rem' }}>
                <li>View assigned jobs</li>
                <li>Update job status (Pending/Complete/Non-Clearance)</li>
                <li>Add comments and notes</li>
                <li>Upload photos/documents</li>
                <li>Mark jobs as complete or non-clearance</li>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

// Getting Started Section
function GettingStartedSection() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>Getting Started</Typography>
      
      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>First Login</Typography>
      <Box component="ol" sx={{ pl: 3 }}>
        <li>Navigate to your application URL (e.g., <code>https://projects.sapcindia.com</code>)</li>
        <li>Enter your username and password</li>
        <li>Click "Login" to access the system</li>
      </Box>

      <Alert severity="warning" sx={{ my: 2 }}>
        <strong>Security Note:</strong> If using the default admin account (username: admin, password: admin123),
        please change your password immediately after first login.
      </Alert>

      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>Dashboard Overview</Typography>
      <Typography paragraph>
        After logging in, you'll see the main dashboard with:
      </Typography>
      <Box component="ul" sx={{ pl: 3 }}>
        <li><strong>Statistics Cards</strong> - Quick overview of projects, jobs, and users</li>
        <li><strong>Recent Activity</strong> - Latest updates and changes</li>
        <li><strong>Quick Actions</strong> - Common actions and shortcuts</li>
        <li><strong>Navigation Menu</strong> - Access all features from the top menu</li>
      </Box>

      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>Navigation</Typography>
      <Typography paragraph>
        The main navigation menu provides access to:
      </Typography>
      <Box component="ul" sx={{ pl: 3 }}>
        <li><strong>Projects</strong> - Project management</li>
        <li><strong>Jobs</strong> - View and manage all jobs</li>
        <li><strong>Structural Elements</strong> - Define structural components with fireproofing types</li>
        <li><strong>Users</strong> - User management (Admin only)</li>
        <li><strong>Reports</strong> - Generate and download reports</li>
        <li><strong>Documentation</strong> - This guide</li>
      </Box>
    </Box>
  );
}

// Projects Section
function ProjectsSection() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>Project Management</Typography>
      
      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>Creating a New Project</Typography>
      <Typography paragraph>
        Creating a project is simple and requires minimal information:
      </Typography>
      <Box component="ol" sx={{ pl: 3 }}>
        <li>Click <strong>Projects</strong> in the navigation menu</li>
        <li>Click the <strong>+ New Project</strong> button</li>
        <li>Fill in the required field:
          <Box component="ul" sx={{ pl: 3, mt: 1 }}>
            <li><strong>Project Name</strong> - Required (e.g., "Building A Construction")</li>
          </Box>
        </li>
        <li>Optionally provide:
          <Box component="ul" sx={{ pl: 3, mt: 1 }}>
            <li><strong>Location</strong> - Project site location (optional)</li>
            <li><strong>Description</strong> - Brief project overview (optional)</li>
          </Box>
        </li>
        <li>Click <strong>Create Project</strong></li>
      </Box>

      <Alert severity="info" sx={{ my: 2 }}>
        <strong>Quick Tip:</strong> Only the project name is required. You can add location and description later or leave them blank.
      </Alert>

      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>Managing Projects</Typography>
      <Typography paragraph>
        From the Projects page, you can:
      </Typography>
      <Box component="ul" sx={{ pl: 3 }}>
        <li><strong>View All Projects</strong> - See list of all projects with status</li>
        <li><strong>Search/Filter</strong> - Find projects by name or location</li>
        <li><strong>Edit Project</strong> - Update project details</li>
        <li><strong>Upload Excel</strong> - Add structural elements and auto-create jobs</li>
        <li><strong>View Details</strong> - See complete project information and jobs</li>
      </Box>

      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>Project Status</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Description</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Planning</TableCell>
              <TableCell>Project is in planning phase</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Active</TableCell>
              <TableCell>Project is currently in progress</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>On Hold</TableCell>
              <TableCell>Project is temporarily paused</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Completed</TableCell>
              <TableCell>Project is finished</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// Jobs Section
function JobsSection() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>Job Management</Typography>
      
      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>How Jobs Are Created</Typography>
      <Typography paragraph>
        Jobs are <strong>automatically created</strong> when you upload an Excel template:
      </Typography>
      <Box component="ol" sx={{ pl: 3 }}>
        <li>Download the Excel template (see <Link href="#excel" sx={{ cursor: 'pointer' }}>Excel Upload</Link> section)</li>
        <li>Fill in the template with structural element data</li>
        <li>Upload the completed Excel file to a project</li>
        <li>Jobs are automatically created from the template data</li>
        <li>All new jobs start with <strong>Pending</strong> status by default</li>
      </Box>

      <Alert severity="info" sx={{ my: 2 }}>
        <strong>Important:</strong> Jobs are not created manually. The Excel upload process automatically generates jobs for each structural element in your template.
      </Alert>

      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>Job Status Types</Typography>
      <Typography paragraph>
        Each job can have one of three status values:
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Description</strong></TableCell>
              <TableCell><strong>When to Use</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Pending</TableCell>
              <TableCell>Job is awaiting completion</TableCell>
              <TableCell>Default status for all new jobs from Excel upload</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Complete</TableCell>
              <TableCell>Job has been successfully finished</TableCell>
              <TableCell>Mark jobs as Complete when work is finished and approved</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Non-Clearance</TableCell>
              <TableCell>Job did not receive clearance</TableCell>
              <TableCell>Mark jobs as Non-Clearance if they don't get approval or fail inspection</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>Managing Job Status</Typography>
      <Typography paragraph>
        <strong>For Site Engineers:</strong>
      </Typography>
      <Box component="ul" sx={{ pl: 3 }}>
        <li>View assigned jobs in your dashboard</li>
        <li>Review job details and structural element information</li>
        <li>Update job status from Pending to Complete or Non-Clearance</li>
        <li>Add notes or comments about job progress</li>
      </Box>

      <Typography paragraph sx={{ mt: 2 }}>
        <strong>For Administrators:</strong>
      </Typography>
      <Box component="ul" sx={{ pl: 3 }}>
        <li>View all jobs across all projects</li>
        <li>Monitor job status distribution (Pending/Complete/Non-Clearance)</li>
        <li>Generate reports on job completion rates</li>
        <li>Reassign jobs if needed</li>
      </Box>

      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>Viewing Jobs</Typography>
      <Typography paragraph>
        Access jobs from the <strong>Jobs</strong> menu:
      </Typography>
      <Box component="ul" sx={{ pl: 3 }}>
        <li><strong>All Jobs</strong> - Complete list of all jobs in the system</li>
        <li><strong>Filter by Status</strong> - Show only Pending, Complete, or Non-Clearance jobs</li>
        <li><strong>Filter by Project</strong> - View jobs for a specific project</li>
        <li><strong>Search</strong> - Find jobs by structural element details</li>
      </Box>

      <Alert severity="success" sx={{ mt: 2 }}>
        <strong>Best Practice:</strong> Regularly update job status to keep project tracking accurate. Review Pending jobs frequently and mark them as Complete or Non-Clearance as work progresses.
      </Alert>
    </Box>
  );
}

// Users Section
function UsersSection() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>User Management</Typography>
      
      <Alert severity="info" sx={{ my: 2 }}>
        <strong>Note:</strong> User management features are only available to Admin users.
      </Alert>

      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>User Roles & Permissions</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Permission</strong></TableCell>
              <TableCell align="center"><strong>Admin</strong></TableCell>
              <TableCell align="center"><strong>Engineer</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Create Projects</TableCell>
              <TableCell align="center"><Check color="success" /></TableCell>
              <TableCell align="center"><Close color="error" /></TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Create Tasks</TableCell>
              <TableCell align="center"><Check color="success" /></TableCell>
              <TableCell align="center"><Close color="error" /></TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Update Assigned Tasks</TableCell>
              <TableCell align="center"><Check color="success" /></TableCell>
              <TableCell align="center"><Check color="success" /></TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Manage Users</TableCell>
              <TableCell align="center"><Check color="success" /></TableCell>
              <TableCell align="center"><Close color="error" /></TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Upload Excel Data</TableCell>
              <TableCell align="center"><Check color="success" /></TableCell>
              <TableCell align="center"><Close color="error" /></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// Excel Section
function ExcelSection() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>Excel Upload & Integration</Typography>
      
      <Typography paragraph>
        The Excel upload feature is the primary way to add structural elements and automatically 
        create jobs in the Project Tracker. Follow this workflow to import data efficiently.
      </Typography>

      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>Step 1: Download the Template</Typography>
      <Typography paragraph>
        Before uploading data, you need to download the Excel template:
      </Typography>
      <Box component="ol" sx={{ pl: 3 }}>
        <li>Navigate to the project where you want to add data</li>
        <li>Click the <strong>Download Template</strong> button or link</li>
        <li>Save the template file to your computer</li>
      </Box>

      <Alert severity="info" sx={{ my: 2 }}>
        <strong>Template Structure:</strong> The template includes pre-defined columns for structural element details, 
        fireproofing types, and other required fields. Do not modify the column headers.
      </Alert>

      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>Step 2: Fill the Template</Typography>
      <Typography paragraph>
        Open the downloaded template in Excel or compatible spreadsheet software:
      </Typography>
      <Box component="ul" sx={{ pl: 3 }}>
        <li><strong>Structural Element Data</strong> - Enter details for each structural element (beams, columns, etc.)</li>
        <li><strong>Fireproofing Type</strong> - Assign fireproofing types to structural elements as needed</li>
        <li><strong>Required Fields</strong> - Ensure all mandatory columns are filled</li>
        <li><strong>Format</strong> - Follow the format examples provided in the template</li>
      </Box>

      <Alert severity="warning" sx={{ my: 2 }}>
        <strong>Important:</strong> Leave column headers unchanged. Only fill in the data rows below the headers.
      </Alert>

      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>Step 3: Upload the Excel Sheet</Typography>
      <Typography paragraph>
        Once your template is filled with data:
      </Typography>
      <Box component="ol" sx={{ pl: 3 }}>
        <li>Return to the project page</li>
        <li>Click the <strong>Upload Excel</strong> button</li>
        <li>Select your filled template file (.xlsx format)</li>
        <li>Review the data preview if shown</li>
        <li>Click <strong>Upload</strong> or <strong>Import</strong> to process</li>
      </Box>

      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>What Happens After Upload</Typography>
      <Typography paragraph>
        When you upload the Excel file, the system automatically:
      </Typography>
      <Box component="ul" sx={{ pl: 3 }}>
        <li><strong>Creates Structural Elements</strong> - Each row becomes a structural element</li>
        <li><strong>Assigns Fireproofing Types</strong> - Fireproofing specifications are linked to elements</li>
        <li><strong>Generates Jobs</strong> - Jobs are automatically created for each structural element</li>
        <li><strong>Sets Pending Status</strong> - All new jobs start with Pending status by default</li>
      </Box>

      <Alert severity="success" sx={{ my: 2 }}>
        <strong>Automatic Job Creation:</strong> You don't need to manually create jobs. The Excel upload 
        handles this automatically, creating one job per structural element in your template.
      </Alert>

      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>Best Practices</Typography>
      <Box component="ul" sx={{ pl: 3 }}>
        <li>Test with a small batch first (5-10 rows) to verify the format</li>
        <li>Keep a backup copy of your filled template before uploading</li>
        <li>Use consistent naming conventions for structural elements</li>
        <li>Double-check fireproofing type assignments before upload</li>
        <li>Large files may take several minutes to process - be patient</li>
      </Box>
    </Box>
  );
}

// Security Section
function SecuritySection() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>Security & Best Practices</Typography>
      
      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>Password Security</Typography>
      <Box component="ul" sx={{ pl: 3 }}>
        <li>Use strong passwords with at least 8 characters</li>
        <li>Include uppercase, lowercase, numbers, and symbols</li>
        <li>Change default passwords immediately</li>
        <li>Never share passwords with others</li>
        <li>Change passwords regularly (every 90 days recommended)</li>
      </Box>

      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>Data Security</Typography>
      <Alert severity="success" sx={{ my: 2 }}>
        <Typography variant="subtitle2" gutterBottom><strong>Your data is protected with:</strong></Typography>
        <Box component="ul" sx={{ pl: 2, mb: 0 }}>
          <li><strong>Encrypted Storage</strong> - All secrets stored in HashiCorp Vault</li>
          <li><strong>HTTPS/SSL</strong> - All data encrypted in transit</li>
          <li><strong>Authentication</strong> - JWT-based secure authentication</li>
          <li><strong>Role-Based Access</strong> - Users only see what they're authorized for</li>
          <li><strong>Regular Backups</strong> - Automated database backups</li>
        </Box>
      </Alert>
    </Box>
  );
}

// Settings Section
function SettingsSection() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>Settings & Configuration</Typography>
      
      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>Profile Settings</Typography>
      <Typography paragraph>
        Update your personal information:
      </Typography>
      <Box component="ol" sx={{ pl: 3 }}>
        <li>Click your profile icon in the top right</li>
        <li>Select <strong>Profile Settings</strong></li>
        <li>Update your information</li>
        <li>Click <strong>Save Changes</strong></li>
      </Box>

      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>Need Help?</Typography>
      <Alert severity="info" sx={{ my: 2 }}>
        <Typography variant="subtitle2" gutterBottom><strong>Support Resources:</strong></Typography>
        <Box component="ul" sx={{ pl: 2, mb: 0 }}>
          <li>📧 <strong>Email:</strong> support@sapcindia.com</li>
          <li>📘 <strong>API Documentation:</strong> <Link href="/api/docs" target="_blank">View API Docs</Link></li>
          <li>🚀 <strong>Deployment Guide:</strong> See docs/DEPLOYMENT.md</li>
        </Box>
      </Alert>
    </Box>
  );
}
