async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const FlashSwap = await ethers.getContractFactory("FlashSwap");
  const flashSwap = await FlashSwap.deploy(
    "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"
  );

  console.log("FlashSwap address:", flashSwap.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
