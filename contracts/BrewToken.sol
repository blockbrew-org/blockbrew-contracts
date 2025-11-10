// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BrewToken
 * @dev BREW代币合约 - 部署时给部署者100亿代币
 */
contract BrewToken is ERC20, Ownable {
    // 总供应量：100亿代币 (100亿 * 10^18)
    uint256 public constant INITIAL_SUPPLY = 10_000_000_000 * 10**18;

    /**
     * @dev 构造函数 - 部署合约时自动铸造100亿代币给部署者
     */
    constructor() ERC20("Brew Token", "BREW") Ownable(msg.sender) {
        // 将100亿代币铸造给合约部署者
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    /**
     * @dev 返回代币的小数位数
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
