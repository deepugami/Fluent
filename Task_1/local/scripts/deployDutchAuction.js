require("dotenv").config();
const fs = require("fs");
const { ethers } = require("hardhat");

async function main() {
  const wasmAddress = process.env.WASM_ADDRESS;
  if (!wasmAddress) {
    throw new Error("WASM_ADDRESS missing in .env");
  }

  // Defaults for a quick test; override via env if needed
  const startPrice = process.env.START_PRICE_WEI
    ? ethers.BigNumber.from(process.env.START_PRICE_WEI)
    : ethers.utils.parseEther("0.1");
  const durationBlocks = process.env.DURATION_BLOCKS
    ? parseInt(process.env.DURATION_BLOCKS, 10)
    : 2000; // ~ 6-7 hours depending on block time
  const exponent = process.env.EXPONENT
    ? ethers.BigNumber.from(process.env.EXPONENT)
    : ethers.BigNumber.from(2);

  console.log("Using WASM contract:", wasmAddress);
  console.log("Start price (wei):", startPrice.toString());
  console.log("Duration (blocks):", durationBlocks);
  console.log("Exponent:", exponent.toString());

  const Factory = await ethers.getContractFactory("DutchAuctionWasmWrapper");
  const auction = await Factory.deploy(
    wasmAddress,
    startPrice,
    durationBlocks,
    exponent
  );
  await auction.deployed();

  console.log("DutchAuctionWasmWrapper deployed to:", auction.address);
  fs.writeFileSync("deployed-addresses-solidity.txt", auction.address + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


