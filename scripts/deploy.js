const { ethers } = require("hardhat")

async function main() {

  const MYERC721 = await ethers.getContractFactory("MyERC721");
  const myERC721 = await MYERC721.deploy();

  await myERC721.deployed();
  console.log("AIRDROP Address: ", myERC721.address);

  // const MyERC1155 = await ethers.getContractFactory("MyERC1155");
  // const myERC1155 = await MyERC1155.deploy("testuri","0x3E44fc9b4e7ebaFDe8F08fb5a300C858d080F7b7");
  //                                      //uri          //   this is your marketplace address.
  // await myERC1155.deployed();
  // console.log("AIRDROP Address: ", myERC1155.address);


}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
