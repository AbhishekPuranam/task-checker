# Task Tracker Web Application

A comprehensive web-based task tracking system designed for **Office Admins** and **Site Engineers** to manage structural engineering projects and work orders.

## Features

### For Office Admins (Blue Work) 📘
- **Structural Elements Management**: Create and manage detailed structural element data
- **Excel Reports**: Generate comprehensive Excel reports with color coding
- **Admin Dashboard**: Overview of all tasks and structural elements
- **User Management**: Manage engineer accounts and permissions
- **Bulk Import**: Import structural data from Excel files

### For Site Engineers (Yellow Work) 📒
- **Job Creation**: Create work orders against structural elements
- **Task Management**: Track progress, add comments, and update status
- **Real-time Updates**: Live notifications and status updates
- **Mobile Friendly**: Responsive design for field work

### Color Coding System (Like Your Excel)
- **🔵 Blue**: Completed work by admins
- **🟡 Yellow**: New jobs filed by site engineers  
- **🟠 Orange**: Work in progress
- **🔴 Red**: Cancelled/failed work

## System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Office Admin  │    │  Site Engineers  │    │   Database      │
│                 │    │                  │    │                 │
│ • Create struct │    │ • Create jobs    │    │ • Structural    │
│   elements      │    │ • Update status  │    │   Elements      │
│ • Generate      │    │ • Add comments   │    │ • Work Orders   │
│   reports       │    │ • Track progress │    │ • Users         │
│ • Manage users  │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Technology Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose
- **JWT** Authentication
- **Socket.IO** for real-time updates
- **ExcelJS** for report generation
- **Multer** for file uploads

### Frontend
- **React** 18 with Hooks
- **Material-UI (MUI)** for design
- **React Router** for navigation
- **Axios** for API calls
- **Socket.IO Client** for real-time features

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or cloud)
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/YourUsername/task-checker.git
cd task-checker/task-tracker-app
```

### 2. Backend Setup
```bash
# Install backend dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 3. Environment Configuration
Edit `.env` file:
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/tasktracker
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
CLIENT_URL=http://localhost:3000
SESSION_SECRET=your-session-secret-change-this-in-production
```

### 4. Frontend Setup
```bash
# Install frontend dependencies
cd client
npm install
```

### 5. Start the Application
```bash
# Terminal 1: Start Backend (from root directory)
npm run dev

# Terminal 2: Start Frontend (from client directory)
cd client
npm start
```

### 6. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/health

## Database Schema

### Structural Elements (Admin Input)
```javascript
{
  serialNo: "SE001",
  structureNumber: "STR-2023-001",
  drawingNo: "DWG-001",
  level: "L1",
  memberType: "beam",
  gridNo: "A1-B1",
  partMarkNo: "PM-001",
  sectionSizes: "200x100x8",
  lengthMm: 5000,
  quantity: 2,
  sectionDepthMm: 200,
  flangeWidthMm: 100,
  webThicknessMm: 6,
  flangeThicknessMm: 8,
  fireproofingThickness: 25,
  surfaceAreaSqm: 2.5,
  projectName: "Building A",
  siteLocation: "Site 1"
}
```

### Work Orders/Tasks (Engineer Input)
```javascript
{
  structuralElement: ObjectId, // Links to structural element
  jobName: "Welding beam connection",
  workDescription: "Weld beam to column connection",
  workType: "welding",
  status: "pending", // pending, in_progress, completed, cancelled
  priority: "high",
  progressPercentage: 0,
  qualityCheckStatus: "pending",
  createdBy: ObjectId, // Site Engineer
  assignedTo: ObjectId,
  dueDate: Date,
  estimatedHours: 8,
  actualHours: 6
}
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile

### Structural Elements (Admin)
- `GET /api/structural-elements` - List all elements
- `POST /api/structural-elements` - Create new element
- `PUT /api/structural-elements/:id` - Update element
- `DELETE /api/structural-elements/:id` - Delete element
- `POST /api/structural-elements/bulk-import` - Bulk import

### Tasks/Work Orders (Engineers)
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `GET /api/tasks/:id` - Get task details
- `POST /api/tasks/:id/comments` - Add comment

### Reports (Admin)
- `GET /api/reports/structural-elements` - Export structural elements to Excel
- `GET /api/reports/tasks-report` - Export tasks report to Excel
- `GET /api/reports/combined-report` - Export combined report to Excel

## Usage Workflow

### 1. Office Admin Workflow
1. **Login** as admin user
2. **Create Structural Elements** with all technical specifications
3. **Manage Engineers** - create engineer accounts
4. **Monitor Tasks** - view all jobs created by engineers
5. **Generate Reports** - export Excel reports with color coding
6. **Update Status** - mark work as completed (blue coding)

### 2. Site Engineer Workflow  
1. **Login** as engineer user
2. **View Structural Elements** - see available structures
3. **Create Work Orders** - create jobs against structural elements
4. **Update Progress** - track work progress percentage
5. **Add Comments** - communicate with team
6. **Complete Tasks** - mark jobs as completed

### 3. Report Generation
```bash
# Generate structural elements report
GET /api/reports/structural-elements?projectName=Building A&status=active

# Generate tasks report with filters
GET /api/reports/tasks-report?status=completed&startDate=2023-01-01

# Generate combined report
GET /api/reports/combined-report?projectName=Building A
```

## Excel Export Features

### Report Types
1. **Structural Elements Report**: Complete structural data with color coding
2. **Tasks Report**: All work orders with progress tracking
3. **Combined Report**: Structural elements with associated jobs

### Excel Color Coding (Matches Your Original System)
- **Light Blue**: Completed work (admin approved)
- **Yellow**: New jobs by engineers
- **Orange**: Work in progress
- **Green**: Successfully completed jobs
- **Gray**: Elements with no assigned work

### Report Filters
- Project Name
- Date Range  
- Status
- Member Type
- Engineer
- Work Type

## Security Features

- **JWT Authentication** with secure tokens
- **Role-based Access Control** (Admin vs Engineer)
- **Rate Limiting** to prevent API abuse
- **Input Validation** and sanitization
- **File Upload Security** with type restrictions
- **CORS Protection**

## Real-time Features

- **Live Updates** when tasks are created/updated
- **Socket.IO Integration** for instant notifications
- **Real-time Dashboard** showing current status
- **Live Comments** and status changes

## Mobile Responsiveness

- **Responsive Design** works on all devices
- **Touch-friendly Interface** for field work
- **Offline Capability** (coming soon)
- **PWA Support** (Progressive Web App)

## Deployment

### Production Deployment
```bash
# Build frontend
cd client
npm run build

# Set production environment
export NODE_ENV=production

# Start with PM2
npm install -g pm2
pm2 start server.js --name task-tracker

# Setup reverse proxy (nginx)
# Configure SSL certificates
# Setup MongoDB replica set
```

### Docker Deployment
```bash
# Build and run with Docker
docker-compose up -d
```

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit pull request

## Support

For questions or support:
- 📧 Email: support@tasktracker.com
- 📱 Phone: +1-234-567-8900
- 💬 Slack: #task-tracker-support

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for efficient structural engineering project management**