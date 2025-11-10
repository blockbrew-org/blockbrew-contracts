// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BrewNFT
 * @dev 简洁、安全的NFT合约 - 参考BAYC、Azuki等蓝筹项目设计
 * @notice 使用严格价格匹配，支持批量mint（最多300个）
 */
contract BrewNFT is ERC721A, Ownable, ReentrancyGuard, Pausable {

    // ============ 状态变量 ============

    /// @notice 收款钱包地址（接收mint付款）
    address payable public treasury;

    /// @notice NFT单价（BNB）
    uint256 public price;

    /// @notice 最大供应量
    uint256 public maxSupply;

    /// @notice 绝对最大供应量（不可更改的硬性上限）
    uint256 public constant ABSOLUTE_MAX_SUPPLY = 100000;

    /// @notice 单次mint最大数量
    uint256 public constant MAX_PER_MINT = 300;

    /// @notice 基础URI
    string private baseTokenURI;

    /// @notice URI是否已锁定（锁定后不可更改）
    bool public uriLocked;

    // ============ 事件 ============

    event Minted(address indexed to, uint256 quantity, uint256 totalCost);
    event PriceUpdated(uint256 newPrice);
    event MaxSupplyUpdated(uint256 newMaxSupply);
    event BaseURIUpdated(string newBaseURI);
    event URILocked();
    event Withdrawn(address indexed to, uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // ============ 构造函数 ============

    /**
     * @dev 初始化NFT合约
     * @param _treasury 收款钱包地址
     */
    constructor(address payable _treasury) ERC721A("Brew NFT", "BNFT") Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury address");
        treasury = _treasury;
        price = 0.001 ether;       // 初始价格: 0.001 BNB
        maxSupply = 10000;         // 初始最大供应量: 10000
        require(maxSupply <= ABSOLUTE_MAX_SUPPLY, "Exceeds absolute max supply");
    }

    // ============ 核心功能 ============

    /**
     * @notice 批量mint NFT
     * @param quantity mint数量 (1-300)
     */
    function mint(uint256 quantity) external payable nonReentrant whenNotPaused {
        // 参数验证
        require(quantity > 0, "Invalid quantity");
        require(quantity <= MAX_PER_MINT, "Exceeds max per mint");

        // 供应量检查
        require(_totalMinted() + quantity <= maxSupply, "Exceeds max supply");

        // 价格验证（严格匹配）
        uint256 totalCost = price * quantity;
        require(msg.value == totalCost, "Incorrect payment");

        // 立即转账到收款钱包
        (bool success, ) = treasury.call{value: totalCost}("");
        require(success, "Transfer to treasury failed");

        // Mint
        _mint(msg.sender, quantity);

        emit Minted(msg.sender, quantity, totalCost);
    }

    // ============ Owner管理功能 ============

    /**
     * @notice 设置NFT单价
     * @param newPrice 新价格（wei）
     */
    function setPrice(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Price must be greater than zero");
        price = newPrice;
        emit PriceUpdated(newPrice);
    }

    /**
     * @notice 设置最大供应量
     * @param newMaxSupply 新的最大供应量
     * @dev 只能设置为大于等于当前已mint数量且不超过绝对上限的值
     */
    function setMaxSupply(uint256 newMaxSupply) external onlyOwner {
        require(newMaxSupply >= _totalMinted(), "Below current supply");
        require(newMaxSupply <= ABSOLUTE_MAX_SUPPLY, "Exceeds absolute max supply");
        maxSupply = newMaxSupply;
        emit MaxSupplyUpdated(newMaxSupply);
    }

    /**
     * @notice 设置收款钱包地址
     * @param newTreasury 新的收款地址
     */
    function setTreasury(address payable newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid address");
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /**
     * @notice 设置基础URI
     * @param newBaseURI 新的基础URI
     * @dev 只有在URI未锁定时才能设置
     */
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        require(!uriLocked, "URI is locked");
        baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    /**
     * @notice 永久锁定URI，锁定后无法再修改
     * @dev 此操作不可逆，请谨慎操作！建议在reveal后锁定
     */
    function lockURI() external onlyOwner {
        require(!uriLocked, "URI already locked");
        require(bytes(baseTokenURI).length > 0, "Base URI not set");
        uriLocked = true;
        emit URILocked();
    }

    /**
     * @notice 暂停mint
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice 恢复mint
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice 紧急提现功能 - 提取合约中意外接收的BNB
     * @dev 正常情况下合约余额应为0（mint收入直接转treasury）
     *      此函数仅用于提取误转入合约的资金
     */
    function emergencyWithdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");

        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Transfer failed");

        emit Withdrawn(owner(), balance);
    }

    // ============ 查询功能 ============

    /**
     * @notice 查询总mint数量
     */
    function totalMinted() external view returns (uint256) {
        return _totalMinted();
    }

    /**
     * @notice 查询合约BNB余额
     * @dev 正常情况下应为0（mint收入直接转treasury）
     *      如果有余额，说明有误转入的资金
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice 查询剩余可mint数量
     */
    function remainingSupply() external view returns (uint256) {
        return maxSupply - _totalMinted();
    }

    // ============ 内部函数 ============

    /**
     * @dev 返回基础URI
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return baseTokenURI;
    }

    /**
     * @dev 覆盖起始tokenId，从1开始
     */
    function _startTokenId() internal pure virtual override returns (uint256) {
        return 1;
    }
}
