require('dotenv').config();
require('@nomiclabs/hardhat-ethers');

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.fluent.xyz";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

module.exports = {
  solidity: "0.8.19",
  networks: {
    fluentTestnet: {
      url: RPC_URL,
      chainId: 20994,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    }
  },
  paths: {
    sources: "./src",
    artifacts: "./artifacts",
    tests: "./test"
  }
};
