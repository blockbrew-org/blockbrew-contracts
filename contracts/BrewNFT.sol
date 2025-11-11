// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "erc721a/contracts/ERC721A.sol";
import "erc721a/contracts/extensions/ERC721AQueryable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BrewNFT
 * @dev 简洁、安全的NFT合约 - 参考BAYC、Azuki等蓝筹项目设计
 * @notice 使用严格价格匹配，支持批量mint（最多300个）
 * @notice 包含ERC721AQueryable扩展，支持高效的批量查询
 */
contract BrewNFT is ERC721A, ERC721AQueryable, Ownable, ReentrancyGuard, Pausable {

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

    // ============ ERC721AQueryable 增强查询功能 ============

    /// @notice 推荐的单次查询范围（防止超时）
    uint256 public constant RECOMMENDED_QUERY_RANGE = 2000;

    /// @notice 单次查询的最大范围限制
    uint256 public constant MAX_QUERY_RANGE = 5000;

    /**
     * @notice 获取分页查询的推荐参数
     * @return startTokenId 起始tokenId（总是从1开始）
     * @return pageSize 推荐的每页大小
     * @return totalPages 基于当前总供应量的总页数
     * @return totalMintedCount 当前已铸造的总数
     * @dev 前端可以用这个方法获取合理的分页参数，然后调用tokensOfOwnerIn进行查询
     * @dev 使用示例：
     *      (start, pageSize, totalPages, total) = getQueryPagination();
     *      for (page = 0; page < totalPages; page++) {
     *          uint256 rangeStart = start + page * pageSize;
     *          uint256 rangeStop = rangeStart + pageSize;
     *          if (rangeStop > total + 1) rangeStop = total + 1;
     *          uint256[] memory tokens = tokensOfOwnerIn(owner, rangeStart, rangeStop);
     *      }
     */
    function getQueryPagination()
        external
        view
        returns (
            uint256 startTokenId,
            uint256 pageSize,
            uint256 totalPages,
            uint256 totalMintedCount
        )
    {
        startTokenId = _startTokenId();
        pageSize = RECOMMENDED_QUERY_RANGE;
        totalMintedCount = _totalMinted();

        if (totalMintedCount == 0) {
            totalPages = 0;
        } else {
            // 计算需要多少页
            uint256 tokensToScan = totalMintedCount;
            totalPages = (tokensToScan + pageSize - 1) / pageSize;
        }
    }

    /**
     * @notice 获取指定页的查询范围
     * @param pageNumber 页码（从0开始）
     * @return rangeStart 该页的起始tokenId
     * @return rangeStop 该页的结束tokenId（不包含）
     * @dev 配合tokensOfOwnerIn使用
     * @dev 使用示例：
     *      (start, stop) = getPageRange(0);
     *      uint256[] memory tokens = tokensOfOwnerIn(owner, start, stop);
     */
    function getPageRange(uint256 pageNumber)
        external
        view
        returns (uint256 rangeStart, uint256 rangeStop)
    {
        uint256 startTokenId = _startTokenId();
        uint256 totalMintedCount = _totalMinted();
        uint256 pageSize = RECOMMENDED_QUERY_RANGE;

        rangeStart = startTokenId + pageNumber * pageSize;
        rangeStop = rangeStart + pageSize;

        // 确保不超过已mint的范围
        uint256 maxTokenId = startTokenId + totalMintedCount;
        if (rangeStop > maxTokenId) {
            rangeStop = maxTokenId;
        }

        require(rangeStart < maxTokenId, "Page out of range");
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
