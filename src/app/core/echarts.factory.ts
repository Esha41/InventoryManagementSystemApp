import * as echarts from 'echarts';

// Reduce ECharts console noise in development.
// Some versions of the ECharts type definitions don't expose setLogLevel,

type EchartsWithLogLevel = typeof echarts & {
  setLogLevel?: (level: 'silent' | 'error' | 'warn' | 'info') => void;
};
const echartsWithLogLevel = echarts as EchartsWithLogLevel;
if (typeof echartsWithLogLevel.setLogLevel === 'function') {
  // Options: 'silent' | 'error' | 'warn' | 'info'
  echartsWithLogLevel.setLogLevel('error');
}

export function createEcharts() {
  return echarts;
}


