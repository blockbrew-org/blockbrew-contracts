// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BrewToken is ERC20, Ownable {
    uint256 public constant INITIAL_SUPPLY = 10_000_000_000 * 10**18;

    constructor(address _delegate, address _treasury)
        ERC20("Brew Token", "BREW")
        Ownable(_delegate) {
        require(_delegate != address(0), "Invalid delegate address");
        require(_treasury != address(0), "Invalid treasury address");
        _mint(_treasury, INITIAL_SUPPLY);
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
