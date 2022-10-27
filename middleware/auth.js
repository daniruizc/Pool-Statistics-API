import asyncHandler from './async.js';
import ErrorResponse from '../utils/errorResponse.js';
import Web3 from 'web3';

// Initialize web3 connection
const web3 = new Web3(process.env.WEB3_PROVIDER);

// Authorize routes
export const authorizeSignature = asyncHandler(async (req, res, next) => {
    
    // Make sure signature exists
    if (!req.headers.signature) {
        return next(new ErrorResponse('Not authorized to access this route', 401));
    }

    try {
        // Verify signature
        const hash = web3.utils.sha3('pool-statistics access signature');
        const signAddress = web3.eth.accounts.recover(hash, req.headers.signature);
        req.address = signAddress.toLowerCase();
        next();
    } catch (error) {
        return next(new ErrorResponse('Not authorized to access this route', 401));
    }
});