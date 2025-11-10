const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BrewToken", function () {
  let brewToken;
  let owner;
  let addr1;
  let addr2;

  const INITIAL_SUPPLY = ethers.parseEther("10000000000"); // 100亿代币

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const BrewToken = await ethers.getContractFactory("BrewToken");
    brewToken = await BrewToken.deploy();
    await brewToken.waitForDeployment();
  });

  describe("部署", function () {
    it("应该正确设置代币名称和符号", async function () {
      expect(await brewToken.name()).to.equal("Brew Token");
      expect(await brewToken.symbol()).to.equal("BREW");
    });

    it("应该有18位小数", async function () {
      expect(await brewToken.decimals()).to.equal(18);
    });

    it("应该将100亿代币分配给部署者", async function () {
      const ownerBalance = await brewToken.balanceOf(owner.address);
      expect(ownerBalance).to.equal(INITIAL_SUPPLY);
    });

    it("总供应量应该是100亿代币", async function () {
      const totalSupply = await brewToken.totalSupply();
      expect(totalSupply).to.equal(INITIAL_SUPPLY);
    });
  });

  describe("转账", function () {
    it("应该能够转账代币", async function () {
      const transferAmount = ethers.parseEther("1000000"); // 100万代币

      await brewToken.transfer(addr1.address, transferAmount);
      const addr1Balance = await brewToken.balanceOf(addr1.address);
      expect(addr1Balance).to.equal(transferAmount);
    });

    it("转账后余额应该正确", async function () {
      const transferAmount = ethers.parseEther("1000000");
      const initialOwnerBalance = await brewToken.balanceOf(owner.address);

      await brewToken.transfer(addr1.address, transferAmount);

      const finalOwnerBalance = await brewToken.balanceOf(owner.address);
      expect(finalOwnerBalance).to.equal(initialOwnerBalance - transferAmount);
    });

    it("余额不足时转账应该失败", async function () {
      const initialOwnerBalance = await brewToken.balanceOf(owner.address);

      await expect(
        brewToken.connect(addr1).transfer(owner.address, ethers.parseEther("1"))
      ).to.be.reverted;

      expect(await brewToken.balanceOf(owner.address)).to.equal(initialOwnerBalance);
    });
  });

  describe("授权", function () {
    it("应该能够授权其他地址", async function () {
      const approveAmount = ethers.parseEther("1000000");

      await brewToken.approve(addr1.address, approveAmount);
      const allowance = await brewToken.allowance(owner.address, addr1.address);
      expect(allowance).to.equal(approveAmount);
    });

    it("授权后应该能够transferFrom", async function () {
      const approveAmount = ethers.parseEther("1000000");

      await brewToken.approve(addr1.address, approveAmount);
      await brewToken.connect(addr1).transferFrom(owner.address, addr2.address, approveAmount);

      expect(await brewToken.balanceOf(addr2.address)).to.equal(approveAmount);
    });
  });

  describe("所有权", function () {
    it("部署者应该是合约所有者", async function () {
      expect(await brewToken.owner()).to.equal(owner.address);
    });

    it("所有者应该能够转移所有权", async function () {
      await brewToken.transferOwnership(addr1.address);
      expect(await brewToken.owner()).to.equal(addr1.address);
    });
  });
});
