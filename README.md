# Pool Statistics API

> Utility API for querying Uniswap V3 pools through theGraph. It also aggregates some basic stats to help users choose the best pools to invest.

## Stack
The stack for this API consist of:
* NodeJS with Express for the Rest API
* MongoDB to store user whitelist and blacklist pools
* Redis to cache time consuming data
* Web3 to authorize requests through the Wallet signature

## API Documentation
https://danielruizc.com/projects/pool-statistics-api


## Install Dependencies
```
npm install
```

## Configuration
Duplicate file "config.env" to ".env" and update the values/settings to your own

## Run application
```
# Run in dev mode
npm run dev

# Run in production mode
npm start
```

## Version & License
- Version: 1.0.0
- License: MIT

## Contact information
Daniel Ruiz <<druizcallado@gmail.com>>