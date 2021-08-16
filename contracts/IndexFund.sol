//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "./DFAM.sol";
import "./Fund.sol";
import "./TimeLock.sol";
import "./oracle/Oracle.sol";
// import "./libraries/IndexLib.sol";

contract IndexFund is Fund, TimeLock {

    // instance of uniswap v2 router02
    address immutable public router;

    // instance of WETH
    address immutable public weth;

    modifier properPortfolio() {
        require(
            components.length > 0,
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
        string[] memory _cpntSymbols,
        address[] memory _cpntAddrs,
        address _router,
        address _oracle
    ) Fund(_oracle) {
        //setPortfolio
        require(_cpntSymbols.length == _cpntAddrs.length,
            "IndexFund: SYMBOL and ADDRESS arrays not equal in length!"
        );

        components = _cpntSymbols;
        for (uint256 i = 0; i < _cpntSymbols.length; i++) {
            require(_cpntAddrs[i] != address(0), "IndexFund: a cpnt address is 0");
            portfolio[_cpntSymbols[i]] = _cpntAddrs[i];
        }
        emit PortfolioUpdated(msg.sender, tx.origin, new string[](0), _cpntSymbols);

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
        onlyOracle
    {
        lock2days(Functions.REBALANCE, _message);
    }

    function updatePorfolio(
        string[] memory _cpntSymbolsOut,
        uint256[] calldata _amountsOutMinOut,
        address[] memory _cpntAddrsIn,
        uint256[] calldata _amountsOutMinIn,
        string[] memory _allNextCpntSymbols
    ) public payable onlyOracle notLocked(Functions.UPDATE_PORTFOLIO) {

        // sell the outgoing cpnts on Uniswap to get eth to buy the incoming ones.
        address[] memory path = new address[](2);
        path[1] = weth;

        for (uint256 i = 0; i < _cpntSymbolsOut.length; i++) {
            path[0] = portfolio[_cpntSymbolsOut[i]];
            uint256 currentBalance = IERC20Metadata(path[0]).balanceOf(address(this));
            IERC20Metadata(path[0]).approve(router, currentBalance);
            IUniswapV2Router02(router).swapExactTokensForETH(
                currentBalance,
                _amountsOutMinOut[i],
                path,
                address(this),
                block.timestamp + 10
            );
            delete portfolio[_cpntSymbolsOut[i]];
        }

        // buy the incoming cpnts.
        path[0] = weth;
        uint256 ethForEachIncomingComponnent = address(this).balance / _cpntAddrsIn.length;
        for (uint256 i = 0; i < _cpntAddrsIn.length; i++) {
            path[1] = _cpntAddrsIn[i];
            IUniswapV2Router02(router).swapExactETHForTokens{value: ethForEachIncomingComponnent}(
                _amountsOutMinIn[i],
                path,
                address(this),
                block.timestamp + 10
            );
            portfolio[IERC20Metadata(_cpntAddrsIn[i]).symbol()] = _cpntAddrsIn[i];
        }

        // replace the entire old symbol array with this new symbol array.
        components = _allNextCpntSymbols;

        require(address(this).balance < components.length, "IndexFund: too much ETH left");

        // lock unlimited time, a next update must always have 2 days grace period.
        lockUnlimited(Functions.UPDATE_PORTFOLIO);

        emit PortfolioUpdated(msg.sender, tx.origin, _cpntSymbolsOut, components);

    }

    /** -------------------------------------------------------------------------- */

    function rebalance(
        uint256[] calldata _amountsETHOutMin,
        uint256[] calldata _amountsCpntOutMin
    ) external payable onlyOracle notLocked(Functions.REBALANCE)  {
       require(_amountsETHOutMin.length == _amountsCpntOutMin.length, "IndexFund: the two input arrays aren't equal in length");
        address[] memory path = new address[](2);
        path[1] = weth;
        uint256[] memory ethAmountsOut = new uint256[](components.length);

        // small amount of wei remained from previous rebalancing and updates
        uint256 ethAvg = address(this).balance;
        for (uint256 i = 0; i < components.length; i++) {
            path[0] = portfolio[components[i]];
            uint256 tokenBalance = IERC20(path[0]).balanceOf(address(this));
            ethAmountsOut[i] = IUniswapV2Router02(router).getAmountsOut(tokenBalance, path)[1];
            ethAvg += ethAmountsOut[i];
        }
        ethAvg = ethAvg / components.length;

        // SELLING `overperforming` tokens for ETH
        uint256[] memory _ethsDiff = new uint256[](components.length);
        for (uint256 i = 0; i < components.length; i++) {
            _ethsDiff[i] = ethAmountsOut[i] > ethAvg ? ethAmountsOut[i] - ethAvg : 0;
        }
        _swapExactTokensForETH(address(this), 0, _ethsDiff, _amountsETHOutMin);

        // BUYING `underperforming` tokens with the ETH received
        for (uint256 i = 0; i < components.length; i++) {
            _ethsDiff[i] = ethAmountsOut[i] < ethAvg ? ethAvg - ethAmountsOut[i] : 0;
        }
        _swapExactETHForTokens(0, _ethsDiff, _amountsCpntOutMin);

        require(address(this).balance < components.length, "IndexFund: too much ETH left");
        lockUnlimited(Functions.REBALANCE);
        emit PortfolioRebalanced(msg.sender, block.timestamp, ethAvg);
    }

    /** -------------------------------------------------------------------------- */

    function getIndexPrice() public view returns (uint256 _price) {
        uint256 totalSupply = IERC20Metadata(indexToken).totalSupply();
        address[] memory path = new address[](2);

        path[1] = weth;
        for (uint256 i = 0; i < components.length; i++) {
            path[0] = portfolio[components[i]];

            uint256 componentBalanceOfIndexFund = totalSupply > 0
                ? IERC20Metadata(path[0]).balanceOf(address(this))
                : 10 ** (IERC20Metadata(path[0]).decimals());

            _price += (IUniswapV2Router02(router).getAmountsOut(componentBalanceOfIndexFund, path))[1];
        }
        if (totalSupply > 0) {
            _price = (_price * 1e18) /  totalSupply;
        } else {
            _price /= components.length;
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

        require(_amountsOutMin.length == 0 || _amountsOutMin.length == components.length,
            "IndexFund: offchainPrices must either be empty or have many entries as the portfolio"
        );

        uint256 totalSupply = IERC20Metadata(indexToken).totalSupply();
        require(totalSupply > 0 || msg.value <= 0.01 ether,
            "IndexFund: totalSupply must > 0 or msg.value must <= 0.01 ETH"
        );

        // calculate the current price based on cpnt tokens
        uint256 _price = getIndexPrice();

        // swap the ETH sent with the transaction for cpnt tokens on Uniswap
        uint256 _ethForEachCpnt = msg.value / components.length;
        uint256[] memory _amountsOut = _swapExactETHForTokens(
            _ethForEachCpnt,
            new uint256[](0),
            _amountsOutMin
        );

        address[] memory path = new address[](2);
        path[1] = weth;
        // Net asset value of the purchase
        uint256 nav = 0;
        for (uint256 i = 0; i < _amountsOut.length; i++) {
            path[0] = portfolio[components[i]];
            nav += IUniswapV2Router02(router).getAmountsOut(_amountsOut[i], path)[1];
        }
        uint256 _amount;
        if (_price > 0) {
            _amount = (nav * 1e18) / _price;
        }

        // mint new <_amount> DFAMs
        require(DFAM(indexToken).mint(msg.sender, _amount), "Unable to mint new Index tokens for buyer");

        emit Buy(msg.sender, _amount, _price);
    }

    function _swapExactETHForTokens(
        uint256 _ethInSame,
        uint256[] memory _ethsInDistinct,
        uint256[] calldata _amountsOutMin
    ) internal returns (uint256[] memory _amountsOut) {
        address[] memory path = new address[](2);
        path[0] = weth;

        _amountsOut = new uint256[](components.length);
        uint256 _amountOutMin;
        for (uint256 i = 0; i < components.length; i++) {
            path[1] = portfolio[components[i]];
            uint _ethIn =  _ethInSame != 0 ? _ethInSame : _ethsInDistinct[i];

            if (_ethIn <= 0) { continue; }

            if (_amountsOutMin.length > 0) {
                _amountOutMin = _amountsOutMin[i];
            }

            _amountsOut[i] = IUniswapV2Router02(router).swapExactETHForTokens{value: _ethIn}(
                _amountOutMin,
                path,
                address(this),
                block.timestamp + 10
            )[1];
        }
    }

    /** -------------------------------------------------------------------------- */

    function sell(uint256 _amount, uint256[] calldata _amountsETHOutMin)
        external
        override
        properPortfolio
    {
        require(_amount > 0, "IndexFund: a non-zero allowance is required");

        DFAM _indexToken = DFAM(indexToken);
        require(
            _amount <= _indexToken.allowance(msg.sender, address(this)),
            "IndexFund: allowance not enough"
        );

        _indexToken.transferFrom(msg.sender, address(this), _amount);

        uint256 _ethExpectedForEach = ((_amount * getIndexPrice()) / 1e18) / components.length;
        _swapExactTokensForETH(
            msg.sender,
            _ethExpectedForEach,
            new uint256[](0),
            _amountsETHOutMin
        );
        _indexToken.burn(_amount);

        emit Sell(msg.sender, _amount);
    }

    function _swapExactTokensForETH(
        address _to,
        uint256 _ethOutSame,
        uint256[] memory _ethsOutDistinct,
        uint256[] calldata _amountsETHOutMin
    ) internal {
        require(_ethOutSame == 0 || _ethsOutDistinct.length == 0);

        address[] memory path = new address[](2);
        path[1] = weth;
        uint256 _amountETHOutMin;
        for (uint256 i = 0; i < components.length; i++) {
            path[0] = portfolio[components[i]];
            uint _ethOut =  _ethOutSame != 0 ? _ethOutSame : _ethsOutDistinct[i];

            if (_ethOut <= 0) { continue; }

            uint256 amountCpntToSell = IUniswapV2Router02(router).getAmountsIn(_ethOut, path)[0];
            uint256 currentBalance = IERC20Metadata(path[0]).balanceOf(address(this));
            if (amountCpntToSell > currentBalance) {
                amountCpntToSell = currentBalance;
            }

            if (_amountsETHOutMin.length > 0) {
                _amountETHOutMin = _amountsETHOutMin[i];
            }

            IERC20Metadata(path[0]).approve(router, amountCpntToSell);
            IUniswapV2Router02(router).swapExactTokensForETH(
                    amountCpntToSell,
                    _amountETHOutMin,
                    path,
                    _to,
                    block.timestamp + 10
            );
        }
    }

    /** -------------------------------------------------------------------------- */

    event Received(address indexed sender, uint amount);

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }
}