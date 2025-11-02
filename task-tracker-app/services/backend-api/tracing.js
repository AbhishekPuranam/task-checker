const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

/**
 * OpenTelemetry Configuration for Coroot Monitoring
 * 
 * This module sets up automatic instrumentation for:
 * - HTTP/HTTPS requests and responses
 * - Express middleware and routes
 * - MongoDB queries
 * - Redis operations
 * - DNS lookups
 * - Net connections
 * 
 * Environment Variables:
 * - OTEL_EXPORTER_OTLP_ENDPOINT: Coroot collector endpoint (default: http://localhost:4318)
 * - OTEL_SERVICE_NAME: Service name for telemetry (default: task-tracker-backend)
 * - OTEL_TRACES_ENABLED: Enable trace collection (default: true)
 * - OTEL_METRICS_ENABLED: Enable metrics collection (default: true)
 * - OTEL_METRICS_INTERVAL: Metrics export interval in ms (default: 60000)
 */

// Get configuration from environment
const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'task-tracker-backend';
const TRACES_ENABLED = process.env.OTEL_TRACES_ENABLED !== 'false';
const METRICS_ENABLED = process.env.OTEL_METRICS_ENABLED !== 'false';
const METRICS_INTERVAL = parseInt(process.env.OTEL_METRICS_INTERVAL || '60000', 10);

// Service resource attributes
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
  [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  'service.instance.id': process.env.HOSTNAME || require('os').hostname(),
});

// Trace exporter configuration
const traceExporter = TRACES_ENABLED
  ? new OTLPTraceExporter({
      url: `${OTEL_ENDPOINT}/v1/traces`,
      headers: {},
    })
  : undefined;

// Metric exporter configuration
const metricReader = METRICS_ENABLED
  ? new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: `${OTEL_ENDPOINT}/v1/metrics`,
        headers: {},
      }),
      exportIntervalMillis: METRICS_INTERVAL,
    })
  : undefined;

// Initialize OpenTelemetry SDK
const sdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader,
  instrumentations: [
    getNodeAutoInstrumentations({
      // Specific instrumentation configuration
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        ignoreIncomingPaths: [
          '/health',
          '/healthz',
          '/ready',
          '/favicon.ico',
        ],
        requestHook: (span, request) => {
          // Add custom attributes to HTTP spans
          span.setAttribute('http.client_ip', request.headers['x-forwarded-for'] || request.socket.remoteAddress);
          span.setAttribute('http.user_agent', request.headers['user-agent']);
        },
      },
      '@opentelemetry/instrumentation-express': {
        enabled: true,
        requestHook: (span, info) => {
          // Add route information to spans
          if (info.route) {
            span.setAttribute('express.route', info.route);
          }
        },
      },
      '@opentelemetry/instrumentation-mongodb': {
        enabled: true,
        enhancedDatabaseReporting: true,
      },
      '@opentelemetry/instrumentation-redis': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-dns': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-net': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Disable to reduce noise
      },
    }),
  ],
});

// Start the SDK
try {
  const startPromise = sdk.start();
  if (startPromise && startPromise.then) {
    startPromise
      .then(() => {
        console.log(`[OpenTelemetry] Initialized for service: ${SERVICE_NAME}`);
        console.log(`[OpenTelemetry] Exporting to: ${OTEL_ENDPOINT}`);
        console.log(`[OpenTelemetry] Traces: ${TRACES_ENABLED ? 'enabled' : 'disabled'}`);
        console.log(`[OpenTelemetry] Metrics: ${METRICS_ENABLED ? 'enabled' : 'disabled'}`);
      })
      .catch((error) => console.error('[OpenTelemetry] Error starting SDK:', error));
  } else {
    console.log('[OpenTelemetry] SDK started synchronously');
  }
} catch (error) {
  console.error('[OpenTelemetry] Error initializing SDK:', error);
}

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('[OpenTelemetry] SDK shut down successfully'))
    .catch((error) => console.error('[OpenTelemetry] Error shutting down SDK:', error))
    .finally(() => process.exit(0));
});

module.exports = sdk;
