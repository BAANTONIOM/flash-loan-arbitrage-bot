import { Link } from 'react-router-dom'
import Web3 from "web3";
import { useEthers } from "@usedapp/core";
import appRoutes from '../pages/routes'

const Header = () => {
  const { activateBrowserWallet, account} = useEthers();
  const handleConnectWallet = () => {
    console.log("---------");
    activateBrowserWallet();
  }
  return (
    <header className="header">
      {/* <Link to={'/flashLoanBot'} className="header__logo">
        <img src="../assets/images/bstar.jpg" alt="logo"/>
      </Link> */}
      <nav className="haedaer__menu">
        {/* {Object.entries(appRoutes).map(
          ([element, { path, title }], key) =>
            (
              <Link to={path} key={element} className="header__link">
                {title}
              </Link>
            ),
        )} */}
      </nav>
      <div className="header__auth">
        <button
          className="button button_style_primary button_size_medium"
          onClick={handleConnectWallet}
        >
          Connect to Metamask
        </button>
      </div>
    </header>
  )
}

export default Header
