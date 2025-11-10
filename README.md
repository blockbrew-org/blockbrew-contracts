# BlockBrew Smart Contracts

简洁、安全的智能合约实现，包含 ERC-20 代币和 ERC-721A NFT。

## 📁 项目结构

```
contracts/
├── contracts/              # Solidity 合约源码
│   ├── BrewToken.sol      # BREW ERC-20 代币合约
│   └── BrewNFT.sol        # ERC-721A NFT 合约
├── test/                  # 测试文件（112个测试用例）
│   ├── BrewToken.test.js
│   └── BrewNFT.test.js
├── scripts/               # 部署脚本
│   └── deploy.js          # 统一部署脚本
├── deployments/           # 部署记录
└── hardhat.config.js      # Hardhat 配置
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 部署者私钥（不含0x前缀）
PRIVATE_KEY=your_private_key_here

# BscScan API Key（用于合约验证）
BSCSCAN_API_KEY=your_bscscan_api_key_here
```

### 3. 编译合约

```bash
npm run compile
```

### 4. 运行测试

```bash
npm test
```

测试覆盖率：112 个测试用例，全部通过 ✅

### 5. 部署合约

```bash
# 部署到本地网络
npm run deploy

# 部署到 BSC 测试网
npm run deploy:testnet

# 部署到 BSC 主网
npm run deploy:mainnet
```

## 📝 合约说明

### BrewToken.sol

BREW ERC-20 代币合约，总供应量 100 亿枚。

**主要特性：**
- 标准 ERC-20 功能
- 总供应量：10,000,000,000 BREW
- 小数位：18
- 部署时将所有代币分配给部署者

### BrewNFT.sol

ERC-721A NFT 合约，参考 BAYC、Azuki 等蓝筹项目设计。

**主要特性：**
- 使用 ERC721A 优化 gas（批量 mint 节省 85% gas）
- 初始价格：0.001 BNB
- 最大供应量：10,000 个
- 单次 mint 上限：300 个
- tokenId 从 1 开始

**核心功能：**

```solidity
// 用户功能
mint(quantity)              // 批量 mint NFT

// 管理员功能
setPrice(newPrice)          // 调整单价
setMaxSupply(newMaxSupply)  // 修改最大供应量
setBaseURI(newBaseURI)      // 设置元数据 URI
lockURI()                   // 永久锁定 URI
pause() / unpause()         // 暂停/恢复 mint
withdraw()                  // 提现所有 BNB
withdrawAmount(amount)      // 提现指定金额

// 查询功能
totalMinted()               // 已 mint 总数
remainingSupply()           // 剩余可 mint 数量
getBalance()                // 合约余额
```

**安全机制：**
- ✅ ReentrancyGuard：防止重入攻击
- ✅ Pausable：紧急暂停功能
- ✅ Ownable：权限控制
- ✅ URI Lock：永久锁定元数据
- ✅ 严格价格匹配：防止支付误差
- ✅ 供应量限制：防止超发

## 🧪 测试

测试文件覆盖了所有核心功能和边界情况：

- **部署和初始化**
- **Mint 功能**（单个/批量/边界条件）
- **价格管理和溢出检查**
- **最大供应量动态调整**
- **URI 锁定功能**
- **Wei 级别支付精度**
- **状态转换序列**
- **查询函数一致性**
- **重入攻击防护**

运行测试：

```bash
npm test
```

查看覆盖率：

```bash
npm run coverage
```

## 🌐 部署

### 部署到 BSC 测试网

1. 确保钱包有足够的测试 BNB
   - 水龙头：https://testnet.bnbchain.org/faucet-smart

2. 运行部署脚本：

   ```bash
   npm run deploy:testnet
   ```

3. 部署完成后，合约地址会保存到 `deployments/` 目录

### 验证合约

部署脚本会输出验证命令，例如：

```bash
npx hardhat verify --network bscTestnet <CONTRACT_ADDRESS>
```

## 📊 合约交互示例

### Mint NFT

```javascript
// Mint 1 个 NFT
await brewNFT.mint(1, { value: ethers.parseEther("0.001") });

// Mint 10 个 NFT
await brewNFT.mint(10, { value: ethers.parseEther("0.01") });

// Mint 300 个 NFT（最大限制）
await brewNFT.mint(300, { value: ethers.parseEther("0.3") });
```

### 查询信息

```javascript
// 查询总 mint 数量
const totalMinted = await brewNFT.totalMinted();

// 查询剩余可 mint 数量
const remaining = await brewNFT.remainingSupply();

// 查询合约余额
const balance = await brewNFT.getBalance();

// 查询当前价格
const price = await brewNFT.price();
```

### 管理功能（仅 Owner）

```javascript
// 修改价格
await brewNFT.setPrice(ethers.parseEther("0.002"));

// 设置最大供应量
await brewNFT.setMaxSupply(5000);

// 设置元数据 URI
await brewNFT.setBaseURI("ipfs://QmYourHash/");

// 锁定 URI（不可逆）
await brewNFT.lockURI();

// 暂停 mint
await brewNFT.pause();

// 恢复 mint
await brewNFT.unpause();

// 提现
await brewNFT.withdraw();
```

## 🔐 安全性

- ✅ 使用 OpenZeppelin 审计过的库
- ✅ ReentrancyGuard 防止重入攻击
- ✅ Pausable 紧急暂停功能
- ✅ 完整的测试覆盖（112 个测试用例）
- ✅ ERC721A 优化 gas 消耗

**建议：**
- 主网部署前进行第三方审计
- 使用 Slither 进行静态分析

## 📱 OpenSea 集成

合约完全符合 OpenSea 标准：

1. 严格遵循 ERC-721 标准
2. 实现 `tokenURI()` 返回元数据
3. NFT 转移后权益完全转移
4. 支持 OpenSea 等 NFT 市场交易

**设置元数据 URI：**

```javascript
await brewNFT.setBaseURI("https://api.yourproject.io/metadata/");

// 锁定后不可修改
await brewNFT.lockURI();
```

元数据格式示例：

```json
{
  "name": "Brew NFT #1",
  "description": "BlockBrew DePIN NFT",
  "image": "https://cdn.yourproject.io/nft/1.png",
  "attributes": [
    {"trait_type": "Tier", "value": "Basic"},
    {"trait_type": "Serial Number", "value": "1"}
  ]
}
```

## 🛠️ 技术栈

- **Solidity**: 0.8.20
- **框架**: Hardhat
- **库**:
  - OpenZeppelin Contracts (ERC20, Ownable, ReentrancyGuard, Pausable)
  - ERC721A (优化的 ERC-721 实现)
- **网络**: BSC 测试网/主网
- **优化**: runs=200

## 📞 支持

如有问题，请查看：
- [Hardhat 文档](https://hardhat.org/docs)
- [OpenZeppelin 文档](https://docs.openzeppelin.com/)
- [ERC721A 文档](https://www.erc721a.org/)

## 📄 许可证

MIT License
