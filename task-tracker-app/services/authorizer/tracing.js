const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

/**
 * OpenTelemetry Configuration for Authorizer Service
 */

const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'task-tracker-authorizer';
const TRACES_ENABLED = process.env.OTEL_TRACES_ENABLED !== 'false';
const METRICS_ENABLED = process.env.OTEL_METRICS_ENABLED !== 'false';
const METRICS_INTERVAL = parseInt(process.env.OTEL_METRICS_INTERVAL || '60000', 10);

const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
  [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  'service.instance.id': process.env.HOSTNAME || require('os').hostname(),
});

const traceExporter = TRACES_ENABLED
  ? new OTLPTraceExporter({
      url: `${OTEL_ENDPOINT}/v1/traces`,
      headers: {},
    })
  : undefined;

const metricReader = METRICS_ENABLED
  ? new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: `${OTEL_ENDPOINT}/v1/metrics`,
        headers: {},
      }),
      exportIntervalMillis: METRICS_INTERVAL,
    })
  : undefined;

const sdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        ignoreIncomingPaths: ['/health', '/healthz', '/ready'],
      },
      '@opentelemetry/instrumentation-express': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-mongodb': {
        enabled: true,
        enhancedDatabaseReporting: true,
      },
    }),
  ],
});

sdk.start()
  .then(() => console.log(`[OpenTelemetry] Authorizer Service initialized - exporting to: ${OTEL_ENDPOINT}`))
  .catch((error) => console.error('[OpenTelemetry] Error initializing SDK:', error));

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('[OpenTelemetry] SDK shut down successfully'))
    .catch((error) => console.error('[OpenTelemetry] Error shutting down SDK:', error))
    .finally(() => process.exit(0));
});

module.exports = sdk;
