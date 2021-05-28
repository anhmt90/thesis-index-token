//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;


import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract IndexToken is ERC20, Ownable {

    constructor(uint256 initialSupply) ERC20("Index Token", "INXT") {
        _mint(msg.sender, initialSupply);
    }

    function mint(uint256 amount) onlyOwner external returns (bool) {
        address _owner = owner();
        _mint(_owner, amount);
        return true;
    }
}