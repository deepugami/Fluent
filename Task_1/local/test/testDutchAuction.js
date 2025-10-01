const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DutchAuction (HH-only)", function () {
  it("computes a positive price before end and zero after", async function () {
    const [owner, buyer] = await ethers.getSigners();
    const startPrice = ethers.utils.parseEther("1");
    const duration = 100;

    const Factory = await ethers.getContractFactory("DutchAuction");
    const auction = await Factory.deploy(startPrice, duration);
    await auction.deployed();

    const price1 = await auction.currentPrice();
    expect(price1).to.be.gt(0);

    // mine blocks to the end
    await ethers.provider.send("hardhat_mine", ["0x64"]); // 100 blocks

    const price2 = await auction.currentPrice();
    expect(price2).to.equal(0);
  });
});
