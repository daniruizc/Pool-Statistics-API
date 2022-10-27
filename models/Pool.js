import mongoose from 'mongoose';

const PoolSchema = new mongoose.Schema({
    poolId: {
        type: String,
        required: [true, 'Please add the poolId'],
        index: true
    },
    type: {
        type: String,
        required: [true, 'Please specify where to add the pool (whitelist or blacklist)'],
        enum: ['whitelist', 'blacklist'],
        index: true
    },
    userAddress: {
        type: String,
        required: [true, 'Please add the user address'],
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

PoolSchema.index({ type: 1, userAddress: 1 });

export default mongoose.model('Pool', PoolSchema);