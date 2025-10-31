const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Task Tracker API',
      version: '1.0.0',
      description: 'API documentation for Task Tracker application - Project management system for construction and engineering tasks',
      contact: {
        name: 'API Support',
        email: 'support@sapcindia.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'https://projects.sapcindia.com/api',
        description: 'Production server'
      },
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token obtained from /api/auth/login'
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token',
          description: 'JWT token stored in cookie'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'User ID'
            },
            username: {
              type: 'string',
              description: 'Unique username'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            fullName: {
              type: 'string',
              description: 'Full name'
            },
            role: {
              type: 'string',
              enum: ['admin', 'engineer'],
              description: 'User role'
            },
            phone: {
              type: 'string',
              description: 'Contact phone number'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Project: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Project ID'
            },
            name: {
              type: 'string',
              description: 'Project name'
            },
            description: {
              type: 'string',
              description: 'Project description'
            },
            startDate: {
              type: 'string',
              format: 'date',
              description: 'Project start date'
            },
            endDate: {
              type: 'string',
              format: 'date',
              description: 'Expected completion date'
            },
            location: {
              type: 'string',
              description: 'Project site location'
            },
            client: {
              type: 'string',
              description: 'Client or organization name'
            },
            status: {
              type: 'string',
              enum: ['planning', 'active', 'on-hold', 'completed'],
              description: 'Current project status'
            },
            createdBy: {
              type: 'string',
              description: 'User ID who created the project'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Task: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Task ID'
            },
            name: {
              type: 'string',
              description: 'Task name'
            },
            description: {
              type: 'string',
              description: 'Detailed task description'
            },
            project: {
              type: 'string',
              description: 'Project ID this task belongs to'
            },
            assignedTo: {
              type: 'string',
              description: 'Engineer user ID assigned to this task'
            },
            status: {
              type: 'string',
              enum: ['pending', 'in-progress', 'completed', 'cancelled'],
              description: 'Current task status'
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              description: 'Task priority level'
            },
            dueDate: {
              type: 'string',
              format: 'date',
              description: 'Task deadline'
            },
            progress: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: 'Completion percentage'
            },
            structuralElement: {
              type: 'string',
              description: 'Related structural element ID'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        StructuralElement: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Element ID'
            },
            type: {
              type: 'string',
              description: 'Type of structural element (e.g., Beam, Column, Slab)'
            },
            description: {
              type: 'string',
              description: 'Element description'
            },
            quantity: {
              type: 'number',
              description: 'Quantity of elements'
            },
            unit: {
              type: 'string',
              description: 'Unit of measurement'
            },
            location: {
              type: 'string',
              description: 'Location within project'
            },
            project: {
              type: 'string',
              description: 'Project ID this element belongs to'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              description: 'Error message'
            },
            error: {
              type: 'string',
              description: 'Detailed error information'
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication token is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Unauthorized - No token provided'
              }
            }
          }
        },
        ForbiddenError: {
          description: 'User does not have permission to perform this action',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Forbidden - Admin access required'
              }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Resource not found'
              }
            }
          }
        },
        ValidationError: {
          description: 'Invalid input data',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Validation error',
                error: 'Invalid email format'
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      },
      {
        cookieAuth: []
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization'
      },
      {
        name: 'Projects',
        description: 'Project management operations'
      },
      {
        name: 'Tasks',
        description: 'Task tracking and assignment'
      },
      {
        name: 'Structural Elements',
        description: 'Structural element management'
      },
      {
        name: 'Users',
        description: 'User management (Admin only)'
      },
      {
        name: 'Reports',
        description: 'Report generation and export'
      },
      {
        name: 'Progress',
        description: 'Progress tracking and updates'
      },
      {
        name: 'Excel',
        description: 'Excel import/export operations'
      }
    ]
  },
  apis: ['./routes/*.js', './server.js'] // Path to the API routes
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
