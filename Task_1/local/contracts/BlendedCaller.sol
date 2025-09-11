// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../out/PowerCalculator.wasm/interface.sol";

contract BlendedCaller {
    IPowerCalculator public immutable powerCalculator;

    constructor(address _powerCalculator) {
        powerCalculator = IPowerCalculator(_powerCalculator);
    }

    // wrapper that calls the WASM contract's power function
    function calcPower(uint256 base, uint256 exp) external returns (uint256) {
        return powerCalculator.power(base, exp);
    }
}
