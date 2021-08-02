//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Instance is ERC20, Ownable {

    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        _mint(msg.sender, 9000000000000000000000000);
    }

    function mint(address _to, uint256 _amount) onlyOwner external returns (bool) {
        _mint(_to, _amount);
        return true;
    }

}