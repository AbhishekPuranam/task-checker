# Documentation

This folder contains deployment documentation for the Task Tracker application.

## Current Documentation

### Deployment Guide
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide with HashiCorp Vault security
  - Quick setup instructions
  - Vault initialization and management
  - Security best practices
  - Troubleshooting

### User Documentation
User documentation has been moved to a **web-based interface** for better accessibility:

**Access the User Guide:**
- Login to the Admin Portal
- Navigate to the Documentation page (`/admin/docs`)
- Or visit: `https://your-domain.com/admin/docs`

**User Guide includes:**
- Overview and features
- Getting started tutorial
- Project management guide
- Task tracking workflows
- User management
- Excel upload instructions
- Security practices
- Settings and configuration

### API Documentation
API documentation is available through **Swagger UI**:

**Access API Docs:**
- Visit: `https://your-domain.com/api/docs`
- Development: `http://localhost:5000/api/docs`

**API Documentation includes:**
- Complete endpoint reference
- Request/response schemas
- Authentication examples
- Try-it-out functionality
- Model definitions
- Error responses

## Archived Documentation

Legacy markdown documentation files have been moved to the `archive/` folder. These files are kept for reference but are no longer actively maintained. Please refer to the web-based documentation for up-to-date information.

## Quick Links

| Documentation Type | Location | Description |
|-------------------|----------|-------------|
| **Deployment** | `DEPLOYMENT.md` | Server setup and deployment |
| **User Guide** | `/admin/docs` | Web-based user documentation |
| **API Reference** | `/api/docs` | Swagger API documentation |
| **Archived Docs** | `archive/` | Legacy markdown files |

## Contributing to Documentation

### User Documentation
User documentation is maintained in the Next.js admin application:
- File: `clients/admin/pages/docs.js`
- Update documentation sections directly in the React component

### API Documentation  
API documentation is generated from code comments:
- Add Swagger JSDoc comments to route files in `services/backend-api/routes/`
- Swagger spec configuration: `services/backend-api/swagger.js`
- Example comments can be found in `routes/auth.js`

### Deployment Documentation
Deployment documentation can be updated in this folder:
- File: `docs/DEPLOYMENT.md`
- Markdown format for easy editing

## Support

For questions or issues:
- Email: support@sapcindia.com
- User Guide: Login to admin portal → Documentation
- API Docs: Visit `/api/docs`
