// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BrewToken
 */
contract BrewToken is ERC20, Ownable {

    uint256 public constant INITIAL_SUPPLY = 10_000_000_000 ether;

    constructor(address _delegate, address _treasury) ERC20("Brew Token", "BREW") Ownable(_delegate) {
        _mint(_treasury, INITIAL_SUPPLY);
    }
}
