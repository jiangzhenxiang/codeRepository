import './style.css';

import pMonitor from '../plugin/pMonitor';

pMonitor.init({ url: '/url', timeoutUrl: 'timeoutUrl' });
pMonitor.logPackage();
