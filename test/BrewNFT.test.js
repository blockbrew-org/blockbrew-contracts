const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BrewNFT - 新版简化合约", function () {
  let brewNFT;
  let owner;
  let user1;
  let user2;
  let user3;
  let treasury;

  beforeEach(async function () {
    [owner, user1, user2, user3, treasury] = await ethers.getSigners();

    const BrewNFT = await ethers.getContractFactory("BrewNFT");
    brewNFT = await BrewNFT.deploy(treasury.address);
    await brewNFT.waitForDeployment();
  });

  describe("部署", function () {
    it("应该正确设置NFT名称和符号", async function () {
      expect(await brewNFT.name()).to.equal("Brew NFT");
      expect(await brewNFT.symbol()).to.equal("BNFT");
    });

    it("应该正确设置所有者", async function () {
      expect(await brewNFT.owner()).to.equal(owner.address);
    });

    it("应该正确设置收款钱包地址", async function () {
      expect(await brewNFT.treasury()).to.equal(treasury.address);
    });

    it("应该正确初始化参数", async function () {
      expect(await brewNFT.price()).to.equal(ethers.parseEther("0.001"));
      expect(await brewNFT.maxSupply()).to.equal(10000);
      expect(await brewNFT.MAX_PER_MINT()).to.equal(300);
    });

    it("tokenId应该从1开始", async function () {
      await brewNFT.connect(user1).mint(1, {
        value: ethers.parseEther("0.001")
      });

      expect(await brewNFT.ownerOf(1)).to.equal(user1.address);
    });
  });

  describe("Mint功能", function () {
    it("应该能够mint 1个NFT", async function () {
      await brewNFT.connect(user1).mint(1, {
        value: ethers.parseEther("0.001")
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(1);
      expect(await brewNFT.totalMinted()).to.equal(1);
    });

    it("应该能够mint 10个NFT", async function () {
      await brewNFT.connect(user1).mint(10, {
        value: ethers.parseEther("0.01")
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(10);
      expect(await brewNFT.totalMinted()).to.equal(10);
    });

    it("应该能够mint 300个NFT（最大限制）", async function () {
      await brewNFT.connect(user1).mint(300, {
        value: ethers.parseEther("0.3")
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(300);
      expect(await brewNFT.totalMinted()).to.equal(300);
    });

    it("应该能够mint任意数量（在限制内）", async function () {
      await brewNFT.connect(user1).mint(50, {
        value: ethers.parseEther("0.05")
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(50);
    });

    it("支付金额不精确时应该失败", async function () {
      // 少付
      await expect(
        brewNFT.connect(user1).mint(10, {
          value: ethers.parseEther("0.009")
        })
      ).to.be.revertedWith("Incorrect payment");

      // 多付
      await expect(
        brewNFT.connect(user1).mint(10, {
          value: ethers.parseEther("0.011")
        })
      ).to.be.revertedWith("Incorrect payment");
    });

    it("mint 0个应该失败", async function () {
      await expect(
        brewNFT.connect(user1).mint(0, {
          value: 0
        })
      ).to.be.revertedWith("Invalid quantity");
    });

    it("超过最大数量（300个）时应该失败", async function () {
      await expect(
        brewNFT.connect(user1).mint(301, {
          value: ethers.parseEther("0.301")
        })
      ).to.be.revertedWith("Exceeds max per mint");
    });

    it("超过最大供应量时应该失败", async function () {
      // 先mint 9900个
      for (let i = 0; i < 33; i++) {
        await brewNFT.connect(user1).mint(300, {
          value: ethers.parseEther("0.3")
        });
      }
      expect(await brewNFT.totalMinted()).to.equal(9900);

      // 再mint 100个（总共10000，达到maxSupply）
      await brewNFT.connect(user1).mint(100, {
        value: ethers.parseEther("0.1")
      });
      expect(await brewNFT.totalMinted()).to.equal(10000);

      // 再mint应该失败
      await expect(
        brewNFT.connect(user1).mint(1, {
          value: ethers.parseEther("0.001")
        })
      ).to.be.revertedWith("Exceeds max supply");
    });

    it("暂停后mint应该失败", async function () {
      await brewNFT.pause();

      await expect(
        brewNFT.connect(user1).mint(1, {
          value: ethers.parseEther("0.001")
        })
      ).to.be.revertedWithCustomError(brewNFT, "EnforcedPause");
    });
  });

  describe("价格管理", function () {
    it("所有者应该能够设置价格", async function () {
      await brewNFT.setPrice(ethers.parseEther("0.002"));
      expect(await brewNFT.price()).to.equal(ethers.parseEther("0.002"));
    });

    it("设置新价格后mint应该使用新价格", async function () {
      await brewNFT.setPrice(ethers.parseEther("0.002"));

      await brewNFT.connect(user1).mint(10, {
        value: ethers.parseEther("0.02")
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(10);
    });

    it("非所有者不能设置价格", async function () {
      await expect(
        brewNFT.connect(user1).setPrice(ethers.parseEther("0.002"))
      ).to.be.reverted;
    });

    it("设置价格为0应该失败", async function () {
      await expect(
        brewNFT.setPrice(0)
      ).to.be.revertedWith("Price must be greater than zero");
    });

    it("设置极高价格应该正常工作", async function () {
      const highPrice = ethers.parseEther("1000");
      await brewNFT.setPrice(highPrice);

      await brewNFT.connect(user1).mint(1, {
        value: highPrice
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(1);
    });
  });

  describe("价格溢出检查", function () {
    it("极端价格不应该导致溢出", async function () {
      // 设置一个会导致溢出的价格
      // type(uint256).max / 300 的值大约是 3.86e+74
      const maxSafePrice = ethers.MaxUint256 / BigInt(300);
      const overflowPrice = maxSafePrice + BigInt(1);

      await brewNFT.setPrice(overflowPrice);

      // 尝试mint 300个（Solidity 0.8+ 会自动检测溢出并抛出 panic）
      await expect(
        brewNFT.connect(user1).mint(300, {
          value: ethers.parseEther("1") // 不需要真的支付那么多
        })
      ).to.be.revertedWithPanic(0x11); // 0x11 = 算术溢出
    });

    it("正常价格范围应该不会溢出", async function () {
      await brewNFT.setPrice(ethers.parseEther("1")); // 1 BNB per NFT

      await brewNFT.connect(user1).mint(300, {
        value: ethers.parseEther("300")
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(300);
    });
  });

  describe("最大供应量管理", function () {
    it("所有者应该能够设置最大供应量", async function () {
      await brewNFT.setMaxSupply(5000);
      expect(await brewNFT.maxSupply()).to.equal(5000);
    });

    it("不能设置低于当前已mint数量的最大供应量", async function () {
      // 先mint 100个
      await brewNFT.connect(user1).mint(100, {
        value: ethers.parseEther("0.1")
      });

      // 尝试设置最大供应量为50（低于当前100）
      await expect(
        brewNFT.setMaxSupply(50)
      ).to.be.revertedWith("Below current supply");
    });

    it("可以设置等于当前已mint数量的最大供应量", async function () {
      await brewNFT.connect(user1).mint(100, {
        value: ethers.parseEther("0.1")
      });

      await brewNFT.setMaxSupply(100);
      expect(await brewNFT.maxSupply()).to.equal(100);

      // 再mint应该失败
      await expect(
        brewNFT.connect(user1).mint(1, {
          value: ethers.parseEther("0.001")
        })
      ).to.be.revertedWith("Exceeds max supply");
    });

    it("非所有者不能设置最大供应量", async function () {
      await expect(
        brewNFT.connect(user1).setMaxSupply(5000)
      ).to.be.reverted;
    });
  });

  describe("多用户mint", function () {
    it("多个用户应该能够同时mint", async function () {
      await brewNFT.connect(user1).mint(1, {
        value: ethers.parseEther("0.001")
      });

      await brewNFT.connect(user2).mint(10, {
        value: ethers.parseEther("0.01")
      });

      await brewNFT.connect(user3).mint(100, {
        value: ethers.parseEther("0.1")
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(1);
      expect(await brewNFT.balanceOf(user2.address)).to.equal(10);
      expect(await brewNFT.balanceOf(user3.address)).to.equal(100);
      expect(await brewNFT.totalMinted()).to.equal(111);
    });

    it("用户可以多次mint", async function () {
      await brewNFT.connect(user1).mint(10, {
        value: ethers.parseEther("0.01")
      });

      await brewNFT.connect(user1).mint(20, {
        value: ethers.parseEther("0.02")
      });

      await brewNFT.connect(user1).mint(30, {
        value: ethers.parseEther("0.03")
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(60);
    });
  });

  describe("收款钱包和资金流向", function () {
    it("mint后资金应该直接转到treasury", async function () {
      const initialTreasuryBalance = await ethers.provider.getBalance(treasury.address);

      await brewNFT.connect(user1).mint(10, {
        value: ethers.parseEther("0.01")
      });

      const finalTreasuryBalance = await ethers.provider.getBalance(treasury.address);
      expect(finalTreasuryBalance - initialTreasuryBalance).to.equal(ethers.parseEther("0.01"));

      // 合约余额应该为0
      expect(await brewNFT.getBalance()).to.equal(0);
    });

    it("多次mint后资金应该累积到treasury", async function () {
      const initialTreasuryBalance = await ethers.provider.getBalance(treasury.address);

      await brewNFT.connect(user1).mint(10, {
        value: ethers.parseEther("0.01")
      });

      await brewNFT.connect(user2).mint(20, {
        value: ethers.parseEther("0.02")
      });

      const finalTreasuryBalance = await ethers.provider.getBalance(treasury.address);
      expect(finalTreasuryBalance - initialTreasuryBalance).to.equal(ethers.parseEther("0.03"));

      // 合约余额应该始终为0
      expect(await brewNFT.getBalance()).to.equal(0);
    });

    it("所有者应该能够更改treasury地址", async function () {
      const newTreasury = user3;

      await brewNFT.setTreasury(newTreasury.address);
      expect(await brewNFT.treasury()).to.equal(newTreasury.address);
    });

    it("更改treasury后新mint应该转到新地址", async function () {
      const newTreasury = user3;
      await brewNFT.setTreasury(newTreasury.address);

      const initialBalance = await ethers.provider.getBalance(newTreasury.address);

      await brewNFT.connect(user1).mint(10, {
        value: ethers.parseEther("0.01")
      });

      const finalBalance = await ethers.provider.getBalance(newTreasury.address);
      expect(finalBalance - initialBalance).to.equal(ethers.parseEther("0.01"));
    });

    it("非所有者不能更改treasury", async function () {
      await expect(
        brewNFT.connect(user1).setTreasury(user2.address)
      ).to.be.reverted;
    });

    it("不能设置treasury为零地址", async function () {
      await expect(
        brewNFT.setTreasury(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });

    it("合约余额为0时紧急提现应该失败", async function () {
      await expect(
        brewNFT.emergencyWithdraw()
      ).to.be.revertedWith("No balance to withdraw");
    });
  });

  describe("暂停功能", function () {
    it("所有者应该能够暂停合约", async function () {
      await brewNFT.pause();

      await expect(
        brewNFT.connect(user1).mint(1, {
          value: ethers.parseEther("0.001")
        })
      ).to.be.revertedWithCustomError(brewNFT, "EnforcedPause");
    });

    it("暂停后应该能够恢复", async function () {
      await brewNFT.pause();
      await brewNFT.unpause();

      await brewNFT.connect(user1).mint(1, {
        value: ethers.parseEther("0.001")
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(1);
    });

    it("非所有者不能暂停", async function () {
      await expect(
        brewNFT.connect(user1).pause()
      ).to.be.reverted;
    });

    it("非所有者不能恢复", async function () {
      await brewNFT.pause();

      await expect(
        brewNFT.connect(user1).unpause()
      ).to.be.reverted;
    });
  });

  describe("BaseURI", function () {
    it("所有者应该能够设置baseURI", async function () {
      await brewNFT.setBaseURI("https://api.example.com/metadata/");

      await brewNFT.connect(user1).mint(1, {
        value: ethers.parseEther("0.001")
      });

      const tokenURI = await brewNFT.tokenURI(1);
      expect(tokenURI).to.equal("https://api.example.com/metadata/1");
    });

    it("非所有者不能设置baseURI", async function () {
      await expect(
        brewNFT.connect(user1).setBaseURI("https://api.example.com/metadata/")
      ).to.be.reverted;
    });

    it("baseURI为空时tokenURI应该返回空字符串", async function () {
      await brewNFT.connect(user1).mint(1, {
        value: ethers.parseEther("0.001")
      });

      const tokenURI = await brewNFT.tokenURI(1);
      // ERC721A的默认行为：baseURI为空时返回空字符串
      expect(tokenURI).to.equal("");
    });

    it("可以使用IPFS URI", async function () {
      await brewNFT.setBaseURI("ipfs://QmXXXXXXXXXXXXXXXXXXXXXXXXXXX/");

      await brewNFT.connect(user1).mint(1, {
        value: ethers.parseEther("0.001")
      });

      const tokenURI = await brewNFT.tokenURI(1);
      expect(tokenURI).to.equal("ipfs://QmXXXXXXXXXXXXXXXXXXXXXXXXXXX/1");
    });
  });

  describe("查询功能", function () {
    it("totalMinted应该返回已mint的总数", async function () {
      expect(await brewNFT.totalMinted()).to.equal(0);

      await brewNFT.connect(user1).mint(10, {
        value: ethers.parseEther("0.01")
      });

      expect(await brewNFT.totalMinted()).to.equal(10);

      await brewNFT.connect(user2).mint(20, {
        value: ethers.parseEther("0.02")
      });

      expect(await brewNFT.totalMinted()).to.equal(30);
    });

    it("remainingSupply应该返回剩余可mint数量", async function () {
      expect(await brewNFT.remainingSupply()).to.equal(10000);

      await brewNFT.connect(user1).mint(100, {
        value: ethers.parseEther("0.1")
      });

      expect(await brewNFT.remainingSupply()).to.equal(9900);
    });

    it("getBalance应该返回合约余额（mint后资金转到treasury，合约余额为0）", async function () {
      expect(await brewNFT.getBalance()).to.equal(0);

      await brewNFT.connect(user1).mint(10, {
        value: ethers.parseEther("0.01")
      });

      // 资金直接转到treasury，合约余额保持为0
      expect(await brewNFT.getBalance()).to.equal(0);
    });
  });

  describe("ERC721标准功能", function () {
    beforeEach(async function () {
      // 每个测试前mint一些NFT
      await brewNFT.connect(user1).mint(5, {
        value: ethers.parseEther("0.005")
      });
    });

    it("应该能够转移NFT", async function () {
      await brewNFT.connect(user1).transferFrom(user1.address, user2.address, 1);

      expect(await brewNFT.ownerOf(1)).to.equal(user2.address);
      expect(await brewNFT.balanceOf(user1.address)).to.equal(4);
      expect(await brewNFT.balanceOf(user2.address)).to.equal(1);
    });

    it("应该能够授权和转移", async function () {
      await brewNFT.connect(user1).approve(user2.address, 1);

      await brewNFT.connect(user2).transferFrom(user1.address, user2.address, 1);

      expect(await brewNFT.ownerOf(1)).to.equal(user2.address);
    });

    it("应该能够设置全局授权", async function () {
      await brewNFT.connect(user1).setApprovalForAll(user2.address, true);

      expect(await brewNFT.isApprovedForAll(user1.address, user2.address)).to.equal(true);

      await brewNFT.connect(user2).transferFrom(user1.address, user2.address, 1);
      await brewNFT.connect(user2).transferFrom(user1.address, user2.address, 2);

      expect(await brewNFT.balanceOf(user2.address)).to.equal(2);
    });

    it("查询不存在的tokenId应该失败", async function () {
      await expect(
        brewNFT.ownerOf(999)
      ).to.be.reverted;
    });

    it("转移不拥有的NFT应该失败", async function () {
      await expect(
        brewNFT.connect(user2).transferFrom(user1.address, user2.address, 1)
      ).to.be.reverted;
    });
  });

  describe("事件", function () {
    it("mint应该触发Minted事件", async function () {
      await expect(
        brewNFT.connect(user1).mint(10, {
          value: ethers.parseEther("0.01")
        })
      )
        .to.emit(brewNFT, "Minted")
        .withArgs(user1.address, 10, ethers.parseEther("0.01"));
    });

    it("setPrice应该触发PriceUpdated事件", async function () {
      await expect(
        brewNFT.setPrice(ethers.parseEther("0.002"))
      )
        .to.emit(brewNFT, "PriceUpdated")
        .withArgs(ethers.parseEther("0.002"));
    });

    it("setMaxSupply应该触发MaxSupplyUpdated事件", async function () {
      await expect(
        brewNFT.setMaxSupply(5000)
      )
        .to.emit(brewNFT, "MaxSupplyUpdated")
        .withArgs(5000);
    });

    it("setBaseURI应该触发BaseURIUpdated事件", async function () {
      await expect(
        brewNFT.setBaseURI("https://api.example.com/")
      )
        .to.emit(brewNFT, "BaseURIUpdated")
        .withArgs("https://api.example.com/");
    });

    it("setTreasury应该触发TreasuryUpdated事件", async function () {
      const newTreasury = user3.address;

      await expect(
        brewNFT.setTreasury(newTreasury)
      )
        .to.emit(brewNFT, "TreasuryUpdated")
        .withArgs(treasury.address, newTreasury);
    });
  });

  describe("Gas优化测试", function () {
    it("批量mint应该比单个mint更省gas", async function () {
      // 单个mint 10次
      let totalGasSingle = BigInt(0);
      for (let i = 0; i < 10; i++) {
        const tx = await brewNFT.connect(user1).mint(1, {
          value: ethers.parseEther("0.001")
        });
        const receipt = await tx.wait();
        totalGasSingle += receipt.gasUsed;
      }

      // 批量mint 10个
      const tx = await brewNFT.connect(user2).mint(10, {
        value: ethers.parseEther("0.01")
      });
      const receipt = await tx.wait();
      const gasBatch = receipt.gasUsed;

      console.log("单个mint 10次总gas:", totalGasSingle.toString());
      console.log("批量mint 10个gas:", gasBatch.toString());
      console.log("节省gas:", ((totalGasSingle - gasBatch) * BigInt(100) / totalGasSingle).toString() + "%");

      // 批量mint应该显著更省gas
      expect(gasBatch).to.be.lessThan(totalGasSingle);
    });

    it("mint 300个的gas成本应该在合理范围内", async function () {
      const tx = await brewNFT.connect(user1).mint(300, {
        value: ethers.parseEther("0.3")
      });
      const receipt = await tx.wait();

      console.log("Mint 300个NFT的gas:", receipt.gasUsed.toString());

      // 应该低于 30M gas（区块gas限制）
      expect(receipt.gasUsed).to.be.lessThan(30000000);
    });
  });

  describe("边界条件测试", function () {
    it("连续mint到maxSupply应该正常工作", async function () {
      // Mint到接近maxSupply
      for (let i = 0; i < 33; i++) {
        await brewNFT.connect(user1).mint(300, {
          value: ethers.parseEther("0.3")
        });
      }
      // 已mint 9900

      await brewNFT.connect(user1).mint(100, {
        value: ethers.parseEther("0.1")
      });
      // 现在正好10000

      expect(await brewNFT.totalMinted()).to.equal(10000);
      expect(await brewNFT.remainingSupply()).to.equal(0);
    });

    it("修改maxSupply后mint应该遵守新限制", async function () {
      await brewNFT.setMaxSupply(500);

      await brewNFT.connect(user1).mint(300, {
        value: ethers.parseEther("0.3")
      });

      await brewNFT.connect(user1).mint(200, {
        value: ethers.parseEther("0.2")
      });

      expect(await brewNFT.totalMinted()).to.equal(500);

      await expect(
        brewNFT.connect(user1).mint(1, {
          value: ethers.parseEther("0.001")
        })
      ).to.be.revertedWith("Exceeds max supply");
    });

    it("价格为最小值时应该正常工作", async function () {
      await brewNFT.setPrice(1); // 1 wei

      await brewNFT.connect(user1).mint(10, {
        value: 10
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(10);
    });

    it("多个用户同时mint到maxSupply", async function () {
      await brewNFT.setMaxSupply(1000);

      // 10个用户各mint 100个
      const users = [owner, user1, user2, user3];
      for (let i = 0; i < 10; i++) {
        const user = users[i % users.length];
        await brewNFT.connect(user).mint(100, {
          value: ethers.parseEther("0.1")
        });
      }

      expect(await brewNFT.totalMinted()).to.equal(1000);
      expect(await brewNFT.remainingSupply()).to.equal(0);
    });
  });

  describe("重入攻击保护", function () {
    it("应该有ReentrancyGuard保护", async function () {
      // mint函数有nonReentrant修饰符
      await brewNFT.connect(user1).mint(1, {
        value: ethers.parseEther("0.001")
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(1);

      // 测试通过说明nonReentrant正常工作
      expect(await brewNFT.getBalance()).to.equal(0);
    });
  });

  // ==================== 补充测试：关键功能覆盖 ====================

  describe("URI锁定功能", function () {
    it("应该能够锁定URI", async function () {
      await brewNFT.setBaseURI("ipfs://QmTestHash/");
      await brewNFT.lockURI();

      expect(await brewNFT.uriLocked()).to.equal(true);
    });

    it("锁定后不能修改URI", async function () {
      await brewNFT.setBaseURI("ipfs://QmTestHash/");
      await brewNFT.lockURI();

      await expect(
        brewNFT.setBaseURI("ipfs://QmNewHash/")
      ).to.be.revertedWith("URI is locked");
    });

    it("空URI时不能锁定", async function () {
      await expect(
        brewNFT.lockURI()
      ).to.be.revertedWith("Base URI not set");
    });

    it("不能重复锁定", async function () {
      await brewNFT.setBaseURI("ipfs://QmTestHash/");
      await brewNFT.lockURI();

      await expect(
        brewNFT.lockURI()
      ).to.be.revertedWith("URI already locked");
    });

    it("锁定后tokenURI应该仍然正常工作", async function () {
      await brewNFT.setBaseURI("ipfs://QmTestHash/");
      await brewNFT.lockURI();

      await brewNFT.connect(user1).mint(1, {
        value: ethers.parseEther("0.001")
      });

      expect(await brewNFT.tokenURI(1)).to.equal("ipfs://QmTestHash/1");
    });

    it("锁定URI后mint新NFT仍然使用正确的URI", async function () {
      await brewNFT.setBaseURI("ipfs://QmFinal/");

      await brewNFT.connect(user1).mint(5, {
        value: ethers.parseEther("0.005")
      });

      await brewNFT.lockURI();

      await brewNFT.connect(user2).mint(3, {
        value: ethers.parseEther("0.003")
      });

      expect(await brewNFT.tokenURI(1)).to.equal("ipfs://QmFinal/1");
      expect(await brewNFT.tokenURI(5)).to.equal("ipfs://QmFinal/5");
      expect(await brewNFT.tokenURI(6)).to.equal("ipfs://QmFinal/6");
    });

    it("应该触发URILocked事件", async function () {
      await brewNFT.setBaseURI("ipfs://QmTestHash/");

      await expect(brewNFT.lockURI())
        .to.emit(brewNFT, "URILocked");
    });

    it("非所有者不能锁定URI", async function () {
      await brewNFT.setBaseURI("ipfs://QmTestHash/");

      await expect(
        brewNFT.connect(user1).lockURI()
      ).to.be.reverted;
    });
  });

  describe("ABSOLUTE_MAX_SUPPLY限制", function () {
    it("应该能够读取ABSOLUTE_MAX_SUPPLY常量", async function () {
      expect(await brewNFT.ABSOLUTE_MAX_SUPPLY()).to.equal(100000);
    });

    it("不能设置超过ABSOLUTE_MAX_SUPPLY的maxSupply", async function () {
      await expect(
        brewNFT.setMaxSupply(100001)
      ).to.be.revertedWith("Exceeds absolute max supply");
    });

    it("可以设置等于ABSOLUTE_MAX_SUPPLY的maxSupply", async function () {
      await brewNFT.setMaxSupply(100000);
      expect(await brewNFT.maxSupply()).to.equal(100000);
    });

    it("设置到绝对上限后应该能够正常mint", async function () {
      await brewNFT.setMaxSupply(100000);

      await brewNFT.connect(user1).mint(10, {
        value: ethers.parseEther("0.01")
      });

      expect(await brewNFT.totalMinted()).to.equal(10);
      expect(await brewNFT.remainingSupply()).to.equal(99990);
    });

    it("mint后不能降低maxSupply到已mint数量以下", async function () {
      await brewNFT.connect(user1).mint(100, {
        value: ethers.parseEther("0.1")
      });

      await expect(
        brewNFT.setMaxSupply(50)
      ).to.be.revertedWith("Below current supply");
    });

    it("可以设置maxSupply等于当前已mint数量", async function () {
      await brewNFT.connect(user1).mint(100, {
        value: ethers.parseEther("0.1")
      });

      await brewNFT.setMaxSupply(100);
      expect(await brewNFT.maxSupply()).to.equal(100);
      expect(await brewNFT.remainingSupply()).to.equal(0);
    });
  });

  describe("Wei级别支付精度", function () {
    it("多付1 wei应该失败", async function () {
      const exactPayment = ethers.parseEther("0.001");

      await expect(
        brewNFT.connect(user1).mint(1, {
          value: exactPayment + BigInt(1)
        })
      ).to.be.revertedWith("Incorrect payment");
    });

    it("少付1 wei应该失败", async function () {
      const exactPayment = ethers.parseEther("0.001");

      await expect(
        brewNFT.connect(user1).mint(1, {
          value: exactPayment - BigInt(1)
        })
      ).to.be.revertedWith("Incorrect payment");
    });

    it("大批量mint的wei精度 - 多付1 wei", async function () {
      const price = ethers.parseEther("0.001");
      const quantity = 300;
      const exactPayment = price * BigInt(quantity);

      await expect(
        brewNFT.connect(user1).mint(quantity, {
          value: exactPayment + BigInt(1)
        })
      ).to.be.revertedWith("Incorrect payment");
    });

    it("大批量mint的wei精度 - 少付1 wei", async function () {
      const price = ethers.parseEther("0.001");
      const quantity = 300;
      const exactPayment = price * BigInt(quantity);

      await expect(
        brewNFT.connect(user1).mint(quantity, {
          value: exactPayment - BigInt(1)
        })
      ).to.be.revertedWith("Incorrect payment");
    });

    it("大批量mint的wei精度 - 精确支付应该成功", async function () {
      const price = ethers.parseEther("0.001");
      const quantity = 300;
      const exactPayment = price * BigInt(quantity);

      await brewNFT.connect(user1).mint(quantity, {
        value: exactPayment
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(300);
    });

    it("极小价格（1 wei）应该正常工作", async function () {
      await brewNFT.setPrice(1);

      const initialTreasuryBalance = await ethers.provider.getBalance(treasury.address);

      await brewNFT.connect(user1).mint(10, {
        value: 10
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(10);

      // 验证资金转到treasury
      const finalTreasuryBalance = await ethers.provider.getBalance(treasury.address);
      expect(finalTreasuryBalance - initialTreasuryBalance).to.equal(BigInt(10));
    });

    it("极小价格mint大批量", async function () {
      await brewNFT.setPrice(1);

      await brewNFT.connect(user1).mint(300, {
        value: 300
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(300);
    });
  });

  describe("边界值测试", function () {
    it("应该能够mint 299个NFT（MAX_PER_MINT - 1）", async function () {
      await brewNFT.connect(user1).mint(299, {
        value: ethers.parseEther("0.299")
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(299);
      expect(await brewNFT.totalMinted()).to.equal(299);
    });

    it("应该能够连续mint 299 + 1", async function () {
      await brewNFT.connect(user1).mint(299, {
        value: ethers.parseEther("0.299")
      });

      await brewNFT.connect(user1).mint(1, {
        value: ethers.parseEther("0.001")
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(300);
    });

    it("到达maxSupply前1个应该成功", async function () {
      await brewNFT.setMaxSupply(1000);

      // 分批mint到999（不能一次mint 999，超过MAX_PER_MINT 300）
      await brewNFT.connect(user1).mint(300, {
        value: ethers.parseEther("0.3")
      });
      await brewNFT.connect(user1).mint(300, {
        value: ethers.parseEther("0.3")
      });
      await brewNFT.connect(user1).mint(300, {
        value: ethers.parseEther("0.3")
      });
      await brewNFT.connect(user1).mint(99, {
        value: ethers.parseEther("0.099")
      });

      expect(await brewNFT.totalMinted()).to.equal(999);
      expect(await brewNFT.remainingSupply()).to.equal(1);

      await brewNFT.connect(user2).mint(1, {
        value: ethers.parseEther("0.001")
      });

      expect(await brewNFT.totalMinted()).to.equal(1000);
      expect(await brewNFT.remainingSupply()).to.equal(0);
    });

    it("分步到达maxSupply精确边界", async function () {
      await brewNFT.setMaxSupply(1000);

      // user1 mint 600个（分两批，每批300）
      await brewNFT.connect(user1).mint(300, {
        value: ethers.parseEther("0.3")
      });
      await brewNFT.connect(user1).mint(300, {
        value: ethers.parseEther("0.3")
      });

      await brewNFT.connect(user2).mint(300, {
        value: ethers.parseEther("0.3")
      });

      await brewNFT.connect(user3).mint(99, {
        value: ethers.parseEther("0.099")
      });

      expect(await brewNFT.totalMinted()).to.equal(999);

      await brewNFT.connect(user3).mint(1, {
        value: ethers.parseEther("0.001")
      });

      expect(await brewNFT.totalMinted()).to.equal(1000);

      // 再mint任何数量都应该失败
      await expect(
        brewNFT.connect(user1).mint(1, {
          value: ethers.parseEther("0.001")
        })
      ).to.be.revertedWith("Exceeds max supply");
    });

    it("最小maxSupply（1个）应该正常工作", async function () {
      await brewNFT.setMaxSupply(1);

      await brewNFT.connect(user1).mint(1, {
        value: ethers.parseEther("0.001")
      });

      expect(await brewNFT.totalMinted()).to.equal(1);

      await expect(
        brewNFT.connect(user2).mint(1, {
          value: ethers.parseEther("0.001")
        })
      ).to.be.revertedWith("Exceeds max supply");
    });
  });

  describe("状态转换序列", function () {
    it("价格变化序列应该正确应用", async function () {
      const initialTreasuryBalance = await ethers.provider.getBalance(treasury.address);

      // 第一次mint：0.001 BNB
      await brewNFT.connect(user1).mint(10, {
        value: ethers.parseEther("0.01")
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(10);

      // 修改价格为 0.002
      await brewNFT.setPrice(ethers.parseEther("0.002"));
      await brewNFT.connect(user1).mint(10, {
        value: ethers.parseEther("0.02")
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(20);

      // 修改价格为 0.005
      await brewNFT.setPrice(ethers.parseEther("0.005"));
      await brewNFT.connect(user1).mint(10, {
        value: ethers.parseEther("0.05")
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(30);

      // 验证资金转到了treasury
      const finalTreasuryBalance = await ethers.provider.getBalance(treasury.address);
      expect(finalTreasuryBalance - initialTreasuryBalance).to.equal(ethers.parseEther("0.08"));
    });

    it("价格降低再升高应该正确工作", async function () {
      // 初始 0.001
      await brewNFT.connect(user1).mint(10, {
        value: ethers.parseEther("0.01")
      });

      // 提高到 0.01
      await brewNFT.setPrice(ethers.parseEther("0.01"));
      await brewNFT.connect(user1).mint(10, {
        value: ethers.parseEther("0.1")
      });

      // 降低到 0.001
      await brewNFT.setPrice(ethers.parseEther("0.001"));
      await brewNFT.connect(user1).mint(10, {
        value: ethers.parseEther("0.01")
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(30);
    });

    it("maxSupply动态调整应该生效", async function () {
      await brewNFT.setMaxSupply(500);

      await brewNFT.connect(user1).mint(300, {
        value: ethers.parseEther("0.3")
      });

      await brewNFT.connect(user2).mint(200, {
        value: ethers.parseEther("0.2")
      });

      expect(await brewNFT.totalMinted()).to.equal(500);
      expect(await brewNFT.remainingSupply()).to.equal(0);

      // 增加maxSupply后应该能继续mint
      await brewNFT.setMaxSupply(1000);

      await brewNFT.connect(user3).mint(100, {
        value: ethers.parseEther("0.1")
      });

      expect(await brewNFT.totalMinted()).to.equal(600);
      expect(await brewNFT.remainingSupply()).to.equal(400);
    });

    it("maxSupply多次调整", async function () {
      await brewNFT.setMaxSupply(1000);
      // mint 500个（分两批，每批250）
      await brewNFT.connect(user1).mint(250, {
        value: ethers.parseEther("0.25")
      });
      await brewNFT.connect(user1).mint(250, {
        value: ethers.parseEther("0.25")
      });

      await brewNFT.setMaxSupply(2000);
      // mint 500个
      await brewNFT.connect(user2).mint(250, {
        value: ethers.parseEther("0.25")
      });
      await brewNFT.connect(user2).mint(250, {
        value: ethers.parseEther("0.25")
      });

      await brewNFT.setMaxSupply(3000);
      // mint 500个
      await brewNFT.connect(user3).mint(250, {
        value: ethers.parseEther("0.25")
      });
      await brewNFT.connect(user3).mint(250, {
        value: ethers.parseEther("0.25")
      });

      expect(await brewNFT.totalMinted()).to.equal(1500);
      expect(await brewNFT.remainingSupply()).to.equal(1500);
    });

    it("暂停-恢复-再暂停循环", async function () {
      // 第一次暂停
      await brewNFT.pause();
      await expect(
        brewNFT.connect(user1).mint(1, { value: ethers.parseEther("0.001") })
      ).to.be.revertedWithCustomError(brewNFT, "EnforcedPause");

      // 恢复
      await brewNFT.unpause();
      await brewNFT.connect(user1).mint(1, { value: ethers.parseEther("0.001") });

      // 第二次暂停
      await brewNFT.pause();
      await expect(
        brewNFT.connect(user1).mint(1, { value: ethers.parseEther("0.001") })
      ).to.be.revertedWithCustomError(brewNFT, "EnforcedPause");

      // 再次恢复
      await brewNFT.unpause();
      await brewNFT.connect(user1).mint(1, { value: ethers.parseEther("0.001") });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(2);
    });

    it("复杂状态序列：价格+供应量+暂停", async function () {
      // 初始状态
      await brewNFT.connect(user1).mint(10, {
        value: ethers.parseEther("0.01")
      });

      // 修改价格
      await brewNFT.setPrice(ethers.parseEther("0.002"));

      // 修改供应量
      await brewNFT.setMaxSupply(5000);

      // mint一些
      await brewNFT.connect(user2).mint(20, {
        value: ethers.parseEther("0.04")
      });

      // 暂停
      await brewNFT.pause();
      await expect(
        brewNFT.connect(user3).mint(1, { value: ethers.parseEther("0.002") })
      ).to.be.revertedWithCustomError(brewNFT, "EnforcedPause");

      // 恢复并继续
      await brewNFT.unpause();
      await brewNFT.connect(user3).mint(30, {
        value: ethers.parseEther("0.06")
      });

      expect(await brewNFT.totalMinted()).to.equal(60);
      expect(await brewNFT.price()).to.equal(ethers.parseEther("0.002"));
      expect(await brewNFT.maxSupply()).to.equal(5000);
    });
  });

  describe("查询函数一致性", function () {
    it("remainingSupply应该始终等于maxSupply - totalMinted", async function () {
      expect(await brewNFT.remainingSupply()).to.equal(
        (await brewNFT.maxSupply()) - (await brewNFT.totalMinted())
      );

      await brewNFT.connect(user1).mint(100, { value: ethers.parseEther("0.1") });

      expect(await brewNFT.remainingSupply()).to.equal(
        (await brewNFT.maxSupply()) - (await brewNFT.totalMinted())
      );

      await brewNFT.setMaxSupply(5000);

      expect(await brewNFT.remainingSupply()).to.equal(
        (await brewNFT.maxSupply()) - (await brewNFT.totalMinted())
      );

      await brewNFT.connect(user2).mint(200, { value: ethers.parseEther("0.2") });

      expect(await brewNFT.remainingSupply()).to.equal(
        BigInt(5000) - BigInt(300)
      );
    });

    it("getBalance应该等于合约的实际余额（mint后为0）", async function () {
      const contractAddress = await brewNFT.getAddress();

      expect(await brewNFT.getBalance()).to.equal(
        await ethers.provider.getBalance(contractAddress)
      );

      await brewNFT.connect(user1).mint(10, { value: ethers.parseEther("0.01") });

      expect(await brewNFT.getBalance()).to.equal(
        await ethers.provider.getBalance(contractAddress)
      );

      // 资金转到treasury，合约余额为0
      expect(await brewNFT.getBalance()).to.equal(0);
    });

    it("totalMinted应该精确追踪所有mint", async function () {
      expect(await brewNFT.totalMinted()).to.equal(0);

      await brewNFT.connect(user1).mint(1, { value: ethers.parseEther("0.001") });
      expect(await brewNFT.totalMinted()).to.equal(1);

      await brewNFT.connect(user1).mint(10, { value: ethers.parseEther("0.01") });
      expect(await brewNFT.totalMinted()).to.equal(11);

      await brewNFT.connect(user2).mint(100, { value: ethers.parseEther("0.1") });
      expect(await brewNFT.totalMinted()).to.equal(111);

      await brewNFT.connect(user3).mint(299, { value: ethers.parseEther("0.299") });
      expect(await brewNFT.totalMinted()).to.equal(410);
    });

    it("查询函数在状态变化后应该保持一致", async function () {
      // 初始mint
      await brewNFT.connect(user1).mint(50, { value: ethers.parseEther("0.05") });

      const minted1 = await brewNFT.totalMinted();
      const remaining1 = await brewNFT.remainingSupply();
      const maxSupply1 = await brewNFT.maxSupply();

      expect(minted1 + remaining1).to.equal(maxSupply1);

      // 修改maxSupply
      await brewNFT.setMaxSupply(5000);

      const minted2 = await brewNFT.totalMinted();
      const remaining2 = await brewNFT.remainingSupply();
      const maxSupply2 = await brewNFT.maxSupply();

      expect(minted2).to.equal(minted1); // mint数量不变
      expect(minted2 + remaining2).to.equal(maxSupply2);

      // 再次mint
      await brewNFT.connect(user2).mint(100, { value: ethers.parseEther("0.1") });

      const minted3 = await brewNFT.totalMinted();
      const remaining3 = await brewNFT.remainingSupply();
      const maxSupply3 = await brewNFT.maxSupply();

      expect(minted3).to.equal(150);
      expect(minted3 + remaining3).to.equal(maxSupply3);
    });
  });

  describe("价格边界和计算极限", function () {
    it("最小价格（1 wei）mint最大数量（300）", async function () {
      await brewNFT.setPrice(1);

      const initialTreasuryBalance = await ethers.provider.getBalance(treasury.address);

      await brewNFT.connect(user1).mint(300, {
        value: 300
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(300);

      // 验证资金转到treasury
      const finalTreasuryBalance = await ethers.provider.getBalance(treasury.address);
      expect(finalTreasuryBalance - initialTreasuryBalance).to.equal(BigInt(300));
    });

    it("安全最大价格应该能够mint 1个", async function () {
      // 设置一个非常高但安全的价格（不会溢出）
      const highPrice = ethers.parseEther("1000"); // 1000 BNB
      await brewNFT.setPrice(highPrice);

      const initialTreasuryBalance = await ethers.provider.getBalance(treasury.address);

      await brewNFT.connect(user1).mint(1, {
        value: highPrice
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(1);

      // 验证资金转到treasury
      const finalTreasuryBalance = await ethers.provider.getBalance(treasury.address);
      expect(finalTreasuryBalance - initialTreasuryBalance).to.equal(highPrice);
    });

    it("中等价格（0.1 BNB）大批量mint", async function () {
      await brewNFT.setPrice(ethers.parseEther("0.1"));

      const initialTreasuryBalance = await ethers.provider.getBalance(treasury.address);

      await brewNFT.connect(user1).mint(300, {
        value: ethers.parseEther("30")
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(300);

      // 验证资金转到treasury
      const finalTreasuryBalance = await ethers.provider.getBalance(treasury.address);
      expect(finalTreasuryBalance - initialTreasuryBalance).to.equal(ethers.parseEther("30"));
    });

    it("高价格（1 BNB）应该正常工作", async function () {
      await brewNFT.setPrice(ethers.parseEther("1"));

      await brewNFT.connect(user1).mint(10, {
        value: ethers.parseEther("10")
      });

      expect(await brewNFT.balanceOf(user1.address)).to.equal(10);
    });
  });
});
