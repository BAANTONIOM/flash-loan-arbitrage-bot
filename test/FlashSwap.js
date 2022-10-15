const { expect } = require("chai");

describe("FlashSwap contract", function () {
  if (
    ("Test FlashSwap contract",
    async function () {
      const [owner] = await ethers.getSigners();

      const FlashSwap = await ethers.getContractFactory("FlashSwap");

      const hardhatFlashSwap = await FlashSwap.deploy();
    })
  );
});
