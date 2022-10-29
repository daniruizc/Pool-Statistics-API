import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../middleware/async.js';
import axios from 'axios';
import Pool from '../models/Pool.js';
import redisCli from '../config/redis.js';

// @desc    Get all pools
// @route   GET /api/v1/pools
// @access  Public
export const getPools = asyncHandler(async (req, res, next) => {

    // Check if we recently have fetched pools and saved into Redis
    if(redisCli) {
        const allPools = await redisCli.get('allPools');
        
        if(allPools) {
            res.status(200).json({ success: true, data: JSON.parse(allPools), cached: true });
            return;
        }
    }

    const uniswapUrl = "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3";
    const maxTokens = 2000;
    const tokensBatch = 50;

    const response = [];
    const tokenPromises = [];

    const poolList = [];

    // Query tokens in batches of 1000
    for (let i = 0; i < maxTokens; i += tokensBatch) {

        tokenPromises.push(
            axios.post(
                uniswapUrl,
                {
                    query: `
                        {
                          tokens(first: ${tokensBatch}, skip: ${i}, orderBy: volumeUSD, orderDirection: desc) {
                            id
                            name
                            symbol,
                            volumeUSD
                          }
                        }             
                    `
                }
            )
        );

    }

    Promise.all(
        tokenPromises
    ).then(async (tokens) => {
        // console.log('Tokens fetched');

        for (let index in tokens) {
            let tokenBatch = tokens[index];
            let poolPromises = [];

            tokenBatch.data.data.tokens.forEach((token) => {

                let date = new Date();
                date.setUTCHours(0, 0, 0, 0);
                date.setUTCDate(date.getUTCDate() - 1); // Count until yesterday (today is not completed and will lower the stats)
                let tstamp1 = parseInt(date.getTime() / 1000);

                date.setUTCMonth(date.getUTCMonth() - 1); // 1 month of historic
                let tstamp0 = parseInt(date.getTime() / 1000);

                poolPromises.push(
                    axios.post(
                        uniswapUrl,
                        {
                            query: `
                            {
                                token(id:"${token.id}") {
                                    symbol,
                                    name,
                                    whitelistPools (where: {totalValueLockedUSD_gte: 10000}, orderBy: liquidity, orderDirection: desc) {
                                        id,
                                        token0 { id, symbol, decimals},
                                        token1 { id, symbol, decimals },
                                        feeTier,
                                        totalValueLockedUSD,
                                        poolDayData (where: {date_gte: ${tstamp0}, date_lte: ${tstamp1}}) {
                                        date,
                                        volumeUSD,
                                        feesUSD
                                        }
                                    }
                                }
                            }                
                        `
                        }
                    )
                );
            });
            // console.log(`${poolPromises.length} queries to do`)

            // Wait before the next call
            await _wait(500);

            await Promise.all(
                poolPromises
            ).then((tokens) => {
                // console.log('Pool batch fetched')

                tokens.forEach((tokenData) => {

                    tokenData.data.data.token.whitelistPools.forEach((poolData) => {

                        let fee = parseInt(poolData.feeTier) / 10000;
                        let pair = `${poolData.token0.symbol}/${poolData.token1.symbol}/${fee}`;
                        let poolId = poolData.id;

                        // Skip to the next pool if it was already processed
                        if (poolList.includes(poolId)) return;

                        poolList.push(poolId);

                        let TVL = parseInt(poolData.totalValueLockedUSD);

                        let lastIndex;
                        let [dailyVolume, weeklyVolume, monthlyVolume, dailyFee, weeklyFee, monthlyFee, dailyAPR, weeklyAPR, monthlyAPR] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
                        let [weeklyVolumeArr, monthlyVolumeArr, weeklyFeeArr, monthlyFeeArr] = [[], [], [], []];

                        if (poolData.poolDayData.length) {

                            let dateYesterday = new Date();
                            dateYesterday.setUTCHours(0, 0, 0, 0);
                            dateYesterday.setUTCDate(dateYesterday.getUTCDate() - 1);
                            let yesterday = parseInt(dateYesterday.getTime() / 1000);

                            let datePastWeek = new Date();
                            datePastWeek.setUTCHours(0, 0, 0, 0);
                            datePastWeek.setUTCDate(datePastWeek.getUTCDate() - 7);
                            let pastWeek = parseInt(datePastWeek.getTime() / 1000);

                            poolData.poolDayData.forEach((stats) => {
                                let _volumeUSD = (stats.volumeUSD * 100) / 100;
                                let _feesUSD = (stats.feesUSD * 100) / 100;
                                // Yesterday data
                                if (stats.date == yesterday) {
                                    dailyVolume = parseInt(_volumeUSD);
                                    dailyFee = parseInt(_feesUSD);
                                    dailyAPR = parseFloat(parseFloat((dailyFee * 100) / TVL).toFixed(2));
                                }

                                // Week data
                                if (stats.date >= pastWeek && stats.date <= yesterday) {
                                    weeklyVolumeArr.push(_volumeUSD);
                                    weeklyFeeArr.push(_feesUSD);
                                }

                                // Month data
                                monthlyVolumeArr.push(_volumeUSD);
                                monthlyFeeArr.push(_feesUSD);

                            });

                            // Sum and calculate APR of week and month
                            weeklyVolume = parseInt(weeklyVolumeArr.reduce((a, b) => a + b, 0));
                            weeklyFee = parseInt(weeklyFeeArr.reduce((a, b) => a + b, 0));
                            weeklyAPR = parseFloat(parseFloat((weeklyFee * 100) / TVL).toFixed(2));

                            monthlyVolume = parseInt(monthlyVolumeArr.reduce((a, b) => a + b, 0));
                            monthlyFee = parseInt(monthlyFeeArr.reduce((a, b) => a + b, 0));
                            monthlyAPR = parseFloat(parseFloat((monthlyFee * 100) / TVL).toFixed(2));
                        }

                        response.push({
                            poolId,
                            pair,
                            TVL,
                            dailyVolume,
                            weeklyVolume,
                            monthlyVolume,
                            dailyFee,
                            weeklyFee,
                            monthlyFee,
                            dailyAPR,
                            weeklyAPR,
                            monthlyAPR
                        });
                    });
                });

            }).catch(error => {
                console.log(`Error ${error}`.red.bold)
                // return next(new ErrorResponse(`Error ${error}`, 500));
            });
        };

        // Order by
        response.sort((a, b) => {
            let operation;
            switch (req.query.sort) {
                case 'TVL':
                    operation = b.TVL - a.TVL;
                    break;
                case 'volume.daily':
                    operation = b.dailyVolume - a.dailyVolume;
                    break;
                case 'volume.weekly':
                    operation = b.weeklyVolume - a.weeklyVolume;
                    break;
                case 'volume.monthly':
                    operation = b.monthlyVolume - a.monthlyVolume;
                    break;
                case 'fee.daily':
                    operation = b.dailyFee - a.dailyFee;
                    break;
                case 'fee.weekly':
                    operation = b.weeklyFee - a.weeklyFee;
                    break;
                case 'fee.monthly':
                    operation = b.monthlyFee - a.monthlyFee;
                    break;
                case 'APR.daily':
                    operation = b.dailyAPR - a.dailyAPR;
                    break;
                case 'APR.weekly':
                    operation = b.weeklyAPR - a.weeklyAPR;
                    break;
                case 'APR.monthly':
                    operation = b.monthlyAPR - a.monthlyAPR;
                    break;
                default:
                    operation = b.dailyAPR - a.dailyAPR;
                    break;
            }
            return operation;
        });

        // Set Redis with 6 hours expiry
        await redisCli.set('allPools', JSON.stringify(response), { EX: (60 * 60 * 6), NX: true });

        res.status(200).json({ success: true, data: response });

    }).catch(error => {
        console.log(`Error ${error}`.red.bold)
        // return next(new ErrorResponse(`Error ${error}`, 500));
    });
});

