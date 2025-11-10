const hre = require("hardhat");

/**
 * 测试合约的 Token ID 起始值
 * 用于确认文件命名应该从几开始
 */
async function main() {
  console.log('═══════════════════════════════════════');
  console.log('   🔍 Token ID 起始值测试');
  console.log('═══════════════════════════════════════\n');

  try {
    // 部署测试合约
    console.log('📦 部署测试合约...');
    const BrewNFT = await hre.ethers.getContractFactory("BrewNFT");
    const nft = await BrewNFT.deploy();
    await nft.waitForDeployment();

    const address = await nft.getAddress();
    console.log(`✅ 合约已部署: ${address}\n`);

    // 获取部署者地址
    const [deployer] = await hre.ethers.getSigners();
    console.log(`👤 部署者地址: ${deployer.address}\n`);

    // 1. 检查初始状态
    console.log('📊 检查初始状态...');
    const totalMinted = await nft.totalMinted();
    console.log(`   已铸造数量: ${totalMinted.toString()}`);

    // 2. 设置一个测试 baseURI
    console.log('\n🔧 设置测试 baseURI...');
    const testBaseURI = "ipfs://QmTestCID/";
    await nft.setBaseURI(testBaseURI);
    console.log(`   Base URI: ${testBaseURI}`);

    // 3. Mint 第一个 NFT
    console.log('\n🎨 铸造第一个 NFT...');
    const price = await nft.price();
    const tx = await nft.mint(1, { value: price });
    await tx.wait();
    console.log('   ✅ 铸造成功！');

    // 4. 检查第一个 Token 的 ID
    console.log('\n🔍 检查第一个 Token 的 ID...');
    const newTotalMinted = await nft.totalMinted();
    console.log(`   当前已铸造数量: ${newTotalMinted.toString()}`);

    // 5. 获取 tokenURI
    console.log('\n📝 获取 tokenURI...');

    // 尝试获取 tokenURI(0)
    try {
      const uri0 = await nft.tokenURI(0);
      console.log(`   ❌ tokenURI(0) = ${uri0}`);
      console.log('   ⚠️  警告：tokenURI(0) 存在！说明从 0 开始！');
    } catch (error) {
      console.log('   ✅ tokenURI(0) 不存在（预期行为）');
    }

    // 尝试获取 tokenURI(1)
    try {
      const uri1 = await nft.tokenURI(1);
      console.log(`   ✅ tokenURI(1) = ${uri1}`);

      // 解析出需要的文件名
      const fileName = uri1.replace(testBaseURI, '');
      console.log(`   📄 需要的文件名: "${fileName}"`);

    } catch (error) {
      console.log('   ❌ tokenURI(1) 不存在！');
      console.log('   ⚠️  警告：可能从 0 开始！');
    }

    // 6. 结论
    console.log('\n═══════════════════════════════════════');
    console.log('📊 测试结果：');
    console.log('═══════════════════════════════════════');

    const startTokenId = await nft.totalMinted() > 0 ? 1 : 0;

    if (startTokenId === 1) {
      console.log('✅ 合约从 Token ID = 1 开始');
      console.log('✅ 文件命名应该是: 1, 2, 3, ..., 100000');
      console.log('✅ 第一个文件名: "1" (无后缀)');
      console.log('✅ 最后一个文件名: "100000" (无后缀)');
    } else {
      console.log('✅ 合约从 Token ID = 0 开始');
      console.log('✅ 文件命名应该是: 0, 1, 2, ..., 99999');
      console.log('✅ 第一个文件名: "0" (无后缀)');
      console.log('✅ 最后一个文件名: "99999" (无后缀)');
    }

    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('\n可能的原因:');
    console.error('   1. 网络配置错误');
    console.error('   2. 合约编译失败');
    console.error('   3. Gas 不足\n');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
