//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract IndexToken is ERC20, Ownable {

    constructor() ERC20("Index Token", "INXT") {  }

    function mint(address _to, uint256 _amount) onlyOwner external returns (bool) {
        _mint(_to, _amount);
        return true;
    }
}