// @desc    Get whitelisted pools by user
// @route   GET /api/v1/pools/whitelisted
// @access  Public
export const getWhitelistedPools = asyncHandler(async (req, res, next) => {
    const whitelistedPools = await Pool.find({ userAddress: req.address, type: 'whitelist' });
    res.status(200).json({ success: true, data: whitelistedPools });
});

// @desc    Get blacklisted pools by user
// @route   GET /api/v1/pools/blacklisted
// @access  Public
export const getBlacklistedPools = asyncHandler(async (req, res, next) => {
    const blacklistedPools = await Pool.find({ userAddress: req.address, type: 'blacklist' });
    res.status(200).json({ success: true, data: blacklistedPools });
});

// @desc    Add pool to whitelist or blacklist
// @route   POST /api/v1/pools
// @access  Public
export const addPool = asyncHandler(async (req, res, next) => {
    // Add address to body
    req.body.userAddress = req.address;
    const pool = await Pool.create(req.body);
    res.status(200).json({ success: true, data: pool });
});

// @desc    Delete pool from whitelist or blacklist
// @route   DELETE /api/v1/pools/:poolId/:type
// @access  Public
export const deletePool = asyncHandler(async (req, res, next) => {
    const pool = await Pool.find({ poolId: req.params.poolId, type: req.params.type, userAddress: req.address });
    if (!pool) {
        return next(new ErrorResponse(`Pool not found with id of ${req.params.poolId}`, 404));
    }

    await Pool.remove({ poolId: req.params.poolId, type: req.params.type, userAddress: req.address });

    res.status(200).json({ success: true, data: {} });
});



async function _wait(time) {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(), time);
    });
}