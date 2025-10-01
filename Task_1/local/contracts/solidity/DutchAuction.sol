// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title DutchAuction (HH-only starting point)
/// @notice Simple linear Dutch auction without any WASM dependency.
contract DutchAuction {
    address payable public immutable seller;
    uint256 public immutable startPrice; // in wei
    uint256 public immutable startBlock;
    uint256 public immutable endBlock;

    bool public ended;

    event Bought(address indexed buyer, uint256 pricePaid);

    constructor(uint256 _startPrice, uint256 _durationBlocks) {
        require(_startPrice > 0, "price=0");
        require(_durationBlocks > 0, "duration=0");

        seller = payable(msg.sender);
        startPrice = _startPrice;
        startBlock = block.number;
        endBlock = block.number + _durationBlocks;
    }

    function remainingBlocks() public view returns (uint256) {
        if (block.number >= endBlock) return 0;
        return endBlock - block.number;
    }

    function totalBlocks() public view returns (uint256) {
        return endBlock - startBlock;
    }

    /// @notice Linear decay: price starts at startPrice and goes to 0 at endBlock
    function currentPrice() public view returns (uint256) {
        uint256 rem = remainingBlocks();
        if (rem == 0) return 0;
        uint256 tot = totalBlocks();
        return (startPrice * rem) / tot;
    }

    function buy() external payable {
        require(!ended, "ended");
        uint256 price = currentPrice();
        require(price > 0, "auction over");
        require(msg.value >= price, "insufficient value");

        ended = true;

        // refund any excess
        uint256 refund = msg.value - price;
        if (refund > 0) {
            (bool okRefund,) = msg.sender.call{value: refund}("");
            require(okRefund, "refund failed");
        }

        // pay seller
        (bool okPay,) = seller.call{value: price}("");
        require(okPay, "payout failed");

        emit Bought(msg.sender, price);
    }
}
