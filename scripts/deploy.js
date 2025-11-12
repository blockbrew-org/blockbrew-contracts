const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("🚀 开始部署合约");
  console.log("=".repeat(70) + "\n");

  // 获取部署账户
  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 部署账户:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 账户余额:", hre.ethers.formatEther(balance), "BNB");
  console.log("🌐 网络:", hre.network.name);
  console.log("⏰ 时间:", new Date().toLocaleString("zh-CN"));
  console.log("\n" + "=".repeat(70) + "\n");

  // 用于保存所有部署信息
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {}
  };

  // ========================================
  // 1. 部署 BrewToken
  // ========================================
  console.log("📝 [1/2] 部署 BrewToken 合约...\n");

  // 配置 BrewToken 参数
  // _delegate: 合约 Owner (管理员地址)
  // _treasury: 代币接收地址 (获得100亿代币)
  const tokenDelegate = process.env.TOKEN_DELEGATE || deployer.address;
  const tokenTreasury = process.env.TOKEN_TREASURY || deployer.address;

  console.log("   👤 Delegate (Owner):", tokenDelegate);
  console.log("   💼 Treasury (Token Holder):", tokenTreasury);

  const BrewToken = await hre.ethers.getContractFactory("BrewToken");
  console.log("   ⏳ 正在部署...");
  const brewToken = await BrewToken.deploy(tokenDelegate, tokenTreasury);
  await brewToken.waitForDeployment();

  const brewTokenAddress = await brewToken.getAddress();
  console.log("   ✅ BrewToken 部署成功!");
  console.log("   📍 合约地址:", brewTokenAddress);

  // 获取代币信息
  const tokenName = await brewToken.name();
  const tokenSymbol = await brewToken.symbol();
  const totalSupply = await brewToken.totalSupply();
  const owner = await brewToken.owner();
  const treasuryTokenBalance = await brewToken.balanceOf(tokenTreasury);

  console.log("\n   📊 代币信息:");
  console.log("      名称:", tokenName);
  console.log("      符号:", tokenSymbol);
  console.log("      总供应量:", hre.ethers.formatEther(totalSupply), "BREW");
  console.log("      合约 Owner:", owner);
  console.log("      Treasury 余额:", hre.ethers.formatEther(treasuryTokenBalance), "BREW");

  // 保存 BrewToken 信息
  deploymentInfo.contracts.BrewToken = {
    address: brewTokenAddress,
    name: tokenName,
    symbol: tokenSymbol,
    totalSupply: hre.ethers.formatEther(totalSupply),
    owner: owner,
    delegate: tokenDelegate,
    treasury: tokenTreasury,
    treasuryBalance: hre.ethers.formatEther(treasuryTokenBalance)
  };

  console.log("\n" + "=".repeat(70) + "\n");

  // ========================================
  // 2. 部署 BrewNFT
  // ========================================
  console.log("📝 [2/2] 部署 BrewNFT 合约...\n");

  // 设置收款钱包地址（默认使用部署者地址）
  // 如果需要使用其他地址，可以在这里修改或通过环境变量配置
  const treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address;
  console.log("   💼 收款钱包地址:", treasuryAddress);

  const BrewNFT = await hre.ethers.getContractFactory("BrewNFT");
  console.log("   ⏳ 正在部署...");
  const brewNFT = await BrewNFT.deploy(treasuryAddress);
  await brewNFT.waitForDeployment();

  const nftAddress = await brewNFT.getAddress();
  console.log("   ✅ BrewNFT 部署成功!");
  console.log("   📍 合约地址:", nftAddress);

  // 获取 NFT 信息
  const nftName = await brewNFT.name();
  const nftSymbol = await brewNFT.symbol();
  const price = await brewNFT.price();
  const maxSupply = await brewNFT.maxSupply();
  const totalMinted = await brewNFT.totalMinted();
  const remainingSupply = await brewNFT.remainingSupply();
  const treasury = await brewNFT.treasury();

  console.log("\n   📊 NFT 信息:");
  console.log("      名称:", nftName);
  console.log("      符号:", nftSymbol);
  console.log("      单价:", hre.ethers.formatEther(price), "BNB");
  console.log("      最大供应:", maxSupply.toString());
  console.log("      已铸造:", totalMinted.toString());
  console.log("      剩余可mint:", remainingSupply.toString());
  console.log("      收款钱包:", treasury);

  // 保存 BrewNFT 信息
  deploymentInfo.contracts.BrewNFT = {
    address: nftAddress,
    name: nftName,
    symbol: nftSymbol,
    price: hre.ethers.formatEther(price),
    maxSupply: maxSupply.toString(),
    totalMinted: totalMinted.toString(),
    remainingSupply: remainingSupply.toString(),
    treasury: treasury
  };

  console.log("\n" + "=".repeat(70) + "\n");

  // ========================================
  // 保存部署信息
  // ========================================

  // 创建 deployments 目录（如果不存在）
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // 保存完整的部署信息
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const deploymentFile = path.join(deploymentsDir, `deployment-${hre.network.name}-${timestamp}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

  // 也保存一个最新的部署信息（覆盖）
  const latestFile = path.join(deploymentsDir, `deployment-${hre.network.name}-latest.json`);
  fs.writeFileSync(latestFile, JSON.stringify(deploymentInfo, null, 2));

  // ========================================
  // 显示最终摘要
  // ========================================

  console.log("🎉 所有合约部署成功!");
  console.log("=".repeat(70));

  console.log("\n📋 部署摘要:");
  console.log("\n   BrewToken (ERC20):");
  console.log("   ├─ 地址:", brewTokenAddress);
  console.log("   ├─ 符号:", tokenSymbol);
  console.log("   └─ 总供应:", hre.ethers.formatEther(totalSupply), "BREW");

  console.log("\n   BrewNFT (ERC721A):");
  console.log("   ├─ 地址:", nftAddress);
  console.log("   ├─ 符号:", nftSymbol);
  console.log("   ├─ 单价:", hre.ethers.formatEther(price), "BNB");
  console.log("   └─ 最大供应:", maxSupply.toString());

  console.log("\n📝 验证合约命令:");
  console.log(`   npx hardhat verify --network ${hre.network.name} ${brewTokenAddress} ${tokenDelegate} ${tokenTreasury}`);
  console.log(`   npx hardhat verify --network ${hre.network.name} ${nftAddress} ${treasuryAddress}`);

  console.log("\n💾 部署信息已保存:");
  console.log("   ", deploymentFile);
  console.log("   ", latestFile);

  console.log("\n" + "=".repeat(70));

  // 生成前端配置文件模板
  const frontendConfig = `// 合约地址配置 - ${hre.network.name}
// 部署时间: ${new Date().toLocaleString("zh-CN")}

const CONTRACTS = {
  ${hre.network.name === "bscTestnet" ? "97" : hre.network.name === "bscMainnet" ? "56" : "31337"}: {
    BrewToken: {
      address: '${brewTokenAddress}',
    },
    BrewNFT: {
      address: '${nftAddress}',
    }
  }
};

module.exports = CONTRACTS;
`;

  const configFile = path.join(deploymentsDir, `frontend-config-${hre.network.name}.js`);
  fs.writeFileSync(configFile, frontendConfig);

  console.log("\n📱 前端配置模板已生成:");
  console.log("   ", configFile);
  console.log("\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ 部署失败:");
    console.error(error);
    process.exit(1);
  });
