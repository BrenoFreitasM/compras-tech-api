import swaggerUi from 'swagger-ui-express';
import * as swaggerDocument from './src/swagger.json';
console.log(swaggerDocument.openapi ? 'OK' : 'FAIL, it is under .default');
