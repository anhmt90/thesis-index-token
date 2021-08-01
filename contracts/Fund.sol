//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


abstract contract Fund {

    // uint256 constant MAX_UINT256 = 2**256 - 1;

    // instance of the ERC20 Index Token contract
    address public indexToken;

    // instance of the price Oracle contract
    address public oracle;

    // <token_name> is at <address>
    mapping(string => address) public portfolio;
    string[] public tokenNames;

    event Purchase(
        address indexed _buyer,
        uint256 _amount,
        uint256 _price
    );

    event Sale(
        address indexed _shareholder,
        uint256 _amount
    );

    event PortfolioChanged(
        string[] names,
        address[] addresses
    );

    event SwapForComponents(
        string[] tokens,
        uint256 amountEth,
        uint256[] amountsOut
    );

    event SwapForEth(
        string[] tokens,
        uint256 amountEach,
        uint256[] amountsEth
    );

    function buy(uint256[] calldata _amountsOutMin) external payable virtual;

    function sell(uint256 _amount, uint256[] calldata _amountsOutMin) external virtual;

    function announcePortfolioUpdating(string calldata _message) external virtual;

    function announcePortfolioRebalancing(string calldata _message) external virtual;

    function setOracle(address _oracle) external virtual;
}