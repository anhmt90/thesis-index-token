//SPDX-License-Identifier: UNLICENSED
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

    function buy(uint256[] calldata _minPrices) external payable virtual;

    // function sell(uint256[] calldata _minPrices) external virtual;
}