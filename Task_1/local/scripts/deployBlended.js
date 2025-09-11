require("dotenv").config();
const fs = require("fs");
const { ethers } = require("hardhat");

async function main() {
  const wasmAddress = process.env.WASM_ADDRESS;
  if (!wasmAddress) {
    throw new Error("WASM_ADDRESS missing in .env");
  }
  console.log("Using WASM contract address:", wasmAddress);

  const BlendedCaller = await ethers.getContractFactory("BlendedCaller");
  const blended = await BlendedCaller.deploy(wasmAddress);
  await blended.deployed();

  console.log("BlendedCaller deployed to:", blended.address);

  fs.writeFileSync("deployed-addresses-solidity.txt", blended.address + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
