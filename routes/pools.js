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

router
    .route('/')
    .get(getPools)
    .post(authorizeSignature, addPool);

router
    .route('/:poolId/:type')
    .delete(authorizeSignature, deletePool);

router
    .route('/whitelisted')
    .get(authorizeSignature, getWhitelistedPools);

router
    .route('/blacklisted')
    .get(authorizeSignature, getBlacklistedPools);

router.use(notFound);

export { router };