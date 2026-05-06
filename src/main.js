import './ws-hook.js';
import { boot } from './boot.js';

if (document.readyState === 'complete') setTimeout(boot, 2000);
else window.addEventListener('load', () => setTimeout(boot, 2000));
