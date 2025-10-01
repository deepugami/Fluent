import fs from 'fs';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
const RPC = process.env.RPC_URL;
const CONTRACT = process.env.SOL_ADDRESS || process.env.CONTRACT_ADDRESS;
const ARTIFACT_PATH = './artifacts/contracts/solidity/BlendedDutchAuction.sol/BlendedDutchAuction.json';
(async function(){
  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH));
  const contract = new ethers.Contract(CONTRACT, artifact.abi, provider);
  const blockNumber = await provider.getBlockNumber();
  console.log('rpc blockNumber:', blockNumber);
  const START_PRICE = await contract.START_PRICE();
  const START_BLOCK = await contract.START_BLOCK();
  const END_BLOCK = await contract.END_BLOCK();
  const EXPONENT = await contract.EXPONENT();
  const POWER_CALC = await contract.POWER_CALCULATOR();
  console.log('START_PRICE (wei):', START_PRICE.toString());
  console.log('START_BLOCK:', START_BLOCK.toString());
  console.log('END_BLOCK:', END_BLOCK.toString());
  console.log('EXPONENT:', EXPONENT.toString());
  console.log('POWER_CALCULATOR:', POWER_CALC);
  const bn_block = BigInt(blockNumber);
  const bn_start = BigInt(START_BLOCK.toString());
  const bn_end = BigInt(END_BLOCK.toString());
  let remaining = bn_end > bn_block ? bn_end - bn_block : 0n;
  const total = bn_end > bn_start ? bn_end - bn_start : 0n;
  console.log('remainingBlocks:', remaining.toString());
  console.log('totalBlocks:', total.toString());
  const exp = Number(EXPONENT.toString());
  function pow_bigint(baseBigInt, e){
    if (e === 0) return 1n;
    let r = 1n;
    for (let i = 0; i < e; i++) r *= baseBigInt;
    return r;
  }
  const powRem = pow_bigint(remaining, exp);
  const powTot = pow_bigint(total === 0n ? 1n : total, exp);
  console.log('powRem:', powRem.toString());
  console.log('powTot:', powTot.toString());
  const startPriceBI = BigInt(START_PRICE.toString());
  let expectedPrice = 0n;
  if (powTot !== 0n) expectedPrice = (startPriceBI * powRem) / powTot;
  console.log('expectedPrice (wei):', expectedPrice.toString());
  try { console.log('expectedPrice (ETH approx):', (Number(expectedPrice) / 1e18).toString()); } catch(e){ console.log('expectedPrice (ETH approx):', expectedPrice.toString()); }
  try {
    const priceOnChain = await contract.callStatic.currentPrice();
    console.log('callStatic currentPrice() =>', priceOnChain.toString());
    try { console.log('callStatic price (ETH):', ethers.utils.formatEther(priceOnChain)); } catch(e){}
  } catch(err){ console.error('callStatic.currentPrice() failed:', err.message || err); }
})();
