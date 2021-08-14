//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Instance is ERC20, Ownable {
    uint8 immutable private _DECIMALS;

    constructor(string memory _name, string memory _symbol, uint8 _decimals) ERC20(_name, _symbol) {
        _DECIMALS = _decimals;
        _mint(msg.sender, 9000000 * (10 ** _decimals));
    }
    
    /**
     * @dev minting 100^1e18 tokens to the caller on every call 
     */
    function mint() external returns (bool) {
        require(balanceOf(msg.sender) < 9000000 * (10 ** decimals()), "ER20Instance: cannot own more than 9 millions tokens");
        _mint(msg.sender, 100 * (10 ** _DECIMALS));
        return true;
    }
    
    function burn(uint256 _amount) external returns (bool) {
        _burn(msg.sender, _amount);
        return true;
    }

    function decimals() public view override returns (uint8) {
        return _DECIMALS;
    }
    
    



}