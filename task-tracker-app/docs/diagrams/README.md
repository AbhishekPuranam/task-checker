# System Architecture Diagrams

This directory contains Mermaid diagram files for the Task Tracker application.

## Diagrams

### 1. Workflow Diagram (`workflow-diagram.mmd`)
Shows the complete user workflow from login through project creation, Excel upload, job assignment, and progress tracking.

**View it:** Copy the content to [Mermaid Live Editor](https://mermaid.live/)

### 2. Architecture Diagram (`architecture-diagram.mmd`)
Displays the complete system architecture including:
- Client Layer (Admin & Engineer Portals)
- API Gateway (Traefik)
- Microservices Layer (7 services)
- Background Workers
- Data Layer (MongoDB, Redis)
- Monitoring Stack (Uptime Kuma, Vector, OpenSearch)

**View it:** Copy the content to [Mermaid Live Editor](https://mermaid.live/)

### 3. Data Flow - Excel Upload (`dataflow-excel-upload.mmd`)
Sequence diagram showing the detailed flow of Excel file upload and processing, including background workers and progress calculation.

**View it:** Copy the content to [Mermaid Live Editor](https://mermaid.live/)

### 4. Database Schema (`database-schema.mmd`)
Entity-Relationship diagram showing all MongoDB collections and their relationships:
- Tasks (Projects)
- SubProjects
- Structural Elements
- Jobs
- Users
- Upload Sessions

**View it:** Copy the content to [Mermaid Live Editor](https://mermaid.live/)

## How to Use

1. Open [Mermaid Live Editor](https://mermaid.live/)
2. Copy the content from any `.mmd` file
3. Paste into the editor
4. The diagram will render automatically
5. Download as PNG, SVG, or PDF

## Updating Diagrams

To update any diagram:
1. Edit the corresponding `.mmd` file
2. Test in Mermaid Live Editor
3. Commit changes to Git

## Technical Stack

- **Mermaid.js**: Diagram as code
- **Live Editor**: https://mermaid.live/
- **Documentation**: https://mermaid.js.org/

## Architecture Overview

```
task-tracker-app/
├── docs/
│   └── diagrams/
│       ├── workflow-diagram.mmd          # User workflow
│       ├── architecture-diagram.mmd      # System architecture
│       ├── dataflow-excel-upload.mmd     # Excel processing flow
│       ├── database-schema.mmd           # Database relationships
│       └── README.md                     # This file
```
