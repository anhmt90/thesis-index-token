//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Instance is ERC20, Ownable {
    uint8 immutable public DECIMALS;

    constructor(string memory _name, string memory _symbol, uint8 _decimals) ERC20(_name, _symbol) {
        DECIMALS = _decimals;
        _mint(msg.sender, 9000000 * (10 ** _decimals));
    }

    function decimals() public view override returns (uint8) {
        return DECIMALS;
    }



}