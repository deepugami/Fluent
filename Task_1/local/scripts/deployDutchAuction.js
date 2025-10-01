require("dotenv").config();
const fs = require("fs");
const { ethers } = require("hardhat");

async function main() {
  // Defaults for a quick test; override via env if needed
  const startPrice = process.env.START_PRICE_WEI
    ? ethers.BigNumber.from(process.env.START_PRICE_WEI)
    : ethers.utils.parseEther("0.1");
  const durationBlocks = process.env.DURATION_BLOCKS
    ? parseInt(process.env.DURATION_BLOCKS, 10)
    : 2000; // ~ 6-7 hours depending on block time

  console.log("Start price (wei):", startPrice.toString());
  console.log("Duration (blocks):", durationBlocks);

  const Factory = await ethers.getContractFactory("DutchAuction");
  const auction = await Factory.deploy(startPrice, durationBlocks);
  await auction.deployed();

  console.log("DutchAuction deployed to:", auction.address);
  fs.writeFileSync("deployed-addresses-solidity.txt", auction.address + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
