import * as echarts from 'echarts';

// Reduce ECharts console noise in development.
// Some versions of the ECharts type definitions don't expose setLogLevel,
// so we call it via a safe "any" cast if it exists at runtime.
const echartsAny = echarts as any;
if (typeof echartsAny.setLogLevel === 'function') {
  // Options: 'silent' | 'error' | 'warn' | 'info'
  echartsAny.setLogLevel('error');
}

export function createEcharts() {
  return echarts;
}


