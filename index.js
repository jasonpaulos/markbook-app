import { URL } from 'whatwg-url';
import { Buffer } from 'buffer/';

import { AppRegistry } from 'react-native';
import { App } from './src/App';
import { name as appName } from './app.json';

global.URL = URL;
global.Buffer = Buffer;

AppRegistry.registerComponent(appName, () => App);
