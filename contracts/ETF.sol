//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
// import "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";
import "./interfaces/IWETH.sol";
import "./libraries/UniswapV2LibraryUpdated.sol";
import "./interfaces/IERC20Extended.sol";
import "./IndexToken.sol";
import "./oracle/IOracleClient.sol";
import "./oracle/Oracle.sol";

contract ETF is Ownable, IOracleClient {
    struct Purchase {
        uint256 _id;
        address _buyer;
        uint256 _ethAmount;
        uint256 _price;
    }

    uint256 constant MAX_UINT256 = 2**256 - 1;

    // instance of the ERC20 Index Token contract
    IndexToken public indexToken = IndexToken(address(0));

    // instance of the price Oracle contract
    Oracle public oracleContract = Oracle(address(0));

    // instance of uniswap v2 factory
    IUniswapV2Factory public factory = IUniswapV2Factory(address(0));

    // instance of uniswap v2 router02
    IUniswapV2Router02 public router = IUniswapV2Router02(address(0));

    // instance of WETH
    IWETH public weth = IWETH(address(0));

    // set of pending purchases that are yet to finalize
    mapping(uint256 => Purchase) pendingPurchases;

    // <token_name> is at <address>
    mapping(string => address) public portfolio;
    string[] public tokenNames;

    // keep track of the token amount sold out to the market
    // default to 1 unit (= 10^-18 token) to avoid dividing by 0 when bootstrapping
    uint256 public circulation = 1;

    event PriceRequest(uint256 indexed _reqId, address indexed _buyer);
    event PurchaseReady(
        uint256 indexed _reqId,
        address indexed _buyer,
        uint256 _price
    );
    event Purchased(
        uint256 indexed _reqId,
        address indexed _buyer,
        uint256 _amount,
        uint256 _price
    );
    event PortfolioChanged(string[] names, address[] addresses);
    event Swap(uint256[] amounts);

    modifier properPortfolio() {
        require(tokenNames.length > 0, "ETF: No token names found in portfolio");
        // for (uint256 i = 0; i < tokenNames.length; i++) {
        //     require(portfolio[tokenNames[i]] != address(0), "ETF: A token in portfolio has address 0");
        // }
        _;
    }

    constructor(
        IndexToken _indexToken,
        IUniswapV2Factory _factory,
        IUniswapV2Router02 _router,
        address _weth
    ) {
        indexToken = _indexToken;
        factory = _factory;
        router = _router;
        weth = IWETH(_weth);
    }

    function setPorfolio(string[] memory names, address[] memory addresses)
        external
        onlyOwner
    {
        require(
            names.length == addresses.length,
            "ETF: Arrays not equal in length!"
        );
        tokenNames = names;
        for (uint256 i = 0; i < names.length; i++) {
            portfolio[names[i]] = addresses[i];
        }
        emit PortfolioChanged(names, addresses);
    }

    function getIndexPrice() public view properPortfolio returns (uint256 _price){
        address[] memory path = new address[](2);
        path[0] = address(weth);

        for (uint256 i = 0; i < tokenNames.length; i++) {
            address tokenAddress = portfolio[tokenNames[i]];
            path[1] = tokenAddress;

            // uint256 poolMidPrice = getMidPriceFromPoolTokenAndWETH(tokenAddress);

            uint[] memory amounts = router.getAmountsOut(10**18, path);
            uint tokenPrice = amounts[1];
            uint tokenBalanceOfETF = IERC20Extended(tokenAddress).balanceOf(address(this));
            _price += tokenPrice * tokenBalanceOfETF;
        }
        _price /= circulation;
    }

    // payable: function can exec Tx
    function orderWithExactETH() public payable properPortfolio {
        uint256 _reqId = assignRequestId();

        pendingPurchases[_reqId] = Purchase(
            _reqId,
            msg.sender,
            msg.value,
            MAX_UINT256
        );

        finalize(_reqId);

        // oracleContract.request(_reqId);

        // emit PriceRequest(_reqId, msg.sender);
    }

    function finalize(uint256 _reqId) internal returns (bool) {
        // require that the request Id passed in is available
        require(pendingPurchases[_reqId]._id != 0, "Request ID not found");

        // require that the function caller is the buyer placing token order earlier with this _reqId
        require(pendingPurchases[_reqId]._buyer == msg.sender, "ETF: Unauthorized purchase claim");

        swapExactETHForPortfolioTokens();

        // require that actual price has been queried and received from the oracle
        // require(pendingPurchases[_reqId]._price != MAX_UINT256, "Price is yet to set");
        pendingPurchases[_reqId]._price = getIndexPrice();

        // require that the contract has enough tokens
        // require(indexToken.balanceOf(address(this)) >= pendingPurchases[_reqId]._ethAmount, "ETF: Unable to purchase more tokens than totally available");
        uint _amount = msg.value / pendingPurchases[_reqId]._price;

        //require that the calling entity has enough funds to buy tokens
        // require(msg.value >= (_amount * pendingPurchases[_reqId]._price) / (10 ** indexToken.decimals()),  "ETF: Not enough funds to buy tokens");
        uint _amountToMint;
        if (_amount > indexToken.balanceOf(address(this))) {
            require(indexToken.owner() == address(this), "ETF: ETF Contract is not the owner of Index Token Contract");

            _amountToMint = _amount - indexToken.balanceOf(address(this));
            require(indexToken.mint(_amountToMint), "Unable to mint new Index tokens for buyer");
        }

        // require that the transfer is successful
        require(indexToken.transfer(msg.sender, _amount), "Unable to transfer tokens to buyer");

        circulation += _amount;

        emit Purchased(
            _reqId,
            msg.sender,
            _amount,
            pendingPurchases[_reqId]._price
        );

        return true;
    }

    function getMidPriceFromPoolTokenAndWETH(address tokenAddress)
        public
        view
        returns (uint256 _price)
    {
        address pairAddress = factory.getPair(tokenAddress, address(weth));
        IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
        address token0Addr = pair.token0();
        address token1Addr = pair.token1();
        require(
            address(weth) == token0Addr || address(weth) == token1Addr,
            "ETF: Not an ERC20/WETH pair"
        );

        IERC20Extended token0 = IERC20Extended(token0Addr);
        IERC20Extended token1 = IERC20Extended(token1Addr);
        (uint256 Res0, uint256 Res1, ) = pair.getReserves();

        // return amount of WETH needed to buy one token1
        if (token0Addr == address(weth)) {
            _price = ((Res0 * (10**token1.decimals())) / Res1);
        } else {
            _price = ((Res1 * (10**token0.decimals())) / Res0);
        }
    }

    function swapExactETHForPortfolioTokens() internal  {
        require(address(weth) != address(0), "ETF: WETH Token not set");
        address[] memory path = new address[](2);
        path[0] = address(weth);
        for (uint256 i = 0; i < tokenNames.length; i++) {
            address tokenAddr = portfolio[tokenNames[i]];
            require(tokenAddr != address(0), "ETF: Token has address 0");
            path[1] = tokenAddr;
            uint256[] memory amounts =
                router.swapExactETHForTokens{value: (msg.value / tokenNames.length)}(
                    1 * (10 ** IERC20Extended(tokenAddr).decimals()),
                    path,
                    address(this),
                    block.timestamp + 10
                );

            emit Swap(amounts);
        }


    }

    function getAmountsOutForExactETH(uint256 ethIn) public view properPortfolio returns (uint256[] memory amounts) {
        require(address(router) != address(0), "ETF: Router contract not set!");
        string memory tokenName;
        address tokenAddress = address(0);
        address wethAddress = address(weth);
        amounts = new uint[](tokenNames.length);

        for (uint256 i = 0; i < tokenNames.length; i++) {
            tokenName = tokenNames[i];
            tokenAddress = portfolio[tokenName];
            address pairAddress = UniswapV2LibraryUpdated.pairFor(address(factory), wethAddress, tokenAddress);

            IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
            address token0 = pair.token0();

            (uint reserve0, uint reserve1,) = pair.getReserves();
            (uint reserveIn, uint reserveOut) = wethAddress == token0 ? (reserve0, reserve1) : (reserve1, reserve0);

            amounts[i] = UniswapV2LibraryUpdated.getAmountOut(ethIn, reserveIn, reserveOut);
        }
    }

    // @notice a callback for Oracle contract to call once the requested data is ready
    function __oracleCallback(uint256 _reqId, uint256 _price)
        external
        override
        returns (bool)
    {
        require(pendingPurchases[_reqId]._id != 0, "Request ID not found");

        pendingPurchases[_reqId]._price = _price;

        emit PurchaseReady(_reqId, pendingPurchases[_reqId]._buyer, _price);

        return true;
    }


    //Ending Token DappTokenSale
    function endSale() public onlyOwner {
        // transfer remaining dapp tokens to admin
        require(
            indexToken.transfer(
                payable(owner()),
                indexToken.balanceOf(address(this))
            ),
            "Unsold tokens not correctly returned to owner"
        );

        // destroy contract
        // the code of the contract on blockchain doesn't really get destroyed since
        // it's immutable. But the contract will be `disabled` and its state variables
        // will be set the default value of their datatype.
        selfdestruct(payable(owner()));
    }

    function setTokenContract(address _indexToken)
        external
        onlyOwner
        returns (bool)
    {
        indexToken = IndexToken(_indexToken);
        return true;
    }

    function setOracle(address _oracleContract)
        external
        override
        onlyOwner
        returns (bool)
    {
        oracleContract = Oracle(_oracleContract);
        return true;
    }

    function getNamesInPortfolio() external view returns (string[] memory) {
        return tokenNames;
    }

    function getAddressesInPortfolio() external view returns (address[] memory _addrs) {
        _addrs = new address[](tokenNames.length);
        for (uint256 i = 0; i < tokenNames.length; i++) {
            require(portfolio[tokenNames[i]] != address(0), "ETF: A token in portfolio has address 0");
            _addrs[i] = portfolio[tokenNames[i]];
        }
    }
}
