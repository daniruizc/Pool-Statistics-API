import express from 'express';
import { notFound } from '../middleware/error.js';
import {
    getPools,
    getWhitelistedPools,
    getBlacklistedPools,
    addPool,
    deletePool
} from '../controllers/pools.js';
import { authorizeSignature } from '../middleware/auth.js';

import validate from '../middleware/validate.js';
// import {
//     poolSchema
// } from '../validationSchemas/pools.js';

const router = express.Router();

router.use(authorizeSignature);

router
    .route('/')
    .get(getPools)
    .post(addPool);

router
    .route('/:poolId/:type')
    .delete(deletePool);

router
    .route('/whitelisted/:address')
    .get(getWhitelistedPools);

router
    .route('/blacklisted/:address')
    .get(getBlacklistedPools);

router.use(notFound);

export { router };