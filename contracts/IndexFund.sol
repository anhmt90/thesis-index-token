//SPDX-License-Identifier: MIT
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
import "./Fund.sol";
import "./oracle/IOracleClient.sol";
import "./oracle/Oracle.sol";

contract IndexFund is Fund, Ownable  {

    // instance of uniswap v2 router02
    address public router;

    // instance of WETH
    address public weth;

    // keep track of the token amount sold out to the market
    // default to 1 unit (= 10^-18 tokens) to avoid dividing by 0 when bootstrapping
    // uint256 public circulation;


    modifier properPortfolio() {
        require(tokenNames.length > 0, "IndexFund : No token names found in portfolio");
        // for (uint256 i = 0; i < tokenNames.length; i++) {
        //     require(portfolio[tokenNames[i]] != address(0), "IndexFund : A token in portfolio has address 0");
        // }
        _;
    }

    modifier onlyOracle() {
        require(msg.sender == oracle, "IndexFund: caller is not a trusted Oracle");
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


    /** ----------------------------------------------------------------------------------------------------- */

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

    function getIndexPrice() public view returns (uint256 _price){
        require(weth != address(0), "IndexFund : Contract WETH not set");
        uint256 totalSupply = IERC20Extended(indexToken).totalSupply();
        address[] memory path = new address[](2);
        path[0] = weth;

        for (uint256 i = 0; i < tokenNames.length; i++) {
            address componentAddress = portfolio[tokenNames[i]];
            path[1] = componentAddress;

            uint[] memory amounts = IUniswapV2Router02(router).getAmountsOut(1000000000000000000, path);
            uint componentPrice = (1000000000000000000000000000000000000) / amounts[1];

            if(totalSupply > 0) {
                uint256 componentBalanceOfIndexFund = IERC20Extended(componentAddress).balanceOf(address(this));
                _price += componentPrice * componentBalanceOfIndexFund;
            } else {
                _price += componentPrice;
            }
        }

        if (totalSupply > 0) {
            _price /= totalSupply;
        } else {
            _price /= tokenNames.length;
        }
    }

    /** ----------------------------------------------------------------------------------------------------- */




    // payable: function can exec Tx
    function buy(uint256[] calldata _amountsOutMin) external payable override properPortfolio {
        require(msg.value > 0, "IndexFund: Investment sum must be greater than 0.");
        require(_amountsOutMin.length == 0 || _amountsOutMin.length == tokenNames.length,
            "IndexToken: offchainPrices must either be empty or have many entries as the portfolio"
        );

        // default price 1 ETH
        uint256 _amount;

        // calculate the current price based on component tokens
        uint256 _price = getIndexPrice();

        if (_price > 0) {
            _amount = (msg.value * 1000000000000000000) / _price;
        }

        // swap the ETH sent with the transaction for component tokens on Uniswap
        _swapExactETHForTokens(_amountsOutMin);

         // mint new <_amount> IndexTokens
        require(IndexToken(indexToken).mint(msg.sender, _amount), "Unable to mint new Index tokens for buyer");

        emit Purchase(
            msg.sender,
            _amount,
            _price
        );
    }

    function _swapExactETHForTokens(uint256[] calldata _amountsOutMin) internal  {
        require(weth != address(0), "IndexFund : WETH Token not set");
        address[] memory path = new address[](2);
        path[0] = weth;

        uint256 _amountEth = msg.value;
        uint256 _ethForEachComponent = msg.value / tokenNames.length;
        uint256[] memory _amountsOut = new uint256[](tokenNames.length);
        uint256 _amountOutMin = 1;

        for (uint256 i = 0; i < tokenNames.length; i++) {
            address tokenAddr = portfolio[tokenNames[i]];
            require(tokenAddr != address(0), "IndexFund : Token has address 0");
            path[1] = tokenAddr;

            if (_amountsOutMin.length > 0) {
                _amountOutMin = _amountsOutMin[i];
            }

            uint256[] memory amounts = IUniswapV2Router02(router).swapExactETHForTokens{value: _ethForEachComponent}(
                _amountOutMin,
                path,
                address(this),
                block.timestamp + 10
            );

            _amountsOut[i] = amounts[1];

        }
        emit SwapForComponents(tokenNames, _amountEth, _amountsOut);
    }




    /** ----------------------------------------------------------------------------------------------------- */




    function sell(uint256 _amount, uint256[] calldata _amountsOutMin) external override properPortfolio {
        require(_amount > 0, "IndexFund: a non-zero allowance is required");

        IndexToken _indexToken = IndexToken(indexToken);
        require(_amount <= _indexToken.allowance(msg.sender, address(this)), "IndexFund: allowance not enough");

        _swapExactTokensForETH(_amount, _amountsOutMin);
        _indexToken.transferFrom(msg.sender, address(this), _amount);
        _indexToken.burn(_amount);

        emit Sale(msg.sender, _amount);
    }


    function _swapExactTokensForETH(uint256 _amountIndexToken, uint256[] calldata _amountsOutMin) internal  {
        address[] memory path = new address[](2);
        path[1] = weth;
        uint256 _amountEachComponent = _amountIndexToken / tokenNames.length;
        uint256[] memory _amountsOut = new uint256[](tokenNames.length);
        uint256 _amountOutMin = 1;

        for (uint256 i = 0; i < tokenNames.length; i++) {
            address tokenAddr = portfolio[tokenNames[i]];
            require(tokenAddr != address(0), "IndexFund: A token has address 0");
            path[0] = tokenAddr;

            if (_amountsOutMin.length > 0) {
                _amountOutMin = _amountsOutMin[i];
            }

            IERC20Extended(tokenAddr).approve(router, _amountEachComponent);

            uint256[] memory amounts = IUniswapV2Router02(router).swapExactTokensForETH(
                _amountEachComponent,
                _amountOutMin,
                path,
                msg.sender,
                block.timestamp + 10
            );
            _amountsOut[i] = amounts[1];

        }
        emit SwapForEth(tokenNames, _amountEachComponent, _amountsOut);
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
    // function __oracleCallback(uint256 _reqId, uint256 _price)
    //     external
    //     override
    //     returns (bool)
    // {
    //     require(pendingPurchases[_reqId]._id != 0, "Request ID not found");

    //     pendingPurchases[_reqId]._price = _price;

    //     emit PurchaseReady(_reqId, pendingPurchases[_reqId]._buyer, _price);

    //     return true;
    // }


    function setTokenContract(address _indexToken)
        external
        onlyOwner
        returns (bool)
    {
        indexToken = _indexToken;
        return true;
    }

    // function setOracle(address _oracleContract)
    //     external
    //     override
    //     onlyOwner
    //     returns (bool)
    // {
    //     oracleContract = _oracleContract;
    //     return true;
    // }

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
