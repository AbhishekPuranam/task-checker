import { useEffect, useRef } from 'react';

/**
 * Performance measurement hook
 * Measures component render time and reports to console
 */
export const usePerformanceMonitor = (componentName) => {
  const renderCount = useRef(0);
  const startTime = useRef(Date.now());
  
  useEffect(() => {
    renderCount.current += 1;
    const renderTime = Date.now() - startTime.current;
    
    if (renderTime > 16) { // Flag renders > 16ms (60fps threshold)
      console.warn(`⚠️ [Performance] ${componentName} render took ${renderTime}ms (Render #${renderCount.current})`);
    } else {
      console.log(`✅ [Performance] ${componentName} render: ${renderTime}ms (Render #${renderCount.current})`);
    }
    
    startTime.current = Date.now();
  });
  
  return renderCount.current;
};

/**
 * Measure initial page load performance
 */
export const measurePageLoad = () => {
  if (typeof window !== 'undefined' && window.performance) {
    const perfData = window.performance.timing;
    const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
    const connectTime = perfData.responseEnd - perfData.requestStart;
    const renderTime = perfData.domComplete - perfData.domLoading;
    
    console.log('📊 [Performance Metrics]', {
      'Total Page Load': `${pageLoadTime}ms`,
      'Server Response': `${connectTime}ms`,
      'DOM Render': `${renderTime}ms`,
      'FCP': window.performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 'N/A'
    });
    
    return {
      pageLoadTime,
      connectTime,
      renderTime
    };
  }
  return null;
};

/**
 * Track interaction performance
 */
export const measureInteraction = (interactionName, fn) => {
  const start = Date.now();
  const result = fn();
  const duration = Date.now() - start;
  
  if (duration > 100) {
    console.warn(`⚠️ [Interaction] ${interactionName} took ${duration}ms`);
  } else {
    console.log(`✅ [Interaction] ${interactionName}: ${duration}ms`);
  }
  
  return result;
};
