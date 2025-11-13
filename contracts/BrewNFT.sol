// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "erc721a/contracts/ERC721A.sol";
import "erc721a/contracts/IERC721A.sol";
import "erc721a/contracts/extensions/ERC721AQueryable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BrewNFT
 * @dev Simple and secure NFT contract - inspired by BAYC, Azuki and other blue-chip projects
 * @notice Uses strict price matching, supports batch minting (up to 300 per transaction)
 * @notice Includes ERC721AQueryable extension for efficient batch queries
 */
contract BrewNFT is ERC721A, ERC721AQueryable, Ownable, ReentrancyGuard, Pausable {

    // ============ State Variables ============

    /// @notice Treasury wallet address (receives mint payments)
    address payable public treasury;

    /// @notice NFT price per unit (in BNB)
    uint256 public price;

    /// @notice Maximum supply
    uint256 public maxSupply;

    /// @notice Absolute maximum supply (immutable hard cap)
    uint256 public constant ABSOLUTE_MAX_SUPPLY = 100000;

    /// @notice Maximum quantity per mint transaction
    uint256 public constant MAX_PER_MINT = 300;

    /// @notice Base URI for token metadata
    string private baseTokenURI;

    /// @notice Whether URI is locked (cannot be changed after locking)
    bool public uriLocked;

    // ============ Events ============

    event Minted(address indexed to, uint256 quantity, uint256 totalCost);
    event PriceUpdated(uint256 newPrice);
    event MaxSupplyUpdated(uint256 newMaxSupply);
    event BaseURIUpdated(string newBaseURI);
    event URILocked();
    event Withdrawn(address indexed to, uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // ============ Constructor ============

    /**
     * @dev Initialize NFT contract
     * @param _treasury Treasury wallet address
     */
    constructor(address payable _treasury) ERC721A("Brew NFT", "BNFT") Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury address");
        treasury = _treasury;
        price = 0.001 ether;       // Initial price: 0.001 BNB
        maxSupply = 10000;         // Initial max supply: 10000
        require(maxSupply <= ABSOLUTE_MAX_SUPPLY, "Exceeds absolute max supply");
    }

    // ============ Core Functions ============

    /**
     * @notice Batch mint NFTs
     * @param quantity Quantity to mint (1-300)
     */
    function mint(uint256 quantity) external payable nonReentrant whenNotPaused {
        // Parameter validation
        require(quantity > 0, "Invalid quantity");
        require(quantity <= MAX_PER_MINT, "Exceeds max per mint");

        // Supply check
        require(_totalMinted() + quantity <= maxSupply, "Exceeds max supply");

        // Price verification (strict match)
        uint256 totalCost = price * quantity;
        require(msg.value == totalCost, "Incorrect payment");

        // Transfer immediately to treasury wallet
        (bool success, ) = treasury.call{value: totalCost}("");
        require(success, "Transfer to treasury failed");

        // Mint
        _mint(msg.sender, quantity);

        emit Minted(msg.sender, quantity, totalCost);
    }

    // ============ Owner Management Functions ============

    /**
     * @notice Set NFT price per unit
     * @param newPrice New price in wei
     */
    function setPrice(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Price must be greater than zero");
        price = newPrice;
        emit PriceUpdated(newPrice);
    }

    /**
     * @notice Set maximum supply
     * @param newMaxSupply New maximum supply
     * @dev Can only be set to a value greater than or equal to current minted amount and not exceeding absolute max
     */
    function setMaxSupply(uint256 newMaxSupply) external onlyOwner {
        require(newMaxSupply >= _totalMinted(), "Below current supply");
        require(newMaxSupply <= ABSOLUTE_MAX_SUPPLY, "Exceeds absolute max supply");
        maxSupply = newMaxSupply;
        emit MaxSupplyUpdated(newMaxSupply);
    }

    /**
     * @notice Set treasury wallet address
     * @param newTreasury New treasury address
     */
    function setTreasury(address payable newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid address");
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /**
     * @notice Set base URI
     * @param newBaseURI New base URI
     * @dev Can only be set when URI is not locked
     */
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        require(!uriLocked, "URI is locked");
        baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    /**
     * @notice Permanently lock URI, cannot be modified after locking
     * @dev This operation is irreversible! Recommended to lock after reveal
     */
    function lockURI() external onlyOwner {
        require(!uriLocked, "URI already locked");
        require(bytes(baseTokenURI).length > 0, "Base URI not set");
        uriLocked = true;
        emit URILocked();
    }

    /**
     * @notice Pause minting
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resume minting
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency withdraw function - extract accidentally received BNB in contract
     * @dev Normally contract balance should be 0 (mint proceeds go directly to treasury)
     *      This function is only for extracting mistakenly sent funds
     */
    function emergencyWithdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");

        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Transfer failed");

        emit Withdrawn(owner(), balance);
    }

    // ============ Query Functions ============

    /**
     * @notice Query total minted amount
     */
    function totalMinted() external view returns (uint256) {
        return _totalMinted();
    }

    /**
     * @notice Query contract BNB balance
     * @dev Normally should be 0 (mint proceeds go directly to treasury)
     *      If there is a balance, it means there are mistakenly sent funds
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Query remaining mintable supply
     */
    function remainingSupply() external view returns (uint256) {
        return maxSupply - _totalMinted();
    }

    // ============ ERC721AQueryable Enhanced Query Functions ============

    /// @notice Recommended single query range (prevents timeout)
    uint256 public constant RECOMMENDED_QUERY_RANGE = 2000;

    /// @notice Maximum query range limit
    uint256 public constant MAX_QUERY_RANGE = 5000;

    /**
     * @notice Get recommended parameters for paginated queries
     * @return startTokenId Starting tokenId (always starts from 1)
     * @return pageSize Recommended page size
     * @return totalPages Total pages based on current total supply
     * @return totalMintedCount Current total minted amount
     * @dev Frontend can use this method to get reasonable pagination parameters, then call tokensOfOwnerIn
     * @dev Usage example:
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
            // Calculate how many pages are needed
            uint256 tokensToScan = totalMintedCount;
            totalPages = (tokensToScan + pageSize - 1) / pageSize;
        }
    }

    /**
     * @notice Get query range for specified page
     * @param pageNumber Page number (starting from 0)
     * @return rangeStart Starting tokenId for this page
     * @return rangeStop Ending tokenId for this page (exclusive)
     * @dev Use together with tokensOfOwnerIn
     * @dev Usage example:
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

        // Ensure not exceeding minted range
        uint256 maxTokenId = startTokenId + totalMintedCount;
        if (rangeStop > maxTokenId) {
            rangeStop = maxTokenId;
        }

        require(rangeStart < maxTokenId, "Page out of range");
    }

    // ============ Internal Functions ============

    /**
     * @dev Return base URI
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return baseTokenURI;
    }

    /**
     * @dev Override starting tokenId, starts from 1
     */
    function _startTokenId() internal pure virtual override returns (uint256) {
        return 1;
    }

    /**
     * @dev Override tokenURI to implement folder sharding
     * @notice Splits 100,000 tokens into 100 folders (1000 tokens per folder)
     * @notice Token #1-1000 → folder 0, Token #1001-2000 → folder 1, etc.
     * @param tokenId Token ID
     * @return Full token URI with folder path
     */
    function tokenURI(uint256 tokenId) public view virtual override(ERC721A, IERC721A) returns (string memory) {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();

        string memory baseURI = _baseURI();
        if (bytes(baseURI).length == 0) return "";

        // Calculate folder number: (tokenId - 1) / 1000
        // Token 1-1000 → folder 0
        // Token 1001-2000 → folder 1
        // Token 2001-3000 → folder 2
        // ...
        // Token 99001-100000 → folder 99
        uint256 folderNumber = (tokenId - 1) / 1000;

        // Concatenate: baseURI + folderNumber + "/" + tokenId
        // Example: ipfs://CID/0/1
        return string(abi.encodePacked(
            baseURI,
            _toString(folderNumber),
            "/",
            _toString(tokenId)
        ));
    }
}
