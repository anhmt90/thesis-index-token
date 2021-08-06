//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


abstract contract Fund {

    // uint256 constant MAX_UINT256 = 2**256 - 1;

    // instance of the ERC20 Index Token contract
    address immutable public indexToken;

    // instance of the price Oracle contract
    address immutable public oracle;

    // <componentToken_name> is at <componentToken_address>
    mapping(string => address) public portfolio;
    string[] public componentSymbols;

    constructor (address _indexToken, address _oracle) {
        indexToken = _indexToken;
        oracle = _oracle;
    }

    event Buy(
        address indexed _buyer,
        uint256 _amount,
        uint256 _price
    );

    event Sell(
        address indexed _shareholder,
        uint256 _amount
    );

    event PortfolioUpdated(
        address indexed _oracle,
        address indexed _txOrigin,
        string[]  _componentsReplaced,
        string[] indexed _newPortfolio
    );

    event PortfolioRebalanced(
        address indexed _msgSender,
        uint256 indexed _time,
        uint256 _ethAverage
    );


    event SwapForComponents(
        string[] _components,
        uint256 _amountEth,
        uint256[] _amountsOut
    );

    event SwapForEth(
        string[] _components,
        uint256 _amountEach,
        uint256[] _amountsEth
    );

    function buy(uint256[] calldata _amountsOutMin) external payable virtual;

    function sell(uint256 _amount, uint256[] calldata _amountsOutMin) external virtual;

    function announcePortfolioUpdating(string calldata _message) external virtual;

    function announcePortfolioRebalancing(string calldata _message) external virtual;

    function getComponentSymbols() external view returns (string[] memory) {
        return componentSymbols;
    }

    function getAddressesInPortfolio()
        external
        view
        returns (address[] memory _addrs)
    {
        _addrs = new address[](componentSymbols.length);
        for (uint256 i = 0; i < componentSymbols.length; i++) {
            require(
                portfolio[componentSymbols[i]] != address(0),
                "IndexFund : A token in portfolio has address 0"
            );
            _addrs[i] = portfolio[componentSymbols[i]];
        }
    }
}