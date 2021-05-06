//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";
import "./interfaces/IERC20Extended.sol";
import "./IndexToken.sol";
import "./oracle/IOracleClient.sol";
import "./oracle/Oracle.sol";

contract ETF is Ownable, IOracleClient {
    struct Purchase {
        uint256 _id;
        address _buyer;
        uint256 _numberOfTokens;
        uint256 _price;
    }

    uint256 constant MAX_UINT256 = 2**256 - 1;

    // instance of the ERC20 Index Token contract
    IndexToken public tokenContract = IndexToken(address(0));

    // instance of the price Oracle contract
    Oracle public oracleContract = Oracle(address(0));

    // instance of uniswap v2 factory
    IUniswapV2Factory public factory = IUniswapV2Factory(address(0));

    // instance of uniswap v2 router02
    IUniswapV2Router02 public router = IUniswapV2Router02(address(0));

    // instance of WETH
    address public weth = address(0);

    // set of pending purchases that are yet to finalize
    mapping(uint256 => Purchase) pendingPurchases;

    // <token_name> is at <address>
    mapping(string => address) public portfolio;
    string[] tokenNames;

    // keep track of the token amount sold out to the market
    uint256 public tokensSold;

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

    constructor(
        IndexToken _tokenContract,
        IUniswapV2Factory _factory,
        IUniswapV2Router02 _router,
        address _weth
    ) {
        tokenContract = _tokenContract;
        factory = _factory;
        router = _router;
        weth = _weth;
    }

    function setPorfolio(string[] memory names, address[] memory addresses)
        external
        onlyOwner
    {
        require(
            names.length == addresses.length,
            "ETF/Arrays not equal in length!"
        );
        for (uint256 i = 0; i < names.length; i++) {
            tokenNames[i] = names[i];
            portfolio[names[i]] = addresses[i];
        }
        emit PortfolioChanged(names, addresses);
    }

    // payable: function can exec Tx
    function orderTokens(uint256 _numberOfTokens) public payable {
        uint256 _reqId = assignRequestId();

        pendingPurchases[_reqId] = Purchase(
            _reqId,
            msg.sender,
            _numberOfTokens,
            MAX_UINT256
        );

        finalize(_reqId);

        oracleContract.request(_reqId);

        // emit PriceRequest(_reqId, msg.sender);
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

    function getTokenPrice(address pairAddress)
        public
        view
        returns (uint256 price)
    {
        IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
        address token0Addr = pair.token0();
        address token1Addr = pair.token1();
        require(
            weth == token0Addr || weth == token1Addr,
            "ETF/Not a ERC20 <-> WETH pair"
        );

        IERC20Extended token0 = IERC20Extended(token0Addr);
        IERC20Extended token1 = IERC20Extended(token1Addr);
        (uint256 Res0, uint256 Res1, ) = pair.getReserves();

        // return amount of WETH needed to buy one token1
        if (token0Addr == weth) {
            price = ((Res0 * (10**token1.decimals())) / Res1);
        } else {
            price = ((Res1 * (10**token0.decimals())) / Res0);
        }
    }

    function swapExactETHForTokens() internal {
        require(
            portfolio[tokenNames[0]] != address(0),
            "ETF/DAI Token not set"
        );

        string memory tokenName = tokenNames[0];
        address tokenAddr = portfolio[tokenName];
        address[] memory path;
        path[0] = weth;
        path[1] = tokenAddr;

        IERC20Extended token = IERC20Extended(tokenAddr);

        uint256[] memory amounts =
            router.swapExactETHForTokens(
                1 * (10**token.decimals()),
                path,
                address(this),
                block.timestamp + 10
            );

        emit Swap(amounts);
    }

    function finalize(uint256 _reqId) internal returns (bool) {
        // require that the request Id passed in is available
        require(pendingPurchases[_reqId]._id != 0, "Request ID not found");

        // require that the function caller is the buyer placing token order earlier with this _reqId
        require(
            pendingPurchases[_reqId]._buyer == msg.sender,
            "Unauthorized purchase claim"
        );

        // require that the contract has enough tokens
        require(
            tokenContract.balanceOf(address(this)) >=
                pendingPurchases[_reqId]._numberOfTokens,
            "Unable to purchase more tokens than totally available"
        );

        // require that actual price has been queried and received from the oracle
        // require(pendingPurchases[_reqId]._price != MAX_UINT256, "Price is yet to set");

        address pairAddress = factory.getPair(weth, portfolio[tokenNames[0]]);
        pendingPurchases[_reqId]._price = getTokenPrice(pairAddress);
        // pendingPurchases[_reqId]._price = 10**18;

        // require that the calling entity has enough funds to buy tokens
        require(msg.value >= (pendingPurchases[_reqId]._numberOfTokens * pendingPurchases[_reqId]._price),
            "Not enough funds to buy tokens"
        );

        swapExactETHForTokens();

        // require that the transfer is successful
        require(
            tokenContract.transfer(
                msg.sender,
                pendingPurchases[_reqId]._numberOfTokens
            ),
            "Unable to transfer tokens to buyer"
        );

        tokensSold += pendingPurchases[_reqId]._numberOfTokens;

        emit Purchased(
            _reqId,
            msg.sender,
            pendingPurchases[_reqId]._numberOfTokens,
            pendingPurchases[_reqId]._price
        );

        return true;
    }

    //Ending Token DappTokenSale
    function endSale() public onlyOwner {
        // transfer remaining dapp tokens to admin
        require(
            tokenContract.transfer(
                payable(owner()),
                tokenContract.balanceOf(address(this))
            ),
            "Unsold tokens not correctly returned to owner"
        );

        // destroy contract
        // the code of the contract on blockchain doesn't really get destroyed since
        // it's immutable. But the contract will be `disabled` and its state variables
        // will be set the default value of their datatype.
        selfdestruct(payable(owner()));
    }

    function setTokenContract(address _tokenContract)
        external
        onlyOwner
        returns (bool)
    {
        tokenContract = IndexToken(_tokenContract);
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
}
