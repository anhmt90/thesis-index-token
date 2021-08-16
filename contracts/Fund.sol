//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./DFAM.sol";

abstract contract Fund {

    // instance of the ERC20 Index Token contract
    address immutable public indexToken;

    // instance of the price Oracle contract
    address immutable public oracle;

    // <cpntToken_name> is at <cpntToken_address>
    mapping(string => address) public portfolio;
    string[] public components;

    constructor (address _oracle) {
        indexToken = address(new DFAM());
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
        string[]  _cpntsReplaced,
        string[] indexed _newPortfolio
    );

    event PortfolioRebalanced(
        address indexed _msgSender,
        uint256 indexed _time,
        uint256 _ethAverage
    );


    function buy(uint256[] calldata _amountsOutMin) external payable virtual;

    function sell(uint256 _amount, uint256[] calldata _amountsOutMin) external virtual;

    function announcePortfolioUpdating(string calldata _message) external virtual;

    function announcePortfolioRebalancing(string calldata _message) external virtual;

    function getComponentSymbols() external view returns (string[] memory) {
        return components;
    }

    function getAddressesInPortfolio()
        external
        view
        returns (address[] memory _addrs)
    {
        _addrs = new address[](components.length);
        for (uint256 i = 0; i < components.length; i++) {
            require(
                portfolio[components[i]] != address(0),
                "IndexFund : A token in portfolio has address 0"
            );
            _addrs[i] = portfolio[components[i]];
        }
    }
}