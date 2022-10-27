// Route files
import { router as pools } from './pools.js';
import { errorHandler } from '../middleware/error.js';

export default (app) => {

    // Mount routers
    app.use('/api/v1/pools', pools);

    // Mount error handler
    app.use(errorHandler);
}