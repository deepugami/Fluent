// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Import the gblend-generated Solidity interface for the WASM contract
// Make sure you've run `gblend build` so `out/PowerCalculator.wasm/interface.sol` exists
import {IPowerCalculator} from "../out/PowerCalculator.wasm/interface.sol";

/// @title DutchAuctionWasmWrapper
/// @notice Minimal Dutch auction wrapper that delegates non-linear price calculation
///         to a WASM contract (via gblend-generated interface `IPowerCalculator`).
///         Price = startPrice * (remainingBlocks^exponent) / (totalBlocks^exponent)
contract DutchAuctionWasmWrapper {
    address payable public immutable SELLER;
    uint256 public immutable START_PRICE; // in wei
    uint256 public immutable START_BLOCK;
    uint256 public immutable END_BLOCK;
    uint256 public immutable EXPONENT; // non-linear curve exponent (e.g., 2 for quadratic)

    IPowerCalculator public immutable POWER_CALCULATOR; // WASM exponentiation helper

    bool public ended;

    event Bought(address indexed buyer, uint256 pricePaid);

    constructor(address _powerCalculator, uint256 _startPrice, uint256 _durationBlocks, uint256 _exponent) {
        require(_powerCalculator != address(0), "invalid wasm");
        require(_startPrice > 0, "price=0");
        require(_durationBlocks > 0, "duration=0");
        require(_exponent > 0, "exponent=0");

        SELLER = payable(msg.sender);
        POWER_CALCULATOR = IPowerCalculator(_powerCalculator);

        START_PRICE = _startPrice;
        START_BLOCK = block.number;
        END_BLOCK = block.number + _durationBlocks;
        EXPONENT = _exponent;
    }

    function remainingBlocks() public view returns (uint256) {
        if (block.number >= END_BLOCK) return 0;
        return END_BLOCK - block.number;
    }

    function totalBlocks() public view returns (uint256) {
        return END_BLOCK - START_BLOCK;
    }

    /// @notice Current price using WASM power function for non-linear decay
    /// @dev Not marked view because the generated interface method is non-view.
    function currentPrice() public returns (uint256) {
        uint256 rem = remainingBlocks();
        if (rem == 0) return 0;

        uint256 tot = totalBlocks();
        // Compute rem^exponent and tot^exponent via WASM-power
        uint256 num = POWER_CALCULATOR.power(rem, EXPONENT);
        uint256 den = POWER_CALCULATOR.power(tot, EXPONENT);
        if (den == 0) return 0;

        return (START_PRICE * num) / den;
    }

    /// @notice Buy at current price. Excess ETH is refunded. Transfers proceeds to seller.
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
        (bool okPay,) = SELLER.call{value: price}("");
        require(okPay, "payout failed");

        emit Bought(msg.sender, price);
    }
}
