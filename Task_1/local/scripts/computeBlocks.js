require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
  const rpc = process.env.RPC_URL;
  if (!rpc) throw new Error('RPC_URL missing');

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const current = await provider.getBlockNumber();
  const startOffset = parseInt(process.env.START_OFFSET || '10', 10); // start 10 blocks in the future
  const duration = parseInt(process.env.DURATION_BLOCKS || '2000', 10);

  const START_BLOCK = current + startOffset;
  const END_BLOCK = START_BLOCK + duration;

  console.log(JSON.stringify({ current, START_BLOCK, END_BLOCK }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
