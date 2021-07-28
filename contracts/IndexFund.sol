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

contract IndexFund is Ownable, IOracleClient {
    struct Purchase {
        uint256 _id;
        address _buyer;
        uint256 _ethAmount;
        uint256 _price;
    }

    uint256 constant MAX_UINT256 = 2**256 - 1;

    // instance of the ERC20 Index Token contract
    address public indexToken;

    // instance of the price Oracle contract
    address public oracleContract;

    // instance of uniswap v2 router02
    address public router;

    // instance of WETH
    address public weth;

    // set of pending purchases that are yet to finalize
    mapping(uint256 => Purchase) pendingPurchases;

    // <token_name> is at <address>
    mapping(string => address) public portfolio;
    string[] public tokenNames;

    // keep track of the token amount sold out to the market
    // default to 1 unit (= 10^-18 tokens) to avoid dividing by 0 when bootstrapping
    // uint256 public circulation;

    event PriceRequest(
        uint256 indexed _reqId,
        address indexed _buyer
    );

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

    event PortfolioChanged(
        string[] names,
        address[] addresses
    );

    event Swap(uint256[] amounts);

    modifier properPortfolio() {
        require(tokenNames.length > 0, "IndexFund : No token names found in portfolio");
        // for (uint256 i = 0; i < tokenNames.length; i++) {
        //     require(portfolio[tokenNames[i]] != address(0), "IndexFund : A token in portfolio has address 0");
        // }
        _;
    }

    constructor(address _router) {
        router = _router;
        weth = IUniswapV2Router02(_router).WETH();
        indexToken = address(new IndexToken());
    }

    function setPorfolio(string[] memory names, address[] memory addresses)
        external
        onlyOwner
    {
        require(names.length == addresses.length, "IndexFund : Arrays not equal in length!");
        tokenNames = names;
        for (uint256 i = 0; i < names.length; i++) {
            portfolio[names[i]] = addresses[i];
        }
        emit PortfolioChanged(names, addresses);
    }

    function getIndexPrice() public view returns (uint256 _price){
        require(weth != address(0), "IndexFund : Contract WETH not set");
        address[] memory path = new address[](2);
        path[0] = weth;

        for (uint256 i = 0; i < tokenNames.length; i++) {
            address tokenAddress = portfolio[tokenNames[i]];
            path[1] = tokenAddress;

            uint[] memory amounts = IUniswapV2Router02(router).getAmountsOut(10**18, path);
            uint tokenPrice = amounts[1];
            uint tokenBalanceOfIndexFund  = IERC20Extended(tokenAddress).balanceOf(address(this));
            _price += tokenPrice * tokenBalanceOfIndexFund ;
        }
        uint256 totalSupply = IERC20Extended(indexToken).totalSupply();
        if (totalSupply > 0) {
            _price /= totalSupply;
        }
    }

    // payable: function can exec Tx
    function orderWithExactETH(uint256[] calldata _minPrices) public payable properPortfolio {
        require(_minPrices.length == 0 || _minPrices.length == tokenNames.length,
            "IndexToken: offchainPrices must either be empty or have many entries as the portfolio"
        );
        uint256 _reqId = assignRequestId();

        pendingPurchases[_reqId] = Purchase(
            _reqId,
            msg.sender,
            msg.value,
            MAX_UINT256
        );

        _finalizePurchase(_reqId, _minPrices);

        // oracleContract.request(_reqId);

        // emit PriceRequest(_reqId, msg.sender);
    }

    function _finalizePurchase(uint256 _reqId, uint256[] calldata _minPrices) internal returns (bool) {
        // require that the request Id passed in is available
        require(pendingPurchases[_reqId]._id != 0, "Request ID not found");

        // require that the function caller is the buyer placing token order earlier with this _reqId
        require(pendingPurchases[_reqId]._buyer == msg.sender, "IndexFund : Unauthorized purchase claim");

        // require that actual price has been queried and received from the oracle
        pendingPurchases[_reqId]._price = getIndexPrice();

        uint256 _amount;
        if (pendingPurchases[_reqId]._price > 0) {
            _amount = msg.value / pendingPurchases[_reqId]._price;
        } else {
            // default price 1 ETH
            _amount = msg.value;
        }

        _swapExactETHForTokens(_minPrices);

         // mint new <_amount> IndexTokens
        IndexToken _indexToken = IndexToken(indexToken);
        require(_indexToken.mint(msg.sender, _amount), "Unable to mint new Index tokens for buyer");

        emit Purchased(
            _reqId,
            msg.sender,
            _amount,
            pendingPurchases[_reqId]._price
        );

        return true;
    }

    function _swapExactETHForTokens(uint256[] calldata _minPrices) internal  {
        require(weth != address(0), "IndexFund : WETH Token not set");
        address[] memory path = new address[](2);
        path[0] = weth;
        uint256 ethForEachComponent = msg.value / tokenNames.length;
        uint256 amountOutMin = 1;
        for (uint256 i = 0; i < tokenNames.length; i++) {
            address tokenAddr = portfolio[tokenNames[i]];
            require(tokenAddr != address(0), "IndexFund : Token has address 0");
            path[1] = tokenAddr;

            if (_minPrices.length > 0) {
                amountOutMin = ethForEachComponent / _minPrices[i];
            }

            uint256[] memory amounts = IUniswapV2Router02(router).swapExactETHForTokens{value: ethForEachComponent}(
                    amountOutMin * (10 ** IERC20Extended(tokenAddr).decimals()),
                    path,
                    address(this),
                    block.timestamp + 10
                );

            emit Swap(amounts);
        }
    }

    function getUniswapAmountsOutForExactETH(uint256 ethIn) public view properPortfolio returns (uint256[] memory amounts) {
        require(router != address(0), "IndexFund : Router contract not set!");
        address[] memory path = new address[](2);
        path[0] = weth;

        amounts = new uint[](tokenNames.length);
        for (uint256 i = 0; i < tokenNames.length; i++) {
            path[1] = portfolio[tokenNames[i]];
            amounts[i] = IUniswapV2Router02(router).getAmountsOut(ethIn, path)[1];
        }
    }

    /** ----------------------------------------------------------------------------------------------------- */
    function rebalance(uint16[] calldata allocation) external onlyOwner {
        require(allocation.length == tokenNames.length, "IndxToken: Wrong size of allocation array");
        uint16 sumAllocation;
        for (uint256 i = 0; i < allocation.length; i++) {
            sumAllocation += allocation[i];
        }
        require(sumAllocation == 1000 || sumAllocation == 999, "IndexToken: Wrong sum of allocation");

        address[] memory path = new address[](2);
        path[1] = weth;

        uint256[] memory ethAmountsOut = new uint256[](tokenNames.length);
        uint256 ethSum;
        for (uint256 i = 0; i < tokenNames.length; i++) {
            address tokenAddr = portfolio[tokenNames[i]];
            path[0] = tokenAddr;
            uint256 tokenBalance = IERC20(tokenAddr).balanceOf(address(this));
            ethAmountsOut[i] = IUniswapV2Router02(router).getAmountsOut(tokenBalance, path)[1];
            ethSum += ethAmountsOut[i];
        }
        uint256 ethAvg = ethSum / tokenNames.length;

        // SELLING `overperforming` tokens for ETH
        for (uint256 i = 0; i < ethAmountsOut.length; i++) {
            if (ethAvg < ethAmountsOut[i]) {
                address tokenAddr = portfolio[tokenNames[i]];

                uint256 ethDiff = ethAmountsOut[i] - ethAvg;
                path[0] = weth;
                path[1] = tokenAddr;

                uint256 tokensToSell = IUniswapV2Router02(router).getAmountsOut(ethDiff, path)[1];

                path[0] = tokenAddr;
                path[1] = weth;
                 IUniswapV2Router02(router).swapTokensForExactETH(
                    ethDiff,
                    tokensToSell,
                    path,
                    address(this),
                    block.timestamp + 10
                );
                // amountsOut[1] // == ethDiff
            }
        }

        // BUYING `underperforming` tokens with the ETH received
        for (uint256 i = 0; i < ethAmountsOut.length; i++) {
            if (ethAvg > ethAmountsOut[i]) {
                address tokenAddr = portfolio[tokenNames[i]];
                uint256 ethDiff = ethAvg - ethAmountsOut[i];
                path[0] = weth;
                path[1] = tokenAddr;

                uint256 tokensToBuy = IUniswapV2Router02(router).getAmountsOut(ethDiff, path)[1];

                IUniswapV2Router02(router).swapExactETHForTokens{value: ethDiff}(
                    tokensToBuy,
                    path,
                    address(this),
                    block.timestamp + 10
                );
            }
        }
        require(address(this).balance == 0, "IndexToken: There's still ETH left unspent");

    }


    /** ---------------------------------------------------------------------------------------------------- */
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
            IndexToken(indexToken).transfer(payable(owner()), IndexToken(indexToken).balanceOf(address(this))),
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
        indexToken = _indexToken;
        return true;
    }

    function setOracle(address _oracleContract)
        external
        override
        onlyOwner
        returns (bool)
    {
        oracleContract = _oracleContract;
        return true;
    }

    function getNamesInPortfolio() external view returns (string[] memory) {
        return tokenNames;
    }

    function getAddressesInPortfolio() external view returns (address[] memory _addrs) {
        _addrs = new address[](tokenNames.length);
        for (uint256 i = 0; i < tokenNames.length; i++) {
            require(portfolio[tokenNames[i]] != address(0), "IndexFund : A token in portfolio has address 0");
            _addrs[i] = portfolio[tokenNames[i]];
        }
    }
}
