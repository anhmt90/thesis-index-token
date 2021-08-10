//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
// import "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";
import "./interfaces/IWETH.sol";
import "./libraries/UniswapV2LibraryUpdated.sol";
import "./IndexToken.sol";
import "./Fund.sol";
import "./TimeLock.sol";
import "./oracle/Oracle.sol";

contract IndexFund is Fund, TimeLock, Ownable {

    // instance of uniswap v2 router02
    address immutable public router;

    // instance of WETH
    address immutable public weth;

    modifier properPortfolio() {
        require(
            componentSymbols.length > 0,
            "IndexFund : No token names found in portfolio"
        );
        _;
    }

    modifier onlyOracle() {
        require(
            msg.sender == oracle,
            "IndexFund: caller is not the trusted Oracle"
        );
        _;
    }

    constructor(
        string[] memory _componentSymbols,
        address[] memory _componentAddrs,
        address _router,
        address _oracle
    ) Fund(_oracle) {
        //setPortfolio
        require(_componentSymbols.length == _componentAddrs.length,
            "IndexFund: SYMBOL and ADDRESS arrays not equal in length!"
        );

        componentSymbols = _componentSymbols;
        for (uint256 i = 0; i < _componentSymbols.length; i++) {
            require(_componentAddrs[i] != address(0), "IndexFund: a component address is 0");
            portfolio[_componentSymbols[i]] = _componentAddrs[i];
        }
        emit PortfolioUpdated(msg.sender, tx.origin, new string[](0), _componentSymbols);

        // initialize state variables
        router = _router;
        weth = IUniswapV2Router02(_router).WETH();
        // oracle = address(new Oracle(msg.sender));
    }

    function announcePortfolioUpdating(string calldata _message)
        external
        override
        onlyOracle
    {
        lock2days(Functions.UPDATE_PORTFOLIO, _message);
    }

    function announcePortfolioRebalancing(string calldata _message)
        external
        override
        onlyOwner
    {
        lock2days(Functions.REBALANCE, _message);
    }

    function updatePorfolio(
        string[] memory _componentSymbolsOut,
        uint256[] calldata _amountsOutMinOut,
        address[] memory _componentAddrsIn,
        uint256[] calldata _amountsOutMinIn,
        string[] memory _allNextComponentSymbols
    ) public payable onlyOracle notLocked(Functions.UPDATE_PORTFOLIO) {
        require(_componentSymbolsOut.length == _componentAddrsIn.length, "IndexFund: number of component to be added and to be removed not matched");
        require(_componentSymbolsOut.length == _amountsOutMinOut.length, "IndexFund: length of _componentSymbolsOut and _amountsOutMinOut not matched");
        require(_componentAddrsIn.length == _amountsOutMinIn.length, "IndexFund: length of _componentAddrsIn and _amountsOutMinIn not matched");

        // sell the outgoing components on Uniswap to get eth to buy the incoming ones.
        address[] memory path = new address[](2);
        path[1] = weth;
        for (uint256 i = 0; i < _componentSymbolsOut.length; i++) {
            address componentAddr = portfolio[_componentSymbolsOut[i]];
            require(componentAddr != address(0), "IndexFund: an outgoing component not found in portfolio");
            path[0] = componentAddr;
            uint256 currentBalance = IERC20Metadata(componentAddr).balanceOf(address(this));

            IERC20Metadata(componentAddr).approve(router, currentBalance);
            IUniswapV2Router02(router).swapExactTokensForETH(
                currentBalance,
                _amountsOutMinOut[i],
                path,
                address(this),
                block.timestamp + 10
            );

            delete portfolio[_componentSymbolsOut[i]];
        }

        // buy the incoming components.
        path[0] = weth;
        uint256 ethForEachIncomingComponnent = address(this).balance / _componentAddrsIn.length;
        for (uint256 i = 0; i < _componentAddrsIn.length; i++) {
            string memory symbol = IERC20Metadata(_componentAddrsIn[i]).symbol();
            path[1] = _componentAddrsIn[i];
            IUniswapV2Router02(router)
                .swapExactETHForTokens{value: ethForEachIncomingComponnent}(
                _amountsOutMinIn[i],
                path,
                address(this),
                block.timestamp + 10
            );
            portfolio[symbol] = _componentAddrsIn[i];
        }

        // replace the entire old symbol array with this new symbol array.
        componentSymbols = _allNextComponentSymbols;

        require(address(this).balance < componentSymbols.length, "IndexToken: too much ETH left");

        // lock unlimited time, a next update must always have 2 days grace period.
        lockUnlimited(Functions.UPDATE_PORTFOLIO);

        emit PortfolioUpdated(msg.sender, tx.origin, _componentSymbolsOut, componentSymbols);

    }

    /** -------------------------------------------------------------------------- */

    function getIndexPrice() public view returns (uint256 _price) {
        require(weth != address(0), "IndexFund : Contract WETH not set");
        uint256 totalSupply = IERC20Metadata(indexToken).totalSupply();
        address[] memory path = new address[](2);

        path[1] = weth;
        for (uint256 i = 0; i < componentSymbols.length; i++) {
            address componentAddress = portfolio[componentSymbols[i]];
            path[0] = componentAddress;
            uint8 decimals = IERC20Metadata(componentAddress).decimals();

            uint256 componentBalanceOfIndexFund = totalSupply > 0
                ? IERC20Metadata(componentAddress).balanceOf(address(this))
                : 10 ** decimals;

            uint256[] memory amounts = IUniswapV2Router02(router).getAmountsOut(componentBalanceOfIndexFund, path);
            _price += amounts[1];
        }
        if (totalSupply > 0) {
            _price = (_price * 1e18) /  totalSupply;
        } else {
            _price /= componentSymbols.length;
        }
    }

    /** -------------------------------------------------------------------------- */

    // payable: function can exec Tx
    function buy(uint256[] calldata _amountsOutMin)
        external
        payable
        override
        properPortfolio
    {
        require(msg.value > 0, "IndexFund: Investment sum must be greater than 0.");

        require(_amountsOutMin.length == 0 || _amountsOutMin.length == componentSymbols.length,
            "IndexToken: offchainPrices must either be empty or have many entries as the portfolio"
        );

        uint256 totalSupply = IERC20Metadata(indexToken).totalSupply();
        require(totalSupply > 0 || msg.value <= 0.01 ether,
            "IndexFund: totalSupply must > 0 or msg.value must <= 0.01 ETH"
        );

        // calculate the current price based on component tokens
        uint256 _price = getIndexPrice();

        uint256 _amount;
        if (_price > 0) {
            _amount = (msg.value * 1e18) / _price;
        }

        // swap the ETH sent with the transaction for component tokens on Uniswap
        _swapExactETHForTokens(_amountsOutMin);

        // mint new <_amount> IndexTokens
        require(IndexToken(indexToken).mint(msg.sender, _amount), "Unable to mint new Index tokens for buyer");

        emit Buy(msg.sender, _amount, _price);
    }

    function _swapExactETHForTokens(uint256[] calldata _amountsOutMin)
        internal
    {
        require(weth != address(0), "IndexFund : WETH Token not set");
        address[] memory path = new address[](2);
        path[0] = weth;

        uint256 _ethForEachComponent = msg.value / componentSymbols.length;
        uint256[] memory _amountsOut = new uint256[](componentSymbols.length);
        uint256 _amountOutMin;

        for (uint256 i = 0; i < componentSymbols.length; i++) {
            address tokenAddr = portfolio[componentSymbols[i]];
            require(tokenAddr != address(0), "IndexFund : Token has address 0");
            path[1] = tokenAddr;

            if (_amountsOutMin.length > 0) {
                _amountOutMin = _amountsOutMin[i];
            }

            uint256[] memory amounts = IUniswapV2Router02(router)
                .swapExactETHForTokens{value: _ethForEachComponent}(
                _amountOutMin,
                path,
                address(this),
                block.timestamp + 10
            );

            _amountsOut[i] = amounts[1];
        }
    }

    /** -------------------------------------------------------------------------- */

    function sell(uint256 _amount, uint256[] calldata _amountsETHOutMin)
        external
        override
        properPortfolio
    {
        require(_amount > 0, "IndexFund: a non-zero allowance is required");

        IndexToken _indexToken = IndexToken(indexToken);
        require(
            _amount <= _indexToken.allowance(msg.sender, address(this)),
            "IndexFund: allowance not enough"
        );

        _indexToken.transferFrom(msg.sender, address(this), _amount);
        _swapExactTokensForETH(_amount, _amountsETHOutMin);
        _indexToken.burn(_amount);

        emit Sell(msg.sender, _amount);
    }

    function _swapExactTokensForETH(
        uint256 _amountIndexToken,
        uint256[] calldata _amountsETHOutMin
    ) internal {
        uint256 _ethAmountOutEachComponent = ((_amountIndexToken * getIndexPrice()) / 1e18) / componentSymbols.length;
        uint256[] memory _amountsOut = new uint256[](componentSymbols.length);

        address[] memory path = new address[](2);
        path[1] = weth;
        uint256 _amountETHOutMin;
        for (uint256 i = 0; i < componentSymbols.length; i++) {
            address componentAddr = portfolio[componentSymbols[i]];
            require(componentAddr != address(0), "IndexFund: a token has address 0");
            path[0] = componentAddr;
            uint256 amountComponentToSell =  IUniswapV2Router02(router).getAmountsIn(_ethAmountOutEachComponent, path)[0];
            uint256 currentBalance = IERC20Metadata(componentAddr).balanceOf(address(this));
            if (amountComponentToSell > currentBalance) {
                amountComponentToSell = currentBalance;
            }

            if (_amountsETHOutMin.length > 0) {
                _amountETHOutMin = _amountsETHOutMin[i];
            }
            IERC20Metadata(componentAddr).approve(router, amountComponentToSell);
            uint256[] memory amounts = IUniswapV2Router02(router)
                .swapExactTokensForETH(
                    amountComponentToSell,
                    _amountETHOutMin,
                    path,
                    msg.sender,
                    block.timestamp + 10
                );
            _amountsOut[i] = amounts[1];
        }
    }

    /** -------------------------------------------------------------------------- */
    function rebalance(uint256[] calldata _amountsETHOutMin, uint256[] calldata _amountsComponentOutMin) external payable onlyOwner notLocked(Functions.REBALANCE)  {
       require(_amountsETHOutMin.length == _amountsComponentOutMin.length, "IndexFund: the two input arrays aren't equal in length");
        address[] memory path = new address[](2);
        path[1] = weth;
        uint256[] memory ethAmountsOut = new uint256[](componentSymbols.length);

        // small amount of wei remained from previous rebalancing and updates
        uint256 ethSum = address(this).balance;
        for (uint256 i = 0; i < componentSymbols.length; i++) {
            address componentAddr = portfolio[componentSymbols[i]];
            path[0] = componentAddr;
            uint256 tokenBalance = IERC20(componentAddr).balanceOf(address(this));
            ethAmountsOut[i] = IUniswapV2Router02(router).getAmountsOut(tokenBalance, path)[1];
            ethSum += ethAmountsOut[i];
        }
        uint256 ethAvg = ethSum / componentSymbols.length;

        // SELLING `overperforming` tokens for ETH
        uint256 _amountETHOutMin;
        for (uint256 i = 0; i < ethAmountsOut.length; i++) {
            if (ethAvg < ethAmountsOut[i]) {
                address componentAddr = portfolio[componentSymbols[i]];

                // derive the amount of component tokens to sell
                uint256 ethDiff = ethAmountsOut[i] - ethAvg;
                path[0] = componentAddr;
                path[1] = weth;
                uint256 amountComponentToSell = IUniswapV2Router02(router).getAmountsIn(ethDiff, path)[0];
                uint256 currentBalance = IERC20Metadata(componentAddr).balanceOf(address(this));
                if (amountComponentToSell > currentBalance) {
                    amountComponentToSell = currentBalance;
                }

                if (_amountsETHOutMin.length > 0) {
                    _amountETHOutMin = _amountsETHOutMin[i];
                }

                IERC20Metadata(componentAddr).approve(router, amountComponentToSell);
                IUniswapV2Router02(router).swapExactTokensForETH(
                    amountComponentToSell,
                    _amountETHOutMin,
                    path,
                    address(this),
                    block.timestamp + 10
                );
            }
        }

        // BUYING `underperforming` tokens with the ETH received
        uint256 _amountComponentOutMin;
        for (uint256 i = 0; i < ethAmountsOut.length; i++) {
            if (ethAvg > ethAmountsOut[i]) {
                address tokenAddr = portfolio[componentSymbols[i]];
                uint256 ethDiff = ethAvg - ethAmountsOut[i];
                path[0] = weth;
                path[1] = tokenAddr;

                // derive the amount of component tokens to buy for frontrunning prevention
                // uint256 amountComponetnTokensToBuy = IUniswapV2Router02(router).getAmountsOut(ethDiff, path)[1];
                if (_amountsComponentOutMin.length > 0) {
                    _amountComponentOutMin = _amountsComponentOutMin[i];
                }
                IUniswapV2Router02(router).swapExactETHForTokens{value: ethDiff}(
                    _amountComponentOutMin,
                    path,
                    address(this),
                    block.timestamp + 10
                );
            }
        }
        require(address(this).balance < componentSymbols.length, "IndexToken: too much ETH left");

        lockUnlimited(Functions.REBALANCE);
        emit PortfolioRebalanced(msg.sender, block.timestamp, ethAvg);
    }

    /** -------------------------------------------------------------------------- */

    event Received(address sender, uint amount);

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

}
